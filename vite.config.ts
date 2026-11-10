import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Ship the 3D scene page alongside the dashboard.
    rollupOptions: { input: { main: 'index.html', scene: 'scene-preview.html' } },
  },
})
