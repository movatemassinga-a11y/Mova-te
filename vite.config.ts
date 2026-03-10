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
      VITE_GOOGLE_MAPS_API_KEY: JSON.stringify('')
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  preview: {
    allowedHosts: ['mova-te.onrender.com']
  }
});
