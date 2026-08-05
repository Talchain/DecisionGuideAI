/**
 * ROADMAP 2.578 — Compare must not contradict itself about what changed.
 *
 * OBSERVED DEFECT (independent simulated-user review, 2026-08-05, evidence
 * `PHASE0-EVIDENCE-2026-07-28/codex-deep-review-2026-08-05-raw/compare-misclassification.yml`):
 * after a visible link-strength edit `+0.50 → +0.80`, one Compare card rendered
 * BOTH `• Rerun (no edits)` AND `Structure changed — comparison is directional
 * only`. Staleness and Undo recognised the same edit correctly.
 *
 * DIAGNOSIS (both sources read at `af5c5a37`):
 *  · "Rerun (no edits)" came from `deriveEditSummary`, which reads the persisted
 *    SCENARIO EVENT LOG. That log cannot contain an in-session direct edit on the
 *    deployed build — `direct_edit` is appended only under `isJourneyTabEnabled()`
 *    (unset in netlify.toml ⇒ false), the append is best-effort `.catch(() => {})`,
 *    and the factory reads `_hydratedEvents`, written ONCE at scenario load.
 *  · "Structure changed" came from `compareStructure`, which read a **content**
 *    hash (`generateGraphHash` hashes edge weight/confidence/belief) as if it
 *    were a **structure** signal. A value-only edit flips that hash.
 *
 * Two labels, two unrelated inputs — so they could disagree, and did.
 *
 * THE FIX SHAPE: one classifier (`classifyGraphChange`) over a canonical graph
 * projection built from the SAME field registry Staleness consumes
 * (`STALE_NODE_FIELDS` / `STALE_EDGE_FIELDS` + `deepEqual`). Every label on the
 * surface reads that one verdict, so they cannot disagree by construction.
 *
 * BINDING (trap 19): every assertion below binds to the EXACT edge id and the
 * EXACT before/after values. A second, deliberately-unchanged edge is present in
 * every fixture so a differ that reports "some edge changed" cannot pass.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Node, Edge } from '@xyflow/react'
import { buildAnalysisSnapshot } from '../../stores/analysisSnapshotFactory'
import { deriveTransitions } from '../deriveTransitions'
import { TransitionCard } from '../TransitionCard'
import type { AnalysisSnapshot } from '../types'
import type { V2RunResponse } from '../../../adapters/plot/v2/types'
import type { ReportV1 } from '../../../adapters/plot/types'

// ---------------------------------------------------------------------------
// The identities under test. Named constants, not literals scattered through
// assertions: every expectation binds to THESE, so a rename cannot silently
// re-point a test at a different object.
// ---------------------------------------------------------------------------

/** The edge the user actually edited. */
const EDITED_EDGE_ID = 'edge-churn-to-mrr'
/** Present in every fixture and NEVER edited — the discriminator. */
const UNTOUCHED_EDGE_ID = 'edge-leads-to-mrr'

const STRENGTH_BEFORE = 0.5
const STRENGTH_AFTER = 0.8

