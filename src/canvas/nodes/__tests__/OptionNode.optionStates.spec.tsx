/**
 * ⭐ DESIGN-GAP ROW 22 — THE THREE OPTION STATES OF VISUAL CONTRACT v3 §02:
 *   · baseline: "Reference for the other alternatives.";
 *   · a target with no value: "Needs input" in the row's AMOUNT cell;
 *   · the model changed since the run: "Last run · no new comparison yet".
 *
 * Before: none of the three texts rendered. A target the option names but never
 * set was SILENTLY dropped from the rows (while still counted in `+N more`).
 *
 * WHAT IS HONEST, AND WHERE. Paul, 25 Sep 2026: the option card matches the
 * PROTOTYPE — one ROW per change on the card at rest, and the baseline card
 * reads "Baseline · no changes" / "Reference for the other alternatives."
 * (`OptionNode.prototypeChangeRows.spec.tsx`). That superseded ED #63
 * 5809278282's "title + ONE primary line", which first placed these states in
 * the popover:
 *   · the reference sentence is said only of the ONE DECLARED baseline
 *     (`is_baseline === true`, exactly one) — the option the others are read
 *     against; a label heuristic ("Status quo") declares nothing. It sits on
 *     the card under the baseline meta, in both views and both phases;
 *   · `Needs input` fills the amount cell of a row whose target carries no
 *     number and no reading, wherever rows render (the Standard resting rows,
 *     the Detailed grid) — with NO source mark, because there is no target to
 *     attribute; the row's accessible name is the needs-input sentence;
 *   · stale keeps the LAST RUN'S result visible and labelled (`Last run`, the
 *     share, the bar — never deleted), and adds the contract's state line in
 *     the popover (Standard) / inline (Detailed) and in the share line's
 *     accessible name and tooltip. Only on the composed `'changed'` verdict:
 *     cannot-confirm and current never carry it.
 *
 * Real store, real freshness authority (the harness of
 * `OptionNode.currentness.spec.tsx`); `NodePopover` is a pass-through so "in the
 * popover" and "on the card" are two DOM regions. Every absence has a present
 * control from the same render.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { ReactNode } from 'react'
import { OptionNode } from '../OptionNode'
import { OptionChanceCellProvider } from '../shared/OptionChanceCellProvider'
import { useCanvasStore } from '../../store'
import { withLicensedOptionChances, fixtureChanceText } from './__helpers__/optionChanceFixture'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: ReactNode }) => <div data-testid="node-popover">{children}</div>,
}))

const REFERENCE = 'Reference for the other alternatives.'
const STALE_STATE = 'Last run · no new comparison yet'

const F_PRICE = { id: 'f-price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Pro plan monthly price', type: 'factor' } }
const F_CONV = { id: 'f-conv', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Trial conversion', type: 'factor' } }
const opt = (id: string, label: string, extra: Record<string, unknown> = {}) =>
  ({ id, type: 'option', position: { x: 0, y: 0 }, data: { label, type: 'option', ...extra } })

const BASELINE = opt('option-b', 'Keep the current plan', { is_baseline: true, interventions: {} })
/** Sets the price, NAMES conversion with no value (the witnessed brief-extraction shape). */
const OPTION_1 = opt('option-1', 'Raise the Pro price', {
  interventions: {
    'f-price': { value: 59, display_value: '£59', source: 'user_specified' },
    'f-conv': { value: null, source: 'brief_extraction' },
  },
})
const OPTION_2 = opt('option-2', 'Hold the price', {
  interventions: { 'f-price': { value: 49, display_value: '£49', source: 'user_specified' } },
})
/** Its only target is unset, so its TOP row — the one primary line — is the gap. */
const OPTION_3 = opt('option-3', 'Run a conversion trial', {
  interventions: { 'f-conv': { value: null, source: 'brief_extraction' } },
})

