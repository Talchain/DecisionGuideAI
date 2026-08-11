// LIVE-ROUTER PROBE, ROUND 2 — round 1 established that the LLM *does* emit operations for
// every explicit add phrasing, and the GRAPH VALIDATOR rejects them:
//   ORPHAN_NODE      (B, C, D — a factor with no edges)
//   NO_PATH_TO_GOAL  (E — connected to the options but not reaching the goal)
// So the question round 2 answers is narrow and decisive: is there ANY instruction the
// engine ACCEPTS, i.e. one that names the causal connection all the way to the goal?
//
// If the answer is no, the CTA cannot be made to work and must be removed or re-scoped.
// If the answer is yes, the acceptance condition is "the instruction names a target that
// reaches the goal" — which is a property of the USER's knowledge, not of the receipt.

import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sendBufferedTurn, sendStreamedTurn, targets } from '/Users/paulslee/Documents/GitHub/scripts/golden-journey/lib/wire.mjs';

const OUT = '/private/tmp/link-r2-lane-8f3c2a/evidence/addthis-probe-r2';
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

// Targets observed in round 1's drafted graphs (labels are stable across arms).
const ARMS = [
  {
    id: 'F_CONNECT_TO_BUDGET',
    note: 'names an existing factor that already reaches the goal',
    message: `Add a new factor called "Annual revenue" with a value of £31m, and connect it so that it influences Budget Headroom.`,
  },
  {
    id: 'G_CONNECT_CHAIN_TO_GOAL',
    note: 'names the full chain, including the goal node, explicitly',
    message: `Add a new factor called "Annual revenue" with a value of £31m. Connect it so that Annual revenue influences Budget Headroom, and make sure the new factor has a path through to the goal "Increase Sales Productivity Within Budget".`,
  },
  {
    id: 'H_RELATIVE_COST',
    note: "the engine's OWN suggested resolution, quoted back to it (its clarify text proposes expressing CRM cost as a share of revenue)",
    message: `Add a new factor called "Annual revenue" with a value of £31m, and connect it to Annual CRM Licence Cost so that CRM cost can be read as a share of revenue.`,
  },
  {
    id: 'I_CONTROL_KNOWN_GOOD',
    note: "POSITIVE CONTROL — the estate's own proven edit grammar (golden-journey T4). If THIS is refused, the probe is measuring a broken service, not the phrasings.",
    message: `Change Annual CRM Licence Cost to £64,000.`,
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
  if (heldBlock || heldErr || confirmGate) return { kind: 'HELD', markers: [heldBlock && 'held_proposal', heldErr && 'details.verdict/blocker_code', confirmGate && 'confirm-gate prose'].filter(Boolean) };
  const codes = [];
  for (const eb of errBlocks) {
    const d = (eb && eb.details) || {};
    if (d.rejection_code) codes.push(`rejection:${d.rejection_code}`);
    for (const c of d.violation_codes || []) codes.push(`violation:${c}`);
    if (d.source) codes.push(`source:${d.source}`);
  }
  if (b.draft_graph) return { kind: 'APPLIED_DIRECT', codes };
  if (errBlocks.length) return { kind: 'REFUSED', codes };
  return { kind: 'NO_TYPED_OUTCOME', codes };
}

async function runArm(arm) {
  const scenarioId = randomUUID();
  log(`${arm.id}: scenario=${scenarioId} drafting…`);
  const t1 = await sendStreamedTurn({ id: `${arm.id}_DRAFT`, scenarioId, message: BRIEF });
  if (!t1.graphReady) {
    log(`${arm.id}: NO DRAFT — unmeasured`);
    return { arm: arm.id, outcome: { kind: 'UNMEASURED_NO_DRAFT' } };
  }
  const before = (t1.graphReady.nodes || []).length;
  log(`${arm.id}: draft nodes=${before}; edit turn…`);
  const t2 = await sendBufferedTurn({ id: `${arm.id}_ADD`, scenarioId, message: arm.message });
  const outcome = classify(t2);
  const b = t2.body || {};
  const g = b.draft_graph || null;
  const rec = {
    arm: arm.id,
    note: arm.note,
    message: arm.message,
    scenarioId,
    nodesBefore: before,
    nodesAfter: g ? (g.nodes || []).length : null,
    newLabels: g ? (g.nodes || []).map((n) => n.label).filter((l) => !(t1.graphReady.nodes || []).some((n) => n.label === l)) : null,
    outcome,
    blockTypes: (b.blocks || []).map((x) => x && x.type),
    text: ((b.assistant_text || b.message || '') + '').slice(0, 800),
  };
  log(`${arm.id}: OUTCOME=${outcome.kind} ${JSON.stringify(outcome.codes || outcome.markers || [])} nodes ${before}->${rec.nodesAfter} new=${JSON.stringify(rec.newLabels)}`);
  fs.writeFileSync(`${OUT}/${arm.id}.json`, JSON.stringify({ ...rec, fullBody: b }, null, 2));
  return rec;
}

log(`target=${targets.ceeTurnBase} arms=${ARMS.length}`);
const results = await Promise.all(ARMS.map((a) => runArm(a).catch((e) => ({ arm: a.id, error: String(e) }))));
fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify({ brief: BRIEF, results }, null, 2));
log('===== SUMMARY =====');
for (const r of results) log(`${String(r.arm).padEnd(26)} ${String(r.outcome && r.outcome.kind).padEnd(18)} ${r.nodesBefore}->${r.nodesAfter} ${JSON.stringify((r.outcome && (r.outcome.codes || r.outcome.markers)) || [])}`);
const ctl = results.find((r) => r.arm === 'I_CONTROL_KNOWN_GOOD');
log(`POSITIVE CONTROL (proven edit grammar must NOT be refused): ${ctl && ctl.outcome && ctl.outcome.kind}`);
