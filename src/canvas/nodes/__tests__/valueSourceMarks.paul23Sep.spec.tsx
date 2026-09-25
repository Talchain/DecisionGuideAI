/**
 * Paul 23 Sep contract feedback — points 1, 7 and 15, pinned on the card FACE.
 *
 *   1. Every Olumi-estimated value is explicitly marked; user-set and brief
 *      values carry their own mark; "unmarked = Olumi" is not a rule a reader
 *      should have to know. Value, range and qualitative displays alike, at the
 *      Normal (standard) view AND Detailed — no hover-only marks.
 *   7. An option's change row says where its TARGET came from: you / Olumi /
 *      brief. Unknown or absent sources are Olumi's estimate, never "you".
 *  15. No "N of M values set by you" aggregate on any card.
 *
 * Bound by IDENTITY: every assertion reads a test id carrying the node (and
 * factor) id, and the mark's kind from `data-value-source`, never a text search
 * another element could satisfy.
 *
 * CLAIM SCOPE: jsdom proves presence/absence of DOM text and attributes, never
 * layout, contrast or visibility.
 *
 * ⭐ POINT 7 RE-POINTED BY THE BOUNDED ANATOMY (ED #63 5809278282, 24 Sep 2026:
 * the S3 change rows move "to the existing hover/focus popover"; "value
 * provenance remain[s] explicit"). The option's rows are read in its popover
 * detail (`option-preview-detail-<id>`) by identity; the value the FACE still
 * shows — its one line, the top change — is pinned to carry the SAME mark
 * beside it, so no value on the card is ever unmarked.
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
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { optionPreviewDetail } from './__helpers__/optionPreview'
import { interventionTargetSourceMark } from '../shared/valueSourceMark'

type N = { id: string; type: string; position: { x: number; y: number }; data: Record<string, unknown> }
const f = (id: string, label: string, extra: Record<string, unknown>): N => ({
  id, type: 'factor', position: { x: 0, y: 0 }, data: { type: 'factor', label, category: 'controllable', ...extra },
})

const FACTORS: N[] = [
  f('fac-est', 'Trial conversion', { observedState: { value: 0.08, unit: '%', display_value: '8%', extractionType: 'inferred', source: 'cee_inference' } }),
  f('fac-qual', 'Brand strength', { observedState: { value: 0.5, display_value: 'Moderate (0.5)', extractionType: 'inferred', source: 'cee_inference' } }),
  f('fac-you', 'Monthly price', { observedState: { value: 49, unit: '£', display_value: '£49', source: 'user_override' } }),
  // A person's number that still carries the stale inferred label: the person wins.
  f('fac-you-stale', 'Seat price', { observedState: { value: 59, unit: '£', display_value: '£59', source: 'user_override', extractionType: 'inferred' } }),
  f('fac-confirmed', 'Churn rate', { observedState: { value: 0.04, unit: '%', display_value: '4%', source: 'user_confirmed' } }),
  f('fac-brief', 'Seat count', { observedState: { value: 10, unit: 'seats', display_value: '10 seats', source: 'brief_extraction', extractionType: 'explicit' } }),
  f('fac-brief-x', 'Team size', { observedState: { value: 12, unit: 'people', display_value: '12 people', extractionType: 'explicit' } }),
  // No stamp anywhere: marked "no source" — never Olumi's, never the user's.
  f('fac-nostamp', 'Support load', { observedState: { value: 30, unit: 'tickets', display_value: '30 tickets' } }),
  // The writer withdrew extractionType on a user edit; the receipt has not stamped yet.
  // The user-edit window, as the REAL writer leaves it (`setObservedValue`): the
  // old Olumi source kept, `display_value` and BOTH `extractionType` spellings
  // withdrawn — keys PRESENT, set to `undefined`. (This fixture used to OMIT the
  // key, which is a different shape: see `fac-ai-draft`.)
  f('fac-edit-window', 'Engineering capacity', {
    extractionType: undefined,
    observedState: { value: 0.8, raw_value: 0.8, display_value: undefined, source: 'cee_inference', extractionType: undefined },
  }),
  // A fresh AI-drafted value, byte for byte as CEE `9417228` serves it (OpenAI
  // draft, AI Quality capture B-openai line 1): Olumi's source, NO
  // `extractionType` key at all. Reviewer 5827605617: it read "no source".
  f('fac-ai-draft', 'Developer delivery capacity', {
    provenance: 'ai_inferred',
    observedState: { unit: 'FTE', value: 0.25, source: 'cee_inference', raw_value: 5 },
  }),
  // An external factor whose only figure is its prior range (Vendor Licensing Cost shape).
  { id: 'fac-range', type: 'factor', position: { x: 0, y: 0 }, data: {
    type: 'factor', label: 'Vendor licensing cost', category: 'external', extractionType: 'inferred', observedState: {},
    prior: { distribution: 'uniform', range_min: 0.25, range_max: 0.75 },
  } },
]

const OPTIONS: N[] = [
  { id: 'opt-base', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Keep current pricing', is_baseline: true } },
  { id: 'opt-a', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Raise the plan price', is_baseline: false } },
  { id: 'opt-b', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option', label: 'Bundle seats', is_baseline: false } },
]

const CEE = {
  goal_node_id: 'goal-1',
  status: 'ready',
  options: [
    { id: 'opt-base', interventions: { 'fac-you': { value: 49, source: 'brief_extraction' }, 'fac-est': { value: 0.08, source: 'brief_extraction' } } },
    // opt-a: user-specified price, Olumi-chosen conversion.
    { id: 'opt-a', interventions: { 'fac-you': { value: 59, source: 'user_specified' }, 'fac-est': { value: 0.07, source: 'cee_hypothesis' } } },
    // opt-b: brief price, and a conversion target with the LIVE literal the intervention vocabulary does not classify.
    { id: 'opt-b', interventions: { 'fac-you': { value: 55, source: 'brief_extraction' }, 'fac-est': { value: 0.09, source: 'cee_inference' } } },
  ],
  blockers: [],
}

let state: Record<string, unknown>
function setState({ viewMode = 'standard' }: { viewMode?: 'standard' | 'expert' } = {}) {
  state = {
    hoveredOptionId: null, setHoveredOption: vi.fn(),
    nodes: [...FACTORS, ...OPTIONS], edges: [],
    ceeAnalysisReady: CEE,
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(), dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null, goalConstraints: [],
    optionNumbering: { 'opt-base': 1, 'opt-a': 2, 'opt-b': 3 },
    runMeta: null, viewMode, lodRung: 'full', selectNodeWithoutHistory: vi.fn(),
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

const renderNode = (Comp: unknown, id: string) => {
  const n = [...FACTORS, ...OPTIONS].find(x => x.id === id)!
  const C = Comp as React.ComponentType<Record<string, unknown>>
  return render(
    <ReactFlowProvider>
      <C id={id} type={n.type} data={n.data} selected={false} isConnectable zIndex={0}
        positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} deletable={false} selectable draggable />
    </ReactFlowProvider>,
  )
}

/** The mark on the factor's value line, by identity: kind from `data-value-source`, or `est.` from the served marker. */
function factorValueMark(container: HTMLElement): string | null {
  const line = container.querySelector('[data-testid="factor-recorded-value"]')
  if (!line) return 'NO-VALUE-LINE'
  if (line.querySelector('[data-testid="estimate-marker"]')) return 'olumi'
  const m = line.querySelector('[data-value-source]')
  return m ? m.getAttribute('data-value-source') : null
}

