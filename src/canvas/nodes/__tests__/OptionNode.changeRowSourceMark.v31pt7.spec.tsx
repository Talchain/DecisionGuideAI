/**
 * Contract v3.1 pt 7 (with pt 1) — gap U12, from Paul's two served screenshots
 * of 24 Sep 2026:
 *
 *   A (OpenAI PoC):       "Tech lead headcount   → 1 brief"
 *                          — the source mark reads as the value's unit.
 *   B (Conventional PoC): "Development throughput 0.3 scale → 0.85 scale est."
 *                          — the model's internal placeholder unit `scale` is
 *                          printed after each number.
 *
 * The rule (v3.1 pt 7): each "current → target" row marks where the target came
 * from, using pt 1's marks — "£49 → £59 brief", "8% → 7% est." — and every mark
 * has an accessible name (pt 1). So:
 *
 *   · the mark sits in its own cluster, set apart from the value by a muted,
 *     decorative separator, so "1 brief" cannot be read as a quantity;
 *   · every mark, `est.` included, carries an accessible name;
 *   · a placeholder unit word is dropped and the producer's figure kept — the
 *     factor card's existing rule (`placeholderMagnitudeNumber`). Real units,
 *     and `ratio` (deliberately NOT a placeholder), are untouched.
 *
 * Bound by IDENTITY: test ids carrying the option and factor ids, the mark's kind
 * from `data-value-source`, exact labels. CLAIM SCOPE: jsdom proves DOM text and
 * attributes, never layout, wrapping, contrast or visibility.
 *
 * ⭐ RE-POINTED TWICE. The bounded anatomy (ED #63 5809278282, 24 Sep) moved the
 * rows into the popover and kept a one-line face; Paul (25 Sep) ruled the card
 * must match the PROTOTYPE, whose resting face IS the rows. So the rows are read
 * ON THE CARD (`optionCardRows`, which refuses a block inside a popover), and the
 * grammar — value, muted separator, then the mark — is pinned on the row.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ layoutNodeWidth: null, layoutCardWidths: null }),
  ),
}))
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))
vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))
vi.mock('../../store', () => {
  const useCanvasStore = vi.fn() as unknown as { (sel: (s: unknown) => unknown): unknown; getState: () => unknown }
  return { useCanvasStore }
})
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))
vi.mock('../../hooks/useAnalysisTrust', () => ({ useAnalysisTrust: vi.fn() }))
vi.mock('../../hooks/useAnalysisResultsAreCurrent', () => ({ useAnalysisResultsAreCurrent: vi.fn() }))
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div data-testid="node-popover">{children}</div>,
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { useAnalysisResultsAreCurrent } from '../../hooks/useAnalysisResultsAreCurrent'
import { OptionNode } from '../OptionNode'
import { VALUE_SOURCE_MARK_LABEL } from '../shared/valueSourceMark'
import { buildOptionChangeRow } from '../shared/optionChangeRows'
import { optionCardRows } from './__helpers__/optionPreview'

type N = { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }
const factor = (id: string, label: string, observedState: Record<string, unknown>): N => ({
  id, type: 'factor', position: { x: 0, y: 0 }, data: { type: 'factor', label, category: 'controllable', observedState },
})
const option = (id: string, label: string, isBaseline: boolean): N => ({
  id, type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label, is_baseline: isBaseline },
})

const FACTORS: N[] = [
  // Screenshot A: a count target with no reference, from the brief.
  factor('fac-lead', 'Tech lead headcount', { value: 0 }),
  // Screenshot B: the internal placeholder unit, spelled into the producer's display strings.
  factor('fac-thru', 'Development throughput', { value: 0.3, unit: 'scale' }),
  // Contrast: a real unit must keep its word.
  factor('fac-days', 'Time to hire', { value: 42, unit: 'days' }),
  // Contrast: `ratio` is deliberately NOT a placeholder (unitClassifier) and must keep its word.
  factor('fac-ratio', 'Senior to junior ratio', { value: 0.4, unit: 'ratio' }),
  // Contrast: a user-set target keeps the "you" mark, now with the same separator.
  factor('fac-price', 'Monthly price', { value: 49, unit: '£' }),
]

const OPTIONS: N[] = [
  option('opt-sq', 'Status quo', true),
  option('opt-hire', 'Hire a tech lead', false),
  option('opt-tools', 'Invest in tooling', false),
  option('opt-price', 'Raise the price', false),
]

const iv = (value: number, display_value: string, source: string) => ({ value, display_value, source })

const CEE = {
  goal_node_id: 'goal-1',
  status: 'ready',
  options: [
    { id: 'opt-sq', interventions: {
      'fac-thru': iv(0.3, '0.3 scale', 'brief_extraction'),
      'fac-days': iv(42, '42 days', 'brief_extraction'),
      'fac-ratio': iv(0.4, '0.4 ratio', 'brief_extraction'),
      'fac-price': iv(49, '£49', 'brief_extraction'),
    } },
    { id: 'opt-hire', interventions: { 'fac-lead': iv(1, '1', 'brief_extraction') } },
    { id: 'opt-tools', interventions: {
      'fac-thru': iv(0.85, '0.85 scale', 'cee_hypothesis'),
      'fac-days': iv(56, '56 days', 'brief_extraction'),
    } },
    { id: 'opt-price', interventions: {
      'fac-price': iv(59, '£59', 'user_specified'),
      'fac-ratio': iv(0.6, '0.6 ratio', 'cee_hypothesis'),
    } },
  ],
  blockers: [],
}

let state: Record<string, unknown>
function setState() {
  state = {
    hoveredOptionId: null, setHoveredOption: vi.fn(),
    nodes: [...FACTORS, ...OPTIONS], edges: [],
    ceeAnalysisReady: CEE,
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(), dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null, goalConstraints: [],
    optionNumbering: { 'opt-sq': 1, 'opt-hire': 2, 'opt-tools': 3, 'opt-price': 4 },
    runMeta: null, viewMode: 'standard', lodRung: 'full', selectNodeWithoutHistory: vi.fn(),
  }
  const hook = useCanvasStore as unknown as { getState: () => unknown }
  vi.mocked(useCanvasStore).mockImplementation(((sel: (s: unknown) => unknown) => sel(state)) as never)
  hook.getState = () => state
}

const BASE_META = {
  sensitivityRank: null, influence: null, influenceProvenance: null, influenceImportanceBasis: null,
  influenceSetSize: null, confidence: null, confidenceIsDefaulted: false, confidenceIsProvisional: false,
  inSensitivityAnalysis: false, achievementProbability: null, achievementProbabilityIsModelledBasis: false,
  achievementProbabilityBasis: null, stabilityPercentage: null, winRate: null, winComputationFailed: false,
  predictedOutcome: null, valueOfInformation: null, voiRank: null, isResultsMode: false, goalFitAvailable: false,
}

function renderOption(id: string) {
  const n = OPTIONS.find(x => x.id === id)!
  return render(
    <ReactFlowProvider>
      <OptionNode id={id} type="option" data={n.data} selected={false} isConnectable zIndex={0}
        positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} deletable={false} selectable draggable />
    </ReactFlowProvider>,
  )
}

/** What a sighted reader sees: the text with screen-reader-only phrases removed. */
function visibleText(el: Element): string {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('.sr-only').forEach(n => n.remove())
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function row(_container: HTMLElement, opt: string, fid: string): HTMLElement {
  // The rows are ON THE CARD at rest (Paul 25 Sep, the prototype; supersedes the
  // bounded anatomy's popover placement) — read THERE, bound by identity.
  const dd = optionCardRows(opt).querySelector<HTMLElement>(`[data-testid="option-change-row-${opt}-${fid}"]`)
  expect(dd, `row ${opt}/${fid}`).not.toBeNull()
  return dd!
}

beforeEach(() => {
  vi.mocked(useNodeDisplayMetadata).mockImplementation(() => BASE_META as never)
  vi.mocked(useAnalysisTrust).mockReturnValue({ semantic: 'none' } as never)
  vi.mocked(useAnalysisResultsAreCurrent).mockReturnValue(false)
  setState()
})
afterEach(() => cleanup())

describe('v3.1 pt 7 (U12a) — the source mark can never be read as the value’s unit', () => {
  it('screenshot A: "→ 1 brief" now reads "→ 1 · brief", the mark in its own cluster with the name "From your brief"', () => {
    const { container } = renderOption('opt-hire')
    const dd = row(container, 'opt-hire', 'fac-lead')
    // ⛔ NO "FROM" HERE, AND THAT IS THE FAITHFUL READING. fac-lead carries only
    // `{value: 0}` — no raw_value, no unit, no display_value, no encoding_map —
    // so the factor card's "No tech lead headcount in place" is the formatter's
    // value-only GUESS, not a reading the data carries. A guess is never a row's
    // "from" (Paul 25 Sep: "from" only "when the data carries it"; verifier
    // FIX_NEEDED on e0490565, which had re-pinned this as
    // 'No tech lead headcount in place → 1 · brief').
    expect(visibleText(dd)).toBe('→ 1 · brief')
    expect(visibleText(dd)).not.toContain('in place')
    expect(visibleText(dd)).not.toMatch(/\d\s+brief/)

    const cluster = dd.querySelector('[data-testid="option-change-row-mark-opt-hire-fac-lead"]')
    expect(cluster).not.toBeNull()
    // The separator is first, decorative, and outside the mark.
    const sep = cluster!.firstElementChild!
    expect(sep.getAttribute('aria-hidden')).toBe('true')
    expect(sep.textContent?.trim()).toBe('·')
    const mark = cluster!.querySelector('[data-testid="option-change-row-source-opt-hire-fac-lead"]')
    expect(mark).not.toBeNull()
    expect(sep.contains(mark)).toBe(false)
    expect(mark!.getAttribute('data-value-source')).toBe('brief')
    expect(mark!.querySelector('[aria-hidden="true"]')!.textContent).toBe('brief')
    expect(mark!.querySelector('.sr-only')!.textContent).toBe('From your brief')
  })

  it('an Olumi target keeps its served `est.` test id and token, and now has an accessible name and the same separator', () => {
    const { container } = renderOption('opt-tools')
    const cluster = row(container, 'opt-tools', 'fac-thru')
      .querySelector('[data-testid="option-change-row-mark-opt-tools-fac-thru"]')
    expect(cluster).not.toBeNull()
    expect(cluster!.firstElementChild!.getAttribute('aria-hidden')).toBe('true')
    const est = cluster!.querySelector('[data-testid="option-change-row-estimate-opt-tools-fac-thru"]')
    expect(est).not.toBeNull()
    expect(est!.getAttribute('data-value-source')).toBe('olumi')
    expect(est!.querySelector('[aria-hidden="true"]')!.textContent).toBe('est.')
    expect(est!.querySelector('.sr-only')!.textContent).toBe(VALUE_SOURCE_MARK_LABEL.olumi)
    expect(est!.getAttribute('title')).toBe(
      'Olumi chose this target; it is not yet confirmed. Open the details to set or confirm it.',
    )
  })

  it('the resting FACE is the row itself: "… → 1 · brief", the mark set apart, the source in the row\'s own title', () => {
    // The one-line face (`option-primary-change-*`) is retired (Paul 25 Sep): the
    // card's resting surface IS the rows, so the grammar is pinned on the row.
    const { container } = renderOption('opt-hire')
    expect(container.querySelector('[data-testid="option-primary-change-opt-hire"]')).toBeNull()
    const dd = row(container, 'opt-hire', 'fac-lead')
    expect(visibleText(dd).endsWith('→ 1 · brief')).toBe(true)
    expect(visibleText(dd)).not.toMatch(/\d\s+brief/)
    const mark = dd.querySelector('[data-testid="option-change-row-source-opt-hire-fac-lead"]')
    expect(mark?.getAttribute('data-value-source')).toBe('brief')
    // The separator is decorative and outside the mark.
    const sep = mark!.previousElementSibling!
    expect(sep.textContent?.trim()).toBe('·')
    expect(sep.contains(mark)).toBe(false)
    expect(dd.getAttribute('title')).toContain('Target: from your brief.')
  })

  it('CONTRAST — a user-set target still renders its "you" mark (no est.), inside the same cluster', () => {
    const { container } = renderOption('opt-price')
    const dd = row(container, 'opt-price', 'fac-price')
    expect(visibleText(dd)).toBe('£49 → £59 · you')
    expect(dd.querySelector('[data-testid="option-change-row-estimate-opt-price-fac-price"]')).toBeNull()
    const mark = dd.querySelector('[data-testid="option-change-row-mark-opt-price-fac-price"] [data-testid="option-change-row-source-opt-price-fac-price"]')
    expect(mark?.getAttribute('data-value-source')).toBe('you')
    expect(mark?.querySelector('.sr-only')?.textContent).toBe('Set by you')
  })
})

describe('v3.1 pt 7 (U12b) — no bare internal `scale` word after each number', () => {
  it('screenshot B: "0.3 scale → 0.85 scale est." now reads "0.3 → 0.85 · est.", and the hover text says no "scale" either', () => {
    const { container } = renderOption('opt-tools')
    const dd = row(container, 'opt-tools', 'fac-thru')
    expect(visibleText(dd)).toBe('0.3 → 0.85 · est.')
    expect(dd.textContent ?? '').not.toMatch(/scale/i)
    expect(dd.getAttribute('title') ?? '').not.toMatch(/scale/i)
    // The producer's own figures survive — nothing rounded, rescaled or banded.
    expect(dd.getAttribute('title')).toContain('0.3 → 0.85')
  })

  it('CONTRAST — a real unit keeps its word ("42 days → 56 days")', () => {
    const { container } = renderOption('opt-tools')
    expect(visibleText(row(container, 'opt-tools', 'fac-days'))).toBe('42 days → 56 days · brief')
  })

  it('CONTRAST — `ratio` is not a placeholder and keeps its word', () => {
    const { container } = renderOption('opt-price')
    expect(visibleText(row(container, 'opt-price', 'fac-ratio'))).toBe('0.4 ratio → 0.6 ratio · est.')
  })

  it('the row builder drops the placeholder word from BOTH the resting and the full change', () => {
    const r = buildOptionChangeRow({
      factorId: 'fac-thru',
      target: { value: 0.85, displayValue: '0.85 scale', source: 'cee_hypothesis' },
      factor: { label: 'Development throughput', unit: 'scale', observedValue: 0.3 },
      baselineOptionTarget: { value: 0.3, displayValue: '0.3 scale' },
    })
    expect(r.change).toBe('0.3 → 0.85')
    expect(r.fullChange).toBe('0.3 → 0.85')
    expect(r.estimated).toBe(true)
  })

  it('the row builder drops it on the numeric path too (a raw-anchored `scale` factor, current-value reference)', () => {
    const r = buildOptionChangeRow({
      factorId: 'fac-thru',
      target: { value: 0.85, source: 'cee_hypothesis' },
      factor: { label: 'Development throughput', unit: 'scale', observedValue: 0.3, observedRawValue: 0.3 },
      baselineOptionTarget: null,
    })
    expect(r.change).not.toMatch(/scale/i)
    expect(r.fullChange).not.toMatch(/scale/i)
    expect(r.change).toBe('0.3 → 0.85')
  })

  it('CONTRAST — a tier reading still sheds its parenthesised number at rest and keeps it in the full change', () => {
    const r = buildOptionChangeRow({
      factorId: 'fac-q',
      target: { value: 0.9, displayValue: 'Very high (0.9)', source: 'brief_extraction' },
      factor: { label: 'Quality' },
      baselineOptionTarget: { value: 0.5, displayValue: 'Moderate (0.5)' },
    })
    expect(r.change).toBe('Moderate → Very high')
    expect(r.fullChange).toBe('Moderate (0.5) → Very high (0.9)')
  })
})
