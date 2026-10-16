/**
 * The contract shared by the web app and the API: the entities of
 * `docs/Modelo_de_Dados.md`, the Zod schemas that validate them and the rule
 * of the public lookup, which both sides answer.
 */
export * from './domain'
export * from './public-lookup'
export * from './schemas'
