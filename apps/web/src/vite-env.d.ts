/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the API answers; read only by `apiBaseUrl` (`lib/repositories/http/api-config.ts`). */
  readonly VITE_API_URL?: string
  /** `true` only in the GitHub Pages build; read only by `lib/app-mode.ts`. */
  readonly VITE_DEMO_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
