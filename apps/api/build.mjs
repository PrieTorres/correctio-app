import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const manifest = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));

/**
 * One file to deploy. The workspace packages are bundled in because they ship
 * as TypeScript source; every other dependency stays external and is installed
 * on the host as usual, `sharp` and the decoder's WebAssembly included.
 */
const BUNDLED = new Set(['@correctio/domain', '@correctio/sheet-reader']);
const EXTERNAL = Object.keys(manifest.dependencies ?? {}).filter((name) => !BUNDLED.has(name));

/** What Firebase uploads: the function bundle and a manifest of its own, apart from the workspace. */
const FUNCTION_DIR = 'dist/function';

const SHARED = { bundle: true, platform: 'node', format: 'esm', target: 'node22', sourcemap: true, external: EXTERNAL };

/**
 * The version each dependency had when the tests ran, read from what is
 * installed, so the host installs the same code instead of the newest release
 * inside each range. npm hoists most packages to the root `node_modules`.
 */
async function installedVersion(name) {
  const local = new URL(`./node_modules/${name}/package.json`, import.meta.url);
  const hoisted = new URL(`../../node_modules/${name}/package.json`, import.meta.url);
  const path = existsSync(local) ? local : hoisted;
  return JSON.parse(await readFile(path, 'utf8')).version;
}

async function functionManifest() {
  const versions = await Promise.all(EXTERNAL.map(async (name) => [name, await installedVersion(name)]));
  return {
    name: 'correctio-api-function',
    private: true,
    type: 'module',
    main: 'index.js',
    engines: { node: '22' },
    dependencies: Object.fromEntries(versions),
  };
}

/** A lockfile or dependency left by an earlier build would be uploaded with the new code. */
await rm(FUNCTION_DIR, { recursive: true, force: true });
/**
 * The reading of a photo runs on a worker thread, which loads a file of its
 * own (ADR-007): it is bundled next to each entry point, where
 * `createPhotoReader` looks for it.
 */
const WORKER_ENTRY = 'src/lib/sheet-reading/sheet-reading-worker.ts';
const WORKER_FILE = 'sheet-reading-worker.js';

await build({ ...SHARED, entryPoints: ['src/server.ts'], outfile: 'dist/server.js' });
await build({ ...SHARED, entryPoints: [WORKER_ENTRY], outfile: `dist/${WORKER_FILE}` });
await build({ ...SHARED, entryPoints: ['src/function.ts'], outfile: `${FUNCTION_DIR}/index.js` });
await build({ ...SHARED, entryPoints: [WORKER_ENTRY], outfile: `${FUNCTION_DIR}/${WORKER_FILE}` });
await mkdir(FUNCTION_DIR, { recursive: true });
await writeFile(`${FUNCTION_DIR}/package.json`, `${JSON.stringify(await functionManifest(), null, 2)}\n`);
