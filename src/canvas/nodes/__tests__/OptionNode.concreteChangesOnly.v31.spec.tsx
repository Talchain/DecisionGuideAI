/**
 * ⭐ CONTRACT v3.1 OPTION CARD — CONCRETE CHANGES ONLY, FULL LABEL, AMOUNT ON ONE
 * LINE (DESIGN-GAP-v31 rows #9 and #19).
 *
 * v3.1 `checks.option`: "Concrete changes, differentiator and an editable
 * target route." Its fixture:
 *
 *   `.delta-rows{grid-template-columns:minmax(0,1fr) auto;font-size:11px}`
 *   `.delta-rows .label{color:muted}`   — the factor's FULL name, never cut
 *   `.delta-rows .amount{white-space:nowrap}` — "£49 → £59 brief" on one line
 *   `.node .differentiator{font-size:10.5px}`
 *   `.icon-btn.revealed{opacity:0}` — the edit pencil is hidden at rest
 *
 * MEASURED BEFORE (served `eec722ab`, 25 Sep): market-entry's Germany option
 * listed "Localisation and compliance cost · 0.5 · same as baseline · est." and
 * "Nordics market entry · Low · same as baseline · brief" — two of its three
 * rows were factors it does NOT change. On vendor-selection all three rows of
 * every option were "same as baseline", so no real change was visible at all.
 * Labels were CSS-clipped ("Bottom-up ado…") and amounts wrapped ("Very high →
 * Moderate / · brief"). The pencil was visible at rest on every non-baseline
 * option (two rail icons where the contract has one).
 *
 * PINNED BY IDENTITY (option id + factor id test ids, exact text):
 *   · a target EQUAL to the baseline option's is not a row; the next concrete
 *     change takes its place (contrast: a target that differs stays);
 *   · a target equal to the factor's current value (no baseline) is not a row;
 *   · `+N more` counts the concrete changes not shown (DIFF N1, 28 Sep — it
 *     counted the target total until then);
 *   · the label cell holds the full name and is not a truncating cell;
 *   · the `from → to` value and its mark are no-wrap segments;
 *   · the pencil is a revealed rail icon (hidden at rest, shown on hover/focus).
 *
 * CLAIM SCOPE: jsdom — DOM text, attributes and class tokens. Whether the row
 * FITS is measured in the browser (`/private/tmp/canvas-v31-ws4/`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { ReactNode } from 'react'
import { OptionNode } from '../OptionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: ReactNode }) => <div data-testid="node-popover">{children}</div>,
}))

vi.mock('../shared/openNodeInspector', () => ({ openNodeInspector: vi.fn(() => true) }))

const FACTOR_GERMANY = { id: 'f-germany', type: 'factor', data: { label: 'Germany market entry', type: 'factor' } }
const FACTOR_LOCAL = {
  id: 'f-local', type: 'factor',
  data: { label: 'Localisation and compliance cost', type: 'factor', observedState: { value: 0.5 } },
}
const FACTOR_NORDICS = { id: 'f-nordics', type: 'factor', data: { label: 'Nordics market entry', type: 'factor' } }
const FACTOR_TEAM = { id: 'f-team', type: 'factor', data: { label: 'Team capacity drawn into the launch', type: 'factor' } }

const GERMANY = { id: 'opt-germany', type: 'option', data: { label: 'Enter Germany first', type: 'option' } }
const NORDICS = { id: 'opt-nordics', type: 'option', data: { label: 'Enter the Nordics first', type: 'option' } }
const BASELINE = {
  id: 'opt-uk', type: 'option',
  data: { label: 'Stay UK-focused', type: 'option', is_baseline: true },
}

/**
 * The market-entry shape: every option (baseline included) sets the SAME
 * factors, and each non-baseline option moves only ONE of them away from the
 * baseline's target.
 */
