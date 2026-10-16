# 🖼️ img2pdfify

A simple command-line tool to convert images (PNG, JPG, JPEG) into a single PDF file. Each image gets its own page in the output PDF.

## 🌐 Web App

Don't want to install anything? A browser-based version with more tools (merge, split, lock/unlock) is available here:

**→ [c2p-cmd.github.io/img2pdfify](https://c2p-cmd.github.io/img2pdfify/)**

---

## 🚀 Features

The command line now matches the web app's tools:

- 🖼️ **images** – combine images (PNG, JPG, WebP, GIF, BMP, TIFF) into one PDF, one per page. Accepts a file or a folder, optionally recursive.
- 📎 **merge** – join PDFs in the order you list them.
- ✂️ **split** – export chosen pages as PNG, JPEG or single-page PDFs, as loose files or one ZIP. Pick pages (`1,3-5`, `odd`, `even`), render scale and JPEG quality.
- 🔒 **lock** / 🔓 **unlock** – add or remove a password. Unlike the web app, the CLI uses real AES-256 encryption and keeps text selectable.

---

## 📦 Installation (from PyPi)

```bash
pip install img2pdfify
```

## 📦 Installation (from source)

### 1. Clone the repo

```bash
git clone https://github.com/c2p-cmd/img2pdfify.git
cd img2pdfify
```

### 2. Install locally

```bash
pip install -e .
```

---

## 🧪 Usage

```bash
img2pdfify images  <input> <output.pdf> [--recursive] [--overwrite]
img2pdfify merge   a.pdf b.pdf ... -o merged.pdf [--overwrite]
img2pdfify split   <input.pdf> [-o DIR|file.zip] [--pages SPEC] [--format png|jpeg|pdf]
                   [--scale 1-4] [--quality 20-100] [--zip] [--password PW]
img2pdfify lock    <input.pdf> <output.pdf> [--password PW]
img2pdfify unlock  <input.pdf> <output.pdf> [--password PW]
```

`img2pdfify <input> <output.pdf>` still works and is shorthand for `images`.
If you leave out `--password`, `lock` and `unlock` prompt for it in a terminal.

---

## 📌 Examples

```bash
# Folder of scans (recursively) to one PDF
img2pdfify images ./scans out.pdf --recursive

# Merge three PDFs in order
img2pdfify merge cover.pdf body.pdf appendix.pdf -o book.pdf

# Pages 1, 3 to 5 and 8 onward as JPEGs in a ZIP
img2pdfify split book.pdf --pages 1,3-5,8- --format jpeg --quality 80 --zip

# Even pages as separate one-page PDFs
img2pdfify split book.pdf --pages even --format pdf -o even_pages

# Protect and unprotect
img2pdfify lock book.pdf book-locked.pdf --password hunter2
img2pdfify unlock book-locked.pdf book.pdf
```

---

## 🧰 Dependencies

- Python 3.9+
- [Pillow](https://python-pillow.org), [pypdf](https://pypdf.readthedocs.io), [pypdfium2](https://github.com/pypdfium2-team/pypdfium2), tqdm

```bash
pip install -r requirements.txt
```

---

## 🙌 Contributing

Open an issue or PR — happy to accept contributions or improvements!

---

## Future Improvements 📈

-	**Parallel processing:** Enhance performance by processing images in parallel. This would speed up the conversion process, especially for large numbers of images.
-	**Support for more image formats:** While the tool currently supports .png, .jpg, and .jpeg, future versions could support additional formats like .webp, .bmp, .gif, etc.
-	**Progressive saving: Currently, images are all saved at once. A potential improvement could involve saving images progressively (one by one), allowing better tracking of individual pages. While this would reduce memory consumption, it may come at the cost of performance, so this could be optional.
-	**Image resizing:** While the current version preserves the original resolution, adding an option to resize images for faster processing (especially for larger files) could be useful for users looking for quicker results or for those working with resource-constrained systems.
-	**Error handling:** Improving error handling to provide more user-friendly messages (e.g., invalid file formats, issues with reading images, etc.).
-	**GUI (Graphical User Interface):** A future graphical version of the tool could allow users to drag-and-drop images or folders and specify output paths interactively.
