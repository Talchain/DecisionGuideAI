/**
 * ⭐ AN OPTION ROW'S "FROM" IS THE TEXT THE FACTOR CARD RENDERS — bound to the
 * RENDERED card, not to a second call of the formatter.
 *
 * `factorCardReading` (optionChangeRows.ts) restates the input mapping
 * `FactorNode` gives `factorDisplayText` (label cleaned, a suppressed unit
 * dropped). A restated rule agrees on the day it is written and drifts after.
 * The verifier on e0490565 found the only "from IS the factor card's text" test
 * compared against `factorDisplayText(data)` — the same call on both sides — so
 * a factor-lane change to the card's mapping would pass it while the row and
 * the card beside it printed different strings.
 *
 * So each case here renders the REAL `FactorNode` and reads its value readout
 * (the first child of `factor-recorded-value`), and requires
 * `factorCardReading` to print exactly that. Cases are the carried readings a
 * row accepts as its "from" (`carriedFactorCardReading`), including the
 * suppressed-unit case where the two could most easily part.
 *
 * CLAIM SCOPE: jsdom DOM text of a non-inferred, non-controllable factor in
 * Standard view (so the readout is `valueDisplay` itself, not an editor or the
 * rest-collapse). Not pixels.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { factorCardReading, carriedFactorCardReading } from '../shared/optionChangeRows'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      hoveredOptionId: null, nodes: [], edges: [], ceeAnalysisReady: null,
      results: { status: 'idle', report: null }, highlightedNodes: new Set(),
      dimmedNodeIds: new Set(), goalThreshold: null, goalConstraints: [],
      viewMode: 'standard',
    })
  ),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

vi.mock('../../hooks/useScienceIcons', () => ({ useScienceIcons: vi.fn(() => []) }))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))

// Spread the real flags module (a `vi.mock` factory REPLACES the module, so an
// unlisted flag would be `undefined` and throw at render — CLAUDE.md trap 12).
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

const baseProps = {
  id: 'f-price', type: 'factor', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
}

/** The factor card's value readout, as rendered — its own text only, no marks. */
function renderedReadout(data: Record<string, unknown>): string | null {
  const { container } = render(
    <ReactFlowProvider><FactorNode {...baseProps} data={data} /></ReactFlowProvider>,
  )
  const line = container.querySelector('[data-testid="factor-recorded-value"]')
  const text = line?.firstElementChild?.textContent ?? null
  cleanup()
  return text === null ? null : text.replace(/\s+/g, ' ').trim()
}

const CARRIED: Array<[string, Record<string, unknown>]> = [
  ['a raw_value with a real unit (the served pricing shape)', {
    label: 'Monthly price', type: 'factor',
    observedState: { cap: 200, unit: 'GBP/month', value: 0.245, raw_value: 49, source: 'brief_extraction' },
  }],
  ['a raw_value on a SUPPRESSED unit word ("other")', {
    label: 'Monthly price', type: 'factor',
    observedState: { value: 0.245, raw_value: 49, unit: 'other', source: 'brief_extraction' },
  }],
  ['a unitless raw_value', {
    label: 'Monthly price', type: 'factor',
    observedState: { value: 0.245, raw_value: 49, source: 'brief_extraction' },
  }],
  ['the factor\'s own display_value, a phrase', {
    label: 'Monthly price', type: 'factor', display_value: 'Free plan only',
    observedState: { value: 0, source: 'brief_extraction' },
  }],
  ['an encoding_map phrase over a magnitude summary', {
    label: 'Monthly price', type: 'factor', display_value: 'Low (0)',
    encoding_map: { '0': 'No paid plan', '1': 'Paid plan' },
    observedState: { value: 0, source: 'brief_extraction' },
  }],
  ['a label that needs cleaning, with a raw_value and a currency unit', {
    label: 'Monthly price (£)', type: 'factor',
    observedState: { value: 0.245, raw_value: 49, unit: '£', source: 'brief_extraction' },
  }],
]

describe('an option row\'s "from" prints exactly what the rendered factor card prints', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it.each(CARRIED)('%s', (_name, data) => {
    const card = renderedReadout(data)
    expect(card, 'precondition: the factor card renders a value readout').toBeTruthy()
    expect(factorCardReading(data)).toBe(card)
    // …and the row accepts it as carried, so this is the string the row shows.
    expect(carriedFactorCardReading(data)).toBe(card)
  })

  it('CONTRAST — the card\'s value-only guess renders on the FACTOR card, and the row refuses it', () => {
    const data = { label: 'Tech lead headcount', type: 'factor', observedState: { value: 0, source: 'brief_extraction' } }
    expect(renderedReadout(data)).toBe('No tech lead headcount in place')
    expect(factorCardReading(data)).toBe('No tech lead headcount in place')
    expect(carriedFactorCardReading(data)).toBeNull()
  })
})