const FRESH = { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-24T00:00:00.000Z' }
const REPORT = withLicensedOptionChances({
  option_probabilities: {
    'option-1': { status: 'computed', win_probability: 0.72 },
    'option-2': { status: 'computed', win_probability: 0.18 },
    'option-b': { status: 'computed', win_probability: 0.1 },
  },
  robustness: { near_tie: { is_tie: false, top_option_id: 'option-1' } },
}, { 'option-1': 41, 'option-2': 29, 'option-b': 18 })
const CHANCE = fixtureChanceText(REPORT, 'option-1', {
  'option-1': OPTION_1.data.label as string, 'option-2': OPTION_2.data.label as string, 'option-b': BASELINE.data.label as string,
})!

type Phase = 'pre' | 'current' | 'changed' | 'cannot_confirm'
const seed = (
  { phase = 'pre', viewMode = 'standard', nodes }:
    { phase?: Phase; viewMode?: 'standard' | 'expert'; nodes?: unknown[] } = {},
) => {
  const ran = phase !== 'pre'
  useCanvasStore.setState({
    nodes: (nodes ?? [F_PRICE, F_CONV, BASELINE, OPTION_1, OPTION_2, OPTION_3]).map((node: any) => ({ ...node, data: { ...node.data, kind: node.type } })),
    edges: [], ceeAnalysisReady: null, viewMode, lodRung: 'full', goalThreshold: 100, goalConstraints: [],
    analysisStateV1: null, importPendingServerRegistration: false, currentScenarioId: 'option-states',
    analysisFreshness: ran
      ? (phase === 'cannot_confirm' ? { ...FRESH, freshness: 'unknown', freshnessReason: 'cee_unknown' } : FRESH)
      : null,
    analysisFreshnessDirty: phase === 'changed',
    v5AnalysisFact: ran ? { scenarioId: 'option-states', analysisHash: 'last-run', hasRunAnalysisFact: true } : null,
    hasCompletedFirstRun: ran,
    results: ran ? { status: 'complete', hash: 'last-run', report: REPORT } : { status: 'idle', report: null },
  } as never)
}

const renderOption = (node: { id: string; data: Record<string, unknown> }) =>
  render(
    <ReactFlowProvider><OptionChanceCellProvider>
      <OptionNode
        id={node.id} type="option" data={node.data as never} selected={false}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </OptionChanceCellProvider></ReactFlowProvider>,
  )

/** An element with this test id ON THE CARD (not inside the popover). */
const onCard = (testId: string): HTMLElement | null => {
  const el = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)
  if (!el) return null
  const pop = document.querySelector('[data-testid="node-popover"]')
  return pop && pop.contains(el) ? null : el
}
const inPopover = (testId: string): HTMLElement | null => {
  const pop = document.querySelector<HTMLElement>('[data-testid="node-popover"]')
  return pop ? within(pop).queryByTestId(testId) : null
}
const title = () => screen.getByTestId('node-title')

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, hasCompletedFirstRun: false, results: { status: 'idle', report: null }, viewMode: 'standard',
  } as never)
})

/**
 * ⛔ RE-PINNED 5 Oct 2026 (gate 5 item 4, DL 0df0e1): row 22a's "Reference for the other alternatives." is DROPPED from
 * the declared baseline. These rows asserted the sentence on the card in Standard, Detailed and post-run; they now
 * assert it is in neither the card nor the popover, with "Baseline · no changes" still on the card (positive control).
 */
