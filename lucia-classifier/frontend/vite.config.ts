import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Usamos sempre caminhos relativos './' para evitar o erro ERR_FILE_NOT_FOUND ao carregar via protocolo file:// no aplicativo offline. Funciona bem no Vercel também.
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
})
