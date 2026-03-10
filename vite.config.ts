import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'process.env': {
      NODE_ENV: JSON.stringify('production'),
      VITE_ADMIN_USERNAME: JSON.stringify('Shadowwalker'),
      VITE_ADMIN_PASSWORD: JSON.stringify('123'),
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
  preview: {
    allowedHosts: ['mova-te.onrender.com']
  }
});
