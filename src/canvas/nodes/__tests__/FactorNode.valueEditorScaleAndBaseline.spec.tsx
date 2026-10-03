/**
 * THE CARD'S VALUE EDITOR SAYS WHAT SCALE IT IS ON, AND WHAT AN EDIT THERE DOES
 * (canvas audit edit-values F3 + F9, each reproduced by a skeptic on served
 * `c0c1dded` / `d87eeb94`).
 *
 * F3 — pricing-model, "Very high" on Bottom-Up Adoption Friction opened as a bare
 * `0.8` with no min, no max and no scale cue. Typing 5 sent
 * `factor_value_edit {value: 5}` → 200, the card read "5 Set by you", readiness
 * said ready, and the Run refused the factor as "stored as an amount without a
 * stated range". The Hybrid option's target editor refuses the same 5 on the
 * same scale: "Not saved · must be between 0 and 1 on the model scale."
 * build-vs-buy "Time to Live (Quarters)" took 2 the same way.
 *
 * F9 — every pricing-model option sets its own value for the three editable
 * factors, so the factor's own value is a baseline they all replace; CEE's reply
 * to the edit says "changing it will not move the comparison", and the card said
 * nothing. The note is carried by the OPEN editor and the control's name/title —
 * NODE-ANATOMY v3.2 adds nothing to a factor's value line at rest.
 *
 * The authority is mocked at `proposeFactorValue` so "nothing was sent" is a
 * count of calls, bound by identity to the one writer the card commits through.
 * CLAIM SCOPE: jsdom — what the editor admits and says, not layout.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { OPTION_TARGET_ENTRY_REFUSAL } from '../../ui/inspector-v2/shared/optionTargetEntry'
import {
  FACTOR_BASELINE_REPLACED_BY_EVERY_OPTION,
  FACTOR_BASELINE_REPLACED_BY_EVERY_OPTION_SHORT,
  FACTOR_VALUE_MODEL_SCALE_HINT,
} from '../shared/metricVocabulary'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

let storeNodes: Array<Record<string, unknown>> = []
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector) =>
      selector({
        hoveredOptionId: null, nodes: storeNodes, edges: [], ceeAnalysisReady: null,
        results: { status: 'idle', report: null }, highlightedNodes: new Set(),
        dimmedNodeIds: new Set(), goalThreshold: null, goalConstraints: [],
        viewMode: 'standard',
      })),
    { getState: () => ({ nodes: storeNodes }) },
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
  NodePopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

const proposed: number[] = []
vi.mock('../../hooks/useModelEditAuthority', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useModelEditAuthority')>()
  return {
    ...actual,
    useModelEditAuthority: () => new Proxy({}, {
      get: (_t, key) => key === 'proposeFactorValue'
        ? (typedValue: number) => { proposed.push(typedValue); return 'dispatched' }
        : () => undefined,
    }),
  }
})

const NODE_ID = 'fac_usage_exposure'
const baseProps = {
  id: NODE_ID, type: 'factor', position: { x: 0, y: 0 }, selected: false,
  isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
  dragging: false, zIndex: 0, deletable: true, selectable: true, draggable: true,
}

/**
 * The starter shape (`pricing-model.draft.json`, fac_adoption_friction): no unit,
 * no cap, no raw_value — the field IS the model scale — with the node-level
 * `display_value` the card collapses to the tier word "Very high" at rest.
 */
const STARTER = { value: 0.8, source: 'cee_inference', extractionType: 'inferred', factor_type: 'other' }
const STARTER_DISPLAY = { display_value: 'Very high (0.8)' }

const renderFactor = (observedState: Record<string, unknown>, nodeLevel: Record<string, unknown> = {}) => {
  const data = { label: 'Usage-Based Pricing Exposure', kind: 'factor', category: 'controllable', ...nodeLevel, observedState }
  storeNodes = [...storeNodes.filter((n) => n.id !== NODE_ID), { id: NODE_ID, type: 'factor', data }]
  return render(
    <ReactFlowProvider>
      <FactorNode {...baseProps} data={data} />
    </ReactFlowProvider>,
  )
}

