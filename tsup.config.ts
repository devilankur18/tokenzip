import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts', 'src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
});
