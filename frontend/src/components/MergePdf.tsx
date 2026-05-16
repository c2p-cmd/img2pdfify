import { useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import DropZone from './DropZone';

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

async function downloadBlob(blob: Blob, filename: string) {
  const pickerWindow = window as SavePickerWindow;

  if (pickerWindow.showSaveFilePicker) {
    const handle = await pickerWindow.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: 'PDF Document',
          accept: { 'application/pdf': ['.pdf'] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function formatSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(size / 1024).toFixed(1)} KB`;
}

export default function MergePdf() {
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [isHovering, setIsHovering] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handlePdfFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList).filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );

    if (incoming.length === 0) {
      setMessage('No PDF files found in the selection.');
      return;
    }

    setPdfFiles((prev) => {
      const existing = new Set(prev.map((file) => `${file.name}-${file.size}`));
      const unique = incoming.filter((file) => !existing.has(`${file.name}-${file.size}`));
      return [...prev, ...unique];
    });
    setMessage('');
  };

  const removePdf = (index: number) => {
    setPdfFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const mergePDFs = async () => {
    if (pdfFiles.length < 2) {
      setMessage('Please add at least 2 PDF files to merge.');
      return;
    }

    setProgress(0);
    setMessage('Merging PDFs...');

    try {
      const mergedPdf = await PDFDocument.create();

      for (let i = 0; i < pdfFiles.length; i += 1) {
        const file = pdfFiles[i];
        const pdf = await PDFDocument.load(await file.arrayBuffer());
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach((page) => mergedPdf.addPage(page));

        setProgress(Math.round(((i + 1) / pdfFiles.length) * 100));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const mergedBytes = await mergedPdf.save();
      const mergedBuffer = new ArrayBuffer(mergedBytes.byteLength);
      new Uint8Array(mergedBuffer).set(mergedBytes);
      await downloadBlob(
        new Blob([mergedBuffer], { type: 'application/pdf' }),
        'merged.pdf'
      );
      setMessage(`Merged ${pdfFiles.length} PDFs.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not merge the PDFs.');
    } finally {
      setTimeout(() => setProgress(null), 1200);
    }
  };

  const clearAll = () => {
    setPdfFiles([]);
    setMessage('');
    setProgress(null);
  };

  return (
    <div className="tool-panel">
      <DropZone
        eyebrow="pdf queue"
        icon="PDF"
        text="Click or drag & drop PDF files here"
        subtext="Files merge in the order shown below"
        inputRef={pdfInputRef}
        accept="application/pdf,.pdf"
        onFilesDropped={handlePdfFiles}
        onFilesSelected={handlePdfFiles}
        isHovering={isHovering}
        onDragStateChange={setIsHovering}
      />

      <div className="status-row">
        <span>{pdfFiles.length} PDF{pdfFiles.length === 1 ? '' : 's'} loaded</span>
        <span>{formatSize(pdfFiles.reduce((total, file) => total + file.size, 0))}</span>
      </div>

      {pdfFiles.length > 0 && (
        <>
          <div className="pdf-list">
            {pdfFiles.map((file, index) => (
              <div key={`${file.name}-${file.size}-${index}`} className="pdf-item">
                <div className="pdf-index">{String(index + 1).padStart(2, '0')}</div>
                <div className="pdf-name">{file.name}</div>
                <div className="pdf-size">{formatSize(file.size)}</div>
                <button
                  className="pdf-remove"
                  onClick={() => removePdf(index)}
                  aria-label={`Remove ${file.name}`}
                >
                  x
                </button>
              </div>
            ))}
          </div>

          <div className="controls">
            <button className="secondary-action" onClick={clearAll}>
              Clear All
            </button>
            <button
              className="primary-action"
              disabled={pdfFiles.length < 2 || progress !== null}
              onClick={mergePDFs}
            >
              Merge PDFs
            </button>
          </div>

          {progress !== null && (
            <div className="progress-container" aria-label="PDF merge progress">
              <div className="progress-label">{progress}%</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </>
      )}

      {message && <p className="helper-message">{message}</p>}
    </div>
  );
}
