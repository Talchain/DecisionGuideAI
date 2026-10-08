/**
 * ⭐⭐ A RUN NEVER GROWS AN OPTION CARD — the share line has ONE reserved slot.
 *
 * SERVED DEFECT (design audit 26 Sep 2026 #4, UI 853feeb7, pricing starter,
 * 1280x800, one Run): every option card grew +49.4px on screen when the Run
 * completed (168 → 217.4, 250.1 → 299.5, 250.1 → 299.5, 139.1 → 188.5).
 * Card text after the Run, verbatim from the audit capture:
 *   "… Current model | 34% of runs | · | Goal only"
 * rendered as THREE lines ("Current model ▬" / "34% of runs" / "· Goal only"),
 * because the row was `flex-wrap` whenever `Goal only` was on it, and because
 * the row did not exist before the run, so the layout had reserved nothing.
 *
 * TARGET (ED #63 5809278282: post-run the option carries ONE current-model
 * share line, no rung-triggered re-layout; ED 5810951997: no card grows):
 *   · the share line is ONE row that never wraps;
 *   · its slot exists BEFORE the run with the identical classes, so the height
 *     the layout measures pre-run is the height the card has post-run.
 *
 * FIXTURE: the served pricing starter's option ids and labels, and the served
 * shares (34% / < 1% / 53% / 13%, all four `Goal only`, i.e. the result's
 * `producer_leader_permission.producer_cause` = `constraint_verdict_withheld`).
 *
 * CLAIM SCOPE: jsdom proves class tokens, element identity and text — never
 * layout. The on-screen heights are measured separately in real Chromium
 * (PR body).
 *
 * ⭐⭐ CURRENT-READ row 9 (AIQ 5912710392; Paul's test 4276f3f9, finding 9): the
 * served stamp WITHHOLDS the leader, and a withheld leader now withholds every
 * per-option share. On the served run the slot therefore holds `Not ranked` (+ the
 * exploratory reason in its name), never `34% of runs · Goal only`; the
 * no-growth property is pinned on that marker. The share line's own one-row
 * geometry is pinned on a PERMITTED run (no stamp), the only run that still
 * renders a share. `· Goal only` only ever sat on a withheld run's share, so it
 * cannot render any more.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { OptionChanceCellProvider } from '../shared/OptionChanceCellProvider'
import { useOptionChanceCell } from '../shared/useOptionChanceCell'
import { useCanvasStore } from '../../store'
import { EXPLORATORY_REASON_LINE, NOT_RANKED_MARKER } from '../../state/winShareGate'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

// Served pricing starter (design audit capture `run-1280x800-pricing-model.json`).
const SERVED_OPTIONS = [
  { id: 'opt_full_switch', label: 'Full Switch to Usage-Based at Renewal', win: 0.34, chancePct: 41 },
  { id: 'opt_hybrid', label: 'Hybrid Platform Fee Plus Usage', win: 0.004, chancePct: 18 },
  { id: 'opt_new_logos', label: 'Usage-Based for New Logos Only', win: 0.53, chancePct: 62 },
  { id: 'opt_status_quo', label: 'Keep Per-Seat Pricing (Status Quo)', win: 0.13, chancePct: 12 },
] as const
const nodes = [
  ...SERVED_OPTIONS.map(o => ({ id: o.id, type: 'option', position: { x: 0, y: 0 }, data: { label: o.label, type: 'option', kind: 'option' } })),
  { id: 'goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Customers', type: 'goal', goal_threshold_raw: 100, goal_threshold_unit: 'customers' } },
]
const GOAL_ONLY_STAMP = { permitted: false, withheld_reason: 'leader_claim_withheld', producer_cause: 'constraint_verdict_withheld' }

const seedPreRun = () => {
  useCanvasStore.setState({
    nodes, edges: [], ceeAnalysisReady: null, viewMode: 'standard',
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    importPendingServerRegistration: false, currentScenarioId: 'pricing-scenario',
    v5AnalysisFact: null, hasCompletedFirstRun: false,
    results: { status: 'idle', report: null },
  } as never)
}

const seedPostRun = (goalOnly = true, unscored: readonly string[] = []) => {
  useCanvasStore.setState({
    nodes, edges: [], ceeAnalysisReady: null, viewMode: 'standard', goalThreshold: 100,
    analysisStateV1: null,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-26T18:05:00.000Z' },
    analysisFreshnessDirty: false, importPendingServerRegistration: false, currentScenarioId: 'pricing-scenario',
    v5AnalysisFact: { scenarioId: 'pricing-scenario', analysisHash: 'run-1', hasRunAnalysisFact: true },
    hasCompletedFirstRun: true,
    results: { status: 'complete', hash: 'run-1', report: {
      option_probabilities: Object.fromEntries(SERVED_OPTIONS.filter(o => !unscored.includes(o.id)).map(o => [o.id, { status: 'computed', win_probability: o.win }])),
      robustness: { near_tie: { is_tie: false, top_option_id: 'opt_new_logos' } },
      inference_warnings: goalOnly ? [] : [{
        code: 'GOAL_CHANCE_LICENSED', form: 'each',
        option_ids: SERVED_OPTIONS.filter(option => !unscored.includes(option.id)).map(option => option.id),
        pct_by_option: Object.fromEntries(SERVED_OPTIONS.filter(option => !unscored.includes(option.id)).map(option => [option.id, option.chancePct])),
        target: { comparator: 'at_least', value: 100, unit: 'customers' },
      }],
      ...(goalOnly ? { producer_leader_permission: GOAL_ONLY_STAMP } : {}),
    } },
  } as never)
}

const renderCard = (id: string) => {
  const n = nodes.find(x => x.id === id)!
  return render(<ReactFlowProvider><OptionChanceCellProvider><OptionNode
    id={n.id} type="option" data={n.data as never} selected={false}
    isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
    dragging={false} zIndex={0} deletable selectable draggable
  /></OptionChanceCellProvider></ReactFlowProvider>)
}

const tokens = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
const slot = (id: string) => screen.queryByTestId(`option-share-slot-${id}`)
const chanceText = (id: string) => renderHook(() => useOptionChanceCell(id), { wrapper: OptionChanceCellProvider }).result.current.text

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, hasCompletedFirstRun: false, results: { status: 'idle', report: null },
  } as never)
})

describe('served pricing options — the share line is ONE line in a slot reserved before the run', () => {
  // CURRENT-READ row 9 (AIQ 5912710392): WAS "the share fills it" on the served (withheld) stamp. The served
  // run now fills the SAME slot with `Not ranked`; the share filling it is pinned on a PERMITTED run.
  it.each(SERVED_OPTIONS.map(o => [o.id] as const))(
    '%s: the pre-run slot and the post-run slot are the SAME element class, one edgeLabel line; `Not ranked` fills it on the served (withheld) run, the licensed chance on a permitted run',
    (id) => {
      seedPreRun()
      renderCard(id)
      const pre = slot(id)
      expect(pre, 'pre-run: the slot is reserved before any run').not.toBeNull()
      const preClass = pre!.getAttribute('class')
      expect(tokens(pre!)).toContain('h-[1lh]')
      expect(tokens(pre!)).toContain('overflow-hidden')
      expect(pre!.getAttribute('aria-hidden')).toBe('true')
      expect(pre!.textContent).toBe('')
      cleanup()

      // The served run: the leader is withheld, so no share — `Not ranked`, one line, in the same slot.
      seedPostRun()
      renderCard(id)
      const withheld = slot(id)
      expect(withheld, 'post-run: the same slot').not.toBeNull()
      // Height-reserving structure identical pre/post: same slot, same classes.
      expect(withheld!.getAttribute('class')).toBe(preClass)
      expect(withheld!.getAttribute('aria-hidden')).toBeNull()
      expect(withheld!.textContent).not.toMatch(/\d\s*%/)
      expect(screen.queryByTestId(`option-analysis-currency-${id}`)).toBeNull()
      const marker = screen.getByTestId(`option-not-ranked-${id}`)
      expect(screen.getByTestId(`option-bottom-marks-${id}`).contains(marker)).toBe(true)
      expect(marker.getAttribute('aria-label')).toBe(NOT_RANKED_MARKER)
      expect(marker.getAttribute('aria-description')).toBe(EXPLORATORY_REASON_LINE)
      expect(tokens(marker)).toContain('whitespace-nowrap')
      cleanup()

      // A permitted run: the share fills the same slot.
      seedPostRun(false)
      renderCard(id)
      const post = slot(id)
      expect(post, 'post-run: the same slot').not.toBeNull()
      expect(post!.getAttribute('class')).toBe(preClass)
      expect(post!.getAttribute('aria-hidden')).toBeNull()
      const row = screen.getByTestId(`option-analysis-currency-${id}`)
      expect(row.parentElement).toBe(post)
      expect(screen.getByTestId(`option-win-readout-${id}`).textContent).toBe(chanceText(id))
      expect(chanceText(id)).toContain('chance of meeting your goal, in this model.')
      expect(row.getAttribute('aria-label')).not.toContain('of runs')
    },
  )

  // MOVED TO A PERMITTED RUN (CURRENT-READ row 9, AIQ 5912710392): WAS "34% of runs · Goal only" on the
  // served (withheld) stamp. The one-row geometry is kept on the same option with no stamp. The `· Goal only`
  // unit (whole, `shrink-0`, after the readout, never `truncate`) only rendered on a withheld run's share,
  // which no longer exists, so its absence is pinned here and the served run is pinned in the row above.
  it('opt_full_switch post-run (PERMITTED run): the licensed chance is ONE non-wrapping row — no wrap class, no qualifier', () => {
    seedPostRun(false)
    renderCard('opt_full_switch')
    const row = screen.getByTestId('option-analysis-currency-opt_full_switch')
    const rowTokens = tokens(row)
    expect(rowTokens).not.toContain('flex-wrap')
    expect(rowTokens).toContain('flex-nowrap')
    expect(rowTokens).toContain('whitespace-nowrap')
    const readout = screen.getByTestId('option-win-readout-opt_full_switch')
    expect(readout.parentElement).toBe(row)
    expect(screen.queryByTestId('option-share-goal-only-opt_full_switch')).toBeNull()
    expect(screen.queryByTestId('option-share-provisional-opt_full_switch')).toBeNull()
    // The caption stays whole; the shared chance is recoverable in the accessible name.
    expect(tokens(readout)).toContain('truncate')
    expect(screen.queryByTestId('option-win-figure-opt_full_switch')).toBeNull()
    expect(screen.queryByTestId('option-win-unit-opt_full_switch')).toBeNull()
    expect(row.querySelector('.h-full.rounded-full')).toBeNull()
    const anchor = screen.getByTestId('option-win-anchor-opt_full_switch')
    expect(anchor.textContent).toBe('Current model')
    expect(anchor.compareDocumentPosition(readout) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(row.getAttribute('aria-label')).toBe(`Current model · ${chanceText('opt_full_switch')}`)
    expect(row.getAttribute('aria-label')).not.toContain('of runs')
  })

  it('MG B1 (#2123 review): an option the Run does NOT score keeps its reserved slot after the Run — no shrink, no re-lay', () => {
    // BF5's level-less option, or one added after the Run: absent from `option_probabilities`, so `winReadout` is null.
    seedPreRun()
    renderCard('opt_hybrid')
    const preClass = slot('opt_hybrid')!.getAttribute('class')
    cleanup()
    seedPostRun(true, ['opt_hybrid'])
    renderCard('opt_hybrid')
    const post = slot('opt_hybrid')
    expect(post, 'post-run: the unscored option keeps the SAME reserved slot').not.toBeNull()
    expect(post!.getAttribute('class')).toBe(preClass)
    expect(screen.queryByTestId('option-analysis-currency-opt_hybrid')).toBeNull()
    // ⚠ RE-PINNED 27 Sep (side-by-side DIFF item 5): this asserted the slot
    // stayed EMPTY and aria-hidden. It was empty because the option's
    // `Not analysed` line was a second row BELOW it, so the Run still grew this
    // card by a line. The line now fills the reserved slot instead.
    const line = screen.getByTestId('option-not-analysed-opt_hybrid')
    expect(post!.contains(line)).toBe(true)
    expect(post!.getAttribute('aria-hidden')).toBeNull()
    expect(screen.getByTestId('option-not-analysed-chip-opt_hybrid')).toHaveAttribute('aria-label', 'Not analysed')
  })

  it('CONTRAST — no Goal-only stamp: the same slot and the same one-line row, without the qualifier', () => {
    seedPostRun(false)
    renderCard('opt_full_switch')
    const row = screen.getByTestId('option-analysis-currency-opt_full_switch')
    expect(tokens(row)).not.toContain('flex-wrap')
    expect(screen.queryByTestId('option-share-goal-only-opt_full_switch')).toBeNull()
    expect(row.parentElement).toBe(slot('opt_full_switch'))
  })
})