const CEE_READY = {
  options: [
    {
      id: 'opt-germany',
      interventions: {
        'f-germany': { value: 1, display_value: 'Very high', source: 'brief_extraction' },
        'f-local': { value: 0.5, display_value: '0.5', source: 'cee_hypothesis' },
        'f-nordics': { value: 0, display_value: 'Low', source: 'brief_extraction' },
        'f-team': { value: 0.8, display_value: 'High', source: 'cee_hypothesis' },
      },
    },
    {
      id: 'opt-nordics',
      interventions: {
        'f-germany': { value: 0, display_value: 'Low', source: 'brief_extraction' },
        'f-local': { value: 0.5, display_value: '0.5', source: 'cee_hypothesis' },
        'f-nordics': { value: 1, display_value: 'Very high', source: 'brief_extraction' },
      },
    },
    {
      id: 'opt-uk',
      interventions: {
        'f-germany': { value: 0, display_value: 'Low', source: 'brief_extraction' },
        'f-local': { value: 0.5, display_value: '0.5', source: 'cee_hypothesis' },
        'f-nordics': { value: 0, display_value: 'Low', source: 'brief_extraction' },
        'f-team': { value: 0.3, display_value: 'Low', source: 'cee_hypothesis' },
      },
    },
  ],
}

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [FACTOR_GERMANY, FACTOR_LOCAL, FACTOR_NORDICS, FACTOR_TEAM, GERMANY, NORDICS, BASELINE],
  edges: [],
  ceeAnalysisReady: CEE_READY,
  results: { status: 'idle' },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'standard',
  lodRung: 'full',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
    achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  type: 'option', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
  deletable: true, selectable: true, draggable: true,
}

type StoreNode = { id: string; type: string; data: Record<string, unknown> }

const renderCard = ({ id = 'opt-germany', store = {} }: { id?: string; store?: Record<string, unknown> } = {}) => {
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState(store) as any))
  const own = (makeStoreState(store).nodes as StoreNode[]).find((n) => n.id === id)?.data
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} id={id} data={{ label: 'Option', type: 'option', ...own }} />
    </ReactFlowProvider>,
  )
}

const rowIds = (optionId: string) =>
  Array.from(document.querySelectorAll<HTMLElement>(`dd[data-testid^="option-change-row-${optionId}-"]`))
    .map((dd) => dd.dataset.testid!.replace(`option-change-row-${optionId}-`, ''))
const tokens = (el: Element | null) => new Set((el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))

describe('v3.1 #9 — an option card lists CONCRETE changes only', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('a target equal to the baseline option\'s is not a row; the next real change takes its place', () => {
    renderCard()
    // Germany moves f-germany (Low → Very high) and f-team (Low → High); it
    // leaves f-local and f-nordics exactly where the baseline has them.
    expect(rowIds('opt-germany')).toEqual(['f-germany', 'f-team'])
    const all = document.querySelector('[data-testid="option-change-rows-opt-germany"]')!.textContent!
    expect(all).not.toContain('same as baseline')
    expect(all).not.toContain('Localisation and compliance cost')
  })

  it('contrast: the change that differs from the baseline stays, with its from → to', () => {
    renderCard()
    expect(screen.getByTestId('option-change-row-opt-germany-f-germany').textContent!.startsWith('Low → Very high')).toBe(true)
  })

  // ⚠ RE-PINNED 28 Sep 2026 (side-by-side DIFF N1, owner decision): `+N more`
  // counted the target TOTAL, so the two targets Germany leaves where the
  // baseline has them read as "+2 more" changes (served: vendor-selection
  // `+5 more` with no further change). It now counts the concrete changes not
  // shown — here none, so no `+N more`; the pencil still names all four targets.
  it('`+N more` counts only concrete changes: two shown, none hidden → no `+N more`', () => {
    renderCard()
    expect(rowIds('opt-germany')).toEqual(['f-germany', 'f-team'])
    expect(screen.queryByTestId('option-change-more-opt-germany')).toBeNull()
    expect(screen.getByTestId('option-edit-targets-opt-germany').getAttribute('aria-label')).toMatch(/^4 factor targets\./)
  })

  it('with no baseline option, a target equal to the factor\'s current value is not a row', () => {
    const nodes = (makeStoreState().nodes as StoreNode[]).filter((n) => n.id !== 'opt-uk')
    const cee = { options: CEE_READY.options.filter((o) => o.id !== 'opt-uk') }
    renderCard({ id: 'opt-nordics', store: { nodes, ceeAnalysisReady: cee } })
    // f-local's current value is 0.5 and the option sets 0.5: no change.
    expect(rowIds('opt-nordics')).not.toContain('f-local')
    // contrast: the factors with no current value keep their target rows.
    expect(rowIds('opt-nordics')).toEqual(['f-germany', 'f-nordics'])
  })
})

