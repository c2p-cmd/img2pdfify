import type { DragEvent, RefObject } from 'react';

interface DropZoneProps {
  eyebrow: string;
  icon: string;
  text: string;
  subtext?: string;
  accept?: string;
  directory?: boolean;
  onDragStateChange?: (isDragging: boolean) => void;
  onFilesDropped: (files: FileList) => void;
  onFilesSelected: (files: FileList) => void;
  isHovering: boolean;
  inputRef?: RefObject<HTMLInputElement>;
}

export default function DropZone({
  eyebrow,
  icon,
  text,
  subtext,
  accept,
  directory = false,
  onDragStateChange,
  onFilesDropped,
  onFilesSelected,
  isHovering,
  inputRef,
}: DropZoneProps) {
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    onDragStateChange?.(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    onDragStateChange?.(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    onDragStateChange?.(false);
    if (e.dataTransfer.files.length > 0) {
      onFilesDropped(e.dataTransfer.files);
    }
  };

  const handleClick = () => {
    inputRef?.current?.click();
  };

  return (
    <div
      className={`dropzone ${isHovering ? 'hover' : ''}`}
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <span className="dropzone-eyebrow">{eyebrow}</span>
      <div className="icon" aria-hidden="true">{icon}</div>
      <p>{text}</p>
      {subtext && <small>{subtext}</small>}
      <input
        type="file"
        ref={inputRef}
        accept={accept}
        multiple
        {...(directory ? { webkitdirectory: '', directory: '' } : {})}
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
