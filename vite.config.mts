import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: './frontend-env',
  server: {
    port: 5173,
    proxy: {
      '/api/v1': {
        target: 'https://folio.yuris.io',
        changeOrigin: true,
        secure: true
      }
    }
  }
});
