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
git clone https://github.com/yourusername/img2pdfify.git
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