#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { ALLOWED_ADVISORIES } from './dependency-audit/allowed-advisories.mjs';
import { auditVerdict } from './dependency-audit/blocking-advisories.mjs';

/**
 * `node scripts/audit-dependencies.mjs`: the dependency audit of the quality
 * gate. It fails on a high or critical advisory, like `npm audit
 * --audit-level=high`, except the ones in `allowed-advisories.mjs`, which it
 * prints with their reason. `npm audit` exits with 1 whenever it finds
 * anything, so only its JSON decides here.
 */
function main() {
  const audit = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (audit.stdout === '') throw new Error(`npm audit printed nothing: ${audit.stderr}`);

  const { blocking, allowed, stale } = auditVerdict(JSON.parse(audit.stdout), ALLOWED_ADVISORIES);
  for (const advisory of allowed) {
    const entry = ALLOWED_ADVISORIES.find((item) => item.id === advisory.id);
    console.log(`Allowed until #${entry.issue}: ${advisory.packageName} ${advisory.id} (${advisory.severity}). ${entry.reason}`);
  }
  for (const entry of stale) console.log(`No longer found, remove it from the allow list: ${entry.packageName} ${entry.id}`);
  for (const advisory of blocking) {
    console.error(`${advisory.severity}: ${advisory.packageName} — ${advisory.title} ${advisory.url}`);
  }
  if (blocking.length > 0) {
    console.error(`\n${blocking.length} high or critical advisory(ies). Run \`npm audit fix\`, or update the package.`);
    process.exitCode = 1;
    return;
  }
  console.log('Dependency audit: no high or critical advisory outside the allow list.');
}

main();
