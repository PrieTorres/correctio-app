/**
 * Rules the team agreed on that no published plugin enforces.
 *
 * They exist because the same mistakes kept coming back through review: review
 * catches them only when someone happens to look, and the build catches them
 * every time.
 */

/**
 * Comments that instruct a tool rather than a reader. They are not prose, so
 * neither the JSDoc rule nor the language rule applies to them.
 */
const TOOL_DIRECTIVE = /^\s*(eslint[\s-]|@ts-|globals?\s|\/\s*<reference\s)/;

/**
 * A leftover that names the issue that will remove it. One without an issue
 * number is a note nobody owns.
 */
const TRACKED_TODO = /^\s*TODO\(#\d+\):/;

const ACCENTED_LETTER = /[À-ÿ]/;

/**
 * Domain literals and identifiers are quoted, and quoting a Portuguese one
 * inside an English sentence is correct. Only the prose around them is checked.
 *
 * `scripts/check-comment-language.mjs` covers the files ESLint cannot reach and
 * has to agree with this: two checkers of the same rule disagreeing means one
 * of them is wrong, and nobody knows which.
 */
function proseOnly(text) {
  return text
    .replace(/`[^`]*`/g, '')
    .replace(/'[^']*'/g, '')
    .replace(/"[^"]*"/g, '');
}

function isJsDoc(comment) {
  return comment.type === 'Block' && comment.value.startsWith('*');
}

/** A shebang tells the shell which program runs the file; it is not a comment to a reader. */
function isExempt(comment) {
  return (
    comment.type === 'Shebang' ||
    TOOL_DIRECTIVE.test(comment.value) ||
    TRACKED_TODO.test(comment.value)
  );
}

const jsdocOnlyComments = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A comment that earns its place is a JSDoc block on the declaration it explains. A note beside a line says the name is wrong, and the fix is to rename.',
    },
    schema: [],
    messages: {
      notJsDoc:
        'Explain why in a JSDoc block (/** */) on the declaration, or rename so the comment is unnecessary. Inside JSX, move the reason to the component JSDoc.',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (isJsDoc(comment) || isExempt(comment)) continue;
          context.report({ loc: comment.loc, messageId: 'notJsDoc' });
        }
      },
    };
  },
};

const englishOnlyComments = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Comments are written in English. Accented letters give away Portuguese; typographic punctuation such as an em dash is fine.',
    },
    schema: [],
    messages: {
      notEnglish: 'Write comments in English. Portuguese belongs in the interface and the docs.',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (!ACCENTED_LETTER.test(proseOnly(comment.value))) continue;
          context.report({ loc: comment.loc, messageId: 'notEnglish' });
        }
      },
    };
  },
};

export default {
  meta: { name: 'conventions' },
  rules: {
    'jsdoc-only-comments': jsdocOnlyComments,
    'english-only-comments': englishOnlyComments,
  },
};
