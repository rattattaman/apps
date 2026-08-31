import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'dev',
  test: {
    include: ['../src/**/*.test.ts'],
  },
  base: '/apps/orb-arena/',
  server: {
    fs: { allow: ['..'] },
  },
  build: {
    outDir: '..',
    emptyOutDir: false,
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        entryFileNames: 'assets/orb-arena-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/orb-arena-[hash][extname]',
      },
    },
    chunkSizeWarningLimit: 1_600,
  },
});
