import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base doit correspondre au nom du dÃ©pÃ´t pour GitHub Pages
export default defineConfig({
  plugins: [react()],
  base: '/royaume-des-sons/',
})