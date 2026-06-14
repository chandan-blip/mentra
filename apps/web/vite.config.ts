import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
      // Socket.IO (live-session chat / presence) — needs ws upgrade proxying.
      '/socket.io': {
        target: process.env.VITE_API_URL ?? 'http://127.0.0.1:4000',
        changeOrigin: true,
        ws: true,
      },
    },
    watch: {
      // VMs and mounted folders are happier with polling
      usePolling: true,
      interval: 200,
    },
  },
});
