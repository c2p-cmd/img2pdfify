import { useRef, useState } from 'react';
import type { DragEvent, RefObject } from 'react';

interface DropZoneProps {
  text: string;
  subtext?: string;
  accept?: string;
  directory?: boolean;
  onFilesDropped: (files: File[]) => void;
  onFilesSelected: (files: FileList) => void;
  inputRef?: RefObject<HTMLInputElement>;
}

async function collectFiles(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve) =>
      (entry as FileSystemFileEntry).file((file) => resolve([file]), () => resolve([])),
    );
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children: FileSystemEntry[] = [];
    // readEntries returns results in batches until it yields an empty array.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve) =>
        reader.readEntries(resolve, () => resolve([])),
      );
      if (batch.length === 0) break;
      children.push(...batch);
    }
    return (await Promise.all(children.map(collectFiles))).flat();
  }
  return [];
}

async function filesFromDrop(dataTransfer: DataTransfer): Promise<File[]> {
  // Entries must be read synchronously, before the drop event finishes.
  const entries = Array.from(dataTransfer.items ?? [])
    .map((item) => item.webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is FileSystemEntry => entry !== null);
  const fallback = Array.from(dataTransfer.files);

  // Dropped folders arrive as nameless "files"; walk them to reach their contents.
  if (entries.some((entry) => entry.isDirectory)) {
    return (await Promise.all(entries.map(collectFiles))).flat();
  }
  return fallback;
}

export default function DropZone({
  text,
  subtext,
  accept,
  directory = false,
  onFilesDropped,
  onFilesSelected,
  inputRef,
}: DropZoneProps) {
  const [isHovering, setIsHovering] = useState(false);
  // dragenter/dragleave also fire for child elements; count them to avoid flicker.
  const depth = useRef(0);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    depth.current += 1;
    setIsHovering(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setIsHovering(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    depth.current = 0;
    setIsHovering(false);
    const files = await filesFromDrop(e.dataTransfer);
    if (files.length > 0) onFilesDropped(files);
  };

  const handleClick = () => inputRef?.current?.click();

  return (
    <div
      className={`dropzone${isHovering ? ' hover' : ''}`}
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      aria-label={subtext ? `${text}. ${subtext}` : text}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <svg className="dropzone-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
      </svg>
      <p>{text}</p>
      {subtext && <small>{subtext}</small>}
      <input
        type="file"
        ref={inputRef}
        accept={accept}
        multiple
        tabIndex={-1}
        aria-hidden="true"
        {...(directory ? { webkitdirectory: '', directory: '' } : {})}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          if (e.target.files) {
            onFilesSelected(e.target.files);
            e.target.value = '';
          }
        }}
      />
    </div>
  );
}
