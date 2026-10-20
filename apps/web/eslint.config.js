import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import { createBaseConfig, ratchet } from '../../tooling/eslint/base.js';

/**
 * Functions that already exceeded the complexity limits when the rule arrived,
 * frozen at their current values so they cannot get worse.
 *
 * A task that touches one of these files splits the function into named
 * pieces and deletes its entry. Entries are only ever removed, never added.
 */
const LEGACY_COMPLEXITY = {
  'src/features/applications/pages/ApplicationDetailPage.tsx': { cyclomatic: 16 },
  'src/features/applications/pages/ApplicationFormPage.tsx': { cyclomatic: 17 },
  'src/features/applications/pages/ApplicationGeneratePage.tsx': { cyclomatic: 22 },
  'src/features/applications/pages/ApplicationListPage.tsx': { cyclomatic: 12 },
  'src/features/grading/pages/GradingSheetPage.tsx': { cyclomatic: 30 },
  'src/features/grading/pages/GradingUploadPage.tsx': { cyclomatic: 19 },
  'src/features/questions/pages/QuestionFormPage.tsx': { cyclomatic: 11 },
  'src/features/questions/pages/QuestionListPage.tsx': { cyclomatic: 13 },
  'src/features/reports/pages/ApplicationReportPage.tsx': { cyclomatic: 24 },
  'src/lib/public-lookup/resolve.ts': { cyclomatic: 14 },
  'src/lib/exams/draw-questions.ts': { params: 5 },
};

export default [
  ...createBaseConfig({ tsconfigRootDir: import.meta.dirname, runtimeGlobals: globals.browser }),

  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      /**
       * The dependency array is never suppressed. Fix the code instead: move the
       * value, use an updater, split the effect.
       */
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  {
    files: ['**/*.test.{ts,tsx}', 'src/test-setup.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },

  {
    files: ['cypress/**/*.ts', 'cypress.config.ts', 'vite.config.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-namespace': 'off',
    },
  },

  ...ratchet(LEGACY_COMPLEXITY),
];
