/**
 * Kysely's own bookkeeping tables, which hold the migration history and are not
 * part of the data model.
 */
const INTERNAL_TABLE = /^kysely_/;

/** Where the generated Mermaid block starts and ends in `docs/data-model/er-diagram.md`. */
export const GENERATED_START = '<!-- er-diagram:start -->';
export const GENERATED_END = '<!-- er-diagram:end -->';

/** A type Mermaid accepts as is: letters, digits, underscores and parentheses. */
const MERMAID_TYPE = /^[\w()]+$/;

/**
 * The tables of the database, each with its columns in creation order, from
 * the rows of `INFORMATION_SCHEMA.COLUMNS` and `KEY_COLUMN_USAGE`. A column
 * that is a foreign key carries the table it points to in `references`.
 */
export function buildSchema({ columns, foreignKeys }) {
  const references = new Map(foreignKeys.map((key) => [`${key.tableName}.${key.columnName}`, key.referencedTable]));
  const tables = new Map();
  for (const row of columns) {
    if (INTERNAL_TABLE.test(row.tableName)) continue;
    const column = {
      name: row.columnName,
      type: row.columnType,
      nullable: row.isNullable === 'YES',
      primary: row.columnKey === 'PRI',
      unique: row.columnKey === 'UNI',
      references: references.get(`${row.tableName}.${row.columnName}`),
    };
    tables.set(row.tableName, [...(tables.get(row.tableName) ?? []), column]);
  }
  return [...tables].map(([name, tableColumns]) => ({ name, columns: tableColumns }));
}

/**
 * The type as MySQL writes it in a `CREATE TABLE`, with the keyword in capitals
 * and the enum values untouched: `enum('draft')` becomes `ENUM('draft')`.
 */
export function displayType(type) {
  return type.replace(/^[a-z ]+/, (keyword) => keyword.toUpperCase());
}

/** `PK`, `FK` and `UK`, in the order both diagram languages list them. */
function keysOf(column) {
  return [column.primary && 'PK', column.references && 'FK', column.unique && 'UK'].filter(Boolean);
}

/**
 * One line per foreign key, in the crow's foot notation that Mermaid and
 * PlantUML share. The referenced row is optional when the column accepts
 * `NULL`; a unique foreign key is one-to-one. The line is solid when the key is
 * part of the primary key, the child table that cannot exist without its parent.
 */
export function relationships(tables) {
  return tables.flatMap(({ name, columns }) =>
    columns
      .filter((column) => column.references !== undefined)
      .map((column) => {
        const parent = column.nullable ? '|o' : '||';
        const child = column.unique ? 'o|' : 'o{';
        const line = column.primary ? '--' : '..';
        return `${column.references} ${parent}${line}${child} ${name} : ${column.name}`;
      }),
  );
}

/**
 * A column as a Mermaid attribute. Mermaid refuses commas, quotes and spaces in
 * a type, so `DECIMAL(6,2)` and the enums keep only the keyword there and carry
 * the full type in the comment, next to `NULL` for an optional column.
 */
function mermaidAttribute(column) {
  const fullType = displayType(column.type).replaceAll(' ', '_');
  const fitsMermaid = MERMAID_TYPE.test(fullType);
  const type = fitsMermaid ? fullType : fullType.slice(0, fullType.indexOf('('));
  const comment = [fitsMermaid ? '' : displayType(column.type), column.nullable ? 'NULL' : ''].filter(Boolean).join(' ');
  return [type, column.name, keysOf(column).join(', '), comment && `"${comment}"`].filter(Boolean).join(' ');
}

/** The `erDiagram` block GitHub renders, fenced and ready to paste between the markers. */
export function toMermaid(tables) {
  const entities = tables.flatMap(({ name, columns }) => [
    `  ${name} {`,
    ...columns.map((column) => `    ${mermaidAttribute(column)}`),
    '  }',
  ]);
  const lines = relationships(tables).map((relationship) => `  ${relationship}`);
  return ['```mermaid', 'erDiagram', ...entities, ...lines, '```'].join('\n');
}

/** A column as a PlantUML entity field: the type, `NULL` when optional and the keys as stereotypes. */
function plantUmlField(column) {
  const keys = keysOf(column).map((key) => `<<${key}>>`);
  return ['  ', column.name, ' : ', [displayType(column.type), column.nullable ? 'NULL' : '', ...keys].filter(Boolean).join(' ')].join('');
}

/**
 * An entity block. Primary key columns sit above the separator, as in the
 * information engineering notation; a table made only of its key, such as
 * `question_tags`, gets no separator and so no empty compartment.
 */
function plantUmlEntity({ name, columns }) {
  const others = columns.filter((column) => !column.primary).map(plantUmlField);
  return [
    `entity ${name} {`,
    ...columns.filter((column) => column.primary).map(plantUmlField),
    ...(others.length > 0 ? ['  --', ...others] : []),
    '}',
    '',
  ];
}

/**
 * The PlantUML source of the PNG. The layout is Smetana, bundled in the
 * PlantUML jar, so rendering needs Java and nothing else.
 */
export function toPlantUml(tables) {
  const entities = tables.flatMap(plantUmlEntity);
  return [
    '@startuml er-diagram',
    "' Generated by scripts/generate-er-diagram.mjs from the migrated database; edit the migrations, not this file.",
    '!pragma layout smetana',
    '!theme plain',
    'hide circle',
    'hide empty members',
    'skinparam linetype ortho',
    '',
    ...entities,
    ...relationships(tables),
    '@enduml',
    '',
  ].join('\n');
}

/** Swaps what sits between the markers for the new block and keeps the prose around it. */
export function replaceGenerated(markdown, block) {
  const start = markdown.indexOf(GENERATED_START);
  const end = markdown.indexOf(GENERATED_END);
  if (start === -1 || end < start) throw new Error(`The page needs ${GENERATED_START} followed by ${GENERATED_END}`);
  return `${markdown.slice(0, start + GENERATED_START.length)}\n${block}\n${markdown.slice(end)}`;
}

/**
 * The columns the data dictionary documents, by table. A table starts at a
 * `###` heading naming it in backticks, and each column is a table row that
 * opens with the column name in backticks.
 */
export function documentedColumns(markdown) {
  const documented = new Map();
  let current;
  for (const line of markdown.split('\n')) {
    const heading = /^###\s[^`]*`(\w+)`/.exec(line);
    if (heading !== null) {
      current = new Set();
      documented.set(heading[1], current);
    }
    const row = /^\|\s*`(\w+)`\s*\|/.exec(line);
    if (row !== null && current !== undefined) current.add(row[1]);
  }
  return documented;
}

/**
 * Everything the data dictionary is missing or still lists after a migration
 * removed it, one message per table or column. Empty when the dictionary and
 * the database agree.
 */
export function dictionaryGaps(tables, markdown) {
  const documented = documentedColumns(markdown);
  return tables.flatMap(({ name, columns }) => {
    const listed = documented.get(name);
    if (listed === undefined) return [`${name}: table missing from the data dictionary`];
    const actual = new Set(columns.map((column) => column.name));
    return [
      ...[...actual].filter((column) => !listed.has(column)).map((column) => `${name}.${column}: missing from the data dictionary`),
      ...[...listed].filter((column) => !actual.has(column)).map((column) => `${name}.${column}: in the data dictionary but not in the database`),
    ];
  });
}
