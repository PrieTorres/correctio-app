/**
 * The synthetic photos of the reader's own tests, for the tests of whoever
 * reads photos with it, such as the API's upload route (#47). Kept under
 * `__tests__`, where coverage and the analysis of production code leave them
 * out, and exported as `@correctio/sheet-reader/testing`.
 */
export { photographCard, type Camera, type PrintedCard } from './synthetic-card'
export { localDecoderBinary } from './synthetic-photo'
