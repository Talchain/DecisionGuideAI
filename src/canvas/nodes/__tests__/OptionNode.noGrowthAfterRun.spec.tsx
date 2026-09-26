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
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

// Served pricing starter (design audit capture `run-1280x800-pricing-model.json`).
const SERVED_OPTIONS = [
  { id: 'opt_full_switch', label: 'Full Switch to Usage-Based at Renewal', win: 0.34, share: '34% of runs' },
  { id: 'opt_hybrid', label: 'Hybrid Platform Fee Plus Usage', win: 0.004, share: '< 1% of runs' },
  { id: 'opt_new_logos', label: 'Usage-Based for New Logos Only', win: 0.53, share: '53% of runs' },
  { id: 'opt_status_quo', label: 'Keep Per-Seat Pricing (Status Quo)', win: 0.13, share: '13% of runs' },
] as const
const nodes = SERVED_OPTIONS.map(o => ({ id: o.id, type: 'option', position: { x: 0, y: 0 }, data: { label: o.label, type: 'option' } }))
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
    nodes, edges: [], ceeAnalysisReady: null, viewMode: 'standard',
    analysisStateV1: null,
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-26T18:05:00.000Z' },
    analysisFreshnessDirty: false, importPendingServerRegistration: false, currentScenarioId: 'pricing-scenario',
    v5AnalysisFact: { scenarioId: 'pricing-scenario', analysisHash: 'run-1', hasRunAnalysisFact: true },
    hasCompletedFirstRun: true,
    results: { status: 'complete', hash: 'run-1', report: {
      option_probabilities: Object.fromEntries(SERVED_OPTIONS.filter(o => !unscored.includes(o.id)).map(o => [o.id, { status: 'computed', win_probability: o.win }])),
      robustness: { near_tie: { is_tie: false, top_option_id: 'opt_new_logos' } },
      ...(goalOnly ? { producer_leader_permission: GOAL_ONLY_STAMP } : {}),
    } },
  } as never)
}

const renderCard = (id: string) => {
  const n = nodes.find(x => x.id === id)!
  return render(<ReactFlowProvider><OptionNode
    id={n.id} type="option" data={n.data as never} selected={false}
    isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
    dragging={false} zIndex={0} deletable selectable draggable
  /></ReactFlowProvider>)
}

const tokens = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)
const slot = (id: string) => screen.queryByTestId(`option-share-slot-${id}`)

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, hasCompletedFirstRun: false, results: { status: 'idle', report: null },
  } as never)
})

describe('served pricing options — the share line is ONE line in a slot reserved before the run', () => {
  it.each(SERVED_OPTIONS.map(o => [o.id, o.share] as const))(
    '%s: the pre-run slot and the post-run slot are the SAME element class, one edgeLabel line; the share fills it',
    (id, share) => {
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

      seedPostRun()
      renderCard(id)
      const post = slot(id)
      expect(post, 'post-run: the same slot').not.toBeNull()
      // Height-reserving structure identical pre/post: same slot, same classes.
      expect(post!.getAttribute('class')).toBe(preClass)
      expect(post!.getAttribute('aria-hidden')).toBeNull()
      const row = screen.getByTestId(`option-analysis-currency-${id}`)
      expect(row.parentElement).toBe(post)
      expect(screen.getByTestId(`option-win-readout-${id}`).textContent).toBe(share)
    },
  )

  it('opt_full_switch post-run: "34% of runs · Goal only" is ONE non-wrapping row — no wrap class, `Goal only` never on a line of its own', () => {
    seedPostRun()
    renderCard('opt_full_switch')
    const row = screen.getByTestId('option-analysis-currency-opt_full_switch')
    const rowTokens = tokens(row)
    expect(rowTokens).not.toContain('flex-wrap')
    expect(rowTokens).toContain('flex-nowrap')
    expect(rowTokens).toContain('whitespace-nowrap')
    const readout = screen.getByTestId('option-win-readout-opt_full_switch')
    const goalOnly = screen.getByTestId('option-share-goal-only-opt_full_switch')
    expect(goalOnly.textContent).toBe('Goal only')
    // The qualifier unit ("· Goal only") is a direct child of the SAME row as
    // the share, after it, and it can only end in an ellipsis — never wrap.
    const unit = goalOnly.parentElement!
    expect(unit.parentElement).toBe(row)
    expect(readout.parentElement).toBe(row)
    expect(unit.textContent).toBe('· Goal only')
    expect(tokens(unit)).toContain('truncate')
    expect(Boolean(readout.compareDocumentPosition(unit) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    // The share itself never gives way.
    expect(tokens(readout)).toContain('shrink-0')
    // Whatever gives way on a narrow card stays whole in the row's name (the
    // existing tooltip reads the same string).
    expect(row.getAttribute('aria-label')!.startsWith('Current model · 34% of runs · Goal only.')).toBe(true)
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
    expect(post!.getAttribute('aria-hidden')).toBe('true')
    expect(post!.textContent).toBe('')
    expect(screen.queryByTestId('option-analysis-currency-opt_hybrid')).toBeNull()
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