beforeEach(() => {
  vi.mocked(useNodeDisplayMetadata).mockImplementation(() => BASE_META as never)
  vi.mocked(useAnalysisTrust).mockReturnValue({ semantic: 'none' } as never)
  vi.mocked(useAnalysisResultsAreCurrent).mockReturnValue(false)
})
afterEach(() => cleanup())

describe('Paul 23 Sep point 1 — every factor value names its source on the face', () => {
  for (const view of ['standard', 'expert'] as const) {
    describe(`${view} view`, () => {
      it.each([
        ['fac-est', 'olumi'],
        ['fac-qual', 'olumi'],
        ['fac-you', 'you'],
        ['fac-you-stale', 'you'],
        ['fac-confirmed', 'you'],
        ['fac-brief', 'brief'],
        ['fac-brief-x', 'brief'],
        ['fac-nostamp', 'unknown'], // Codex 5801529767: unknown stays unknown — never Olumi, never you
        ['fac-ai-draft', 'olumi'], // reviewer 5827605617: the producer's own source names the author
      ])('%s → %s', (id, expected) => {
        setState({ viewMode: view })
        const { container } = renderNode(FactorNode, id)
        expect(factorValueMark(container)).toBe(expected)
      })
    })
  }

  it('the user-edit window (old Olumi source, withdrawn extractionType) reads "no source" — never est., never you, never unmarked (Codex #1919 5802926467)', () => {
    setState()
    const { container } = renderNode(FactorNode, 'fac-edit-window')
    expect(factorValueMark(container)).toBe('unknown')
  })

  it('the mark is a word with an accessible name, not colour alone', () => {
    setState()
    const { container } = renderNode(FactorNode, 'fac-confirmed')
    const m = container.querySelector('[data-testid="factor-recorded-value"] [data-value-source="you"]')!
    expect(m.querySelector('[aria-hidden="true"]')!.textContent).toBe('you')
    expect(m.querySelector('.sr-only')!.textContent).toBe('Confirmed by you')
    expect(m.getAttribute('title')).toBe('Confirmed by you')
  })

  it('a range that is the factor’s only figure is marked "no source" — never est., never "filled in for you" (the range’s author is not recorded)', () => {
    // `fac-range` is the reviewer's case: no value, a `prior` of the shape
    // `setPriorRange` writes (no stamp), and a draft-time `extractionType:
    // 'inferred'` still on the node. The value's mark would say `est.`.
    setState()
    const { container } = renderNode(FactorNode, 'fac-range')
    // ED #63 5809278282 (bounded anatomy): in Standard the range line is the
    // factor's POPOVER content, not the face — and its mark travels with it.
    const face = container.querySelector('[role="group"]')!
    expect(face.querySelector('[data-testid="node-title"]')?.textContent).toBeTruthy()
    expect(face.querySelector('[data-testid="factor-prior-range-fac-range"]')).toBeNull()
    const range = container.querySelector('[data-testid="node-popover"] [data-testid="factor-prior-range-fac-range"]')
    expect(range).toBeTruthy()
    expect(range!.querySelector('[data-testid="estimate-marker"]')).toBeNull()
    expect(range!.textContent ?? '').not.toMatch(/filled in for you|est\./)
    const m = range!.querySelector('[data-testid="factor-range-source-fac-range"]')
    expect(m?.getAttribute('data-value-source')).toBe('unknown')
    expect(m?.querySelector('.sr-only')?.textContent).toBe('Source not recorded')
  })
})

