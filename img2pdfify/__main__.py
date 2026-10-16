import argparse
import getpass
import sys
from pathlib import Path
from typing import List, Optional

from tqdm import tqdm

from . import core
from .core import PdfifyError

COMMANDS = ("images", "merge", "split", "lock", "unlock")


def _path(value: str) -> Path:
    return Path(value).expanduser()


def _bar(desc: str):
    """Return (progress_callback, close) backed by a tqdm bar."""
    bar = tqdm(desc=desc, unit="item")

    def update(done: int, total: int) -> None:
        bar.total = total
        bar.n = done
        bar.refresh()

    return update, bar.close


def _check_output(path: Path, overwrite: bool, suffix: str = ".pdf") -> None:
    if path.suffix.lower() != suffix:
        raise PdfifyError(f"Output path must end in {suffix}")
    if path.exists() and not overwrite:
        raise PdfifyError(f"{path} already exists. Use --overwrite to replace it.")
    path.parent.mkdir(parents=True, exist_ok=True)


def _password(args, confirm: bool = False, required: bool = False) -> Optional[str]:
    if args.password is not None:
        return args.password
    if not required or not sys.stdin.isatty():
        return None
    first = getpass.getpass("Password: ")
    if confirm and getpass.getpass("Confirm password: ") != first:
        raise PdfifyError("Passwords do not match.")
    return first


def cmd_images(args) -> None:
    _check_output(args.output, args.overwrite)
    images = core.find_images(args.input, args.recursive)
    if not images:
        raise PdfifyError(f"No images found in {args.input}")
    update, close = _bar("Building PDF")
    try:
        count = core.images_to_pdf(images, args.output, update)
    finally:
        close()
    print(f"✅ Created {args.output} from {count} image{'s' if count != 1 else ''}")


def cmd_merge(args) -> None:
    _check_output(args.output, args.overwrite)
    update, close = _bar("Merging")
    try:
        pages = core.merge_pdfs(args.inputs, args.output, update)
    finally:
        close()
    print(f"✅ Merged {len(args.inputs)} PDFs ({pages} pages) into {args.output}")


def cmd_split(args) -> None:
    reader = core.open_pdf(args.input, args.password)
    pages = core.parse_pages(args.pages, len(reader.pages))
    if args.format == "pdf" and args.scale != 2.0:
        print("Note: --scale only applies to PNG/JPEG export.", file=sys.stderr)
    out_dir = args.output or args.input.with_name(args.input.stem + "_pages")
    probe = out_dir if args.zip and out_dir.suffix.lower() == ".zip" else None
    if probe is not None and probe.exists() and not args.overwrite:
        raise PdfifyError(f"{probe} already exists. Use --overwrite to replace it.")
    update, close = _bar("Exporting pages")
    try:
        result = core.split_pdf(
            args.input, out_dir, pages, args.format, args.scale, args.quality,
            args.zip, args.password, update,
        )
    finally:
        close()
    label = "ZIP" if args.zip else "folder"
    print(f"✅ Exported {len(pages)} page{'s' if len(pages) != 1 else ''} to {label} {result}")


def cmd_lock(args) -> None:
    _check_output(args.output, args.overwrite)
    password = _password(args, confirm=True, required=True)
    if not password:
        raise PdfifyError("A password is required. Pass --password or run in a terminal.")
    pages = core.lock_pdf(args.input, args.output, password)
    print(f"🔒 Locked {pages} pages into {args.output}")


def cmd_unlock(args) -> None:
    _check_output(args.output, args.overwrite)
    password = args.password
    try:
        pages = core.unlock_pdf(args.input, args.output, password)
    except PdfifyError:
        if password is not None or not sys.stdin.isatty():
            raise
        pages = core.unlock_pdf(args.input, args.output, getpass.getpass("Password: "))
    print(f"🔓 Unlocked {pages} pages into {args.output}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="img2pdfify",
        description="Convert images to PDF, merge, split, lock and unlock PDFs.",
        epilog="Running `img2pdfify <input> <output.pdf>` is shorthand for `img2pdfify images ...`.",
    )
    sub = parser.add_subparsers(dest="command", metavar="{%s}" % ",".join(COMMANDS))

    def common(p, overwrite=True):
        if overwrite:
            p.add_argument("--overwrite", action="store_true", help="Replace the output if it exists")

    p = sub.add_parser("images", help="Combine images into one PDF (one image per page)")
    p.add_argument("input", type=_path, help="Image file or folder of images")
    p.add_argument("output", type=_path, help="Output PDF (.pdf)")
    p.add_argument("--recursive", action="store_true", help="Search folders recursively")
    common(p)
    p.set_defaults(func=cmd_images)

    p = sub.add_parser("merge", help="Merge PDFs, in the order given, into one")
    p.add_argument("inputs", type=_path, nargs="+", help="PDFs to merge (at least two)")
    p.add_argument("-o", "--output", type=_path, required=True, help="Output PDF (.pdf)")
    common(p)
    p.set_defaults(func=cmd_merge)

    p = sub.add_parser("split", help="Export pages as PNG/JPEG images or separate PDFs")
    p.add_argument("input", type=_path, help="Source PDF")
    p.add_argument("-o", "--output", type=_path, help="Output folder (or .zip path with --zip)")
    p.add_argument("--pages", default="all", help="Pages to export: 'all', 'odd', 'even' or ranges like 1,3-5,8- (default: all)")
    p.add_argument("--format", choices=("png", "jpeg", "pdf"), default="png", help="Export format (default: png)")
    p.add_argument("--scale", type=float, default=2.0, help="Render scale for images, 1-4 (2 = 144 DPI; default: 2)")
    p.add_argument("--quality", type=int, default=92, help="JPEG quality, 20-100 (default: 92)")
    p.add_argument("--zip", action="store_true", help="Write one ZIP archive instead of individual files")
    p.add_argument("--password", help="Password, if the PDF is protected")
    common(p)
    p.set_defaults(func=cmd_split)

    p = sub.add_parser("lock", help="Protect a PDF with a password (AES-256)")
    p.add_argument("input", type=_path)
    p.add_argument("output", type=_path)
    p.add_argument("--password", help="Password (prompted if omitted)")
    common(p)
    p.set_defaults(func=cmd_lock)

    p = sub.add_parser("unlock", help="Remove password protection from a PDF")
    p.add_argument("input", type=_path)
    p.add_argument("output", type=_path)
    p.add_argument("--password", help="Password (prompted if needed)")
    common(p)
    p.set_defaults(func=cmd_unlock)

    return parser


def main(argv: Optional[List[str]] = None) -> None:
    argv = list(sys.argv[1:] if argv is None else argv)
    # Backwards compatibility: `img2pdfify <input> <output.pdf>` means `images`.
    if argv and argv[0] not in COMMANDS and not argv[0].startswith("-"):
        argv.insert(0, "images")

    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "func", None):
        parser.print_help()
        sys.exit(2)

    if args.command == "split":
        if not 1 <= args.scale <= 4:
            parser.error("--scale must be between 1 and 4")
        if not 20 <= args.quality <= 100:
            parser.error("--quality must be between 20 and 100")

    try:
        args.func(args)
    except PdfifyError as exc:
        print(f"❌ {exc}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":
    main()