describe('row 22a (dropped) — the declared baseline no longer says "Reference for the other alternatives."', () => {
  it.each([
    ['Standard, pre-run', {}],
    ['Detailed', { viewMode: 'expert' }],
    ['post-run (Standard)', { phase: 'current' }],
  ] as const)('%s: "Baseline · no changes" is on the card; the sentence is nowhere', (_n, opts) => {
    seed(opts as never)
    renderOption(BASELINE)
    expect(onCard('option-baseline-meta-option-b')?.getAttribute('aria-label')).toBe('Baseline · no changes')
    expect(onCard('option-baseline-reference-option-b')).toBeNull()
    expect(inPopover('option-baseline-reference-option-b')).toBeNull()
    expect(document.body.textContent ?? '').not.toContain(REFERENCE)
  })

  it('CONTRAST — a label-only "Status quo" (nothing declared) is NOT called the reference', () => {
    const labelOnly = opt('option-sq', 'Status quo', { interventions: {} })
    seed({ nodes: [F_PRICE, labelOnly, OPTION_2] })
    renderOption(labelOnly)
    expect(onCard('option-baseline-meta-option-sq')).not.toBeNull()
    expect(document.body.textContent ?? '').not.toContain(REFERENCE)
  })

  /**
   * ⛔ RE-PINNED 27 Sep 2026 (canvas audit paul-models POM-3). This row also
   * asserted the label-only card still carried a baseline META
   * (`not.toBeNull()`), i.e. that the keyword guess made it a second baseline
   * beside the declared one — the defect Paul's 90b8 board showed ("£59 for new
   * Pro customers; grandfather existing customers" read "Baseline option" beside
   * "Keep current £49 price"). A board has one baseline; once one is declared
   * the guess may not mint another. The row's own claim — only the declared one
   * is the reference — is unchanged and still asserted.
   */
  it('CONTRAST — a label-only "Status quo" beside a DECLARED baseline: only the declared one is the reference', () => {
    const labelOnly = opt('option-sq', 'Status quo', { interventions: {} })
    seed({ nodes: [F_PRICE, BASELINE, labelOnly, OPTION_2] })
    renderOption(labelOnly)
    // Positive control: the label-only card mounted and carries its title.
    expect(document.body.textContent ?? '').toContain('Status quo')
    expect(onCard('option-baseline-meta-option-sq')).toBeNull()
    expect(document.body.textContent ?? '').not.toContain(REFERENCE)
  })

  it('CONTRAST — two declared baselines: neither is THE reference', () => {
    const second = opt('option-b2', 'Keep everything', { is_baseline: true, interventions: {} })
    seed({ nodes: [F_PRICE, BASELINE, second, OPTION_2] })
    renderOption(BASELINE)
    expect(onCard('option-baseline-meta-option-b')).not.toBeNull()
    expect(document.body.textContent ?? '').not.toContain(REFERENCE)
  })

  it('CONTRAST — a non-baseline option never carries it', () => {
    seed()
    renderOption(OPTION_2)
    expect(title()).toBeInTheDocument()
    expect(document.body.textContent ?? '').not.toContain(REFERENCE)
  })
})

describe('row 22b — a target with no value reads "Needs input" in its amount cell', () => {
  it('Detailed: the unset row is on the card with the state word and NO source mark; the set row is unchanged', () => {
    seed({ viewMode: 'expert' })
    renderOption(OPTION_1)
    const gap = onCard('option-change-row-option-1-f-conv')
    expect(gap, 'the unset target must not be silently dropped').not.toBeNull()
    expect(within(gap!).getByTestId('option-change-row-needs-input-option-1-f-conv').textContent).toBe('Needs input')
    expect(onCard('option-change-row-mark-option-1-f-conv')).toBeNull()
    // Contrast in the same render: the set target keeps its value and its mark.
    expect(onCard('option-change-row-option-1-f-price')?.textContent).toContain('£59')
    expect(onCard('option-change-row-mark-option-1-f-price')).not.toBeNull()
    expect(onCard('option-change-row-needs-input-option-1-f-price')).toBeNull()
  })

  it('Standard: the card\'s resting rows carry the gap, and `+N more` no longer counts a row it never showed', () => {
    seed()
    renderOption(OPTION_1)
    expect(onCard('option-change-row-needs-input-option-1-f-conv')?.textContent).toBe('Needs input')
    expect(onCard('option-change-row-mark-option-1-f-conv')).toBeNull()
    // Contrast in the same render: the set target keeps its value and its mark.
    expect(onCard('option-change-row-option-1-f-price')?.textContent).toContain('£59')
    expect(onCard('option-change-row-mark-option-1-f-price')).not.toBeNull()
    expect(screen.queryByTestId('option-change-more-option-1')).toBeNull()
    // The rows render once — on the card, never also in the popover.
    expect(inPopover('option-change-rows-option-1')).toBeNull()
  })

  it('Standard: when the gap is the option\'s TOP row, that resting row says "Needs input" in its value cell, with no mark, and its accessible text is the gap', () => {
    seed()
    renderOption(OPTION_3)
    const rows = onCard('option-change-rows-option-3')
    expect(rows, 'the card row must not vanish because the target is unset').not.toBeNull()
    const dd = onCard('option-change-row-option-3-f-conv')!
    expect(rows!.querySelector('dd')).toBe(dd)
    expect(within(dd).getByTestId('option-change-row-needs-input-option-3-f-conv').textContent).toBe('Needs input')
    expect(onCard('option-change-row-mark-option-3-f-conv')).toBeNull()
    expect((dd.previousElementSibling as HTMLElement).textContent).toBe('Trial conversion')
    expect(dd.getAttribute('title')).toBe(
      'Trial conversion: Needs input. This option names this factor but sets no target value yet.',
    )
    expect(screen.getByRole('definition', {
      name: 'Trial conversion: Needs input. This option names this factor but sets no target value yet.',
    })).toBe(dd)
    // The retired one-line primary change is gone (prototype, Paul 25 Sep).
    expect(screen.queryByTestId('option-primary-change-option-3')).toBeNull()
  })

  it('CONTRAST — an option whose targets are all set shows no "Needs input"', () => {
    seed({ viewMode: 'expert' })
    renderOption(OPTION_2)
    expect(onCard('option-change-row-option-2-f-price')?.textContent).toContain('£49')
    expect(document.body.textContent ?? '').not.toContain('Needs input')
  })
})

