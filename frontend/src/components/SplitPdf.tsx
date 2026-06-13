import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { zipSync, strToU8 } from 'fflate';
import DropZone from './DropZone';
import { validatePdfFile, validatePdfPageCount } from '../lib/fileLimits';

// ─── PDF.js worker setup ──────────────────────────────────────────────────────
// Use the bundled worker via a URL import so Vite serves it correctly
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// ─── Types ────────────────────────────────────────────────────────────────────
type ExportFormat = 'png' | 'jpeg' | 'pdf';
type DownloadMode = 'zip' | 'individual';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatSize(size: number) {
  return size >= 1024 * 1024
    ? `${(size / 1024 / 1024).toFixed(1)} MB`
    : `${(size / 1024).toFixed(1)} KB`;
}

function padNum(n: number, total: number) {
  return String(n).padStart(String(total).length, '0');
}

async function renderPageToBlob(
  pdf: PDFDocumentProxy,
  pageNum: number, // 1-indexed
  scale: number,
  format: 'png' | 'jpeg',
  quality: number,
): Promise<Blob> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      format === 'jpeg' ? 'image/jpeg' : 'image/png',
      format === 'jpeg' ? quality / 100 : undefined,
    );
  });
}

/** Extract a single page from a raw ArrayBuffer and return it as a PDF Blob. */
async function exportPageAsPdfBlob(srcBytes: ArrayBuffer, pageNum: number): Promise<Blob> {
  const src = await PDFDocument.load(srcBytes);
  const out = await PDFDocument.create();
  const [page] = await out.copyPages(src, [pageNum - 1]); // pdf-lib is 0-indexed
  out.addPage(page);
  const bytes = await out.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

async function renderThumbnail(pdf: PDFDocumentProxy, pageNum: number): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 0.3 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.7);
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PdfToImages() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [thumbsLoading, setThumbsLoading] = useState(false);

  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set()); // 1-indexed
  const [format, setFormat] = useState<ExportFormat>('png');
  const [quality, setQuality] = useState(90); // JPEG quality 1-100
  const [downloadMode, setDownloadMode] = useState<DownloadMode>('zip');
  const [scale, setScale] = useState(2); // render scale — 2× ≈ 150 DPI
  // Keep the raw bytes around so pdf-lib can extract pages without re-reading the file
  const [pdfBytes, setPdfBytes] = useState<ArrayBuffer | null>(null);

  const [isHovering, setIsHovering] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const prevDocRef = useRef<PDFDocumentProxy | null>(null);

  // Cleanup old document on unmount or new load
  useEffect(() => {
    return () => {
      prevDocRef.current?.destroy();
    };
  }, []);

  // ── File loading ────────────────────────────────────────────────────────────
  const loadFile = useCallback(async (fileList: FileList | File[]) => {
    const file = Array.from(fileList).find(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    );
    if (!file) {
      setMessage('Please select a PDF file.');
      return;
    }

    const sizeError = validatePdfFile(file);
    if (sizeError) {
      setMessage(sizeError);
      return;
    }

    try {
      prevDocRef.current?.destroy();
      const bytes = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
      prevDocRef.current = doc;
      setPdfFile(file);
      setPdfDoc(doc);
      setPdfBytes(bytes);
      const count = doc.numPages;
      const pageError = validatePdfPageCount(count);
      if (pageError) {
        doc.destroy();
        setMessage(pageError);
        return;
      }
      setTotalPages(count);
      setSelectedPages(new Set(Array.from({ length: count }, (_, i) => i + 1)));
      setThumbnails([]);
      setMessage('');
      setIsSuccess(false);
      setProgress(null);

      // Render thumbnails progressively
      setThumbsLoading(true);
      const thumbs: string[] = new Array(count).fill('');
      for (let p = 1; p <= count; p++) {
        thumbs[p - 1] = await renderThumbnail(doc, p);
        setThumbnails([...thumbs]);
      }
      setThumbsLoading(false);
    } catch {
      setMessage('Could not read the PDF. Make sure it is not password-protected.');
    }
  }, []);

  // ── Page selection helpers ──────────────────────────────────────────────────
  const togglePage = (pageNum: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNum)) next.delete(pageNum);
      else next.add(pageNum);
      return next;
    });
  };

  const selectAll = () =>
    setSelectedPages(new Set(Array.from({ length: totalPages }, (_, i) => i + 1)));
  const selectNone = () => setSelectedPages(new Set());
  const selectOdd = () =>
    setSelectedPages(new Set(Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 !== 0)));
  const selectEven = () =>
    setSelectedPages(new Set(Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0)));

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!pdfDoc || selectedPages.size === 0) return;

    const baseName = pdfFile!.name.replace(/\.pdf$/i, '');
    const pages = [...selectedPages].sort((a, b) => a - b);

    setProgress({ done: 0, total: pages.length });
    setMessage('');
    setIsSuccess(false);

    try {
      if (format === 'pdf') {
        // ── PDF export: one PDF per selected page ────────────────────────────
        if (!pdfBytes) throw new Error('Source PDF data not available.');

        if (downloadMode === 'zip') {
          const files: Record<string, Uint8Array> = {};
          for (let i = 0; i < pages.length; i++) {
            const blob = await exportPageAsPdfBlob(pdfBytes, pages[i]);
            const arr = new Uint8Array(await blob.arrayBuffer());
            files[`${baseName}_page-${padNum(pages[i], totalPages)}.pdf`] = arr;
            setProgress({ done: i + 1, total: pages.length });
            await new Promise((r) => setTimeout(r, 0));
          }
          files['_info.txt'] = strToU8(
            `Split from: ${pdfFile!.name}\nPages exported: ${pages.join(', ')}\n`,
          );
          const zipped = zipSync(files);
          const url = URL.createObjectURL(new Blob([zipped], { type: 'application/zip' }));
          triggerDownload(url, `${baseName}_pages.zip`);
          URL.revokeObjectURL(url);
        } else {
          for (let i = 0; i < pages.length; i++) {
            const blob = await exportPageAsPdfBlob(pdfBytes, pages[i]);
            const url = URL.createObjectURL(blob);
            triggerDownload(url, `${baseName}_page-${padNum(pages[i], totalPages)}.pdf`);
            URL.revokeObjectURL(url);
            setProgress({ done: i + 1, total: pages.length });
            await new Promise((r) => setTimeout(r, 80));
          }
        }

        setIsSuccess(true);
        setMessage(
          downloadMode === 'zip'
            ? `Exported ${pages.length} PDF${pages.length === 1 ? '' : 's'} as ${baseName}_pages.zip`
            : `Exported ${pages.length} individual PDF${pages.length === 1 ? '' : 's'}.`,
        );
      } else {
        // ── Image export (PNG / JPEG) ────────────────────────────────────────
        const ext = format === 'jpeg' ? 'jpg' : 'png';

        if (downloadMode === 'zip') {
          const files: Record<string, Uint8Array> = {};
          for (let i = 0; i < pages.length; i++) {
            const blob = await renderPageToBlob(pdfDoc, pages[i], scale, format, quality);
            const arr = new Uint8Array(await blob.arrayBuffer());
            files[`${baseName}_page-${padNum(pages[i], totalPages)}.${ext}`] = arr;
            setProgress({ done: i + 1, total: pages.length });
            await new Promise((r) => setTimeout(r, 0));
          }
          files['_info.txt'] = strToU8(
            `Exported from: ${pdfFile!.name}\nPages: ${pages.join(', ')}\nFormat: ${ext.toUpperCase()}\n`,
          );
          const zipped = zipSync(files);
          const url = URL.createObjectURL(new Blob([zipped], { type: 'application/zip' }));
          triggerDownload(url, `${baseName}_images.zip`);
          URL.revokeObjectURL(url);
        } else {
          for (let i = 0; i < pages.length; i++) {
            const blob = await renderPageToBlob(pdfDoc, pages[i], scale, format, quality);
            const url = URL.createObjectURL(blob);
            triggerDownload(url, `${baseName}_page-${padNum(pages[i], totalPages)}.${ext}`);
            URL.revokeObjectURL(url);
            setProgress({ done: i + 1, total: pages.length });
            await new Promise((r) => setTimeout(r, 80));
          }
        }

        setIsSuccess(true);
        setMessage(
          downloadMode === 'zip'
            ? `Exported ${pages.length} page${pages.length === 1 ? '' : 's'} as ${baseName}_images.zip`
            : `Exported ${pages.length} image${pages.length === 1 ? '' : 's'}.`,
        );
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Export failed.');
      setIsSuccess(false);
    } finally {
      setTimeout(() => setProgress(null), 1400);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const progressPct =
    progress !== null ? Math.round((progress.done / progress.total) * 100) : null;
  const canExport = pdfDoc !== null && selectedPages.size > 0 && progress === null;
  const isPdf = format === 'pdf';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="tool-panel">
      {/* ── Intro ── */}
      {!pdfFile && (
        <div className="export-intro">
          <p className="export-intro-title">Export PDF pages</p>
          <p className="export-intro-body">
            Drop any PDF below to pick individual pages and export them as
            high-resolution <strong>PNG</strong> or <strong>JPEG</strong> images,
            or extract them as separate <strong>PDF files</strong>.
            Everything happens locally — nothing leaves your device.
          </p>
          <div className="export-intro-pills">
            <span>🖼 PNG / JPEG images</span>
            <span>📄 Individual PDFs</span>
            <span>🗜 ZIP or one-by-one</span>
            <span>🔒 100% offline</span>
          </div>
        </div>
      )}

      <DropZone
        eyebrow="pdf source"
        icon="PDF"
        text={pdfFile ? pdfFile.name : 'Click or drag & drop a PDF here'}
        subtext={
          pdfFile
            ? `${totalPages} page${totalPages === 1 ? '' : 's'} · ${formatSize(pdfFile.size)}`
            : 'One file at a time'
        }
        inputRef={inputRef}
        accept="application/pdf,.pdf"
        onFilesDropped={loadFile}
        onFilesSelected={loadFile}
        isHovering={isHovering}
        onDragStateChange={setIsHovering}
      />

      {pdfDoc && (
        <>
          {/* ── Page grid ── */}
          <div className="split-select-panel">
            <div className="split-quick-actions">
              <button className="split-quick-btn" onClick={selectAll}>All</button>
              <button className="split-quick-btn" onClick={selectNone}>None</button>
              <button className="split-quick-btn" onClick={selectOdd}>Odd</button>
              <button className="split-quick-btn" onClick={selectEven}>Even</button>
              <span className="split-selection-badge">
                {selectedPages.size} / {totalPages} selected
              </span>
            </div>

            <div className="split-page-grid">
              {Array.from({ length: totalPages }, (_, i) => {
                const pageNum = i + 1;
                const thumb = thumbnails[i];
                const selected = selectedPages.has(pageNum);
                return (
                  <button
                    key={pageNum}
                    id={`pdf-page-${pageNum}`}
                    className={`split-page-thumb ${selected ? 'selected' : ''} ${thumb ? 'has-thumb' : ''}`}
                    onClick={() => togglePage(pageNum)}
                    aria-label={`Page ${pageNum}${selected ? ', selected' : ''}`}
                    aria-pressed={selected}
                  >
                    {thumb ? (
                      <img src={thumb} alt={`Page ${pageNum}`} className="split-thumb-img" />
                    ) : (
                      <span className="split-thumb-skeleton" aria-hidden="true" />
                    )}
                    <span className="split-page-label">
                      <span className="split-page-num">{pageNum}</span>
                      {selected && <span className="split-check" aria-hidden="true">✓</span>}
                    </span>
                  </button>
                );
              })}
            </div>

            {thumbsLoading && (
              <p className="split-thumbs-loading">Rendering page previews…</p>
            )}
          </div>

          {/* ── Export settings ── */}
          <div className="export-settings">
            {/* Format */}
            <div className="export-setting-group">
              <label className="export-setting-label">Export as</label>
              <div className="export-format-toggle">
                <button
                  id="format-png"
                  className={`export-format-btn ${format === 'png' ? 'active' : ''}`}
                  onClick={() => setFormat('png')}
                >
                  PNG
                </button>
                <button
                  id="format-jpeg"
                  className={`export-format-btn ${format === 'jpeg' ? 'active' : ''}`}
                  onClick={() => setFormat('jpeg')}
                >
                  JPEG
                </button>
                <button
                  id="format-pdf"
                  className={`export-format-btn ${isPdf ? 'active' : ''}`}
                  onClick={() => setFormat('pdf')}
                >
                  PDF
                </button>
              </div>
            </div>

            {/* JPEG quality — images only */}
            {format === 'jpeg' && (
              <div className="export-setting-group">
                <label className="export-setting-label" htmlFor="jpeg-quality">
                  Quality — {quality}%
                </label>
                <input
                  id="jpeg-quality"
                  className="export-quality-slider"
                  type="range"
                  min={20}
                  max={100}
                  step={5}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                />
              </div>
            )}

            {/* Resolution — images only */}
            {!isPdf && (
              <div className="export-setting-group">
                <label className="export-setting-label" htmlFor="export-scale">
                  Resolution — {scale}× ({Math.round(scale * 72)} DPI)
                </label>
                <input
                  id="export-scale"
                  className="export-quality-slider"
                  type="range"
                  min={1}
                  max={4}
                  step={0.5}
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                />
              </div>
            )}

            {/* Download mode */}
            <div className="export-setting-group">
              <label className="export-setting-label">Download as</label>
              <div className="export-format-toggle">
                <button
                  id="download-zip"
                  className={`export-format-btn ${downloadMode === 'zip' ? 'active' : ''}`}
                  onClick={() => setDownloadMode('zip')}
                >
                  ZIP archive
                </button>
                <button
                  id="download-individual"
                  className={`export-format-btn ${downloadMode === 'individual' ? 'active' : ''}`}
                  onClick={() => setDownloadMode('individual')}
                >
                  Individual files
                </button>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="controls">
            <button
              className="secondary-action"
              onClick={() => {
                pdfDoc.destroy();
                setPdfFile(null);
                setPdfDoc(null);
                setTotalPages(0);
                setThumbnails([]);
                setSelectedPages(new Set());
                setMessage('');
                setIsSuccess(false);
                setProgress(null);
              }}
            >
              Clear
            </button>
            <button
              id="export-images-btn"
              className="primary-action"
              disabled={!canExport}
              onClick={handleExport}
            >
              {isPdf
                ? `Export ${selectedPages.size || ''} PDF${selectedPages.size === 1 ? '' : 's'}${downloadMode === 'zip' ? ' as ZIP' : ''}`
                : `Export ${selectedPages.size || ''} image${selectedPages.size === 1 ? '' : 's'}${downloadMode === 'zip' ? ' as ZIP' : ''}`
              }
            </button>
          </div>

          {/* Progress */}
          {progressPct !== null && (
            <div className="progress-container" aria-label="Export progress">
              <div className="progress-label">{progressPct}%</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          )}
        </>
      )}

      {message && (
        <p className={`helper-message ${isSuccess ? 'helper-message--success' : ''}`}>
          {isSuccess && <span className="helper-tick" aria-hidden="true">✓ </span>}
          {message}
        </p>
      )}
    </div>
  );
}
