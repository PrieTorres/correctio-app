/**
 * `timeZone: 'UTC'` keeps this deterministic regardless of where it runs: the
 * stored timestamps are UTC, and letting the formatter apply the machine's own
 * zone would shift the day near midnight, in tests and for the teacher alike.
 */
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})

/** Renders an ISO timestamp as "10 de setembro", for lists too short for a full date. */
export function formatShortDate(iso: string): string {
  return SHORT_DATE_FORMATTER.format(new Date(iso))
}
