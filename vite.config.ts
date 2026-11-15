import { defineConfig } from 'vite'
import { qwikVite } from '@builder.io/qwik/optimizer'
import dts from 'vite-plugin-dts'

// https://vite.dev/config/
export default defineConfig({
  // Library build — MUST run as `vite build --mode lib`: qwikVite derives its
  // lib target from vite's mode and then takes the entry from build.lib. The
  // `.qwik.` infix in the emitted filenames is the convention consumer
  // optimizers key on — only libraries named *.qwik.mjs/cjs get their QRLs
  // re-processed from node_modules.
  plugins: [qwikVite(), dts({ tsconfigPath: './tsconfig.app.json' })],
  build: {
    target: 'es2022',
    // qwikVite's lib target defaults to a `lib/` out dir — dist/ for parity
    // with the other library packages.
    outDir: 'dist',
    lib: {
      entry: 'src/canvas-glide.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => `canvas-glide.qwik.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['@builder.io/qwik', '@builder.io/qwik/build', 'canvas-glide'],
    },
  },
})
