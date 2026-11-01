/**
 * Advisories the dependency audit lets through, each with the reason and the
 * issue that removes it. The list only shrinks: an entry stays while its
 * issue is open, and the audit says when an entry no longer matches anything,
 * so it can be deleted.
 */
export const ALLOWED_ADVISORIES = Object.freeze([]);
