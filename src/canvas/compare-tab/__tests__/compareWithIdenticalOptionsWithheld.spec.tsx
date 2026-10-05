/**
 * ⭐ COMPARE OVER A RUN THAT WITHHELD ITS COMPARISON BECAUSE OPTIONS CAME OUT IDENTICAL (CEE #2574, gate 1 v2,
 * `GOAL_FIGURES_OPTIONS_IDENTICAL`; DL 0df0e1 task, 5 Oct). Checked on the producer's shape BEFORE #2574 serves.
 *
 * THE PRODUCER (read at CEE #2574 head dba21233):
 *   · `run-analysis.ts` → `withholdOptionGoalFigures(…, { keepOutcome: true })` over the PLoT envelope: EVERY option
 *     entry loses `win_probability` / `rank` / `robustness`; the identical options also lose `probability_of_goal`,
 *     `probability_of_joint_goal`, `downside`; the brief loses its leader keys; `robustness` is emptied and
 *     `robustness_synthesis` + the other comparison-derived keys are deleted; `inference_warnings` gains the coded
 *     record (`win_shares_withheld: true`). Outcome distributions stay.
 *   · `build-run-delta.ts` then pairs no shares for a Run whose own shares are gone: `win_probabilities: []` with NO
 *     reason (a reason is sent only for `prior_withheld` / `no_matched_option`), and no leader id for that side.
 *
 * THE BYTES: the analysis turn is SERVED bytes (`chat-served-turns.bf-20260927.json`, turn 3), with #2574's strip
 * ported verbatim onto its enrichment, parsed by the REAL `parseV5Response`, applied by the REAL `applyV5State` to the
 * REAL canvas store, rendered by the REAL Compare tab. No LLM, no network.
 *
 * PASS (DL): no ranking/leader words for the withheld Run, no blank / NaN cells, and the recorded change rows shown.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { RunDelta } from '@talchain/schemas/boundary'
import { parseV5Response } from '../../../v5/responseParser'
import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import { useCanvasStore } from '../../store'
import { CompareRunPairBody, COMPARE_RUN_PAIR_TESTID } from '../CompareRunPairBody'
import { COMPARE_SUPPORT_TESTID } from '../CompareSupportFigures'
import turns from '../../conversation/__tests__/fixtures/chat-served-turns.bf-20260927.json'

vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

type Rec = Record<string, unknown>
const SERVED = (turns as unknown as Array<{ body: Rec }>)[3].body
const SCN = 'scn-bf-20260927'
/** Two arms this fixture's Run scores alike (both ≈0.2% share) — the shape gate 1 v2 detects. */
const IDENTICAL = ['raise_to_54_with_ai_release', '048c0e4a']
const PRIOR_LEADER = '74c8d405'

// ── #2574's strip, ported verbatim (constraint-feasibility.ts `withholdOptionGoalFigures`, keepOutcome) ────────────
const COMPARISON_DERIVED_KEYS = ['flip_thresholds', 'conditional_winners', 'p_win_sensitivity', 'factor_evppi', 'decision_evpi', 'robustness_synthesis']
const BRIEF_LEADER_KEYS = ['headline', 'headline_banded', 'robustness', 'robustness_caveat', 'what_would_change']
const SUMMARY_LEADER_KEYS = ['goal_fit', 'win_probability', 'leading_option', 'robustness_band']
function withholdIdentical(env: Rec): Rec {
  const withheld = new Set(IDENTICAL)
  const stripEntry = (entry: unknown): unknown => {
    if (entry === null || typeof entry !== 'object') return entry
    const out: Rec = { ...(entry as Rec) }
    delete out.win_probability; delete out.rank; delete out.robustness
    const id = (out.option_id ?? out.id) as string | undefined
    if (id !== undefined && withheld.has(id)) { delete out.probability_of_goal; delete out.probability_of_joint_goal; delete out.downside }
    return out
  }
  const strip = (v: unknown) => (Array.isArray(v) ? v.map(stripEntry) : v)
  const out: Rec = { ...env }
  if ('option_comparison' in env) out.option_comparison = strip(env.option_comparison)
  if (Array.isArray(env.results)) out.results = strip(env.results)
  else if (env.results && typeof env.results === 'object') {
    const nested = env.results as Rec
    const n: Rec = { ...nested }
    for (const k of ['option_comparison', 'options', 'option_results']) if (k in nested) n[k] = strip(nested[k])
    out.results = n
  }
  const brief = env.decision_brief as Rec | undefined
  if (brief) {
    const b: Rec = { ...brief }
    if ('options' in brief) b.options = strip(brief.options)
    for (const k of BRIEF_LEADER_KEYS) delete b[k]
    const summary = brief.analysis_summary as Rec | undefined
    if (summary) { const s: Rec = { ...summary }; for (const k of SUMMARY_LEADER_KEYS) delete s[k]; b.analysis_summary = s }
    out.decision_brief = b
  }
  for (const k of COMPARISON_DERIVED_KEYS) delete out[k]
  if (env.robustness && typeof env.robustness === 'object') out.robustness = { fragile_edges: [], robust_edges: [] }
  out.inference_warnings = [...((env.inference_warnings as unknown[]) ?? []), {
    code: 'GOAL_FIGURES_OPTIONS_IDENTICAL', severity: 'warning', option_ids: IDENTICAL,
    message: 'Not shown. Raise to £54 with AI release and Test £54 versus £59 by customer cohort before rollout came out identical: in this model they lead to the same outcome.',
    withheld_claims: ['goal_probability', 'joint_probability', 'downside', 'win_share'], win_shares_withheld: true,
  }]
  return out
}

