import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const DIRECTIVE = /^\s*(eslint|@ts-|global|prettier|c8|v8|istanbul|type|jsx)/;
const ACCENTED_LETTER = /[\u00C0-\u00FF]/;

/**
 * Rules the team agreed on that no published plugin enforces.
 *
 * Both exist because the same mistake kept coming back through review: review
 * catches it only when someone happens to look, and the build catches it every
 * time.
 */
const conventions = {
  rules: {
    'no-line-comments': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'A comment that earns its place is a JSDoc block on the declaration. Anything needing a note beside it is saying the name is wrong, and the fix is to rename.',
        },
        schema: [],
      },
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              if (comment.type !== 'Line' || DIRECTIVE.test(comment.value)) continue;
              context.report({
                loc: comment.loc,
                message:
                  'Use a JSDoc block on the declaration, or rename so the comment is unnecessary.',
              });
            }
          },
        };
      },
    },

    'english-only-comments': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Comments are written in English. Accented letters give away Portuguese; typographic punctuation such as an em dash is fine.',
        },
        schema: [],
      },
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              if (!ACCENTED_LETTER.test(comment.value)) continue;
              context.report({
                loc: comment.loc,
                message: 'Write comments in English. Portuguese belongs in the interface and the docs.',
              });
            }
          },
        };
      },
    },
  },
};

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      conventions,
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

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',

      'conventions/no-line-comments': 'error',
      'conventions/english-only-comments': 'error',

      /** Anything left behind must be traceable. */
      'no-warning-comments': ['warn', { terms: ['fixme', 'xxx'], location: 'anywhere' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
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

  /** Config files are plain JavaScript and sit outside the TypeScript project. */
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: globals.node },
  },
);
