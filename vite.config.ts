import { defineConfig } from 'vite';

// Library build: one self-contained IIFE bundle ready to be dropped into
// any third-party page via a <script> tag. No code splitting, no externals.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'EasyChatWidget',
      formats: ['iife'],
      fileName: () => 'easy-chat-widget.js',
    },
    minify: true,
    target: 'es2018',
    outDir: 'dist',
  },
});
