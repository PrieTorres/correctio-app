import { createBaseConfig } from './tooling/eslint/base.js';

/**
 * Lints the files that belong to no workspace: the shared tooling and the
 * repository scripts. Each workspace under `apps` has its own config built on
 * the same base, so the rules are written once.
 */
export default [
  ...createBaseConfig({ tsconfigRootDir: import.meta.dirname }),

  /** A command-line script reports to the terminal; printing is its output. */
  { files: ['scripts/**'], rules: { 'no-console': 'off' } },
];