const nodes: Node[] = [
  { id: 'fac_churn', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Monthly Churn Rate', kind: 'factor' } },
  { id: 'fac_leads', type: 'factor', position: { x: 0, y: 80 }, data: { label: 'Lead Volume', kind: 'factor' } },
  { id: 'out_new_mrr', type: 'outcome', position: { x: 200, y: 40 }, data: { label: 'New MRR', kind: 'outcome' } },
]

function edgesWithStrength(weight: number): Edge[] {
  return [
    {
      id: EDITED_EDGE_ID,
      source: 'fac_churn',
      target: 'out_new_mrr',
      data: { weight, direction: 'positive', confidence: 0.7 },
    },
    {
      id: UNTOUCHED_EDGE_ID,
      source: 'fac_leads',
      target: 'out_new_mrr',
      data: { weight: 0.4, direction: 'positive', confidence: 0.6 },
    },
  ]
}

const RESPONSE = {
  analysis_status: 'computed',
  option_comparison_status: 'computed',
  robustness_status: 'unavailable',
  drivers_status: 'unavailable',
  option_comparison: [
    { option_id: 'opt-a', option_label: 'Option A', win_probability: 0.48, confidence_interval: [0.3, 0.7], expected_outcome: 0.5 },
    { option_id: 'opt-b', option_label: 'Option B', win_probability: 0.2, confidence_interval: [0.1, 0.4], expected_outcome: 0.3 },
  ],
  critiques: [],
  response_hash: 'resp-1',
} as unknown as V2RunResponse

const PREV_RUN_AT = '2026-08-05T10:00:00Z'

/**
 * Build a run snapshot the way the LIVE session path does (store.ts:3396):
 * real nodes/edges, and — critically — an EMPTY event list, because that is
 * what `_hydratedEvents` holds for an in-session edit on the deployed build.
 * A fixture carrying `direct_edit` events would be testing a wire the product
 * does not produce (trap 16: a fixture you wrote yourself is not evidence).
 */
function runSnapshot(runNumber: number, weight: number): AnalysisSnapshot {
  return buildAnalysisSnapshot({
    rawV2Response: { ...RESPONSE, response_hash: `resp-${runNumber}` } as V2RunResponse,
    report: {} as ReportV1,
    nodes,
    edges: edgesWithStrength(weight),
    runNumber,
    events: [],
    previousSnapshotTimestamp: runNumber === 1 ? null : PREV_RUN_AT,
  })
}

/** The observed journey: run 1, edit the link +0.50 → +0.80, run 2. */
function valueOnlyEditTransition() {
  const snapshots = [
    runSnapshot(1, STRENGTH_BEFORE),
    runSnapshot(2, STRENGTH_AFTER),
  ]
  const [tr] = deriveTransitions(snapshots)
  return tr
}

// ---------------------------------------------------------------------------
// Mount-path binding (trap 3b).
//
// This estate has twice shipped a UI feature DARK because its tests were bound
// to a component the deployed flags do not mount. These tests bind to
// TransitionCard; TransitionCard reaches a user only through
// CompareTabBody → TransitionsSection, and CompareTabBody mounts only when
// `VITE_FEATURE_COMPARE_TAB` is on. That posture is DERIVED from netlify.toml
// here rather than assumed, so if the flag ever moves this file goes RED and
// says why, instead of staying green about a surface nobody loads.
// ---------------------------------------------------------------------------

describe('mount path — these tests bind to a surface the deployed flags render', () => {
  const repoRoot = resolve(__dirname, '../../../..')
  const netlifyToml = readFileSync(resolve(repoRoot, 'netlify.toml'), 'utf8')

  it('netlify.toml enables VITE_FEATURE_COMPARE_TAB, so CompareTabBody mounts', () => {
    // Positive control: prove we can SEE a setting in this file at all before
    // asserting anything about the one under test (trap 13).
    expect(netlifyToml).toMatch(/VITE_FEATURE_ANALYSIS_HERO_PANEL\s*=\s*"1"/)
    expect(netlifyToml).toMatch(/VITE_FEATURE_COMPARE_TAB\s*=\s*"1"/)
  })

  it('CompareTabBody renders TransitionsSection, which renders TransitionCard', () => {
    const body = readFileSync(resolve(repoRoot, 'src/canvas/compare-tab/CompareTabBody.tsx'), 'utf8')
    const section = readFileSync(resolve(repoRoot, 'src/canvas/compare-tab/TransitionsSection.tsx'), 'utf8')
    expect(body).toContain('<TransitionsSection')
    expect(section).toContain('<TransitionCard')
  })
})

// ---------------------------------------------------------------------------
// The acceptance gate.
// ---------------------------------------------------------------------------

describe('ROADMAP 2.578 — a value-only link edit is reported as exactly that', () => {
  it('does NOT claim "Rerun (no edits)" — the edit is visible in the graph itself', () => {
    const tr = valueOnlyEditTransition()
    expect(tr.edits).not.toContain('Rerun (no edits)')
  })

  it('does NOT claim the structure changed — node and edge sets are identical', () => {
    const tr = valueOnlyEditTransition()
    expect(tr.structureChanged).toBe(false)
  })

  it('classifies the change as value_only', () => {
    const tr = valueOnlyEditTransition()
    expect(tr.changeVerdict.kind).toBe('value_only')
  })

  it('reports the changed edge BY ID, with the exact before/after values', () => {
    const tr = valueOnlyEditTransition()
    const changes = tr.changeVerdict.fieldChanges.filter(c => c.field === 'weight')
    expect(changes).toHaveLength(1)
    expect(changes[0].id).toBe(EDITED_EDGE_ID)
    expect(changes[0].element).toBe('edge')
    expect(changes[0].before).toBe(STRENGTH_BEFORE)
    expect(changes[0].after).toBe(STRENGTH_AFTER)
  })

  it('does NOT report the untouched edge — binding is to the edited object, not "an edge"', () => {
    const tr = valueOnlyEditTransition()
    const touchedIds = tr.changeVerdict.fieldChanges.map(c => c.id)
    expect(touchedIds).toContain(EDITED_EDGE_ID)
    expect(touchedIds).not.toContain(UNTOUCHED_EDGE_ID)
  })
})

// ---------------------------------------------------------------------------
// The coherence rule: two labels on one screen must not be able to disagree.
// ---------------------------------------------------------------------------

describe('ROADMAP 2.578 — the labels cannot contradict each other', () => {
  it('never renders "no edits" and "Structure changed" together (the observed defect)', () => {
    const tr = valueOnlyEditTransition()
    render(
      <TransitionCard transition={tr} startOpen showExpert allDeltas={[tr.winnerProbDelta]} />,
    )
    const noEdits = screen.queryByText(/Rerun \(no edits\)/)
    const structure = screen.queryByText(/Structure changed/)
    // The exact pair witnessed in the capture. Either alone would be a
    // different (possibly correct) statement; TOGETHER they are incoherent.
    expect(noEdits && structure).toBeFalsy()
  })

  it('renders the edit as "+0.5 → +0.8" against the edited relationship', () => {
    const tr = valueOnlyEditTransition()
    render(
      <TransitionCard transition={tr} startOpen showExpert allDeltas={[tr.winnerProbDelta]} />,
    )
    expect(screen.getByTestId(`change-edge-${EDITED_EDGE_ID}-weight`)).toHaveTextContent(
      `${STRENGTH_BEFORE} → ${STRENGTH_AFTER}`,
    )
  })

  it('renders no change row for the untouched edge', () => {
    const tr = valueOnlyEditTransition()
    render(
      <TransitionCard transition={tr} startOpen showExpert allDeltas={[tr.winnerProbDelta]} />,
    )
    expect(screen.queryByTestId(`change-edge-${UNTOUCHED_EDGE_ID}-weight`)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// The honesty rule: a claim the data does not support is not shown at all.
// ---------------------------------------------------------------------------

describe('ROADMAP 2.578 — absent evidence yields silence, never a confident label', () => {
  /**
   * The persisted-run rebuild path (`persistedRunSnapshotFactory`) has no graph:
   * a `run_analysis` fact stores the analysis, not the model. `nodes`/`edges`
   * are null there by design, so no projection exists and the honest answer is
   * "we cannot characterise this change".
   */
  function rebuiltSnapshot(runNumber: number): AnalysisSnapshot {
    return buildAnalysisSnapshot({
      rawV2Response: { ...RESPONSE, response_hash: `resp-${runNumber}` } as V2RunResponse,
      report: null,
      nodes: null,
      edges: null,
      runNumber,
      events: [],
      previousSnapshotTimestamp: runNumber === 1 ? null : PREV_RUN_AT,
    })
  }

  it('a graph-less pair is not_comparable, not "no edits" and not "structure changed"', () => {
    const [tr] = deriveTransitions([rebuiltSnapshot(1), rebuiltSnapshot(2)])
    expect(tr.changeVerdict.kind).toBe('not_comparable')
    expect(tr.structureChanged).toBe(false)
    expect(tr.edits).not.toContain('Rerun (no edits)')
  })

  it('a genuinely identical rerun DOES say "no edits" — the honest use of that label', () => {
    const snapshots = [runSnapshot(1, STRENGTH_BEFORE), runSnapshot(2, STRENGTH_BEFORE)]
    const [tr] = deriveTransitions(snapshots)
    expect(tr.changeVerdict.kind).toBe('unchanged')
    expect(tr.edits).toContain('Rerun (no edits)')
    expect(tr.structureChanged).toBe(false)
  })

  it('a real structural change IS reported as structural', () => {
    const before = runSnapshot(1, STRENGTH_BEFORE)
    const after = buildAnalysisSnapshot({
      rawV2Response: { ...RESPONSE, response_hash: 'resp-2' } as V2RunResponse,
      report: {} as ReportV1,
      nodes,
      // The untouched edge is REMOVED — a membership change, by identity.
      edges: edgesWithStrength(STRENGTH_BEFORE).filter(e => e.id !== UNTOUCHED_EDGE_ID),
      runNumber: 2,
      events: [],
      previousSnapshotTimestamp: PREV_RUN_AT,
    })
    const [tr] = deriveTransitions([before, after])
    expect(tr.changeVerdict.kind).toBe('structural')
    expect(tr.structureChanged).toBe(true)
    const removed = tr.changeVerdict.membershipChanges.filter(c => c.op === 'removed')
    expect(removed).toHaveLength(1)
    expect(removed[0].id).toBe(UNTOUCHED_EDGE_ID)
  })
})
