export const SITE_ORIGIN = "https://c2p-cmd.github.io/img2pdfify";

export type RouteMeta = {
  path: string;
  title: string;
  description: string;
  navLabel: string;
  tabId: string;
};

export const routes = {
  images: {
    path: "/",
    title: "PDFify — Convert Images to PDF Online Free",
    description:
      "Convert JPG, PNG, and WebP images to PDF in your browser. Free, private, no file uploads.",
    navLabel: "Images to PDF",
    tabId: "tab-images",
  },
  merge: {
    path: "/merge",
    title: "PDFify — Merge PDFs Online Free",
    description:
      "Combine multiple PDF files into one document in your browser. Free, private, no file uploads.",
    navLabel: "Merge PDFs",
    tabId: "tab-merge",
  },
  split: {
    path: "/split",
    title: "PDFify — Split PDF Online Free",
    description:
      "Extract pages or split a PDF into separate files in your browser. Free, private, no file uploads.",
    navLabel: "Split PDF",
    tabId: "tab-split",
  },
  unlock: {
    path: "/unlock",
    title: "PDFify — Lock & Unlock PDF Online Free",
    description:
      "Password-protect or remove protection from PDFs in your browser. Free, private, no file uploads.",
    navLabel: "Lock / Unlock",
    tabId: "tab-unlock",
  },
} as const satisfies Record<string, RouteMeta>;

export const routeList = Object.values(routes);

export function routeUrl(path: string): string {
  if (path === "/") {
    return `${SITE_ORIGIN}/`;
  }
  return `${SITE_ORIGIN}${path}`;
}
