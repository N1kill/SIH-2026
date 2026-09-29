import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      // Let the landing app hand off to the FastAPI-served 2D/3D dashboard
      // while running frontend-dam in Vite development mode.
      '/simulation': 'http://127.0.0.1:8050',
      '/twin': 'http://127.0.0.1:8050',
      '/api': 'http://127.0.0.1:8050',
      '/ws': {
        target: 'ws://127.0.0.1:8050',
        ws: true,
      },
    },
  },
})
