import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'react-form-builder.js',
        chunkFileNames: 'react-form-builder.js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') {
            return 'react-form-builder.css';
          }
          return assetInfo.name;
        }
      }
    }
  }
});
