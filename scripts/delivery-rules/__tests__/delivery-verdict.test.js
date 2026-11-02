import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checklistOf, closingReferences, deliveryErrors, isReleasePullRequest } from '../delivery-verdict.mjs';

const VIDEO = 'https://github.com/PrieTorres/correctio-app/actions/runs/41350735874/artifacts/13101424905';

/** A pull request body as the template leaves it, with its own checklist still unticked. */
const pullRequestBody = (closes, video = VIDEO) => `## Issue
Closes #${closes}

## Test video
<!-- journey-video:start -->
${video}
<!-- journey-video:end -->

## Checklist
- [ ] Lint, tipos e testes passam
- [ ] README/docs atualizados, se aplicável
`;

/** The checklist of #193 when #194 merged: the work done, the video item left unticked. */
const uxIssue = `### Checklist de aceite

- [x] Proposta aprovada pela PM
- [x] Implementada com teste
- [ ] Vídeo do antes/depois anexado no PR
`;

/** The checklist of #52 with its production check moved under "Depois do merge". */
const deliveryIssue = `### Checklist de aceite
- [x] Tag e release 2.0.0, criadas pelo workflow
- [ ] Evidência (link, print ou vídeo) anexada na issue

### Depois do merge
- [ ] Front publicado apontando para a API: um dado criado num navegador aparece em outro

### Prazo
- [ ] Zip gerado da tag
`;

describe('closingReferences', () => {
  it('reads every closing keyword once, and skips the ones inside a comment', () => {
    assert.deepEqual(closingReferences('Closes #52\nfixes #7, resolves #52\n<!-- Closes #9 -->'), [52, 7]);
  });

  it('finds nothing in an empty body', () => {
    assert.deepEqual(closingReferences(null), []);
  });
});

describe('isReleasePullRequest', () => {
  it('knows the release of the day by its branch', () => {
    assert.equal(isReleasePullRequest('release/2026-11-01'), true);
    assert.equal(isReleasePullRequest('feat/release-notes'), false);
  });
});

describe('checklistOf', () => {
  it('leaves out the video and the evidence items, which the check covers on its own', () => {
    assert.deepEqual(checklistOf(uxIssue), { total: 3, pending: [] });
    assert.deepEqual(checklistOf('- [ ] Vídeo/foto do reteste anexado no PR\n- [ ] Evidência anexada na issue'), {
      total: 2,
      pending: [],
    });
  });

  it('leaves out what sits under "Depois do merge", up to the next heading', () => {
    assert.deepEqual(checklistOf(deliveryIssue), { total: 4, pending: ['Zip gerado da tag'] });
  });

  it('still asks for an acceptance item that mentions a video without being the attachment', () => {
    assert.deepEqual(checklistOf('- [ ] O vídeo da jornada mostra a correção'), {
      total: 1,
      pending: ['O vídeo da jornada mostra a correção'],
    });
  });

  it('counts both tick marks and both bullet styles', () => {
    assert.deepEqual(checklistOf('* [X] Um\n- [x] Dois\n  - [ ] Três'), { total: 3, pending: ['Três'] });
  });
});

describe('deliveryErrors', () => {
  it('lets a pull request through with its own checklist unticked', () => {
    const errors = deliveryErrors({ body: pullRequestBody(193), labels: [], headRef: 'feat/x', issues: [{ number: 193, body: uxIssue }] });
    assert.deepEqual(errors, []);
  });

  it('asks for the closing reference', () => {
    const errors = deliveryErrors({ body: `## Vídeo\n${VIDEO}`, labels: [], headRef: 'fix/x', issues: [] });
    assert.deepEqual(errors, ['Ligue a issue no corpo do PR com "Closes #N".']);
  });

  it('asks for the video, unless a label says no screen changed', () => {
    const body = pullRequestBody(1, '');
    const issues = [{ number: 1, body: '- [x] Feito' }];
    assert.match(deliveryErrors({ body, labels: [], headRef: 'feat/x', issues }).join('\n'), /Falta o vídeo/);
    assert.deepEqual(deliveryErrors({ body, labels: ['docs'], headRef: 'docs/x', issues }), []);
  });

  it('names each item still pending on the issue, and where an after-merge item goes', () => {
    const errors = deliveryErrors({
      body: pullRequestBody(52),
      labels: ['infra'],
      headRef: 'chore/x',
      issues: [{ number: 52, body: deliveryIssue }],
    });
    assert.deepEqual(errors, [
      'Issue #52 tem 1 item(ns) do checklist sem marcar: "Zip gerado da tag".',
      'Item que só se cumpre depois do merge vai sob um título "Depois do merge" na issue, e o check deixa de cobrá-lo.',
    ]);
  });

  it('asks an issue without a checklist for one', () => {
    const errors = deliveryErrors({ body: pullRequestBody(9), labels: [], headRef: 'feat/x', issues: [{ number: 9, body: 'Só texto.' }] });
    assert.deepEqual(errors, ['Issue #9 não tem checklist.']);
  });

  it('does not check the issues again on the release pull request', () => {
    const errors = deliveryErrors({
      body: pullRequestBody(52),
      labels: [],
      headRef: 'release/2026-11-01',
      issues: [{ number: 52, body: '- [ ] Ainda falta' }],
    });
    assert.deepEqual(errors, []);
  });
});