const option = (id: string, interventions: Record<string, unknown>) =>
  ({ id, type: 'option', data: { label: id, kind: 'option', interventions } })

const restingButton = (c: HTMLElement) => {
  const b = c.querySelector<HTMLElement>(`[data-testid="node-value-editor-${NODE_ID}"]`)
  expect(b, 'PRECONDITION: the inline editor renders on a controllable factor').not.toBeNull()
  return b!
}
const openEditor = (c: HTMLElement): HTMLInputElement => {
  fireEvent.click(restingButton(c))
  const input = c.querySelector<HTMLInputElement>(`[data-testid="node-value-editor-${NODE_ID}-input"]`)
  expect(input, 'the editor opened').not.toBeNull()
  return input!
}
const commit = (input: HTMLInputElement, typed: string) => {
  fireEvent.change(input, { target: { value: typed } })
  fireEvent.keyDown(input, { key: 'Enter' })
}
const refusalOf = (c: HTMLElement) =>
  c.querySelector(`[data-testid="node-value-editor-${NODE_ID}-refusal"]`)?.textContent ?? null

beforeEach(() => { proposed.length = 0; storeNodes = []; cleanup() })

describe('F3 — the card\'s value field is bounded to the scale the model stores', () => {
  it('the witnessed entry: 5 on a 0–1 factor is refused with the estate\'s sentence and NOTHING is sent', () => {
    const { container } = renderFactor(STARTER, STARTER_DISPLAY)
    const input = openEditor(container)
    commit(input, '5')
    expect(proposed, 'no factor_value_edit left the card').toEqual([])
    expect(refusalOf(container)).toBe(OPTION_TARGET_ENTRY_REFUSAL.outOfRangeModelScale)
    // Fail-visible: the field stays open with the typed text, as the option row does.
    expect(container.querySelector(`[data-testid="node-value-editor-${NODE_ID}-input"]`)).not.toBeNull()
  })

  it.each(['-0.1', '1.0001', '2'])('refuses %s (outside [0, 1])', (typed) => {
    const { container } = renderFactor(STARTER, STARTER_DISPLAY)
    commit(openEditor(container), typed)
    expect(proposed).toEqual([])
    expect(refusalOf(container)).toBe(OPTION_TARGET_ENTRY_REFUSAL.outOfRangeModelScale)
  })

  it.each([['0', 0], ['1', 1], ['0.6', 0.6]])('admits %s (inside [0, 1], ends included)', (typed, value) => {
    const { container } = renderFactor(STARTER, STARTER_DISPLAY)
    commit(openEditor(container), typed)
    expect(proposed).toEqual([value])
    expect(refusalOf(container)).toBeNull()
  })

  it('a non-number keeps the admission\'s own reason — it is not a range question', () => {
    const { container } = renderFactor(STARTER, STARTER_DISPLAY)
    const input = openEditor(container)
    // jsdom's number input sanitises letters to '' (a no-op close), so drive the
    // one non-finite string it keeps.
    commit(input, 'Infinity')
    expect(proposed).toEqual([])
    expect(refusalOf(container)).not.toBe(OPTION_TARGET_ENTRY_REFUSAL.outOfRangeModelScale)
  })

  it('the OPEN field says its scale beside the number, and names it for assistive tech', () => {
    const { container } = renderFactor(STARTER, STARTER_DISPLAY)
    const input = openEditor(container)
    const hint = container.querySelector(`[data-testid="node-value-editor-${NODE_ID}-scale"]`)
    expect(hint?.textContent).toBe(FACTOR_VALUE_MODEL_SCALE_HINT)
    expect(input.getAttribute('aria-describedby')).toContain(`node-value-editor-${NODE_ID}-scale`)
    expect(input.getAttribute('min')).toBe('0')
    expect(input.getAttribute('max')).toBe('1')
  })

  it('the shape CEE persists after an edit (raw_value === value, user_override) is still bounded', () => {
    const { container } = renderFactor({ value: 0.3, raw_value: 0.3, source: 'user_override', factor_type: 'other' })
    commit(openEditor(container), '5')
    expect(proposed).toEqual([])
  })

  it('CONTROL: a capped £ factor reads USER units — no 0–1 bound, no 0–1 hint', () => {
    const { container } = renderFactor({ value: 0.245, raw_value: 49, cap: 200, unit: '£/month', source: 'brief_extraction' })
    const input = openEditor(container)
    expect(container.querySelector(`[data-testid="node-value-editor-${NODE_ID}-scale"]`)).toBeNull()
    commit(input, '55')
    expect(proposed).toEqual([55])
  })

  it('CONTROL: an uncapped £ magnitude (raw === value) is not a 0–1 number — £41,000 is admitted', () => {
    const { container } = renderFactor({ value: 40000, raw_value: 40000, unit: '£', source: 'brief_extraction' })
    commit(openEditor(container), '41000')
    expect(proposed).toEqual([41000])
  })
})

