import globals from 'globals';
import { createBaseConfig } from '../../tooling/eslint/base.js';

export default [
  ...createBaseConfig({ tsconfigRootDir: import.meta.dirname, runtimeGlobals: globals.node }),

  /** Supertest types the response body as `any`; the assertions are what check its shape. */
  {
    files: ['src/**/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
];
