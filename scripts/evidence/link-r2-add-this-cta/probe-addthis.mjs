// LIVE-ROUTER PROBE — which "add this figure" phrasing does the deployed edit router accept?
//
// Uses the programme's own wire recipe (scripts/golden-journey/lib/wire.mjs) VERBATIM:
// guest posture, NO auth headers, no credential read or embedded anywhere.
//
// DESIGN — a controlled experiment, not a demo:
//   * every candidate gets its OWN fresh scenario UUID and a BYTE-IDENTICAL brief, so the
//     only thing that varies across arms is the PHRASING. One scenario shared across arms
//     would confound arm N with the graph arms 1..N-1 had already mutated.
//   * arm A is the CONTROL: the phrasing the product ships TODAY. If A does not reproduce
//     the refusal, the probe is measuring something other than the defect and no arm's
//     result may be believed (an absence probe with no positive control — trap 13).
//   * outcome is classified from the PRODUCER'S OWN TYPED CHANNEL using the same markers
//     the golden-journey invariant engine derives (held_proposal / details.verdict==='held'
//     / details.blocker_code  vs  details.rejection_code / details.violation_codes), never
//     from the harness author's reading of the prose (trap 13c).

import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sendBufferedTurn, sendStreamedTurn, targets } from '/Users/paulslee/Documents/GitHub/scripts/golden-journey/lib/wire.mjs';

const OUT = process.argv[2] || '/private/tmp/link-r2-lane-8f3c2a/evidence/addthis-probe';
fs.mkdirSync(OUT, { recursive: true });

const log = (...a) => {
  const line = `[${new Date().toISOString()}] ${a.join(' ')}`;
  console.log(line);
  fs.appendFileSync(`${OUT}/probe.log`, line + '\n');
};

// Question-form brief (CEE refuses statement-form at intake). Contains ONE contextual
// figure — £31m annual revenue — that is background to the decision and therefore the
// class of figure the receipt reports as "not modelled". This mirrors L3's actual finding.
const BRIEF =
  `Should we replace our current CRM with HubSpot next quarter, or keep what we have? ` +
  `We are a 34-person B2B sales team with annual revenue of £31m. ` +
  `Annual CRM cost is about £50,000 and switching would cost roughly £20,000 one-off. ` +
  `The goal is higher sales productivity without blowing the budget.`;

// The sentence a charOffset lookup would recover around the figure "£31m".
const SURROUNDING = 'We are a 34-person B2B sales team with annual revenue of £31m.';

const ARMS = [
  {
    id: 'A_CONTROL_SHIPPED',
    note: 'the phrasing the product composes TODAY (V7WhatIWasGivenSection.tsx:298)',
    message: `Please add "£31m" from my brief to the model.`,
  },
  {
    id: 'B_SENTENCE_CONTEXT',
    note: 'bare figure replaced by the charOffset-recovered surrounding sentence',
    message: `Please add this from my brief to the model: "${SURROUNDING}"`,
  },
  {
    id: 'C_FACTOR_PLUS_SENTENCE',
    note: 'explicit add-a-factor instruction PLUS the recovered sentence as evidence',
    message: `Add a factor to the model for the £31m figure in my brief. My brief says: "${SURROUNDING}"`,
  },
  {
    id: 'D_NAMED_FACTOR',
    note: "the estate's proven edit grammar shape (cf. golden-journey T4 'Change X to Y.'), adapted to an add",
    message: `Add a new factor called "Annual revenue" with a value of £31m.`,
  },
  {
    id: 'E_NAMED_FACTOR_CONNECTED',
    note: 'as D but naming connectivity — the known OPTION_NO_FACTOR_EDGES refusal suggests the router cares about edges',
    message: `Add a new factor called "Annual revenue" with a value of £31m, and connect it to the options in the model.`,
  },
];

