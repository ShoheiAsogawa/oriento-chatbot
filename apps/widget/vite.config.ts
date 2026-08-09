import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/orient-chat.ts',
      name: 'OrientChat',
      formats: ['iife'],
      fileName: () => 'orient-chat.js',
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: { assetFileNames: 'orient-chat.[ext]' },
    },
  },
});
