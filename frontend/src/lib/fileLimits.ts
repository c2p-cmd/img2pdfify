/** Client-side limits to avoid tab freeze from oversized inputs. */
export const MAX_PDF_BYTES = 250 * 1024 * 1024;
export const MAX_PDF_PAGES = 500;
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_MERGE_PDF_COUNT = 50;

export function formatLimitBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / 1024 / 1024)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

export function validatePdfFile(file: File): string | null {
  if (file.size > MAX_PDF_BYTES) {
    return `"${file.name}" exceeds the ${formatLimitBytes(MAX_PDF_BYTES)} limit.`;
  }
  return null;
}

export function validatePdfPageCount(pageCount: number): string | null {
  if (pageCount > MAX_PDF_PAGES) {
    return `This PDF has ${pageCount} pages. The limit is ${MAX_PDF_PAGES} pages.`;
  }
  return null;
}

export function validateImageFile(file: File): string | null {
  if (file.size > MAX_IMAGE_BYTES) {
    return `"${file.name}" exceeds the ${formatLimitBytes(MAX_IMAGE_BYTES)} per-image limit.`;
  }
  return null;
}

export function validateMergePdfCount(count: number): string | null {
  if (count > MAX_MERGE_PDF_COUNT) {
    return `You can merge up to ${MAX_MERGE_PDF_COUNT} PDFs at once.`;
  }
  return null;
}