describe('F9 — a baseline every option replaces says so while it is edited', () => {
  it('every option sets the factor: the open editor carries the note, and the control names it', () => {
    storeNodes = [option('opt_a', { [NODE_ID]: 1 }), option('opt_b', { [NODE_ID]: 0.5 }), option('opt_c', { [NODE_ID]: 0 })]
    const { container } = renderFactor(STARTER, STARTER_DISPLAY)
    // AT REST: nothing added to the card's text (NODE-ANATOMY v3.2 Factor line 2)…
    expect(container.textContent).not.toContain(FACTOR_BASELINE_REPLACED_BY_EVERY_OPTION)
    // …but the control's accessible name and hover carry it.
    const resting = restingButton(container)
    expect(resting.getAttribute('aria-label')).toContain(FACTOR_BASELINE_REPLACED_BY_EVERY_OPTION)
    expect(resting.getAttribute('title')).toBe(FACTOR_BASELINE_REPLACED_BY_EVERY_OPTION)

    const input = openEditor(container)
    const note = container.querySelector(`[data-testid="node-value-editor-${NODE_ID}-note"]`)
    // Visible: the SHORT form (NODE-ANATOMY v3.2 principle 2)…
    expect(note?.querySelector('[aria-hidden="true"]')?.textContent).toBe(FACTOR_BASELINE_REPLACED_BY_EVERY_OPTION_SHORT)
    // …the full sentence in the hover and in what the field is described by.
    expect(note?.getAttribute('title')).toBe(FACTOR_BASELINE_REPLACED_BY_EVERY_OPTION)
    expect(input.getAttribute('aria-describedby')).toContain(`node-value-editor-${NODE_ID}-note`)
    expect(note?.querySelector('.sr-only')?.textContent).toBe(FACTOR_BASELINE_REPLACED_BY_EVERY_OPTION)
    // The editor is KEPT — the baseline is still a legitimate "what is true today".
    commit(input, '0.3')
    expect(proposed).toEqual([0.3])
  })

  it('CONTRAST: one option leaves the factor at its baseline → no note (build-vs-buy fac_build_indicator, 2 of 4)', () => {
    storeNodes = [
      option('opt_a', { [NODE_ID]: 1 }), option('opt_b', { [NODE_ID]: 0.5 }),
      option('opt_c', { other_factor: 0.2 }), option('opt_d', {}),
    ]
    const { container } = renderFactor(STARTER, STARTER_DISPLAY)
    expect(restingButton(container).getAttribute('aria-label')).not.toContain(FACTOR_BASELINE_REPLACED_BY_EVERY_OPTION)
    expect(restingButton(container).getAttribute('title')).toBeNull()
    openEditor(container)
    expect(container.querySelector(`[data-testid="node-value-editor-${NODE_ID}-note"]`)).toBeNull()
  })

  it('CONTRAST: no options at all → no note (nothing replaces the value)', () => {
    const { container } = renderFactor(STARTER, STARTER_DISPLAY)
    openEditor(container)
    expect(container.querySelector(`[data-testid="node-value-editor-${NODE_ID}-note"]`)).toBeNull()
  })
})
