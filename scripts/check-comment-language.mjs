#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Fails when a comment outside the documentation is written in Portuguese.
 *
 * ESLint enforces this for TypeScript, but workflows, properties files and
 * ignore files sit outside its reach, and that is exactly where the mistake
 * kept surviving review.
 */
const SKIPPED_EXTENSIONS = /\.(md|pdf|docx|pptx|jpe?g|png|svg|ico|lock)$/i;
const COMMENT_LINE = /^\s*(#|\/\/|<!--|\*)/;
const ACCENTED_LETTER = /[À-ÿ]/;

/**
 * Words that give away Portuguese even when someone drops the accents.
 *
 * `professor` is deliberately absent: it is also an English word, and it is a
 * role name from the specification.
 */
const GIVEAWAYS =
  /\b(nao|não|pelo|pela|porque|quando|isso|este|esta|esse|essa|aqui|entao|então|mesmo|cada|todo|toda|est[aá]|s[aã]o|precisa|deve|arquivo|pasta|campo|linha|tela|prova|turma|aluno|regra|codigo|código|acesso|usuario|usuário)\b/i;

/**
 * Domain literals and identifiers are quoted, and quoting them in an English
 * sentence is correct. Only the prose around them is checked.
 */
function proseOnly(line) {
  return line.replace(/`[^`]*`/g, '').replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '');
}

const trackedFiles = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter((file) => file !== '' && !SKIPPED_EXTENSIONS.test(file));

const violations = [];

for (const file of trackedFiles) {
  let contents;
  try {
    contents = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  contents.split('\n').forEach((line, index) => {
    if (!COMMENT_LINE.test(line)) return;
    const prose = proseOnly(line);
    if (!ACCENTED_LETTER.test(prose) && !GIVEAWAYS.test(prose)) return;
    violations.push(`${file}:${index + 1}  ${line.trim()}`);
  });
}

if (violations.length > 0) {
  console.error('Comments must be written in English. Portuguese belongs in docs/ and in the interface.\n');
  violations.forEach((violation) => console.error(`  ${violation}`));
  console.error(`\n${violations.length} comment(s) to translate.`);
  process.exit(1);
}

console.log(`Comment language: ${trackedFiles.length} files checked, all English.`);
