// LIVE-ROUTER PROBE, ROUND 3 — settling the DESIGN, not just the grammar.
//
// What rounds 1-2 established, measured:
//   A  bare figure ("Please add \"£31m\" from my brief to the model.")
//        -> NO typed outcome; the engine answers with a SPECIFIC, well-grounded
//           question ("it is not clear what it should causally connect to…").
//   B,C,D  figure + brief sentence, or a named factor, still with NO causal target
//        -> the LLM emits operations and the GRAPH VALIDATOR refuses: ORPHAN_NODE.
//   E  connected to the options but not the goal -> NO_PATH_TO_GOAL.
//   F,G  the instruction NAMES a causal target that keeps the graph valid
//        -> **HELD** (structural change proposed, confirm to apply) = ACCEPTED.
//   I  positive control, the estate's proven edit grammar -> APPLIED_DIRECT. Service healthy.
//
// So an accepted instruction EXISTS, and its acceptance condition is knowledge the
// RECEIPT DOES NOT HAVE: what the figure should causally influence. A CTA that picked a
// target for the user would be the product inventing causality on their behalf.
//
// Round 3 therefore asks the only remaining question: is there a phrasing that RELIABLY
// produces the grounded QUESTION rather than an orphan-node attempt? That is the message
// an honest "what should this affect?" CTA must send — it has to be the engine's
// question path, deterministically, not the structural-error path B/C/D fell into.

import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sendBufferedTurn, sendStreamedTurn, targets } from '/Users/paulslee/Documents/GitHub/scripts/golden-journey/lib/wire.mjs';

const OUT = '/private/tmp/link-r2-lane-8f3c2a/evidence/addthis-probe-r3';
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => {
  const line = `[${new Date().toISOString()}] ${a.join(' ')}`;
  console.log(line);
  fs.appendFileSync(`${OUT}/probe.log`, line + '\n');
};

const BRIEF =
  `Should we replace our current CRM with HubSpot next quarter, or keep what we have? ` +
  `We are a 34-person B2B sales team with annual revenue of £31m. ` +
  `Annual CRM cost is about £50,000 and switching would cost roughly £20,000 one-off. ` +
  `The goal is higher sales productivity without blowing the budget.`;
const SENTENCE = 'We are a 34-person B2B sales team with annual revenue of £31m.';

const ARMS = [
  {
    id: 'J_ASK_WHERE_WITH_SENTENCE',
    note: 'ASK phrasing + the charOffset-recovered sentence, explicitly deferring the change',
    message: `My brief mentions £31m, which is not in the model yet. The brief says: "${SENTENCE}" What could this figure influence in this decision, and where would it belong? Don't change the model yet — tell me the options first.`,
  },
  {
    id: 'K_ASK_WHERE_SHORT',
    note: 'ASK phrasing, sentence but no explicit deferral — does the deferral clause carry the weight?',
    message: `My brief mentions £31m ("${SENTENCE}") and it is not in the model. What could it influence here?`,
  },
  {
    id: 'L_ASK_NO_SENTENCE',
    note: 'DISCRIMINATING TWIN of J: identical ask, sentence REMOVED. Isolates what the charOffset context actually buys.',
    message: `My brief mentions £31m, which is not in the model yet. What could this figure influence in this decision, and where would it belong? Don't change the model yet — tell me the options first.`,
  },
];

function classify(step) {
  const b = (step && step.body) || null;
  if (!b) return { kind: 'no_body' };
  const blocks = b.blocks || [];
  const errBlocks = blocks.filter((x) => x && x.type === 'error');
  const heldBlock = blocks.some((x) => x && x.type === 'held_proposal');
  const heldErr = errBlocks.some((x) => {
    const d = (x && x.details) || {};
    return d.verdict === 'held' || !!d.blocker_code;
  });
  const text = (b.assistant_text || b.message || '') + '';
  const confirmGate = /(holding these changes|nothing in the model moves until you confirm|reply yes to continue|say yes to (?:continue|apply))/i.test(text);
  if (heldBlock || heldErr || confirmGate) return { kind: 'HELD' };
  const codes = [];
  for (const eb of errBlocks) {
    const d = (eb && eb.details) || {};
    if (d.rejection_code) codes.push(`rejection:${d.rejection_code}`);
    for (const c of d.violation_codes || []) codes.push(`violation:${c}`);
  }
  if (b.draft_graph) return { kind: 'APPLIED_DIRECT', codes };
  if (errBlocks.length) return { kind: 'REFUSED', codes };
  return { kind: 'ANSWERED_NO_MUTATION', codes };
}

async function runArm(arm) {
  const scenarioId = randomUUID();
  log(`${arm.id}: scenario=${scenarioId} drafting…`);
  const t1 = await sendStreamedTurn({ id: `${arm.id}_DRAFT`, scenarioId, message: BRIEF });
  if (!t1.graphReady) return { arm: arm.id, outcome: { kind: 'UNMEASURED_NO_DRAFT' } };
  const t2 = await sendBufferedTurn({ id: `${arm.id}_ASK`, scenarioId, message: arm.message });
  const outcome = classify(t2);
  const b = t2.body || {};
  const rec = {
    arm: arm.id,
    note: arm.note,
    message: arm.message,
    scenarioId,
    outcome,
    blockTypes: (b.blocks || []).map((x) => x && x.type),
    suggestedActions: (b.suggested_actions || []).map((a) => a && a.label),
    text: ((b.assistant_text || b.message || '') + '').slice(0, 1400),
  };
  log(`${arm.id}: OUTCOME=${outcome.kind} ${JSON.stringify(outcome.codes || [])}`);
  log(`${arm.id}: TEXT>>> ${rec.text.slice(0, 700).replace(/\n/g, ' ')}`);
  log(`${arm.id}: ACTIONS ${JSON.stringify(rec.suggestedActions)}`);
  fs.writeFileSync(`${OUT}/${arm.id}.json`, JSON.stringify({ ...rec, fullBody: b }, null, 2));
  return rec;
}

log(`target=${targets.ceeTurnBase} arms=${ARMS.length}`);
const results = await Promise.all(ARMS.map((a) => runArm(a).catch((e) => ({ arm: a.id, error: String(e) }))));
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify({ brief: BRIEF, sentence: SENTENCE, results }, null, 2));
log('===== SUMMARY =====');
for (const r of results) log(`${String(r.arm).padEnd(28)} ${String(r.outcome && r.outcome.kind)}`);
