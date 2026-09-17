/**
 * THE CARD MUST NOT PRINT A PLACEHOLDER UNDER A HEADING PROMISING EVIDENCE.
 *
 * ⭐ WHY THIS IS A RENDER TEST AND NOT A SOURCE ASSERTION, AND THE MUTANT THAT
 * FORCED THE CHANGE. The first version of this guard asserted on the component's
 * SOURCE — that it no longer contained `observedState.uncertainty_drivers.map(`.
 * A mutant re-introduced the raw read as `...uncertainty_drivers.map && (` and
 * the assertion SURVIVED: it was bound to a punctuation mark, not to a
 * behaviour, so any respelling of the defect walked straight past it.
 *
 * That survivor is the whole argument for this file. A source assertion can
 * pin a decision it can SEE spelled one way; only the DOM can answer *"does a
 * user read the word 'Not provided' under a heading that says Uncertainty
 * drivers?"*.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })
  ),
}))

// Spread the real flags module so a newly-added flag never goes silently absent
// and throws at render (CLAUDE.md trap 12 — a `vi.mock` factory REPLACES the
// module). Only the flags this suite deliberately pins are overridden.
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({ useNodeDisplayMetadata: vi.fn() }))

// Make NodePopover transparent so its content is readable without the hover delay.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="node-popover">{children}</div>
  ),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

/** The sentence under repair. Asserted as ABSENT for every non-brief provenance. */
const BRIEF_CLAIM = /from your brief/i
/** The honest replacement — asserted present only where there is genuinely no evidence. */
const PLACEHOLDER_LINE = /placeholder/i
/** The pre-existing user-owned sentence. Reused, never re-authored. */
const USER_OWNED_LINE = /You provided this value/i

// `deletable`/`selectable`/`draggable` are REQUIRED by `NodeProps` and are the
// reason the neighbouring render-matrix suite carries TS2739 in the typecheck
// baseline. Supplied here so this file contributes ZERO baseline errors — a new
// file with errors blocks the gate outright, and inheriting a known-broken
// fixture shape would have meant asking for a baseline bump instead of writing
// three fields.
const baseFactorProps = {
  id: 'factor-1',
  type: 'factor',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: false,
  selectable: true,
  draggable: true,
}

/**
 * factor-1 is the rendered node and carries the strongest edge, so it ranks #1
 * and is high-priority — the gate this coaching line sits behind. `weightSource`
 * is REQUIRED on every edge: the pre-analysis ranking is provenance-gated, and
 * without it there is no ranking and no factor is high-priority at all.
 */
function topology(rankedFirst: boolean) {
  return {
    hoveredOptionId: null,
    nodes: [
      { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Hiring cost' } },
      { id: 'factor-2', type: 'factor', data: { type: 'factor', label: 'F2' } },
      { id: 'factor-3', type: 'factor', data: { type: 'factor', label: 'F3' } },
      { id: 'factor-4', type: 'factor', data: { type: 'factor', label: 'F4' } },
      { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
    ],
    edges: [
      {
        id: 'e1',
        source: 'factor-1',
        target: 'outcome-1',
        data: { weight: rankedFirst ? 1 : 0.01, direction: 'positive', weightSource: 'cee' },
      },
      { id: 'e2', source: 'factor-2', target: 'outcome-1', data: { weight: 0.9, direction: 'positive', weightSource: 'cee' } },
      { id: 'e3', source: 'factor-3', target: 'outcome-1', data: { weight: 0.8, direction: 'positive', weightSource: 'cee' } },
      { id: 'e4', source: 'factor-4', target: 'outcome-1', data: { weight: 0.7, direction: 'positive', weightSource: 'cee' } },
    ],
    ceeAnalysisReady: null,
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    setHoveredOption: vi.fn(),
    runMeta: { ceeReview: null },
    viewMode: 'expert' as const,
  }
}

function applyStore(rankedFirst = true) {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector(topology(rankedFirst)))
}

function renderFactor(observedState: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <FactorNode
        {...baseFactorProps}
        data={{ type: 'factor', label: 'Hiring cost', category: 'controllable', observedState }}
      />
    </ReactFlowProvider>
  )
}

/** The exact shape CEE's substitution writes, witnessed on deployed staging. */
const SUBSTITUTED = { value: 0.5, extractionType: 'inferred', source: 'cee_inference', unit: 'scale' }
/** Its twin: same value, same extractionType, but a PERSON owns the number. */
const USER_OWNED = { value: 0.5, extractionType: 'inferred', source: 'user_override', unit: 'scale' }


const DRIVERS = (observedState: Record<string, unknown>) => {
  applyStore()
  return renderFactor(observedState).container.textContent ?? ''
}

const REAL = 'Onboarding complexity unknown'
const BASE = { value: 0.5, extractionType: 'inferred', source: 'cee_inference', unit: 'scale' }

describe('the card prints evidence, or nothing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null,
      inSensitivityAnalysis: false, achievementProbability: null,
      stabilityPercentage: null, winRate: null, isResultsMode: false,
    } as any)
  })

  /** CONTRAST CONTROL FIRST. If a real driver does not render, every absence
   *  below proves only that this harness draws no drivers at all. */
  it('CONTRAST: a real driver renders, under its heading', () => {
    const text = DRIVERS({ ...BASE, uncertainty_drivers: [REAL] })
    expect(text).toContain('Uncertainty drivers')
    expect(text).toContain(REAL)
  })

  it('never prints the producer placeholder', () => {
    const text = DRIVERS({ ...BASE, uncertainty_drivers: ['Not provided'] })
    expect(text).not.toContain('Not provided')
  })

  /** ⛔ AND THE HEADING GOES WITH IT. A heading reading "Uncertainty drivers:"
   *  above nothing is its own false claim — it says evidence was gathered and
   *  happens to be empty, which is not what the producer said. */
  it('drops the heading too, rather than leaving it over an empty list', () => {
    const text = DRIVERS({ ...BASE, uncertainty_drivers: ['Not provided'] })
    expect(text).not.toContain('Uncertainty drivers')
  })

  it('prints the real ones and only the real ones from a mixed list', () => {
    const text = DRIVERS({ ...BASE, uncertainty_drivers: ['Not provided', REAL] })
    expect(text).toContain(REAL)
    expect(text).not.toContain('Not provided')
  })

  /** ⭐ THE CASE A SUBSTRING FILTER WOULD BREAK. `REAL` ends in the word
   *  "unknown", which is itself a placeholder spelling. It is real evidence and
   *  must survive — proven here at the DOM, not just at the predicate. */
  it('keeps a real driver that ends in a placeholder word', () => {
    expect(DRIVERS({ ...BASE, uncertainty_drivers: [REAL] })).toContain(REAL)
  })
})
