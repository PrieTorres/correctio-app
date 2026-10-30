/**
 * The contract shared by the web app and the API: the entities of
 * `docs/Modelo_de_Dados.md`, the Zod schemas that validate them, and the
 * rules both sides must apply alike: the pagination of the exam, the geometry
 * of the answer card, the automatic draw of an exam, the generation of the
 * printed versions and sheets, the grading of a sheet, the public lookup of a
 * grade and the comparison of two registrations.
 */
export * from './answer-card'
export * from './answer-sheet-code'
export * from './application-progress'
export * from './applications'
export * from './build-versions'
export * from './domain'
export * from './draw-questions'
export * from './grades-release'
export * from './grading'
export * from './public-lookup'
export * from './regeneration'
export * from './registration'
export * from './schemas'
