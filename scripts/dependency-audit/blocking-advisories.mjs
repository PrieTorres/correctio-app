/** Severities that fail the audit, as the quality gate states (RNF18). */
export const BLOCKING_SEVERITIES = Object.freeze(['high', 'critical']);

const ADVISORY_ID = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/;

/** The GitHub advisory id at the end of the advisory address, or the address itself when it has none. */
export function advisoryId(url) {
  return ADVISORY_ID.exec(url)?.[0] ?? url;
}

/**
 * Every advisory in an `npm audit --json` report, once each. A package that
 * is only vulnerable through another one lists that package's name in `via`;
 * the advisory itself is the object, so only objects count.
 */
export function advisoriesIn(report) {
  const byId = new Map();
  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via !== 'object' || via === null) continue;
      const id = advisoryId(via.url);
      byId.set(id, { id, packageName: via.name, severity: via.severity, title: via.title, url: via.url });
    }
  }
  return [...byId.values()];
}

/**
 * Splits the advisories into what fails the audit and what the allow list
 * let through, and names the allowed entries that matched nothing, which can
 * leave the list.
 */
export function auditVerdict(report, allowed) {
  const advisories = advisoriesIn(report).filter((advisory) => BLOCKING_SEVERITIES.includes(advisory.severity));
  const allowedIds = new Set(allowed.map((entry) => entry.id));
  const found = new Set(advisoriesIn(report).map((advisory) => advisory.id));
  return {
    blocking: advisories.filter((advisory) => !allowedIds.has(advisory.id)),
    allowed: advisories.filter((advisory) => allowedIds.has(advisory.id)),
    stale: allowed.filter((entry) => !found.has(entry.id)),
  };
}
