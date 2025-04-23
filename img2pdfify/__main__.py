import argparse
from pathlib import Path
from PIL import Image
from tqdm import tqdm
import sys


def str2bool(v: str) -> bool:
    if v.lower() == "true":
        return True
    elif v.lower() == "false":
        return False
    else:
        raise argparse.ArgumentTypeError("Expected true or false")


def find_images(input_path: Path, recursive: bool):
    patterns = ["*.png", "*.jpg", "*.jpeg"]
    images = []

    if input_path.is_dir():
        print(f"Searching for images in directory: {input_path}")
        if recursive:
            print("Recursively searching for images...")
        else:
            print("Searching for images in the top-level directory only.")
        for pattern in patterns:
            searcher = input_path.rglob if recursive else input_path.glob
            images += sorted(searcher(pattern))
    elif input_path.is_file() and input_path.suffix.lower() in (
        ".png",
        ".jpg",
        ".jpeg",
    ):
        images = [input_path]
    else:
        print(
            f"❌ Invalid input path: {input_path}. Must be a directory or a valid image file."
        )
        return []

    return images


def convert_images_to_pdf(
    input_path: Path, output_path: Path, recursive: bool, overwrite: bool
):
    if not output_path.suffix.lower() == ".pdf":
        print("❌ Output path must be a PDF filename ending in .pdf")
        sys.exit(1)

    if output_path.exists() and not overwrite:
        print("❌ Output file exists. Use --overwrite true to replace it.")
        sys.exit(1)

    images = find_images(input_path, recursive)

    if not images:
        print(f"❌ No valid images found to convert in path: {input_path}")
        sys.exit(1)

    try:
        image_list = [
            Image.open(img).convert("RGB")
            for img in tqdm(images, desc="Converting images 📷")
        ]
        image_list[0].save(
            output_path,
            save_all=True,
            append_images=tqdm(image_list[1:], desc="Saving images to PDF 📄"),
        )
        print(f"✅ Saved PDF to {output_path}")
    except Exception as e:
        print(f"❌ Error during conversion: {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Convert images to a PDF")
    parser.add_argument(
        "--input",
        type=lambda p: Path(p).expanduser(),
        help="Image file or folder containing images",
    )
    parser.add_argument(
        "--output",
        type=lambda p: Path(p).expanduser(),
        help="Output PDF filename (must end with .pdf)",
    )
    parser.add_argument(
        "--recursive",
        type=str2bool,
        required=True,
        help="Recursively search for images: true or false",
    )
    parser.add_argument(
        "--overwrite",
        type=str2bool,
        required=True,
        help="Overwrite the output PDF if it exists: true or false",
    )

    args = parser.parse_args()

    convert_images_to_pdf(args.input, args.output, args.recursive, args.overwrite)


if __name__ == "__main__":
    main()
