import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const manifest = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));

/**
 * One file to deploy. `@correctio/domain` is bundled in because it ships as
 * TypeScript source; every other dependency stays external and is installed on
 * the host as usual.
 */
const BUNDLED = new Set(['@correctio/domain']);

await build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'dist/server.js',
  sourcemap: true,
  external: Object.keys(manifest.dependencies ?? {}).filter((name) => !BUNDLED.has(name)),
});
