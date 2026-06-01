# PDFify

> Fast, private PDF tools that run entirely in your browser — no uploads, no servers.

**🔗 Live App → [c2p-cmd.github.io/img2pdfify](https://c2p-cmd.github.io/img2pdfify/)**

## Features

| Tool | Description |
|---|---|
| **Images to PDF** | Convert JPG, PNG, WebP images into a PDF |
| **Merge PDFs** | Combine multiple PDF files into one |
| **Split PDF** | Extract pages or split a PDF into separate files |
| **Lock / Unlock** | Password-protect or remove protection from PDFs |

Everything happens client-side. Your files never leave your device.

## Tech Stack

- **React 18** + **TypeScript** — UI
- **Vite** — bundler with lazy-loaded routes for fast initial load
- **jsPDF**, **pdf-lib**, **pdfjs-dist** — PDF processing
- **vite-plugin-pwa** — PWA / offline support
- **Bun** — package manager & scripts

## Getting Started

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build for production and preview
bun run build; bun run preview
```

## License

[MIT](LICENSE)
