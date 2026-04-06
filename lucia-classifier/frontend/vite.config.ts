import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Essa linha abaixo é A MÁGICA para o modo offline funcionar no Windows:
  base: './', 
})
