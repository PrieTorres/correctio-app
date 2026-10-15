/**
 * Reads a photographed answer sheet, the same way in the browser and in Node
 * (ADR-006). Pixels in, the identified sheet out; the marks arrive with the
 * printed card of #46.
 */
export * from './identify-sheet'
export * from './qr-decoder'
