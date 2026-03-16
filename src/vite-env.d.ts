/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE?: 'demo' | 'realtime'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
