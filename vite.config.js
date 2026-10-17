import { defineConfig, loadEnv } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig(({ mode }) => {
  const userNodeEnv = process.env.VITE_USER_NODE_ENV;
  loadEnv(mode, projectRoot, 'VITE_');
  // The root .env is shared with the API; its development mode must not force a development build.
  if (userNodeEnv === undefined) delete process.env.VITE_USER_NODE_ENV;
  return {
    plugins: [react()],
    server: { proxy: { '/api': 'http://localhost:4001', '/uploads': 'http://localhost:4001' } },
    build: { rollupOptions: { output: { manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom'], icons: ['lucide-react'] } } } }
  };
});
