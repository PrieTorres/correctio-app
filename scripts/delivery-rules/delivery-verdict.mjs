/** Labels of pull requests that change no screen, so they owe no test video. */
export const NO_VIDEO_LABELS = Object.freeze(['docs', 'infra', 'process', 'qa', 'ux', 'po']);

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const CLOSING_REFERENCE = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;
const VIDEO_LINK =
  /(github\.com\/user-attachments\/assets\/|github\.com\/[^/\s]+\/[^/\s]+\/actions\/runs\/\d+\/artifacts\/\d+|\.(mp4|mov|webm)\b|loom\.com\/share|drive\.google\.com|youtu\.?be)/i;
const CHECKLIST_ITEM = /^\s*[-*] \[([ xX])\]\s*(.*)$/;
const HEADING = /^#{1,6}\s/;
const AFTER_MERGE_HEADING = /depois do merge/i;

/**
 * Items an open pull request cannot be asked to tick. The test video lives in
 * the pull request, where this check already looks for it, and the evidence
 * goes on the issue once the work is merged.
 */
const ITEMS_THE_CHECK_COVERS = Object.freeze([/^v[íi]deo\b.*\banexad[oa] no PR/i, /^evid[êe]ncia\b.*\banexad[oa] na issue/i]);

const MISSING_REFERENCE = 'Ligue a issue no corpo do PR com "Closes #N".';
const MISSING_VIDEO =
  'Falta o vídeo do teste. A CI escreve sozinha o link da jornada gravada pelo Cypress ao terminar; se ela falhou, corrija e faça push de novo, ou anexe um vídeo (upload no PR ou link Drive/Loom/YouTube).';
const AFTER_MERGE_HINT = 'Item que só se cumpre depois do merge vai sob um título "Depois do merge" na issue, e o check deixa de cobrá-lo.';

/** Markdown left in a body after its HTML comments, which the template uses for instructions. */
function visibleText(body) {
  return (body ?? '').replace(HTML_COMMENT, '');
}

/** The issue numbers a pull request closes, once each and in the order written. */
export function closingReferences(body) {
  return [...new Set([...visibleText(body).matchAll(CLOSING_REFERENCE)].map((match) => Number(match[1])))];
}

/**
 * The release pull request of the day only gathers pull requests that each
 * passed this check against their own issues, so it does not check them again.
 */
export function isReleasePullRequest(headRef) {
  return headRef.startsWith('release/');
}

/**
 * The checklist of an issue: how many items it has, and the unticked ones a
 * pull request still has to deliver. Items under a "Depois do merge" heading,
 * up to the next heading, and the ones in `ITEMS_THE_CHECK_COVERS` count
 * toward the total but are never pending.
 */
export function checklistOf(issueBody) {
  let total = 0;
  let afterMerge = false;
  const pending = [];
  for (const line of visibleText(issueBody).split('\n')) {
    if (HEADING.test(line)) afterMerge = AFTER_MERGE_HEADING.test(line);
    const item = CHECKLIST_ITEM.exec(line);
    if (item === null) continue;
    total += 1;
    const text = item[2].trim();
    const ticked = item[1] !== ' ';
    if (!ticked && !afterMerge && !ITEMS_THE_CHECK_COVERS.some((pattern) => pattern.test(text))) pending.push(text);
  }
  return { total, pending };
}

/** What is wrong with one linked issue's checklist, if anything. */
function issueComplaints({ number, total, pending }) {
  if (total === 0) return [`Issue #${number} não tem checklist.`];
  if (pending.length === 0) return [];
  const items = pending.map((text) => `"${text}"`).join('; ');
  return [`Issue #${number} tem ${pending.length} item(ns) do checklist sem marcar: ${items}.`];
}

/**
 * Why a pull request cannot merge yet, as the check prints it; empty when it
 * can. The pull request's own checklist is a reminder for its author and
 * never blocks: each of its items repeats a rule checked here or by the CI.
 * `issues` holds the body of every issue the pull request closes.
 */
export function deliveryErrors({ body, labels, headRef, issues }) {
  const errors = [];
  if (closingReferences(body).length === 0) errors.push(MISSING_REFERENCE);
  if (!labels.some((label) => NO_VIDEO_LABELS.includes(label)) && !VIDEO_LINK.test(visibleText(body))) errors.push(MISSING_VIDEO);
  if (isReleasePullRequest(headRef)) return errors;

  const checklists = issues.map(({ number, body: issueBody }) => ({ number, ...checklistOf(issueBody) }));
  const complaints = checklists.flatMap(issueComplaints);
  if (checklists.some(({ pending }) => pending.length > 0)) complaints.push(AFTER_MERGE_HINT);
  return [...errors, ...complaints];
}
