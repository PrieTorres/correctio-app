import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COMPLEXITY_LIMITS, complexityRules, ratchet } from '../base.js';

describe('complexityRules', () => {
  it('applies the shared limits by default', () => {
    assert.deepEqual(complexityRules(), {
      complexity: ['error', COMPLEXITY_LIMITS.cyclomatic],
      'sonarjs/cognitive-complexity': ['error', COMPLEXITY_LIMITS.cognitive],
      'max-depth': ['error', COMPLEXITY_LIMITS.depth],
      'max-params': ['error', COMPLEXITY_LIMITS.params],
    });
  });
});

describe('ratchet', () => {
  it('freezes only the limit a legacy file exceeds and keeps the others shared', () => {
    const [entry] = ratchet({ 'src/legacy.tsx': { cyclomatic: 16 } });

    assert.deepEqual(entry.files, ['src/legacy.tsx']);
    assert.deepEqual(entry.rules.complexity, ['error', 16]);
    assert.deepEqual(entry.rules['sonarjs/cognitive-complexity'], ['error', COMPLEXITY_LIMITS.cognitive]);
    assert.deepEqual(entry.rules['max-params'], ['error', COMPLEXITY_LIMITS.params]);
  });

  it('produces one override per legacy file', () => {
    const entries = ratchet({ 'a.ts': { params: 5 }, 'b.ts': { cyclomatic: 12 } });

    assert.equal(entries.length, 2);
    assert.deepEqual(entries[0].rules['max-params'], ['error', 5]);
    assert.deepEqual(entries[1].rules.complexity, ['error', 12]);
  });
});
