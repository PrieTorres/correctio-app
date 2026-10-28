/**
 * Advisories the dependency audit lets through, each with the reason and the
 * issue that removes it. The list only shrinks: an entry stays while its
 * issue is open, and the audit says when an entry no longer matches anything,
 * so it can be deleted.
 */
export const ALLOWED_ADVISORIES = Object.freeze([
  Object.freeze({
    id: 'GHSA-mrhx-c7xc-m3w5',
    packageName: 'zod',
    reason:
      'Fixed only in zod 4. Every request body is capped at 100 KB before zod sees it (middlewares/body-limit.ts), which bounds the array the advisory needs.',
    issue: 164,
  }),
]);
