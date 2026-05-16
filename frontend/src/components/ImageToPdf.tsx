import { useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import DropZone from './DropZone';

interface FileWithThumb {
  file: File;
  preview: string;
  checked: boolean;
}

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

async function rasterizeImage(file: File): Promise<Uint8Array> {
  if (file.type === 'image/jpeg' || file.type === 'image/png') {
    return new Uint8Array(await file.arrayBuffer());
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = objectUrl;
    await img.decode();

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not prepare image canvas.');
    }

    context.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result);
        else reject(new Error('Could not convert image to PNG.'));
      }, 'image/png');
    });

    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function ImageToPdf() {
  const [files, setFiles] = useState<FileWithThumb[]>([]);
  const [isHovering, setIsHovering] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const filesRef = useRef<FileWithThumb[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, []);

  const handleFiles = (fileList: FileList | File[]) => {
    const incoming = Array.from(fileList)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        checked: true,
      }));

    if (incoming.length === 0) {
      setMessage('No supported image files found.');
      return;
    }

    setFiles((prev) => {
      const existing = new Set(prev.map((item) => `${item.file.name}-${item.file.size}`));
      const unique = incoming.filter(
        (item) => !existing.has(`${item.file.name}-${item.file.size}`)
      );
      return [...prev, ...unique];
    });
    setMessage('');
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const toggleCheck = (index: number) => {
    setFiles((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const generatePDF = async () => {
    const selected = files.filter((item) => item.checked);
    if (selected.length === 0) {
      setMessage('Select at least one image first.');
      return;
    }

    setProgress(0);
    setMessage('Building your PDF...');

    try {
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < selected.length; i += 1) {
        const item = selected[i];
        const bytes = await rasterizeImage(item.file);
        const image =
          item.file.type === 'image/jpeg'
            ? await pdfDoc.embedJpg(bytes)
            : await pdfDoc.embedPng(bytes);

        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });

        setProgress(Math.round(((i + 1) / selected.length) * 100));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const pdfBytes = await pdfDoc.save();
      const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
      new Uint8Array(pdfBuffer).set(pdfBytes);
      await downloadBlob(
        new Blob([pdfBuffer], { type: 'application/pdf' }),
        'images.pdf'
      );
      setMessage(`Created PDF from ${selected.length} image${selected.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not generate the PDF.');
    } finally {
      setTimeout(() => setProgress(null), 1200);
    }
  };

  const clearAll = () => {
    files.forEach((item) => URL.revokeObjectURL(item.preview));
    setFiles([]);
    setProgress(null);
    setMessage('');
  };

  const selectedCount = files.filter((item) => item.checked).length;

  return (
    <div className="tool-panel">
      <div className="dropzone-container">
        <DropZone
          eyebrow="image stack"
          icon="IMG"
          text="Click or drag & drop images here"
          subtext="JPG, PNG, WEBP, GIF and other browser-readable image files"
          inputRef={fileInputRef}
          accept="image/*"
          onFilesDropped={handleFiles}
          onFilesSelected={handleFiles}
          isHovering={isHovering}
          onDragStateChange={setIsHovering}
        />

        <DropZone
          eyebrow="folder run"
          icon="DIR"
          text="Click or drag & drop folders here"
          subtext="Useful for ordered batches from a scan or export folder"
          inputRef={folderInputRef}
          accept="image/*"
          directory
          onFilesDropped={handleFiles}
          onFilesSelected={handleFiles}
          isHovering={isHovering}
          onDragStateChange={setIsHovering}
        />
      </div>

      <div className="status-row">
        <span>{files.length} image{files.length === 1 ? '' : 's'} loaded</span>
        <span>{selectedCount} selected</span>
      </div>

      {files.length > 0 && (
        <>
          <div className="controls">
            <button className="secondary-action" onClick={clearAll}>
              Clear All
            </button>
            <button
              className="primary-action"
              disabled={selectedCount === 0 || progress !== null}
              onClick={generatePDF}
            >
              Generate PDF
            </button>
          </div>

          {progress !== null && (
            <div className="progress-container" aria-label="PDF generation progress">
              <div className="progress-label">{progress}%</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="gallery">
            {files.map((item, index) => (
              <div className="thumb" key={`${item.file.name}-${item.file.size}-${index}`}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  aria-label={`Include ${item.file.name}`}
                  onChange={() => toggleCheck(index)}
                  onClick={(e) => e.stopPropagation()}
                />
                <img src={item.preview} alt={item.file.name} draggable={false} />
                <span className="thumb-meta">{item.file.name}</span>
                <button
                  className="remove-btn"
                  onClick={() => removeFile(index)}
                  aria-label={`Remove ${item.file.name}`}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {message && <p className="helper-message">{message}</p>}
    </div>
  );
}
