/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE?: 'standalone' | 'demo' | 'realtime'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