describe('v3.1 #9 — full label, amount on one line', () => {
  // RE-PINNED (design audit #9, 26 Sep): the label is ONE line at every rung and
  // its DOM text is still the FULL name (never cut in JS).
  // ⭐ RE-PINNED 27 Sep (side-by-side DIFF item 1): the one line is a CHARACTER
  // ellipsis (`truncate`) after the amount's natural width — `line-clamp-1` broke
  // at a word and left one word — marked `data-truncates="label"`, with the full
  // name on the row line's `title` (the e2e clipping gate's exemption). Never
  // more than one line (`line-clamp-2`), and no title on the name cell itself.
  it('the label cell holds the FULL factor name on ONE ellipsised line, recoverable from the row (audit #9, DIFF item 1)', () => {
    renderCard()
    const dd = screen.getByTestId('option-change-row-opt-germany-f-team')
    const dt = dd.previousElementSibling as HTMLElement
    expect(dt.tagName).toBe('DT')
    expect(dt.textContent).toBe('Team capacity drawn into the launch')
    for (const cut of ['line-clamp-1', 'line-clamp-2']) {
      expect(tokens(dt).has(cut), `the label cell is clamped by ${cut}`).toBe(false)
    }
    expect(tokens(dt).has('truncate')).toBe(true)
    expect(dt.getAttribute('data-truncates')).toBe('label')
    expect(tokens(dt).has('min-w-0')).toBe(true)
    expect(dt.hasAttribute('title')).toBe(false)
    expect(dt.closest('[title]')?.getAttribute('title')).toBe('Team capacity drawn into the launch')
  })

  // RE-PINNED (design audit #9, 26 Sep): the mark is GLUED to the value by one
  // no-break space, so the value is held whole only while value + mark fits one
  // line of the row budget. "Low → Very high · brief" (23) does not, so the value
  // may break before its arrow; the "from" half stays one unbroken run, and the
  // last run "→ Very high · brief" (19) is over the budget too, so it may wrap at
  // its own spaces rather than push the mark past the card's edge (#2119's rule
  // applied to run + mark). The mark rides the value's last line. Was: the value
  // one no-wrap run, the mark free to drop to a line of its own.
  it('the "from" half and the glued source mark are no-wrap segments; the mark never leaves the value (audit #9)', () => {
    renderCard()
    const value = screen.getByTestId('option-change-row-value-opt-germany-f-germany')
    expect(value.textContent).toBe('Low → Very high')
    // 27 Sep 2026 (landing text ceiling): the row budget is 25 characters (was
    // 17), so this run and its mark now fit WHOLE — one no-wrap run, its halves
    // no-wrap segments inside it. The mark still never leaves the value.
    expect(tokens(value).has('whitespace-nowrap')).toBe(true)
    expect([...value.querySelectorAll('.whitespace-nowrap')].map((n) => n.textContent)).toEqual(['Low', '→ Very high'])
    const mark = screen.getByTestId('option-change-row-mark-opt-germany-f-germany')
    expect(tokens(mark).has('whitespace-nowrap')).toBe(true)
    expect(mark.previousSibling?.textContent).toBe('\u00A0')
    expect(mark.previousSibling?.previousSibling).toBe(value)
  })

  it('the differentiator line is the contract\'s 10.5px muted line', () => {
    const nodes = (makeStoreState().nodes as StoreNode[]).map((n) =>
      n.id === 'opt-germany' ? { ...n, data: { ...n.data, description: 'Tests demand before localising.' } } : n)
    renderCard({ store: { nodes } })
    const line = screen.getByTestId('option-card-differentiator-opt-germany')
    expect(line.textContent).toBe('Tests demand before localising.')
    expect(tokens(line).has('text-[length:calc(11px*var(--canvas-label-scale,1))]')).toBe(true)
  })
})

describe('v3.1 #19 — the edit pencil is revealed on hover/focus, never at rest', () => {
  it('the option\'s edit-targets icon is a revealed rail icon', () => {
    renderCard()
    const pencil = screen.getByTestId('option-edit-targets-opt-germany')
    expect(pencil.getAttribute('data-rail-reveal')).toBe('true')
    expect(tokens(pencil).has('opacity-0')).toBe(true)
    expect(tokens(pencil).has('group-hover:opacity-100')).toBe(true)
    expect(tokens(pencil).has('group-focus-within:opacity-100')).toBe(true)
  })

  it('contrast: the coaching icon is NOT revealed — it stays visible at rest', () => {
    renderCard()
    const coach = document.querySelector('[data-testid^="node-coaching-icon-opt-germany"]')
    if (coach) expect(coach.getAttribute('data-rail-reveal')).toBeNull()
  })
})
