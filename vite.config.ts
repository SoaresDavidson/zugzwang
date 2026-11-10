import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// COOP/COEP liberam SharedArrayBuffer, exigido pelo Stockfish multi-thread.
// NO_COI=1 desliga os headers para testar o fallback single-thread.
const isolationHeaders = process.env.NO_COI
  ? {}
  : {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }

export default defineConfig({
  plugins: [react()],
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
})
