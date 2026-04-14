import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Se estivermos compilando para Electron, usamos caminhos relativos './' 
  // para evitar o erro ERR_FILE_NOT_FOUND ao carregar pelo protocolo file://
  // No Vercel, o padrão '/' continua sendo usado para suportar rotas profundas.
  base: process.env.VITE_ELECTRON_BUILD === 'true' ? './' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
})