const RUN_AT = ((SERVED.analysis_state as Rec).run_state as Rec).computed_at as string
const pair = { prior: { run_id: 'run-before', computed_at: '2026-09-27T10:11:02.000Z' }, current: { run_id: 'run-latest', computed_at: RUN_AT } }
const priceRow = {
  entity_kind: 'factor_value', entity_id: 'pro_plan_price', field: 'value', label_before: 'Pro plan price', label_after: 'Pro plan price',
  before: { raw: 49, unit: '£' }, after: { raw: 54, unit: '£' }, change: 'changed',
}
const deltaBase = {
  attribution_case: 'C2_unpaired', pair_provenance: { seed_equal: false, hash_equal: false, builds_equal: 'equal', n_equal: true },
  flip_thresholds: [], endpoints: pair, input_coverage: 'complete', input_changes: [priceRow],
}
/**
 * CEE's shape when the LATEST Run withheld its own shares: none paired, no reason, no latest leader id. The leader id is
 * absent BY CONSTRUCTION, not by this fixture: the strip leaves no source with a usable share, so `compactAnalysis`'s
 * `deriveWinner` crowns nobody and `readLeaderOptionId` returns null (CEE `compare-runs.ts`, `analysis-compact.ts`).
 */
const LATEST_WITHHELD: RunDelta = { ...deltaBase, win_probabilities: [], leader: { changed: false, prior_leading_option_id: PRIOR_LEADER, noise_verdict: 'not_noise_qualified' } } as unknown as RunDelta
/** CEE's shape when the EARLIER Run withheld (its record carries `win_shares_withheld`): `prior_withheld`. */
const PRIOR_WITHHELD: RunDelta = { ...deltaBase, win_probabilities: [], win_probabilities_unavailable: 'prior_withheld', leader: { changed: false, current_leading_option_id: PRIOR_LEADER, noise_verdict: 'not_noise_qualified' } } as unknown as RunDelta

function servedTurn({ withheld, delta, leaderClaim }: { withheld: boolean; delta: RunDelta; leaderClaim?: Rec }): Rec {
  const t = structuredClone(SERVED)
  const block = (t.blocks as Rec[])[0]
  if (withheld) {
    block.enrichment = withholdIdentical(block.enrichment as Rec)
    block.win_probabilities = {}
    block.leading_option_id = null
  }
  t.run_delta = delta
  if (leaderClaim) (t.analysis_state as Rec).leader_claim = leaderClaim
  return t
}

async function replay(body: Rec): Promise<string> {
  const parsed = await parseV5Response(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }))
  if (parsed.kind !== 'response') throw new Error(`parseV5Response rejected the served turn: ${parsed.kind}`)
  applyV5State(parsed.response, useCanvasStore.getState() as unknown as V5ApplicatorStore)
  const s = useCanvasStore.getState()
  expect(s.runDelta).not.toBeNull() // positive control: the delta survived the parser (a quarantined one would be null)
  return s.results.hash as string
}

