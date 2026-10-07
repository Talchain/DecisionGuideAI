/**
 * ⭐ AN OPTION CHANGE ROW NEVER CUTS THE FACTOR'S NAME TO NOTHING — and a yes/no
 * factor's row states both ends (Paul's staging test, 28 Sep 2026, debug
 * export `olumi-debug-64c5eccc`).
 *
 * SERVED (landing, text scale 1.64): "Human as… 0 hours/week → 20 hours/week
 * est.", "Annual as… $0 / year → $45k/year est." — the grid gave the amount
 * every pixel but a ~6em label floor, the name was unreadable, and the amount
 * wrapped to a second line anyway. And "AI assistant use → on": a binary factor
 * with no from-value.
 *
 * OWNER DECISION (Canvas): when the full amount — `from → to` plus its source
 * mark — cannot sit on the row's one line beside at least
 * `OPTION_ROW_NAME_MIN_CHARS` of the name (a deterministic character budget
 * at the bound, `optionRowForm`), the row is TWO lines: the factor's name on its
 * own line (full width, truncating only past the card), the amount — mark
 * included — on the line below. The one-line row stays wherever it fits. The
 * card spends at most `OPTION_CARD_ROW_LINE_BUDGET` lines on rows (what three
 * grid rows reached at the bound): a row that would overrun it is not shown,
 * and `+N more` counts it. Rows read the model only, so a Run cannot move them.
 *
 * A binary factor (unit or type says "binary") whose target and reference are
 * 0/1 reads both ends: the factor's own value labels (`encoding_map`) when
 * present, else "Not in use → In use". CEE's words are re-worded only when they
 * are a bare switch word ("on"/"off"); any other CEE phrase is kept verbatim.
 *
 * FIXTURE: the export's own draft graph + analysis_ready
 * (`__fixtures__/realDraft.assistant64c5eccc.json`). Bound by option id +
 * factor id test ids.
 *
 * CLAIM SCOPE: jsdom — tokens, text, DOM order; the line model is the
 * character budget, not pixels.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { ReactNode } from 'react'

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
  NodePopover: ({ children }: { children: ReactNode }) => <div data-testid="node-popover">{children}</div>,
}))
vi.mock('../shared/openNodeInspector', () => ({ openNodeInspector: vi.fn(() => true) }))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { useAnalysisResultsAreCurrent } from '../../hooks/useAnalysisResultsAreCurrent'
import { OptionNode, OPTION_ROW_LINE_GRID_CLASSES, OPTION_ROW_TWO_LINE_CLASSES } from '../OptionNode'
import {
  buildOptionChangeRow,
  fitRowsToLineBudget,
  optionRowForm,
  optionRowLineCount,
  OPTION_CARD_ROW_LINE_BUDGET,
  OPTION_ROW_NAME_MIN_CHARS,
  type OptionChangeRow,
} from '../shared/optionChangeRows'
import { NODE_ROW_AMOUNT_MAX_CHARS } from '../../utils/nodeLayoutConstants'
import { mapDraftNodeToCanvas, mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import served from '../../__fixtures__/realDraft.assistant64c5eccc.json'

type Draft = { nodes: unknown[]; edges: unknown[]; analysis_ready: unknown }
type CanvasNode = { id: string; data: Record<string, unknown> }
const DRAFT = served as unknown as Draft

let state: Record<string, unknown>
function setState(results: Record<string, unknown> = { status: 'idle', report: null }) {
  state = {
    hoveredOptionId: null, setHoveredOption: vi.fn(),
    nodes: DRAFT.nodes.map(mapDraftNodeToCanvas),
    edges: DRAFT.edges.map((e, i) => mapDraftEdgeToCanvas(e, i)),
    ceeAnalysisReady: DRAFT.analysis_ready,
    results,
    highlightedNodes: new Set(), dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null, goalConstraints: [],
    optionNumbering: {},
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

function renderOption(optionId: string, results?: Record<string, unknown>) {
  setState(results)
  const n = (state.nodes as CanvasNode[]).find(x => x.id === optionId)
  expect(n, `PRECONDITION: the export carries option ${optionId}`).toBeDefined()
  return render(
    <ReactFlowProvider>
      <OptionNode id={optionId} type="option" data={n!.data as never} selected={false} isConnectable zIndex={0}
        positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} deletable={false} selectable draggable />
    </ReactFlowProvider>,
  )
}

function onCard(container: HTMLElement, selector: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(selector)].filter(el => !el.closest('[data-testid="node-popover"]'))
}
const tokens = (el: Element) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))
const visibleText = (el: Element) => {
  const clone = el.cloneNode(true) as Element
  clone.querySelectorAll('.sr-only').forEach(n => n.remove())
  return (clone.textContent ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}
function rowLine(container: HTMLElement, optionId: string, factorId: string): HTMLElement {
  const line = onCard(container, `[data-testid="option-change-row-line-${optionId}-${factorId}"]`)[0]
  expect(line, `${optionId} · ${factorId} renders a resting row`).toBeDefined()
  return line
}

beforeEach(() => {
  vi.mocked(useNodeDisplayMetadata).mockImplementation(() => BASE_META as never)
  vi.mocked(useAnalysisTrust).mockReturnValue({ semantic: 'none' } as never)
  vi.mocked(useAnalysisResultsAreCurrent).mockReturnValue(false)
})
afterEach(() => cleanup())

describe('served 64c5eccc — the factor name gets its own line when the amount cannot share it', () => {
  it.each([
    ['personal_assistant', 'human_assistant_capacity', 'Human assistant capacity', '0 → 20 hours/week'],
    ['personal_assistant', 'annual_assistant_tool_cost', 'Annual assistant-tool cost', '$0 / year → $45k/year'],
  ])('%s · %s: TWO lines — "%s" whole, then "%s"', (optionId, factorId, name, amount) => {
    const { container } = renderOption(optionId)
    const line = rowLine(container, optionId, factorId)
    expect(line.getAttribute('data-row-form')).toBe('two-line')
    const lt = tokens(line)
    for (const c of OPTION_ROW_TWO_LINE_CLASSES.split(/\s+/)) expect(lt.has(c), `two-line row lacks "${c}"`).toBe(true)
    expect(lt.has('grid-cols-[minmax(0,1fr)_fit-content(calc(100%_-_8px_-_6em))]'), 'no amount column beside the name').toBe(false)
    const [dt, dd] = [...line.children] as HTMLElement[]
    expect([dt.tagName, dd.tagName]).toEqual(['DT', 'DD'])
    expect(visibleText(dt)).toBe(name)
    expect(visibleText(dd)).toBe(amount)
    // The value retains its line box; its source glyph is in the bottom band.
    const mark = dd.querySelector(`[data-testid="option-change-row-mark-${optionId}-${factorId}"]`)
    expect(mark, 'the reserved mark slot is in the amount cell').not.toBeNull()
    const source = onCard(container, `[data-testid="option-change-row-estimate-${optionId}-${factorId}"]`)[0]
    expect(source.getAttribute('aria-label')).toContain('Olumi estimate')
    expect(source.querySelector('.lucide-sparkles')).not.toBeNull()
    expect(source.closest(`[data-testid="option-bottom-marks-${optionId}"]`)).not.toBeNull()
    expect((mark!.previousSibling as Text | null)?.data).toBe('\u00a0')
    expect(dt.querySelector('[data-testid^="option-change-row-mark-"]')).toBeNull()
  })

  it('a short amount keeps the one-line row (the rule, not a blanket change)', () => {
    const row = buildOptionChangeRow({
      factorId: 'f_price', target: { value: 0.6, displayValue: '£59', source: 'user_specified' },
      factor: { label: 'Price' }, baselineOptionTarget: { value: 0.5, displayValue: '£49' },
    })
    expect(row.change).toBe('£49 → £59')
    expect(optionRowForm(row)).toBe('one-line')
    expect(optionRowLineCount(row)).toBe(1)
  })

  it('every resting row on every option wears the class set its form names — and the form is the rule\'s', () => {
    for (const optionId of ['personal_assistant', 'ai_assistant', 'personal_assistant_plus_ai']) {
      cleanup()
      const { container } = renderOption(optionId)
      const lines = onCard(container, `[data-testid^="option-change-row-line-${optionId}-"]`)
      expect(lines.length, `${optionId} renders rows`).toBeGreaterThan(0)
      for (const line of lines) {
        const form = line.getAttribute('data-row-form')
        expect(['one-line', 'two-line']).toContain(form)
        const classes = form === 'one-line' ? OPTION_ROW_LINE_GRID_CLASSES : OPTION_ROW_TWO_LINE_CLASSES
        const lt = tokens(line)
        for (const c of classes.split(/\s+/)) expect(lt.has(c), `${line.getAttribute('data-testid')} lacks "${c}"`).toBe(true)
      }
    }
  })
})

describe('served 64c5eccc — a yes/no factor states both ends', () => {
  it('PRECONDITION: CEE said a bare "on" for the target and the factor has no value labels', () => {
    const ai = (DRAFT.analysis_ready as { options: Array<{ id: string; intervention_details?: Record<string, { display_value?: string }> }> })
      .options.find(o => o.id === 'ai_assistant')
    expect(ai?.intervention_details?.ai_assistant_use?.display_value).toBe('on')
  })

  it('ai_assistant · ai_assistant_use: "Not in use → In use", from muted, the est. mark on its line', () => {
    const { container } = renderOption('ai_assistant')
    const line = rowLine(container, 'ai_assistant', 'ai_assistant_use')
    const dd = line.querySelector<HTMLElement>('[data-testid="option-change-row-ai_assistant-ai_assistant_use"]')!
    expect(visibleText(dd)).toBe('Not in use → In use')
    const before = onCard(container, '[data-testid="option-change-row-before-ai_assistant-ai_assistant_use"]')[0]
    expect(before?.textContent).toBe('Not in use')
    expect(visibleText(line)).not.toContain('→ on')
  })

  it('the factor\'s own value labels win over the default words', () => {
    const row = buildOptionChangeRow({
      factorId: 'ai_assistant_use', target: { value: 1, displayValue: 'on', source: 'cee_hypothesis' },
      factor: {
        label: 'AI assistant use', unit: 'binary adoption', observedValue: 0,
        factorData: { label: 'AI assistant use', encoding_map: { 0: 'Manual only', 1: 'AI assisted' } },
      },
      baselineOptionTarget: null,
    })
    expect(row.change).toBe('Manual only → AI assisted')
  })

  it('a CEE phrase that is not a bare switch word is kept verbatim (never re-worded)', () => {
    const row = buildOptionChangeRow({
      factorId: 'fac_segment', target: { value: 1, displayValue: 'Adopted', source: 'brief_extraction' },
      factor: { label: 'Segment', unit: 'binary', observedValue: 0 },
      baselineOptionTarget: { value: 0, displayValue: 'Not adopted' },
    })
    expect(row.change).toBe('Not adopted → Adopted')
  })

  it('a non-binary factor at 0 → 1 is untouched by the binary words', () => {
    const row = buildOptionChangeRow({
      factorId: 'f_count', target: { value: 1, displayValue: '1 engineer', source: 'cee_hypothesis' },
      factor: { label: 'Engineers', unit: 'engineers', observedValue: 0 },
      baselineOptionTarget: null,
    })
    expect(row.change).not.toContain('In use')
  })
})

describe('the card spends at most OPTION_CARD_ROW_LINE_BUDGET lines on rows — `+N more` counts the rest', () => {
  it('personal_assistant_plus_ai: human (3 lines) + AI use (3 lines) fill the budget; annual cost is behind +1 more', () => {
    const { container } = renderOption('personal_assistant_plus_ai')
    const lines = onCard(container, '[data-testid^="option-change-row-line-personal_assistant_plus_ai-"]')
    expect(lines.map(l => l.getAttribute('data-testid')!.replace('option-change-row-line-personal_assistant_plus_ai-', '')))
      .toEqual(['human_assistant_capacity', 'ai_assistant_use'])
    expect(onCard(container, '[data-testid="option-change-more-personal_assistant_plus_ai"]')[0]?.textContent).toBe('+1 more')
  })

  it('the pure rule: a prefix of the shared order, never zero rows, never over budget', () => {
    const mk = (id: string, change: string, label = 'A factor name long enough'): OptionChangeRow => ({
      factorId: id, label, fullLabel: label, change, fullChange: change, target: change, reference: 'none',
      estimated: true, targetSource: { kind: 'olumi', label: 'Olumi estimate' } as OptionChangeRow['targetSource'], sameAsReference: false,
    })
    const long = '0 hours/week → 20 hours/week' // 2 amount lines at the bound → 3 lines
    const short = '→ 1' // one-line row
    expect(OPTION_CARD_ROW_LINE_BUDGET).toBe(6)
    expect(OPTION_ROW_NAME_MIN_CHARS).toBe(12)
    expect(NODE_ROW_AMOUNT_MAX_CHARS).toBe(23)
    expect(optionRowLineCount(mk('a', long))).toBe(3)
    expect(fitRowsToLineBudget([mk('a', long), mk('b', long), mk('c', long)]).map(r => r.factorId)).toEqual(['a', 'b'])
    expect(fitRowsToLineBudget([mk('a', short), mk('b', short), mk('c', short)]).map(r => r.factorId)).toEqual(['a', 'b', 'c'])
    expect(fitRowsToLineBudget([mk('a', `${long} ${long}`)]).map(r => r.factorId)).toEqual(['a'])
    // Prefix only: a later short row never jumps a longer one (options compare like with like).
    expect(fitRowsToLineBudget([mk('a', long), mk('b', long), mk('c', short)]).map(r => r.factorId)).toEqual(['a', 'b'])
  })

  it('a Run moves nothing: the same rows, forms and +N more before and after a completed run', () => {
    const snapshot = (results?: Record<string, unknown>) => {
      cleanup()
      const { container } = renderOption('personal_assistant_plus_ai', results)
      return {
        rows: onCard(container, '[data-testid^="option-change-row-line-personal_assistant_plus_ai-"]')
          .map(l => `${l.getAttribute('data-testid')}|${l.getAttribute('data-row-form')}`),
        more: onCard(container, '[data-testid="option-change-more-personal_assistant_plus_ai"]')[0]?.textContent ?? null,
      }
    }
    const pre = snapshot()
    const post = snapshot({
      status: 'complete', hash: 'run-1', report: {
        option_probabilities: {
          personal_assistant: { status: 'computed', win_probability: 0.2 },
          ai_assistant: { status: 'computed', win_probability: 0.5 },
          personal_assistant_plus_ai: { status: 'computed', win_probability: 0.3 },
        },
      },
    })
    expect(post).toEqual(pre)
    expect(pre.rows.length).toBeGreaterThan(0)
  })
})
