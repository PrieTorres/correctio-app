import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { advisoriesIn, advisoryId, auditVerdict } from '../blocking-advisories.mjs';
import { ALLOWED_ADVISORIES } from '../allowed-advisories.mjs';

const advisory = (name, severity, ghsa, title = `${name} issue`) => ({
  source: 1,
  name,
  severity,
  title,
  url: `https://github.com/advisories/${ghsa}`,
});

/** The shape of `npm audit --json`: a package vulnerable through another names it in `via`. */
const report = {
  vulnerabilities: {
    zod: { severity: 'high', via: [advisory('zod', 'high', 'GHSA-mrhx-c7xc-m3w5')] },
    'body-parser': { severity: 'high', via: [advisory('body-parser', 'high', 'GHSA-27r3-jxmh-p828')] },
    express: { severity: 'high', via: ['body-parser'] },
    nodemailer: {
      severity: 'moderate',
      via: [advisory('nodemailer', 'moderate', 'GHSA-8c8m-p3m8-cjg8'), advisory('nodemailer', 'moderate', 'GHSA-8c8m-p3m8-cjg8')],
    },
  },
};

describe('advisoryId', () => {
  it('reads the GitHub advisory id out of its address', () => {
    assert.equal(advisoryId('https://github.com/advisories/GHSA-mrhx-c7xc-m3w5'), 'GHSA-mrhx-c7xc-m3w5');
    assert.equal(advisoryId('https://example.com/advisory/1'), 'https://example.com/advisory/1');
  });
});

describe('advisoriesIn', () => {
  it('lists each advisory once, and not the packages only vulnerable through another', () => {
    const ids = advisoriesIn(report).map((item) => item.id).sort();

    assert.deepEqual(ids, ['GHSA-27r3-jxmh-p828', 'GHSA-8c8m-p3m8-cjg8', 'GHSA-mrhx-c7xc-m3w5']);
  });

  it('copes with a clean report', () => {
    assert.deepEqual(advisoriesIn({}), []);
  });
});

describe('auditVerdict', () => {
  it('fails on a high advisory outside the list, lets the allowed one through and ignores moderate ones', () => {
    const verdict = auditVerdict(report, ALLOWED_ADVISORIES);

    assert.deepEqual(verdict.blocking.map((item) => item.packageName), ['body-parser']);
    assert.deepEqual(verdict.allowed.map((item) => item.packageName), ['zod']);
    assert.deepEqual(verdict.stale, []);
  });

  it('passes once the only high advisory is the allowed one', () => {
    const onlyZod = { vulnerabilities: { zod: report.vulnerabilities.zod } };

    assert.deepEqual(auditVerdict(onlyZod, ALLOWED_ADVISORIES).blocking, []);
  });

  /** An entry left behind would silently allow the advisory again if it ever came back. */
  it('names the allowed entries that no longer match anything', () => {
    const verdict = auditVerdict({ vulnerabilities: {} }, ALLOWED_ADVISORIES);

    assert.deepEqual(verdict.stale.map((entry) => entry.id), ['GHSA-mrhx-c7xc-m3w5']);
  });

  it('fails on a critical advisory too', () => {
    const critical = { vulnerabilities: { lib: { severity: 'critical', via: [advisory('lib', 'critical', 'GHSA-aaaa-bbbb-cccc')] } } };

    assert.equal(auditVerdict(critical, ALLOWED_ADVISORIES).blocking.length, 1);
  });
});

describe('ALLOWED_ADVISORIES', () => {
  it('gives every entry a reason and the issue that removes it', () => {
    for (const entry of ALLOWED_ADVISORIES) {
      assert.match(entry.id, /^GHSA-/);
      assert.ok(entry.reason.length > 20);
      assert.ok(Number.isInteger(entry.issue));
    }
  });
});
