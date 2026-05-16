/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_URL: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