describe('Paul 23 Sep point 7 — an option change row says where its TARGET came from', () => {
  const rowMark = (_container: HTMLElement, opt: string, fid: string): string | null => {
    // Bounded anatomy: the rows live in the option's popover detail — read THERE.
    const dd = optionPreviewDetail(opt)?.querySelector(`[data-testid="option-change-row-${opt}-${fid}"]`)
    if (!dd) return 'NO-ROW'
    if (dd.querySelector(`[data-testid="option-change-row-estimate-${opt}-${fid}"]`)) return 'olumi'
    const m = dd.querySelector(`[data-testid="option-change-row-source-${opt}-${fid}"]`)
    return m ? m.getAttribute('data-value-source') : null
  }

  it('user_specified → you; cee_hypothesis → est.', () => {
    setState()
    const { container } = renderNode(OptionNode, 'opt-a')
    expect(rowMark(container, 'opt-a', 'fac-you')).toBe('you')
    expect(rowMark(container, 'opt-a', 'fac-est')).toBe('olumi')
  })

  it('brief_extraction → brief; an unclassified intervention literal (cee_inference) → "no source" — never est., never you, never unmarked (Codex 5801529767)', () => {
    setState()
    const { container } = renderNode(OptionNode, 'opt-b')
    expect(rowMark(container, 'opt-b', 'fac-you')).toBe('brief')
    expect(rowMark(container, 'opt-b', 'fac-est')).toBe('unknown')
  })

  it('a BARE analysis_ready number equal to the node’s own receipt-stamped target keeps the user’s stamp → you, never est. (applyDraftResult 23 Sep witness)', () => {
    setState()
    const USER_OBJ = { value: 59, source: 'user_specified' }
    state.nodes = (state.nodes as N[]).map(n => n.id === 'opt-a'
      ? { ...n, data: { ...n.data, interventions: { 'fac-you': USER_OBJ, 'fac-est': { value: 0.07, source: 'cee_hypothesis' } } } }
      : n)
    state.ceeAnalysisReady = {
      ...CEE,
      options: CEE.options.map(o => o.id === 'opt-a' ? { id: 'opt-a', interventions: { 'fac-you': 59, 'fac-est': 0.07 } } : o),
    }
    const { container } = render(
      <ReactFlowProvider>
        <OptionNode id="opt-a" type="option" data={(state.nodes as N[]).find(n => n.id === 'opt-a')!.data} selected={false} isConnectable zIndex={0}
          positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} deletable={false} selectable draggable />
      </ReactFlowProvider>,
    )
    expect(rowMark(container, 'opt-a', 'fac-you')).toBe('you')
    // The Olumi-chosen target keeps ITS stamp the same way — est., from the node's own object.
    expect(rowMark(container, 'opt-a', 'fac-est')).toBe('olumi')
  })

  it('CONTRAST — a bare number that DIFFERS from the node’s own target does not inherit its stamp → "no source"', () => {
    setState()
    state.nodes = (state.nodes as N[]).map(n => n.id === 'opt-a'
      ? { ...n, data: { ...n.data, interventions: { 'fac-you': { value: 59, source: 'user_specified' }, 'fac-est': { value: 0.07, source: 'cee_hypothesis' } } } }
      : n)
    state.ceeAnalysisReady = {
      ...CEE,
      options: CEE.options.map(o => o.id === 'opt-a' ? { id: 'opt-a', interventions: { 'fac-you': 61, 'fac-est': 0.07 } } : o),
    }
    const { container } = render(
      <ReactFlowProvider>
        <OptionNode id="opt-a" type="option" data={(state.nodes as N[]).find(n => n.id === 'opt-a')!.data} selected={false} isConnectable zIndex={0}
          positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} deletable={false} selectable draggable />
      </ReactFlowProvider>,
    )
    expect(rowMark(container, 'opt-a', 'fac-you')).toBe('unknown')
  })

  it('the 2-row bound is unchanged', () => {
    setState()
    renderNode(OptionNode, 'opt-a')
    expect(optionPreviewDetail('opt-a')!.querySelectorAll('[data-testid="option-change-rows-opt-a"] dd')).toHaveLength(2)
  })

  it('the FACE keeps its value marked: the one line carries the SAME mark as that factor\'s row', () => {
    setState()
    const { container } = renderNode(OptionNode, 'opt-a')
    const line = container.querySelector('[data-testid="option-primary-change-opt-a"]')
    expect(line, 'the face line renders').not.toBeNull()
    expect(optionPreviewDetail('opt-a')!.contains(line!)).toBe(false)
    const fid = line!.getAttribute('data-factor-id')!
    const faceMark = line!.querySelector('[data-testid="option-primary-change-source-opt-a"]')!.getAttribute('data-value-source')
    expect(['you', 'olumi']).toContain(faceMark)
    // Same factor, same mark, in both places (the row reports `est.` as 'olumi').
    expect(rowMark(container, 'opt-a', fid)).toBe(faceMark)
  })

  it.each([
    [null, 'unknown'], [undefined, 'unknown'], ['', 'unknown'], ['cee_inference', 'unknown'], ['something_new', 'unknown'],
    ['cee_hypothesis', 'olumi'], ['brief_extraction', 'brief'], ['user_specified', 'you'],
  ])('interventionTargetSourceMark(%s) → %s (unknown is never "you" and never relabelled as Olumi)', (src, expected) => {
    expect(interventionTargetSourceMark(src as string | null | undefined).kind).toBe(expected)
  })
})

describe('Paul 23 Sep point 15 — no "N of M values set by you" aggregate on a card', () => {
  it.each(['fac-you', 'fac-est', 'opt-a', 'opt-b'])('%s carries no set-by-you count', (id) => {
    setState()
    const { container } = renderNode(id.startsWith('opt') ? OptionNode : FactorNode, id)
    expect(container.textContent ?? '').not.toMatch(/\d+\s+of\s+\d+\s+(values?\s+)?(set|edited|confirmed)\s+by\s+you/i)
  })
})
