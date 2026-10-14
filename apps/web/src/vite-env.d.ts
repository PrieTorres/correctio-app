/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the API answers; read only by `apiBaseUrl` (`lib/repositories/http/api-config.ts`). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
