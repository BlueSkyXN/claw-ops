import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 39527,
  },
  preview: {
    port: 39527,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-flow': ['@xyflow/react', 'dagre'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
})
