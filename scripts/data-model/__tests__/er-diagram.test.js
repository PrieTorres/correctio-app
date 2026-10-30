import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GENERATED_END,
  GENERATED_START,
  buildSchema,
  dictionaryGaps,
  displayType,
  documentedColumns,
  relationships,
  replaceGenerated,
  toMermaid,
  toPlantUml,
} from '../er-diagram.mjs';

/** A row of `INFORMATION_SCHEMA.COLUMNS` as the generator selects it. */
function column(tableName, columnName, columnType, { isNullable = 'NO', columnKey = '' } = {}) {
  return { tableName, columnName, columnType, isNullable, columnKey };
}

/**
 * A slice of the real schema with each kind of link: a plain foreign key, an
 * optional one, a unique one and a child table whose key is part of its own.
 */
const ROWS = {
  columns: [
    column('kysely_migration', 'name', 'varchar(255)', { columnKey: 'PRI' }),
    column('users', 'id', 'varchar(36)', { columnKey: 'PRI' }),
    column('users', 'role', "enum('professor','estudante')"),
    column('questions', 'id', 'varchar(36)', { columnKey: 'PRI' }),
    column('questions', 'teacherId', 'varchar(36)', { columnKey: 'MUL' }),
    column('questions', 'maxScore', 'decimal(6,2)', { isNullable: 'YES' }),
    column('question_tags', 'questionId', 'varchar(36)', { columnKey: 'PRI' }),
    column('question_tags', 'tag', 'varchar(80)', { columnKey: 'PRI' }),
    column('corrections', 'id', 'varchar(36)', { columnKey: 'PRI' }),
    column('corrections', 'studentId', 'varchar(36)', { isNullable: 'YES', columnKey: 'MUL' }),
    column('corrections', 'answerSheetId', 'varchar(36)', { columnKey: 'UNI' }),
    column('corrections', 'sheetNumber', 'int unsigned'),
  ],
  foreignKeys: [
    { tableName: 'questions', columnName: 'teacherId', referencedTable: 'users' },
    { tableName: 'question_tags', columnName: 'questionId', referencedTable: 'questions' },
    { tableName: 'corrections', columnName: 'studentId', referencedTable: 'users' },
    { tableName: 'corrections', columnName: 'answerSheetId', referencedTable: 'questions' },
  ],
};

const TABLES = buildSchema(ROWS);

describe('buildSchema', () => {
  it('groups the columns by table and leaves out the Kysely bookkeeping', () => {
    assert.deepEqual(
      TABLES.map(({ name }) => name),
      ['users', 'questions', 'question_tags', 'corrections'],
    );
  });

  it('reads the keys, the nullability and the referenced table of each column', () => {
    const corrections = TABLES.find(({ name }) => name === 'corrections').columns;
    assert.deepEqual(corrections.find(({ name }) => name === 'answerSheetId'), {
      name: 'answerSheetId',
      type: 'varchar(36)',
      nullable: false,
      primary: false,
      unique: true,
      references: 'questions',
    });
    assert.equal(corrections.find(({ name }) => name === 'studentId').nullable, true);
    assert.equal(corrections.find(({ name }) => name === 'id').references, undefined);
  });
});

describe('displayType', () => {
  it('capitalises the keyword and keeps the enum values as written', () => {
    assert.equal(displayType("enum('objetiva','IN_PROGRESS')"), "ENUM('objetiva','IN_PROGRESS')");
    assert.equal(displayType('int unsigned'), 'INT UNSIGNED');
    assert.equal(displayType('decimal(6,2)'), 'DECIMAL(6,2)');
  });
});

describe('relationships', () => {
  it('draws optional, unique and identifying foreign keys with their own ends', () => {
    assert.deepEqual(relationships(TABLES), [
      'users ||..o{ questions : teacherId',
      'questions ||--o{ question_tags : questionId',
      'users |o..o{ corrections : studentId',
      'questions ||..o| corrections : answerSheetId',
    ]);
  });
});

describe('toMermaid', () => {
  const mermaid = toMermaid(TABLES);

  it('is a fenced erDiagram block', () => {
    assert.match(mermaid, /^```mermaid\nerDiagram\n/);
    assert.match(mermaid, /\n```$/);
  });

  it('moves the types Mermaid cannot parse into the comment, next to NULL', () => {
    assert.match(mermaid, /^ {4}ENUM role "ENUM\('professor','estudante'\)"$/m);
    assert.match(mermaid, /^ {4}DECIMAL maxScore "DECIMAL\(6,2\) NULL"$/m);
    assert.match(mermaid, /^ {4}INT_UNSIGNED sheetNumber$/m);
  });

  it('lists every key of a column', () => {
    assert.match(mermaid, /^ {4}VARCHAR\(36\) questionId PK, FK$/m);
    assert.match(mermaid, /^ {4}VARCHAR\(36\) answerSheetId FK, UK$/m);
  });
});

describe('toPlantUml', () => {
  const plantUml = toPlantUml(TABLES);

  it('puts the primary key above the separator and the rest below it', () => {
    assert.match(plantUml, /entity questions \{\n {2}id : VARCHAR\(36\) <<PK>>\n {2}--\n {2}teacherId : VARCHAR\(36\) <<FK>>\n/);
  });

  it('draws no separator for a table that is only its key', () => {
    assert.match(plantUml, /entity question_tags \{\n {2}questionId : VARCHAR\(36\) <<PK>> <<FK>>\n {2}tag : VARCHAR\(80\) <<PK>>\n\}/);
  });

  it('renders with the layout bundled in the jar', () => {
    assert.match(plantUml, /^@startuml er-diagram\n/);
    assert.match(plantUml, /^!pragma layout smetana$/m);
    assert.match(plantUml, /^users \|o\.\.o\{ corrections : studentId$/m);
  });
});

describe('replaceGenerated', () => {
  it('swaps only what sits between the markers', () => {
    const page = `Intro\n${GENERATED_START}\nold\n${GENERATED_END}\nOutro\n`;
    assert.equal(replaceGenerated(page, 'new'), `Intro\n${GENERATED_START}\nnew\n${GENERATED_END}\nOutro\n`);
  });

  it('refuses a page without the markers instead of losing its text', () => {
    assert.throws(() => replaceGenerated('Intro only', 'new'), /needs/);
    assert.throws(() => replaceGenerated(`${GENERATED_END}\n${GENERATED_START}`, 'new'), /needs/);
  });
});

describe('dictionaryGaps', () => {
  const dictionary = [
    '| Tabela | Entidade |',
    '| `users` | User |',
    '### `users` — User',
    '| `id` | `VARCHAR(36)` |',
    '| `role` | `ENUM` |',
    '### `questions` — Question',
    '| `id` | `VARCHAR(36)` |',
    '| `teacherId` | `VARCHAR(36)` |',
    '| `removedColumn` | `TEXT` |',
    '### `question_tags` — Question.tags',
    '| `questionId` | `VARCHAR(36)` |',
    '| `tag` | `VARCHAR(80)` |',
  ].join('\n');

  it('reports a missing table, a missing column and a column the database no longer has', () => {
    assert.deepEqual(dictionaryGaps(TABLES, dictionary), [
      'questions.maxScore: missing from the data dictionary',
      'questions.removedColumn: in the data dictionary but not in the database',
      'corrections: table missing from the data dictionary',
    ]);
  });

  it('ignores rows outside a table section, such as the summary at the top', () => {
    const documented = documentedColumns(dictionary);
    assert.deepEqual([...documented.keys()], ['users', 'questions', 'question_tags']);
    assert.deepEqual([...documented.get('users')], ['id', 'role']);
  });
});
