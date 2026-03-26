import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Redirige todas las rutas a index.html (necesario para React Router en modo history)
    historyApiFallback: true,
  },
  preview: {
    // Lo mismo para vite preview
    port: 4173,
  },
})