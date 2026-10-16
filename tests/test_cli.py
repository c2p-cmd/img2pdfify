import zipfile

import pytest
from PIL import Image
from pypdf import PdfReader

from img2pdfify.__main__ import main


def run(*argv):
    with pytest.raises(SystemExit) as exc:
        main([str(a) for a in argv])
    return exc.value.code


def ok(*argv):
    main([str(a) for a in argv])


@pytest.fixture
def images(tmp_path):
    d = tmp_path / "imgs"
    d.mkdir()
    for i, color in enumerate(["red", "green", "blue"]):
        Image.new("RGB", (200 + i, 100), color).save(d / f"{i}.png")
    Image.new("RGBA", (50, 50), (0, 0, 0, 0)).save(d / "3.webp")
    return d


@pytest.fixture
def pdf(tmp_path, images):
    out = tmp_path / "src.pdf"
    ok("images", images, out)
    return out


def test_images_page_size_matches_pixels(pdf):
    pages = PdfReader(str(pdf)).pages
    assert len(pages) == 4
    assert (float(pages[0].mediabox.width), float(pages[0].mediabox.height)) == (200, 100)


def test_legacy_invocation(tmp_path, images):
    out = tmp_path / "legacy.pdf"
    ok(images, out)
    assert len(PdfReader(str(out)).pages) == 4


def test_overwrite_guard(pdf, images):
    assert run("images", images, pdf) == 1
    ok("images", images, pdf, "--overwrite")


def test_merge(tmp_path, pdf):
    out = tmp_path / "m.pdf"
    ok("merge", pdf, pdf, "-o", out)
    assert len(PdfReader(str(out)).pages) == 8
    assert run("merge", pdf, "-o", tmp_path / "x.pdf") == 1


def test_split_formats(tmp_path, pdf):
    ok("split", pdf, "-o", tmp_path / "png", "--pages", "1,3-")
    assert sorted(p.name for p in (tmp_path / "png").iterdir()) == [
        "src_page_1.png", "src_page_3.png", "src_page_4.png"]
    ok("split", pdf, "-o", tmp_path / "pdfs", "--format", "pdf", "--pages", "even")
    assert len(list((tmp_path / "pdfs").glob("*.pdf"))) == 2
    z = tmp_path / "out.zip"
    ok("split", pdf, "-o", z, "--zip", "--format", "jpeg", "--quality", "50", "--scale", "1")
    assert len(zipfile.ZipFile(z).namelist()) == 4
    assert run("split", pdf, "--pages", "9") == 1


def test_lock_unlock_roundtrip(tmp_path, pdf):
    locked, opened = tmp_path / "l.pdf", tmp_path / "u.pdf"
    ok("lock", pdf, locked, "--password", "pw")
    assert PdfReader(str(locked)).is_encrypted
    assert run("unlock", locked, opened, "--password", "bad") == 1
    ok("unlock", locked, opened, "--password", "pw")
    assert not PdfReader(str(opened)).is_encrypted
    # split works on a locked file given the password
    ok("split", locked, "-o", tmp_path / "s", "--password", "pw", "--pages", "1")
    assert len(list((tmp_path / "s").iterdir())) == 1
