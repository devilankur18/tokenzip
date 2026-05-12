import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts', 'src/index.ts', 'src/engine/worker.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  platform: 'node',
  target: 'node18',
  external: [
    'simple-git',
    'surrealdb',
    '@surrealdb/node',
    '@modelcontextprotocol/sdk',
    'commander',
    'web-tree-sitter'
  ]
});
