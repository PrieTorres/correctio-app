import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';
import sonarjs from 'eslint-plugin-sonarjs';
import conventions from './conventions.js';

/**
 * Upper bounds for a single function, shared by every workspace.
 *
 * `cognitive` is the same rule and threshold SonarCloud applies (S3776), so the
 * build fails locally for the reason the quality gate would fail later.
 * `cyclomatic` stays at McCabe's classic 10. A function that needs more is doing
 * several things, and each of them deserves a name.
 */
export const COMPLEXITY_LIMITS = Object.freeze({
  cyclomatic: 10,
  cognitive: 15,
  depth: 3,
  params: 4,
});

/**
 * The complexity rules at a given set of limits. The shared config uses the
 * defaults; `ratchet` uses a file's current values so legacy code cannot get
 * worse while it waits to be split.
 */
export function complexityRules(limits = COMPLEXITY_LIMITS) {
  return {
    complexity: ['error', limits.cyclomatic],
    'sonarjs/cognitive-complexity': ['error', limits.cognitive],
    'max-depth': ['error', limits.depth],
    'max-params': ['error', limits.params],
  };
}

/**
 * Freezes files that already exceed the limits at their current values.
 *
 * Each entry is a debt with an owner: whoever touches the file in a task splits
 * the function and deletes the entry, the same way the coverage exclusions in
 * `vite.config.ts` shrink. Entries are only ever removed, never added.
 */
export function ratchet(legacy) {
  return Object.entries(legacy).map(([file, current]) => ({
    files: [file],
    rules: complexityRules({ ...COMPLEXITY_LIMITS, ...current }),
  }));
}

const commentRules = {
  'conventions/jsdoc-only-comments': 'error',
  'conventions/english-only-comments': 'error',
  'jsdoc/informative-docs': 'error',
  'jsdoc/no-blank-blocks': 'error',
  'jsdoc/no-bad-blocks': 'error',
  'jsdoc/check-alignment': 'error',
};

/**
 * An empty `catch` is how a browser storage failure is ignored on purpose. The
 * reason belongs in the JSDoc of the function, like every other explanation,
 * so the block itself stays empty.
 */
const emptyCatch = { 'no-empty': ['error', { allowEmptyCatch: true }] };

const sharedRules = {
  ...commentRules,
  ...complexityRules(),
  ...emptyCatch,
  'no-warning-comments': ['warn', { terms: ['fixme', 'xxx'], location: 'anywhere' }],
  'no-console': ['error', { allow: ['warn', 'error'] }],
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'prefer-const': 'error',
  'no-var': 'error',
};

const typeScriptRules = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
  ],
  '@typescript-eslint/no-non-null-assertion': 'warn',
};

const plugins = { conventions, jsdoc, sonarjs };

/**
 * The config every workspace starts from. A workspace adds what is specific to
 * its runtime, such as the React plugins for the web app, and never restates
 * these rules.
 *
 * `runtimeGlobals` are the globals of the code under `src`; config and script
 * files always run on Node.
 */
export function createBaseConfig({ tsconfigRootDir, runtimeGlobals = globals.node }) {
  return tseslint.config(
    { ignores: ['dist', 'coverage', 'node_modules'] },
    js.configs.recommended,
    {
      files: ['**/*.{ts,tsx}'],
      extends: [...tseslint.configs.recommendedTypeChecked],
      languageOptions: {
        ecmaVersion: 2023,
        globals: runtimeGlobals,
        parserOptions: { projectService: true, tsconfigRootDir },
      },
      plugins,
      rules: { ...sharedRules, ...typeScriptRules },
    },
    {
      files: ['**/*.{js,mjs}'],
      languageOptions: { globals: globals.node },
      plugins,
      rules: sharedRules,
    },
  );
}
