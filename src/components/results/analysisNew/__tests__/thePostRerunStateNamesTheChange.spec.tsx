/**
 * After a rerun, the Reasoning tab AND the chat say what changed, in the same words (Panel, 30 Sep 2026).
 *
 * Served before this (SC-24 witness, #75 5920770514, CEE `ddd6586d` · UI `986beec9`): an input edit then a
 * rerun. The Compare tab listed "Investor fit rate: 5% → 7%". The Reasoning tab only had a receipt line
 * ("What's changed · Compared with the earlier run"); its "What we have" said only the option count. The
 * chat's analysis card said nothing about the change at all.
 *
 * Now ONE function (`runDeltaSentence`) words the displayed Run against the Run before it, from the one
 * reader's view (`buildRunDeltaView` / `displayedRunDeltaView`), and both surfaces call it. The chat card
 * finds its own Run by the wire block's content hash, which is the store's `currentResultsHash` for the same
 * analysis, so an older card never borrows the latest comparison.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { RunDelta } from '@talchain/schemas/boundary'
import { RunDeltaSchema } from '@talchain/schemas/boundary'
import { buildRunDeltaView } from '../runDeltaView'
import { buildCommitmentSynthesis, runDeltaSentence } from '../commitmentSynthesis'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { decisionWithLeaderWithheld } from './analysisNewFixtures'
import { mapV5Block } from '../../../../v5/blocks/mapV5Blocks'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import { V5AnalysisResultBlock } from '../../../../v5/blocks/V5AnalysisResultBlock'
import { useCanvasStore } from '../../../../canvas/store'
import type { V5AnalysisResultBlock as ChatCard } from '../../../../canvas/conversation/types'

const LABELS: Record<string, string> = { fac_fit: 'Investor fit rate', opt_a: 'Investment Firm Outreach', opt_b: 'Angel Bridge Outreach' }
const label = (id: string) => LABELS[id] ?? null

// The served shape: one factor value edited, a C2 pair, no option movement the producer can qualify.
const FIT = {
  entity_kind: 'factor_value', entity_id: 'fac_fit', field: 'value', label_before: 'Investor fit rate', label_after: 'Investor fit rate',
  before: { raw: 5, unit: '%' }, after: { raw: 7, unit: '%' }, change: 'changed',
} as const
const SERVED = {
  attribution_case: 'C2_unpaired',
  pair_provenance: { seed_equal: false, hash_equal: false, builds_equal: 'equal', n_equal: true },
  leader: { changed: false, noise_verdict: 'not_noise_qualified' },
  win_probabilities: [],
  flip_thresholds: [],
  endpoints: { prior: { run_id: 'run-a', computed_at: '2026-09-30T22:10:00.000Z' }, current: { run_id: 'run-b', computed_at: '2026-09-30T22:18:00.000Z' } },
  input_coverage: 'complete',
  input_changes: [FIT],
}

function delta(over: Record<string, unknown> = {}): RunDelta {
  const d = { ...SERVED, ...over }
  // The fixture is the CONTRACT's shape: it must parse.
  expect(RunDeltaSchema.safeParse(d).success).toBe(true)
  return d as unknown as RunDelta
}
const view = (over: Record<string, unknown> = {}) => buildRunDeltaView(delta(over), label, label)

describe('the one sentence: what changed, then what moved', () => {
  it('served shape: one input changed, nothing the producer can qualify moved → the change, once', () => {
    expect(runDeltaSentence(view(), { isStale: false })).toBe('Since the last run, Investor fit rate changed from 5% to 7%.')
  })

  it('the change and a within-noise movement → ONE lead, never "Since the last run" twice', () => {
    const s = runDeltaSentence(view({ win_probabilities: [{ option_id: 'opt_a', prior: 0.41, current: 0.42, noise_verdict: 'within_noise' }] }), { isStale: false })
    expect(s).toBe('Since the last run, Investor fit rate changed from 5% to 7%. No option moved beyond ordinary run-to-run variation.')
    expect(s!.match(/Since the last run/g)).toHaveLength(1)
  })

  it('CONTRAST: no input record → the movement sentence keeps its own lead, unchanged', () => {
    const s = runDeltaSentence(view({ input_coverage: 'not_recorded', input_changes: undefined, win_probabilities: [{ option_id: 'opt_a', prior: 0.41, current: 0.42, noise_verdict: 'within_noise' }] }), { isStale: false })
    expect(s).toBe('Since the last run, no option moved beyond ordinary run-to-run variation.')
  })

  it('several inputs: the count only when the producer says its record is complete', () => {
    const churn = { ...FIT, entity_id: 'fac_churn', label_before: 'Monthly churn', label_after: 'Monthly churn' }
    expect(runDeltaSentence(view({ input_changes: [FIT, churn] }), { isStale: false })).toBe('Since the last run, 2 inputs changed, including Investor fit rate.')
    expect(runDeltaSentence(view({ input_changes: [FIT, churn], input_coverage: 'partial' }), { isStale: false })).toBe('Since the last run, inputs changed, including Investor fit rate.')
  })

  // AIQ CR on #2368 (rule 5920669246): C2–C5 never imply a cause. Rows as AIQ listed them.
  const BEYOND = [{ option_id: 'opt_a', prior: 0.41, current: 0.55, noise_verdict: 'signal' }]
  it('C2 + a change + a beyond-noise movement → the change only, never "…changed. X moved…" (no implied cause)', () => {
    const s = runDeltaSentence(view({ win_probabilities: BEYOND }), { isStale: false })
    expect(s).toBe('Since the last run, Investor fit rate changed from 5% to 7%.')
  })

  it('CONTRAST: C1 + a change + a beyond-noise movement → both, with no limit', () => {
    const c1 = view({
      attribution_case: 'C1_attributable',
      pair_provenance: { seed_equal: true, hash_equal: false, builds_equal: 'equal', n_equal: true },
      win_probabilities: BEYOND,
    })
    expect(c1.attributable, 'PRECONDITION: the reader calls C1 attributable').toBe(true)
    expect(runDeltaSentence(c1, { isStale: false })).toBe(
      'Since the last run, Investor fit rate changed from 5% to 7%. Investment Firm Outreach moved from 41% to 55%.',
    )
  })

  it('stale (the Reasoning bullet describes the model on screen) → nothing', () => {
    expect(runDeltaSentence(view(), { isStale: true })).toBeNull()
  })
})

describe('the Reasoning tab says it first, in "What we have"', () => {
  it('a withheld run after a rerun: the count, then the change', () => {
    const vm = buildAnalysisNewViewModel({
      data: decisionWithLeaderWithheld(), recommendations: [], isPreRun: false, isRunning: false, isStale: false, whatsChanged: view(),
    } as never)
    const founded = buildCommitmentSynthesis(vm).founded!.text
    expect(founded).toMatch(/ options? compared\. Since the last run, Investor fit rate changed from 5% to 7%\.$/)
  })
})

// ── the chat card ──────────────────────────────────────────────────────────

const WIRE = {
  type: 'analysis_result' as const,
  summary: 'Investment Firm Outreach and Angel Bridge Outreach compared.',
  leading_option_id: 'opt_a',
  win_probabilities: { opt_a: 0.55, opt_b: 0.45 },
  enrichment: { option_comparison: [] },
}

describe('the chat card finds its own Run by identity', () => {
  it('the card\'s hash IS the store\'s results hash for the same wire block', () => {
    const card = mapV5Block(WIRE as never) as ChatCard
    expect(card.analysis_hash).toBe(mapV5AnalysisToReport(WIRE as never).model_card.response_hash)
  })

  it('…including when the card itself withholds the win figures (hash taken from the wire block)', () => {
    const withheld = { ...WIRE, enrichment: { inference_warnings: [{ code: 'GOAL_FIGURES_TARGET_NOT_TESTABLE', message: 'Not shown. Olumi cannot test the options against your target yet.' }] } }
    const card = mapV5Block(withheld as never) as ChatCard
    expect(card.analysis_hash).toBe(mapV5AnalysisToReport(withheld as never).model_card.response_hash)
  })
})

describe('the chat card says what changed, in the Reasoning tab\'s words', () => {
  let hash = ''
  beforeEach(() => {
    const card = mapV5Block(WIRE as never) as ChatCard
    hash = card.analysis_hash!
    useCanvasStore.setState({
      currentScenarioId: 'sc-1',
      nodes: [{ id: 'fac_fit', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Investor fit rate' } }] as never,
      runDelta: { delta: delta(), analysisHash: hash, scenarioId: 'sc-1' },
    } as never)
  })
  afterEach(() => {
    cleanup()
    useCanvasStore.setState({ runDelta: null } as never)
  })

  it('the card for the displayed Run carries the same sentence as the Reasoning tab', () => {
    render(<V5AnalysisResultBlock block={mapV5Block(WIRE as never) as ChatCard} />)
    expect(screen.getByTestId('v5-analysis-result-since-last-run')).toHaveTextContent(
      runDeltaSentence(buildRunDeltaView(delta(), label, (id) => (id === 'fac_fit' ? 'Investor fit rate' : null)), { isStale: false })!,
    )
  })

  it('CONTRAST: an older card (another Run) says nothing about this comparison', () => {
    const older = { ...(mapV5Block(WIRE as never) as ChatCard), analysis_hash: 'v5:older-run' }
    render(<V5AnalysisResultBlock block={older} />)
    expect(screen.queryByTestId('v5-analysis-result-since-last-run')).toBeNull()
  })

  it('CONTRAST: a card stored before the hash existed says nothing (fail-closed)', () => {
    const { analysis_hash: _drop, ...legacy } = mapV5Block(WIRE as never) as ChatCard
    render(<V5AnalysisResultBlock block={legacy as ChatCard} />)
    expect(screen.queryByTestId('v5-analysis-result-since-last-run')).toBeNull()
  })
})
