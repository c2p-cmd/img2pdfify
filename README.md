# 🖼️ img2pdfify

A simple command-line tool to convert images (PNG, JPG, JPEG) into a single PDF file. Each image gets its own page in the output PDF.

---

## 🚀 Features

- 📂 Accepts either a single image or a folder of images.
- 🔁 Recursive folder search (explicit `true` or `false`).
- ✍️ Option to overwrite output PDF (explicit `true` or `false`).
- 🔒 Strict CLI usage — you must specify all options clearly.
- 🧠 Uses Pillow for reliable image handling.

---

## 📦 Installation

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
img2pdfify <input_path> <output_file.pdf> --recursive true|false --overwrite true|false
```

---

## 📌 Examples

Convert images from a folder (non-recursive, no overwrite):

```bash
img2pdfify ./images myoutput.pdf --recursive false --overwrite false
```

Convert a single image and allow overwriting the output:

```bash
img2pdfify image.jpg output.pdf --recursive false --overwrite true
```

---

## 🧰 Dependencies

- Python 3.7+
- [Pillow](https://python-pillow.org)

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
