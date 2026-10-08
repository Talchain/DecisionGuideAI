/**
 * Every Olumi-estimate mark on a canvas card says WHOSE estimate it is, in its accessible name (P02 smoke B2 M5,
 * scenario 9ea9683a, 8 Oct; DL). Before: the mark was named "Estimate not yet confirmed — this value was filled in
 * for you…", which never says Olumi, on all four inferred cards. Three cards only looked "labelled" to the probe
 * because their coaching button is named "Ask Olumi about …", which names an action, not the value.
 *
 * Bound by provenance (the stored `observed_state.source`), never by label. The four inferred nodes are the stored
 * nodes of scenario 9ea9683a, verbatim (shared DB, SELECT only), including "Starter tier price" (no cap), the card
 * the smoke flagged. Contrasts: values the user set or confirmed, and a brief figure, carry no "Olumi's estimate" name.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/**
 * ⚠ `viewMode` IS NOT A DETAIL — IT DECIDES WHETHER THE FOUNDER'S FACE EXISTS.
 * `FactorNode.tsx:62` is `isDetailed = viewMode === 'expert'`, and the `est.`
 * marker renders only when `isInferred && !isDetailed`. The founder's cards read
 * `0.3 scale est.`, so his board is in the STANDARD view. A spec fixed to
 * 'expert' would be testing a face he is not looking at — trap 3b's shape, where
 * every instrument agrees because all of them point at the wrong surface. This
 * harness therefore runs the founder's view by default and pins the expert view
 * separately.
 */
let viewMode: 'expert' | 'standard' = 'standard'

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      hoveredOptionId: null, nodes: [], edges: [], ceeAnalysisReady: null,
      results: { status: 'idle', report: null }, highlightedNodes: new Set(),
      dimmedNodeIds: new Set(), goalThreshold: null, goalConstraints: [],
      viewMode,
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

// Spread the real flags module: `FactorNode` now reads the composed analysis
// verdict (`useModelChangedSinceRun`), whose source classifier calls a flag
// this factory never listed. A `vi.mock` factory REPLACES the module, so an
// unlisted flag is `undefined` and throws at render (CLAUDE.md trap 12).
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

// ⚠ `deletable`, `selectable` and `draggable` are REQUIRED by NodeProps and are
// spelled out rather than cast away. The sibling FactorNode specs carry this as
// a baselined type error; a new file may not add one, and the typecheck ratchet
// is right to refuse it — so this props object is complete instead.
const baseProps = {
  id: 'factor-1', type: 'factor', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
}

const renderFactor = (data: Record<string, unknown>) =>
  render(<ReactFlowProvider><FactorNode {...baseProps} data={data} /></ReactFlowProvider>)

const faceText = (c: HTMLElement) => {
  const copy = c.cloneNode(true) as HTMLElement
  copy.querySelectorAll('.sr-only').forEach(el => el.remove())
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/** The founder's shape: an inferred factor on a placeholder scale. */
const founderFactor = (value: number, displayValue: string | null) => ({
  label: 'Team Capability',
  type: 'factor',
  ...(displayValue === null ? {} : { display_value: displayValue }),
  observedState: { value, unit: 'scale', extractionType: 'inferred' as const },
})

import { OLUMI_ESTIMATE_NAME } from '../shared/EstimateMarker'

const renderCard = (id: string, data: Record<string, unknown>) =>
  render(<ReactFlowProvider><FactorNode {...({ ...baseProps, id, data: { kind: 'factor', ...data } } as any)} /></ReactFlowProvider>)
const namesOf = (c: HTMLElement) => [...c.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label') ?? '')

/** Scenario 9ea9683a's four Olumi-inferred factors, as stored. */
const INFERRED: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ['existing_price_rise', { label: 'Existing price rise', category: 'controllable', provenance: 'ai_inferred', observedState: { cap: 100, unit: '%', value: 0, source: 'cee_inference', raw_value: 0, declared_scale: 'unit_interval' } }],
  ['existing_customers_lost', { label: 'Existing customers lost', category: 'observable', provenance: 'ai_inferred', observedState: { cap: 500, unit: 'customers', value: 0, source: 'cee_inference', raw_value: 0, declared_scale: 'unit_interval' } }],
  ['starter_tier_price', { label: 'Starter tier price', category: 'controllable', provenance: 'ai_inferred', observedState: { unit: 'GBP per subscriber per month', value: 0, source: 'cee_inference', raw_value: 0, extractionType: 'inferred' } }],
  ['starter_subscribers', { label: 'Starter subscribers', category: 'observable', provenance: 'ai_inferred', observedState: { cap: 1000, unit: 'subscribers', value: 0, source: 'cee_inference', raw_value: 0, declared_scale: 'unit_interval' } }],
]

describe('an Olumi estimate on a card is named as Olumi’s', () => {
  it.each(INFERRED)('%s: the estimate mark is named "Olumi’s estimate — not your figure"', (id, data) => {
    const { container } = renderCard(id, data)
    const mark = container.querySelector('[data-testid="estimate-marker"]')
    expect(mark).not.toBeNull()
    expect(mark!.getAttribute('aria-label')!.startsWith(`${OLUMI_ESTIMATE_NAME}. `)).toBe(true)
    expect(mark!.textContent).toBe('est.') // visible face unchanged
  })
})

describe('contrast: a figure that is not Olumi’s is never named as Olumi’s estimate', () => {
  const NOT_OLUMI: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
    ['user typed it', { label: 'Monthly price', category: 'controllable', observedState: { value: 49, raw_value: 49, unit: '£', display_value: '£49', source: 'user_override' } }],
    ['user confirmed it', { label: 'Churn rate', category: 'observable', observedState: { value: 0.04, unit: '%', display_value: '4%', source: 'user_confirmed' } }],
    ['from the brief', { label: 'Support cost per starter subscriber', category: 'observable', provenance: 'from_brief', observedState: { cap: 100, unit: 'GBP per subscriber per month', value: 0.06, source: 'brief_extraction', raw_value: 6, declared_scale: 'unit_interval' } }],
  ]
  it.each(NOT_OLUMI)('%s → no "Olumi’s estimate" name anywhere on the card', (_why, data) => {
    const { container } = renderCard('f-contrast', data)
    expect(container.querySelector('[data-testid="estimate-marker"]')).toBeNull()
    expect(namesOf(container).some(n => n.includes(OLUMI_ESTIMATE_NAME))).toBe(false)
  })
})
