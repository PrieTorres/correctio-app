/**
 * The contract shared by the web app and the API: the entities of
 * `docs/Modelo_de_Dados.md`, the Zod schemas that validate them, and the
 * printing rules both sides must apply alike: the pagination of the exam and
 * the geometry of the answer card.
 */
export * from './answer-card'
export * from './applications'
export * from './domain'
export * from './schemas'
