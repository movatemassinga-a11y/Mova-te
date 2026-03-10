import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.VITE_ADMIN_USERNAME': JSON.stringify('Shadowwalker'),
      'process.env.VITE_ADMIN_PASSWORD': JSON.stringify('123456'), // Podes mudar o 123456 para o que quiseres
      'process.env.NODE_ENV': JSON.stringify('production')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: true,
    },
    preview: {
      allowedHosts: ['mova-te.onrender.com']
    }
  };
});
