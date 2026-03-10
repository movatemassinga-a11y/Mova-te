import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Forçamos o ambiente como produção e definimos os dados de acesso diretamente
    'process.env': {
      NODE_ENV: 'production',
      VITE_ADMIN_USERNAME: 'Shadowwalker',
      VITE_ADMIN_PASSWORD: '123', // Mudei para uma senha simples para teste
      VITE_GOOGLE_MAPS_API_KEY: '', // Deixamos vazio para não travar o mapa
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['mova-te.onrender.com']
  }
});