describe('row 22c — stale: "Last run · no new comparison yet", and the last result is kept, labelled', () => {
  const shareName = () => onCard('option-analysis-currency-option-1')?.getAttribute('aria-label') ?? ''

  it('changed (Standard): the state line is in the popover; the share stays on the card as `Last run`', () => {
    seed({ phase: 'changed' })
    renderOption(OPTION_1)
    expect(onCard('option-win-anchor-option-1')?.getAttribute('aria-label')).toBe('Last run')
    expect(onCard('option-win-readout-option-1')?.textContent).toBe(CHANCE)
    expect(inPopover('option-stale-preview-option-1')?.textContent).toBe(STALE_STATE)
    // ONE status mark (DL 8 Oct, workstream D): "Last run" wins and names the stale line in its tooltip.
    expect(onCard('option-stale-state-option-1')).toBeFalsy()
    expect(onCard('option-win-anchor-option-1')?.getAttribute('aria-description')).toBe('Also: no new comparison yet')
    // WS5-1: keep the last Run's licensed chance and its currency note; never the runs share.
    expect(shareName()).toContain(`Last run · ${CHANCE}`)
    expect(shareName()).not.toContain('of runs')
    expect(shareName()).toContain('No new comparison yet.')
  })

  it('changed (Detailed): the state line is inline on the card', () => {
    seed({ phase: 'changed', viewMode: 'expert' })
    renderOption(OPTION_1)
    // ONE status mark (DL 8 Oct, workstream D): "Last run" wins and names the stale line in its tooltip.
    expect(onCard('option-stale-state-option-1')).toBeFalsy()
    expect(onCard('option-win-anchor-option-1')?.getAttribute('aria-description')).toBe('Also: no new comparison yet')
  })

  it('CONTRAST — current: no stale line anywhere, and the share is "Current model"', () => {
    seed({ phase: 'current' })
    renderOption(OPTION_1)
    expect(onCard('option-win-anchor-option-1')?.textContent).toBe('Current model')
    expect(screen.queryByTestId('option-stale-state-option-1')).toBeNull()
    expect(shareName()).not.toContain('No new comparison')
  })

  it('cannot confirm: no "last run" claim is manufactured', () => {
    seed({ phase: 'cannot_confirm' })
    renderOption(OPTION_1)
    expect(onCard('option-win-anchor-option-1')?.textContent).toBe('Model result')
    expect(screen.queryByTestId('option-stale-state-option-1')).toBeNull()
    expect(shareName()).not.toContain('No new comparison')
  })

  it('the SAME card moves current → changed on a real edit, keeping the result', () => {
    seed({ phase: 'current' })
    renderOption(OPTION_1)
    expect(screen.queryByTestId('option-stale-state-option-1')).toBeNull()
    act(() => useCanvasStore.setState({ analysisFreshnessDirty: true } as never))
    expect(onCard('option-win-readout-option-1')?.textContent).toBe(CHANCE)
    expect(inPopover('option-stale-preview-option-1')?.textContent).toBe(STALE_STATE)
  })
})
