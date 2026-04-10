import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // base: './' foi removido — causa problemas no Vercel (paths relativos quebram o servidor web)
  // O padrão '/' é correto para deploy em produção
})
