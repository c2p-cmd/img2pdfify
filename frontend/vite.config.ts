import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Use 'autoUpdate' so a new SW is activated without prompting the user
      registerType: "autoUpdate",
      // The SW file will be generated inside docs/
      outDir: "../docs",
      // Tell Workbox the public base so asset URLs are correct on GH Pages
      base: "/img2pdfify/",
      // Include all build output assets in the precache manifest
      includeAssets: ["icons/**", "screenshots/**"],
      workbox: {
        // Cache-first strategy: shell assets served from cache immediately
        globPatterns: ["**/*.{js,css,html,ico,png,svg,mjs}"],
        // Don't cache the pdf worker inline — it's huge; it gets its own entry
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB cap
        runtimeCaching: [
          {
            // Cache the pdf.js worker with a cache-first strategy
            urlPattern: /\.mjs$/,
            handler: "CacheFirst",
            options: {
              cacheName: "pdf-worker-cache",
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      manifest: {
        name: "Image/PDF Tools",
        short_name: "PDF Tools",
        description: "Convert images to PDF and merge PDF files",
        start_url: "/img2pdfify/",
        display: "standalone",
        background_color: "#f7f7f7",
        // Unified theme colour (was mismatched between index.html and manifest)
        theme_color: "#BFDDF0",
        icons: [
          { src: "/img2pdfify/icons/favicon.ico", type: "image/x-icon", sizes: "16x16 32x32" },
          { src: "/img2pdfify/icons/icon-192.png", type: "image/png", sizes: "192x192" },
          { src: "/img2pdfify/icons/icon-512.png", type: "image/png", sizes: "512x512" },
          { src: "/img2pdfify/icons/icon-192-maskable.png", type: "image/png", sizes: "192x192", purpose: "maskable" },
          { src: "/img2pdfify/icons/icon-512-maskable.png", type: "image/png", sizes: "512x512", purpose: "maskable" },
        ],
      },
    }),
  ],
  base: "/img2pdfify/",
  build: {
    outDir: "../docs",
    emptyOutDir: true,
    modulePreload: {
      // Inject <link rel="modulepreload"> for all chunks so the browser
      // discovers and fetches them earlier, improving FCP.
      polyfill: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React — tiny, loads fast, cached aggressively
          "vendor-react": ["react", "react-dom"],
          // PDF manipulation libs — only needed when user interacts with a tab
          "vendor-pdf-lib": ["pdf-lib"],
          "vendor-pdfjs": ["pdfjs-dist"],
          // Image→PDF path
          "vendor-jspdf": ["jspdf"],
          "vendor-html2canvas": ["html2canvas"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  optimizeDeps: {
    // pdf.js ships as ESM; tell Vite not to pre-bundle the worker
    exclude: ["pdfjs-dist"],
  },
});

