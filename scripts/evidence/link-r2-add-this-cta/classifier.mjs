// THE CORRECTED OUTCOME CLASSIFIER — extracted so every round shares one, because
// the defect it fixes was a copy of the same predicate in three probe files.
//
// ⚠ THE DEFECT, and it invalidated a shipped claim. Rounds 1-3 used:
//
//     return d.verdict === 'held' || !!d.blocker_code;
//
// `verdict` is READ and then OVERRIDDEN by the disjunct, so an explicit
// `verdict: "rejected"` that also carries a `blocker_code` scored **HELD**. Arms
// F and G came back `{verdict:"rejected", blocker_code:"PIPELINE_OWNED_FIELD"}`
// with NO `held_proposal` block and `draft_graph: null`, and the probe reported
// them as accepted-and-held. That is trap 13c in its purest form: the 13-mutant
// kit measured whether the TESTS could detect a change, never whether the
// ORACLE was right, so a full kill-rate certified nothing about this.
//
// THE RULE THE FIX ENCODES: an explicit verdict is AUTHORITATIVE and is read
// FIRST. `blocker_code` is only a held-marker in the ABSENCE of a verdict that
// contradicts it. A disjunct can never be used to rescue a signal that a
// stronger, more specific field has already settled.

/** @returns {{kind:string, verdict:string|null, codes:string[], markers:string[]}} */
export function classifyOutcome(step) {
  const b = (step && step.body) || null;
  if (!b) return { kind: 'NO_BODY', verdict: null, codes: [], markers: [] };
  const blocks = b.blocks || [];
  const errBlocks = blocks.filter((x) => x && x.type === 'error');
  const text = String(b.assistant_text || b.message || '');

  const codes = [];
  let verdict = null;
  for (const eb of errBlocks) {
    const d = (eb && eb.details) || {};
    if (d.verdict && !verdict) verdict = d.verdict;
    if (d.rejection_code) codes.push(`rejection:${d.rejection_code}`);
    if (d.blocker_code) codes.push(`blocker:${d.blocker_code}`);
    for (const c of d.violation_codes || []) codes.push(`violation:${c}`);
  }

  // 1. AN EXPLICIT VERDICT WINS, in both directions, before anything else.
  if (verdict === 'rejected') return { kind: 'REFUSED', verdict, codes, markers: ['details.verdict="rejected"'] };
  if (verdict === 'held') return { kind: 'HELD', verdict, codes, markers: ['details.verdict="held"'] };

  // 2. A typed held_proposal block is the next strongest signal.
  if (blocks.some((x) => x && x.type === 'held_proposal'))
    return { kind: 'HELD', verdict, codes, markers: ['held_proposal block'] };

  // 3. Only now may a blocker_code or the prose gate imply "held" — i.e. when no
  //    verdict has already contradicted them.
  const confirmGate = /(holding these changes|nothing in the model moves until you confirm|reply yes to continue|say yes to (?:continue|apply))/i.test(text);
  if (codes.some((c) => c.startsWith('blocker:')) || confirmGate)
    return { kind: 'HELD', verdict, codes, markers: [confirmGate ? 'confirm-gate prose' : 'details.blocker_code (no contradicting verdict)'] };

  if (b.draft_graph) return { kind: 'APPLIED_DIRECT', verdict, codes, markers: ['draft_graph committed'] };
  if (errBlocks.length) return { kind: 'REFUSED', verdict, codes, markers: ['error block, no verdict'] };
  return { kind: 'ANSWERED_NO_MUTATION', verdict, codes, markers: [] };
}

/**
 * SELF-TEST — a classifier that cannot be shown to discriminate is the same kind
 * of instrument the original was. Each case names the direction it guards.
 */
export function selfTest() {
  const cases = [
    { name: 'the ACTUAL arm-F payload — rejected WITH a blocker_code (the defect)', expect: 'REFUSED',
      step: { body: { blocks: [{ type: 'error', details: { verdict: 'rejected', blocker_code: 'PIPELINE_OWNED_FIELD' } }] } } },
    { name: 'a genuine held proposal — verdict held + blocker_code', expect: 'HELD',
      step: { body: { blocks: [{ type: 'error', details: { verdict: 'held', blocker_code: 'STRUCTURAL_APPLY_HELD' } }, { type: 'held_proposal' }] } } },
    { name: 'blocker_code with NO verdict still reads as held', expect: 'HELD',
      step: { body: { blocks: [{ type: 'error', details: { blocker_code: 'STRUCTURAL_APPLY_HELD' } }] } } },
    { name: 'a structural refusal — rejection_code, no verdict', expect: 'REFUSED',
      step: { body: { blocks: [{ type: 'error', details: { rejection_code: 'ORPHAN_NODE' } }] } } },
    { name: 'an applied change', expect: 'APPLIED_DIRECT', step: { body: { blocks: [], draft_graph: { nodes: [] } } } },
    { name: 'a plain answer, no mutation', expect: 'ANSWERED_NO_MUTATION', step: { body: { blocks: [] } } },
  ];
  let ok = true;
  for (const c of cases) {
    const got = classifyOutcome(c.step).kind;
    const pass = got === c.expect;
    if (!pass) ok = false;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${c.expect.padEnd(21)} got ${got.padEnd(21)} ${c.name}`);
  }
  return ok;
}

if (process.argv[1] && process.argv[1].endsWith('probe-classifier.mjs')) {
  console.log('=== classifier self-test ===');
  process.exit(selfTest() ? 0 : 1);
}
