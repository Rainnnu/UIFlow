import { defineConfig } from 'vite';
export default defineConfig({ base: './', build: { outDir: '../../apps/vscode-extension/dist/webview', emptyOutDir: true, rollupOptions: { output: { entryFileNames: 'main.js', assetFileNames: 'assets/[name][extname]' } } } });
