/**
 * The contract shared by the web app and the API: the entities of
 * `docs/Modelo_de_Dados.md`, the Zod schemas that validate them, and the
 * rules both sides must apply alike: the pagination of the exam, the geometry
 * of the answer card and the grading of a sheet.
 */
export * from './answer-card'
export * from './answer-sheet-code'
export * from './applications'
export * from './domain'
export * from './grading'
export * from './schemas'
