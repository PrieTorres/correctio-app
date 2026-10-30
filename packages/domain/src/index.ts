/**
 * The contract shared by the web app and the API: the entities of
 * `docs/Modelo_de_Dados.md`, the Zod schemas that validate them, and the
 * rules both sides must apply alike: the pagination of the exam, the geometry
 * of the answer card, the automatic draw of an exam, the grading of a sheet and
 * the public lookup of a grade.
 */
export * from './answer-card'
export * from './answer-sheet-code'
export * from './applications'
export * from './domain'
export * from './draw-questions'
export * from './grading'
export * from './public-lookup'
export * from './schemas'
