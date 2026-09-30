/**
 * ⭐ THE OPTION CARD READS LIKE CONTRACT v3.1 AT ITS NEW WIDTH (Paul, 30 Sep 2026, on his staging run:
 * "the spacing is terrible. It's all bunched together. The graph is nearly invisible … text like
 * 'not analysed' really subtly invisible. They don't look like the design artefact.").
 *
 * Measured on served `61f5b909` (1440×900, MRR `af640d3c`) against the contract's own render:
 *   1. every `from → to` row split into two lines (name, then amount) inside a 400 card, because the row
 *      budget was still the 248 card's (`NODE_ROW_AMOUNT_MAX_CHARS`) — the card gained width, not lines;
 *   2. the rows said the unit twice ("£49 / month → £60 / month"); the contract says "£49 → £59";
 *   3. `Not analysed` was muted text; the contract's state is a bordered `.state-word` chip in ink;
 *   4. question→option / option→factor links reached ~40 below the ground, the contract's ~64.
 *
 * Bound by identity: option id + factor id test ids, exact strings.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'
import { useLayoutStore } from '../../layoutStore'
import { mapDraftEdgeToCanvas, mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import pricingStarter from '../../starters/data/pricing-model.draft.json'
import {
  elideSharedUnit,
  optionRowForm,
  type OptionChangeRow,
} from '../shared/optionChangeRows'
import { NODE_ROW_AMOUNT_MAX_CHARS, REPEATED_CARD_MAX_W, REPEATED_CARD_W, rowAmountMaxCharsFor } from '../../utils/nodeLayoutConstants'
import { STRUCTURAL_EDGE_COLOUR } from '../../edges/edgePresentation'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const baseProps = {
  type: 'option', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
}

afterEach(() => {
  cleanup()
  useLayoutStore.setState({ layoutCardWidths: null } as never)
})

describe('1 — one unit per row (contract "£49 → £59")', () => {
  it('a shared unit is said once, after the target', () => {
    expect(elideSharedUnit('£49 / month', '£60 / month')).toBe('£49')
    expect(elideSharedUnit('0 hours/week', '20 hours/week')).toBe('0')
    expect(elideSharedUnit('1,500 subscribers', '1,600 subscribers')).toBe('1,500')
  })
  it('CONTROL: different units, qualitative readings and bare figures stay whole', () => {
    expect(elideSharedUnit('1 month', '12 months')).toBe('1 month')
    expect(elideSharedUnit('Very high', 'Moderate')).toBe('Very high')
    expect(elideSharedUnit('8%', '7%')).toBe('8%')
    expect(elideSharedUnit('£49 / month', '£600 / year')).toBe('£49 / month')
  })
})

describe('2 — a card spends the row budget of its OWN width', () => {
  const row = {
    factorId: 'f', label: 'Pro plan price', fullLabel: 'Pro plan price',
    change: '£49 → £60 / month', before: '£49', after: '£60 / month', fullChange: '£49 / month → £60 / month',
    target: '£60 / month', reference: 'current_value', estimated: false,
    targetSource: { kind: 'user' }, sameAsReference: false,
  } as unknown as OptionChangeRow

  it('the floor keeps the narrowest card\'s budget; the widest card gets more', () => {
    expect(rowAmountMaxCharsFor(REPEATED_CARD_W)).toBe(NODE_ROW_AMOUNT_MAX_CHARS)
    expect(rowAmountMaxCharsFor(REPEATED_CARD_MAX_W)).toBeGreaterThan(NODE_ROW_AMOUNT_MAX_CHARS)
    expect(rowAmountMaxCharsFor(100)).toBe(NODE_ROW_AMOUNT_MAX_CHARS)
  })
  it('⭐ "Pro plan price  £49 → £60 / month" is ONE line in a 400 card, two in a 248 one', () => {
    expect(optionRowForm(row, rowAmountMaxCharsFor(REPEATED_CARD_MAX_W))).toBe('one-line')
    expect(optionRowForm(row, rowAmountMaxCharsFor(REPEATED_CARD_W))).toBe('two-line')
  })
})

describe('2b — the card reads its width from the layout (the shipped pricing starter)', () => {
  type Draft = { nodes: unknown[]; edges: unknown[]; analysis_ready: unknown }
  const draft = pricingStarter as unknown as Draft
  const OPTION = 'opt_hybrid'
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: draft.nodes.map(mapDraftNodeToCanvas), edges: draft.edges.map(mapDraftEdgeToCanvas),
      ceeAnalysisReady: draft.analysis_ready, results: { status: 'idle', report: null }, viewMode: 'standard',
    } as never)
  })
  // "Bottom-up adoption friction  Very high → Moderate brief" fits a 400 card's line; "No usage pricing →
  // Moderate brief" beside 12 characters of its name does not, at either width (the honest limit).
  const FITS = 'fac_adoption_friction'
  const TOO_LONG = 'fac_usage_exposure'
  const forms = () => {
    const n = (useCanvasStore.getState() as unknown as { nodes: Array<{ id: string; data: Record<string, unknown> }> }).nodes.find(x => x.id === OPTION)!
    render(<ReactFlowProvider><OptionNode {...baseProps} id={OPTION} data={n.data as never} /></ReactFlowProvider>)
    return Object.fromEntries([...document.querySelectorAll(`[data-testid^="option-change-row-line-${OPTION}-"]`)]
      .filter(el => !el.closest('[data-testid="node-popover"]'))
      .map(el => [el.getAttribute('data-testid')!.slice(`option-change-row-line-${OPTION}-`.length), el.getAttribute('data-row-form')]))
  }
  it('⭐ in a 400 card the row that fits is ONE line; the row too long for any line stays two', () => {
    useLayoutStore.setState({ layoutCardWidths: { option: REPEATED_CARD_MAX_W } } as never)
    const f = forms()
    expect(f[FITS]).toBe('one-line')
    expect(f[TOO_LONG]).toBe('two-line')
  })
  it('CONTROL: with no width on record the same row keeps the narrowest card\'s two lines', () => {
    expect(forms()[FITS]).toBe('two-line')
  })
})

describe('3 — `Not analysed` is the contract\'s state chip, not muted text', () => {
  const option = (id: string) => ({ id, type: 'option', position: { x: 0, y: 0 }, data: { label: id, type: 'option' } })
  it('⭐ the state word sits in a bordered chip in ink', () => {
    useCanvasStore.setState({
      nodes: [option('addon'), option('other')], edges: [], viewMode: 'expert',
      ceeAnalysisReady: { options: [], blockers: [] },
      results: { status: 'complete', report: { option_probabilities: { other: { status: 'computed', win_probability: 1 } } } },
      analysisFreshness: { freshness: 'fresh' }, analysisFreshnessDirty: false, importPendingServerRegistration: false,
    } as never)
    render(<ReactFlowProvider><OptionNode {...baseProps} id="addon" data={option('addon').data as never} /></ReactFlowProvider>)
    const chip = screen.getByTestId('option-not-analysed-chip-addon')
    expect(chip.textContent).toBe('Not analysed')
    const cls = new Set((chip.getAttribute('class') ?? '').split(/\s+/))
    for (const t of ['border', 'rounded-full', 'text-text-body', 'bg-panel']) expect(cls.has(t), t).toBe(true)
    expect(cls.has('text-text-light')).toBe(false)
  })
})

describe('4 — structural links carry the contract\'s contrast', () => {
  it('the muted-ink token at 0.75, not 0.5', () => {
    expect(STRUCTURAL_EDGE_COLOUR).toBe('rgb(var(--text-light-rgb) / 0.75)')
  })
})
