import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import conventions from '../conventions.js';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
});

ruleTester.run('jsdoc-only-comments', conventions.rules['jsdoc-only-comments'], {
  valid: [
    '/** Explains why the constant exists. */\nconst limit = 10;',
    '/**\n * A paragraph.\n *\n * Another paragraph.\n */\nfunction run() {}',
    '/* eslint-disable no-console */',
    '// eslint-disable-next-line no-console\nconsole.log(1);',
    '// @ts-expect-error the library types are wrong',
    '/// <reference types="cypress" />',
    '/* global window */',
    '// TODO(#36): remove once the upgrade lands',
    '#!/usr/bin/env node\nconst a = 1;',
  ],
  invalid: [
    { code: '// explains the next line\nconst a = 1;', errors: [{ messageId: 'notJsDoc' }] },
    { code: '/* a block that is not JSDoc */\nconst a = 1;', errors: [{ messageId: 'notJsDoc' }] },
    { code: '// TODO: nobody owns this', errors: [{ messageId: 'notJsDoc' }] },
    { code: 'const view = <div>{/* a note inside JSX */}</div>;', errors: [{ messageId: 'notJsDoc' }] },
    { code: 'const a = 1; // trailing note', errors: [{ messageId: 'notJsDoc' }] },
  ],
});

ruleTester.run('english-only-comments', conventions.rules['english-only-comments'], {
  valid: [
    '/** Plain English. */',
    '/** Quoting the label `Questão` inside an English sentence is fine. */',
    '/** An em dash — like this one — is punctuation, not Portuguese. */',
  ],
  invalid: [
    { code: '/** Explicação em português. */', errors: [{ messageId: 'notEnglish' }] },
  ],
});