const original = useCanvasStore.getState()
beforeEach(() => {
  useCanvasStore.setState(original, true)
  const nodes = ((SERVED.draft_graph as Rec).nodes as Rec[]).map((n) => ({ id: n.id as string, type: (n.kind ?? n.type) as string, position: { x: 0, y: 0 }, data: { label: n.label } }))
  useCanvasStore.setState({ currentScenarioId: SCN, nodes, edges: [], analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' }, analysisFreshnessDirty: false } as never)
})
afterEach(() => { cleanup(); useCanvasStore.setState(original, true) })

const CONTEST = /winner|\bleader\b|leading option|ranked|\bahead\b|\bbeats\b|performs best|close call/i
function assertHonest(body: HTMLElement) {
  const text = body.textContent ?? ''
  expect(text.length).toBeGreaterThan(50) // positive control: the panel rendered
  expect(text).not.toMatch(/NaN|undefined|null|\[object/)
  expect(text).not.toMatch(CONTEST)
  // No default-visible science figure (plain words first).
  expect(within(body).queryByRole('region', { name: /What changed between runs|Result comparison/ })?.textContent ?? '').not.toMatch(/\d+%/)
  // No blank cell: every endpoint value and every change row says something.
  for (const dd of body.querySelectorAll('dd')) expect((dd.textContent ?? '').trim().length).toBeGreaterThan(0)
  const rows = within(body).getAllByTestId('analysis-new-whats-changed-input-row')
  expect(rows).toHaveLength(1)
  expect(rows[0]).toHaveTextContent('Pro plan price')
  expect(rows[0]).toHaveTextContent('£49 → £54')
}

/** CONTROL: both Runs entitled, CEE pairs the shares and names the latest leader — the shape #2574 replaces. */
const BOTH_SHOWN: RunDelta = {
  ...deltaBase,
  win_probabilities: [
    { option_id: PRIOR_LEADER, prior: 0.62, current: 0.81, noise_verdict: 'signal' },
    { option_id: 'current_setup', prior: 0.30, current: 0.12, noise_verdict: 'signal' },
  ],
  leader: { changed: false, prior_leading_option_id: PRIOR_LEADER, current_leading_option_id: PRIOR_LEADER, noise_verdict: 'not_noise_qualified' },
} as unknown as RunDelta

describe('Compare over a Run that withheld its comparison (identical options, CEE #2574 shape)', () => {
  it('CONTROL (no withhold, shares paired): the probes below DO see figures and a named option when they are there', async () => {
    const hash = await replay(servedTurn({ withheld: false, delta: BOTH_SHOWN, leaderClaim: { permitted: true, separation: 'separated' } }))
    render(<CompareRunPairBody responseHash={hash} />)
    expect(screen.getByTestId(COMPARE_SUPPORT_TESTID)).toBeInTheDocument()
    expect(screen.getAllByTestId(`${COMPARE_SUPPORT_TESTID}-figure`).length).toBeGreaterThan(0)
    const latest = within(screen.getByRole('region', { name: 'Previous and latest runs' })).getByText('Latest run').parentElement!
    expect(latest).toHaveTextContent('put forward by this run')
  })

  it('LATEST Run withheld, served leader claim: no ranking words, no blank or NaN cell, the change row shown', async () => {
    const hash = await replay(servedTurn({ withheld: true, delta: LATEST_WITHHELD }))
    render(<CompareRunPairBody responseHash={hash} />)
    const body = screen.getByTestId(COMPARE_RUN_PAIR_TESTID)
    assertHonest(body)
    expect(screen.queryByTestId(COMPARE_SUPPORT_TESTID)).toBeNull()
    const latest = within(screen.getByRole('region', { name: 'Previous and latest runs' })).getByText('Latest run').parentElement!
    expect(latest).not.toHaveTextContent('put forward by this run')
  })

  it('⛔ LATEST Run withheld while the turn still PERMITS a leader claim: the identical withhold alone keeps every share and name off', async () => {
    const hash = await replay(servedTurn({ withheld: true, delta: LATEST_WITHHELD, leaderClaim: { permitted: true, separation: 'separated' } }))
    render(<CompareRunPairBody responseHash={hash} />)
    const body = screen.getByTestId(COMPARE_RUN_PAIR_TESTID)
    assertHonest(body)
    expect(screen.queryByTestId(COMPARE_SUPPORT_TESTID)).toBeNull()
    const latest = within(screen.getByRole('region', { name: 'Previous and latest runs' })).getByText('Latest run').parentElement!
    expect(latest).not.toHaveTextContent('put forward by this run')
    // Even on disclosure, no share is printed for the withheld Run.
    fireEvent.click(screen.getByTestId('compare-result-details-toggle'))
    expect(screen.getByTestId('compare-result-details-region').textContent).not.toMatch(/\d+%|NaN/)
  })

  it('EARLIER Run withheld, latest Run permitted: "compared for the first time", no fabricated pair, the change row shown', async () => {
    const hash = await replay(servedTurn({ withheld: false, delta: PRIOR_WITHHELD, leaderClaim: { permitted: true, separation: 'separated' } }))
    render(<CompareRunPairBody responseHash={hash} />)
    const body = screen.getByTestId(COMPARE_RUN_PAIR_TESTID)
    assertHonest(body)
    expect(screen.queryByTestId(COMPARE_SUPPORT_TESTID)).toBeNull()
    expect(body).toHaveTextContent('The options can be compared for the first time.')
  })
})
