import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative asset paths so dist/index.html also works when opened directly
  // from disk (file://) or hosted in a subfolder.
  base: './',
  plugins: [react(), tailwindcss()],
})
