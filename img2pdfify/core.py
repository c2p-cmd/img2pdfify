"""PDF operations shared by the CLI subcommands (mirrors the web app's tools)."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path
from typing import Callable, Iterable, List, Optional, Sequence

from PIL import Image, ImageOps
from pypdf import PdfReader, PdfWriter
from pypdf.errors import FileNotDecryptedError, PdfReadError

IMAGE_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff")

ProgressFn = Optional[Callable[[int, int], None]]


class PdfifyError(Exception):
    """A problem the user can fix; the CLI prints it without a traceback."""


# ── Images → PDF ──────────────────────────────────────────────────────────────


def find_images(input_path: Path, recursive: bool = False) -> List[Path]:
    if input_path.is_dir():
        walker = input_path.rglob("*") if recursive else input_path.glob("*")
        return sorted(
            p for p in walker if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES
        )
    if input_path.is_file() and input_path.suffix.lower() in IMAGE_SUFFIXES:
        return [input_path]
    raise PdfifyError(
        f"Invalid input path: {input_path}. Must be a folder or an image file."
    )


def _open_rgb(path: Path) -> Image.Image:
    image = ImageOps.exif_transpose(Image.open(path))
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        flat = Image.new("RGB", rgba.size, "white")
        flat.paste(rgba, mask=rgba.getchannel("A"))
        return flat
    return image.convert("RGB")


def images_to_pdf(images: Sequence[Path], output: Path, progress: ProgressFn = None) -> int:
    if not images:
        raise PdfifyError("No images to convert.")
    pages = []
    for i, path in enumerate(images, start=1):
        try:
            pages.append(_open_rgb(path))
        except Exception as exc:  # unreadable or corrupt image
            raise PdfifyError(f"Could not read image {path}: {exc}") from exc
        if progress:
            progress(i, len(images))
    # resolution=72 makes each page exactly as many points as the image has pixels.
    pages[0].save(output, "PDF", save_all=True, append_images=pages[1:], resolution=72.0)
    return len(pages)


# ── PDF helpers ───────────────────────────────────────────────────────────────


def open_pdf(path: Path, password: Optional[str] = None) -> PdfReader:
    if not path.is_file():
        raise PdfifyError(f"File not found: {path}")
    try:
        reader = PdfReader(str(path))
    except PdfReadError as exc:
        raise PdfifyError(f"{path} is not a readable PDF: {exc}") from exc
    if reader.is_encrypted:
        if reader.decrypt(password or "") == 0:
            if password:
                raise PdfifyError(f"Wrong password for {path}.")
            raise PdfifyError(f"{path} is password-protected. Pass --password.")
    return reader


def parse_pages(spec: str, page_count: int) -> List[int]:
    """Turn '1,3-5,8-' / 'odd' / 'even' / 'all' into sorted 1-based page numbers."""
    spec = spec.strip().lower()
    if spec in ("", "all"):
        return list(range(1, page_count + 1))
    if spec == "odd":
        return list(range(1, page_count + 1, 2))
    if spec == "even":
        return list(range(2, page_count + 1, 2))
    chosen = set()
    for part in spec.split(","):
        part = part.strip()
        try:
            if "-" in part:
                start_s, end_s = part.split("-", 1)
                start = int(start_s) if start_s else 1
                end = int(end_s) if end_s else page_count
            else:
                start = end = int(part)
        except ValueError:
            raise PdfifyError(f"Invalid page range: '{part}'.") from None
        if start < 1 or end > page_count or start > end:
            raise PdfifyError(
                f"Page range '{part}' is outside 1-{page_count}."
            )
        chosen.update(range(start, end + 1))
    return sorted(chosen)


# ── Merge ─────────────────────────────────────────────────────────────────────


def merge_pdfs(inputs: Sequence[Path], output: Path, progress: ProgressFn = None) -> int:
    if len(inputs) < 2:
        raise PdfifyError("Provide at least two PDFs to merge.")
    writer = PdfWriter()
    for i, path in enumerate(inputs, start=1):
        writer.append(open_pdf(path))
        if progress:
            progress(i, len(inputs))
    with open(output, "wb") as fh:
        writer.write(fh)
    return len(writer.pages)


# ── Split / export pages ──────────────────────────────────────────────────────


def _render_page(pdf, index: int, scale: float, fmt: str, quality: int) -> bytes:
    image = pdf[index].render(scale=scale).to_pil().convert("RGB")
    buf = io.BytesIO()
    if fmt == "jpeg":
        image.save(buf, "JPEG", quality=quality)
    else:
        image.save(buf, "PNG")
    return buf.getvalue()


def split_pdf(
    source: Path,
    out_dir: Path,
    pages: Sequence[int],
    fmt: str = "png",
    scale: float = 2.0,
    quality: int = 92,
    as_zip: bool = False,
    password: Optional[str] = None,
    progress: ProgressFn = None,
) -> Path:
    """Export the chosen pages as PNG/JPEG images or single-page PDFs.

    Returns the output path (the ZIP file, or the directory of individual files).
    """
    if not pages:
        raise PdfifyError("No pages selected.")
    reader = open_pdf(source, password)
    stem = source.stem
    width = len(str(len(reader.pages)))
    ext = {"png": "png", "jpeg": "jpg", "pdf": "pdf"}[fmt]

    pdfium = None
    if fmt != "pdf":
        import pypdfium2

        # pdfium needs an unencrypted file; decrypt through pypdf first.
        data = io.BytesIO()
        clone = PdfWriter(clone_from=reader)
        clone.write(data)
        pdfium = pypdfium2.PdfDocument(data.getvalue())

    entries = []
    for n, page_no in enumerate(pages, start=1):
        name = f"{stem}_page_{str(page_no).zfill(width)}.{ext}"
        if fmt == "pdf":
            writer = PdfWriter()
            writer.add_page(reader.pages[page_no - 1])
            buf = io.BytesIO()
            writer.write(buf)
            payload = buf.getvalue()
        else:
            payload = _render_page(pdfium, page_no - 1, scale, fmt, quality)
        entries.append((name, payload))
        if progress:
            progress(n, len(pages))

    if as_zip:
        target = out_dir if out_dir.suffix.lower() == ".zip" else out_dir / f"{stem}_{'pages' if fmt == 'pdf' else 'images'}.zip"
        target.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zf:
            for name, payload in entries:
                zf.writestr(name, payload)
        return target

    out_dir.mkdir(parents=True, exist_ok=True)
    for name, payload in entries:
        (out_dir / name).write_bytes(payload)
    return out_dir


# ── Lock / unlock ─────────────────────────────────────────────────────────────


def lock_pdf(source: Path, output: Path, password: str) -> int:
    if not password:
        raise PdfifyError("A password is required to lock a PDF.")
    reader = open_pdf(source)  # an already-locked file must be unlocked first
    writer = PdfWriter(clone_from=reader)
    writer.encrypt(password, algorithm="AES-256")
    with open(output, "wb") as fh:
        writer.write(fh)
    return len(writer.pages)


def unlock_pdf(source: Path, output: Path, password: Optional[str] = None) -> int:
    reader = open_pdf(source, password)
    writer = PdfWriter(clone_from=reader)
    with open(output, "wb") as fh:
        writer.write(fh)
    return len(writer.pages)