/** Classify from the producer's typed channel — same markers as invariants.mjs. */
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
  if (heldBlock || heldErr || confirmGate)
    return { kind: 'HELD', markers: [heldBlock && 'held_proposal', heldErr && 'details.verdict/blocker_code', confirmGate && 'confirm-gate prose'].filter(Boolean) };
  const codes = [];
  for (const eb of errBlocks) {
    const d = (eb && eb.details) || {};
    if (d.rejection_code) codes.push(`rejection:${d.rejection_code}`);
    for (const c of d.violation_codes || []) codes.push(`violation:${c}`);
    if (d.source) codes.push(`source:${d.source}`);
    if (d.failure_branch) codes.push(`branch:${d.failure_branch}`);
  }
  if (b.draft_graph) return { kind: 'APPLIED_DIRECT', codes };
  if (errBlocks.length) return { kind: 'REFUSED', codes };
  return { kind: 'NO_TYPED_OUTCOME', codes };
}

const summarise = (step) => {
  const b = (step && step.body) || {};
  const g = b.draft_graph || null;
  return {
    http: step.httpStatus,
    ms: step.ms,
    transportError: step.transportError,
    blockTypes: (b.blocks || []).map((x) => x && x.type),
    suggestedActions: (b.suggested_actions || []).map((a) => a && a.label),
    graphNodes: g ? (g.nodes || []).length : null,
    graphEdges: g ? (g.edges || []).length : null,
    text: ((b.assistant_text || b.message || '') + '').slice(0, 900),
  };
};

async function runArm(arm) {
  const scenarioId = randomUUID();
  log(`${arm.id}: scenario=${scenarioId} — drafting…`);
  const t1 = await sendStreamedTurn({ id: `${arm.id}_DRAFT`, scenarioId, message: BRIEF });
  const draftNodes = t1.graphReady ? (t1.graphReady.nodes || []).length : null;
  const draftLabels = t1.graphReady ? (t1.graphReady.nodes || []).map((n) => n.label) : null;
  log(`${arm.id}: draft terminal=${t1.completeStatus} nodes=${draftNodes} stages=${(t1.frames || []).map((f) => f.stage).join('>')}`);
  fs.writeFileSync(`${OUT}/${arm.id}-draft.json`, JSON.stringify({ scenarioId, brief: BRIEF, completeStatus: t1.completeStatus, frames: t1.frames, draftNodes, draftLabels, transportError: t1.transportError }, null, 2));

  if (!t1.graphReady) {
    log(`${arm.id}: NO GRAPH — arm unmeasured`);
    return { arm: arm.id, note: arm.note, message: arm.message, scenarioId, draftNodes, draftLabels, outcome: { kind: 'UNMEASURED_NO_DRAFT' }, edit: null };
  }

  log(`${arm.id}: edit turn…`);
  const t2 = await sendBufferedTurn({ id: `${arm.id}_ADD`, scenarioId, message: arm.message });
  const outcome = classify(t2);
  const edit = summarise(t2);
  log(`${arm.id}: OUTCOME=${outcome.kind} codes=${JSON.stringify(outcome.codes || outcome.markers || [])} nodes=${draftNodes}->${edit.graphNodes}`);
  fs.writeFileSync(`${OUT}/${arm.id}-edit.json`, JSON.stringify({ scenarioId, message: arm.message, outcome, ...edit, fullBody: t2.body }, null, 2));
  return { arm: arm.id, note: arm.note, message: arm.message, scenarioId, draftNodes, draftLabels, outcome, edit };
}

const results = [];
log(`target=${targets.ceeTurnBase} origin=${targets.origin} arms=${ARMS.length}`);
// Arms run CONCURRENTLY: each owns a distinct scenario UUID, so they cannot interfere.
const settled = await Promise.all(ARMS.map((a) => runArm(a).catch((e) => ({ arm: a.id, error: String(e && e.message ? e.message : e) }))));
results.push(...settled);
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify({ target: targets.ceeTurnBase, brief: BRIEF, surrounding: SURROUNDING, results }, null, 2));

log('===== SUMMARY =====');
for (const r of results) log(`${r.arm.padEnd(26)} ${String(r.outcome && r.outcome.kind).padEnd(20)} nodes ${r.draftNodes}->${r.edit && r.edit.graphNodes} :: ${JSON.stringify((r.outcome && (r.outcome.codes || r.outcome.markers)) || [])}`);
const control = results.find((r) => r.arm === 'A_CONTROL_SHIPPED');
log(`POSITIVE CONTROL (arm A must reproduce the refusal): ${control && control.outcome && control.outcome.kind}`);
