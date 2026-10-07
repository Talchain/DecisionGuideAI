import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../../../../v5/applyV5State'
import { useCanvasStore } from '../../../../canvas/store'
import { useResultsSectionData } from '../../useResultsSectionData'
import { AnalysisHeroContainer } from '../AnalysisHeroContainer'
import fixture from './fixtures/s6/b9-df15c8c.s6-cee.turn.json'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../../../../canvas/analysis/canonicalRunRegistry', () => ({ executeCanonicalRun: vi.fn() }))
afterEach(() => {
  cleanup()
  useCanvasStore.getState().resetCanvas?.()
})

const TNT = 'GOAL_FIGURES_TARGET_NOT_TESTABLE'
const BASELINE = '‘Carry on as now’: not shown yet. It needs nothing more of its own; it waits until the other options can be tested against your target, so all are shown on the same footing.'
const producerWarning = fixture.blocks[0].enrichment.inference_warnings.find(w => w.code === TNT)!

/** Whole-store applicator call, as in firstAskReachesThePanel.wire.spec.tsx; no adapter or reader mock. */
function hydrate(perOption: unknown) {
  useCanvasStore.getState().resetCanvas?.()
  useCanvasStore.setState({
    nodes: fixture.draft_graph.nodes.map(n => ({
      id: n.id, type: n.kind, position: { x: 0, y: 0 }, data: { ...n },
    })),
    edges: [],
  } as never)
  const envelope = structuredClone(fixture)
  const warning = envelope.blocks[0].enrichment.inference_warnings.find(w => w.code === TNT)!
  // Controls vary only the raw producer field before the real hydration chain.
  ;(warning as Record<string, unknown>).per_option = perOption
  const snapshot = useCanvasStore.getState()
  applyV5State(envelope as unknown as OlumiResponse, {
    ...snapshot, currentResultsHash: snapshot.results?.hash ?? null,
  } as unknown as V5ApplicatorStore)
  expect(useCanvasStore.getState().results?.report).toBeTruthy()
  return renderHook(() => useResultsSectionData()).result.current
}

describe('S-E S6: raw per-option reason reaches the rendered panel through the real adapter', () => {
  it('R6 WIRE: B9 baseline ID and literal words survive report hydration and adaptation', () => {
    expect(producerWarning.message).toContain('Loyalty app deployment')
    const data = hydrate(producerWarning.per_option)
    const adapted = data.confidence.inferenceWarnings!.find(w => w.code === TNT)!
    expect(adapted.per_option?.carry_on_as_now).toEqual(producerWarning.per_option!.carry_on_as_now)
    expect(data.goalChanceRange?.optionIds).toContain('launch_loyalty_app')
    render(<AnalysisHeroContainer data={data} fragileEdgeCount={0} />)
    const line = screen.getAllByTestId('goal-option-withheld-line').find(n => n.getAttribute('data-option-id') === 'carry_on_as_now')
    expect(line).toBeTruthy()
    expect({ id: line!.getAttribute('data-option-id'), text: line!.textContent }).toEqual({ id: 'carry_on_as_now', text: BASELINE })
    expect(line!.textContent).not.toContain('Loyalty app deployment')
  })

  it('adapter control: plain map keeps own string messages and drops malformed and reserved entries', () => {
    const raw = Object.fromEntries([
      ['carry_on_as_now', producerWarning.per_option!.carry_on_as_now],
      ['numeric', { message: 7 }], ['empty', null], ['missing', {}],
      ['__proto__', { message: 'Not shown. Wrong identity.' }],
      ['constructor', { message: 'Not shown. Wrong identity.' }],
      ['prototype', { message: 'Not shown. Wrong identity.' }],
    ])
    const data = hydrate(raw)
    const adapted = data.confidence.inferenceWarnings!.find(w => w.code === TNT)!.per_option!
    expect(Object.getPrototypeOf(adapted)).toBeNull()
    expect(Object.keys(adapted)).toEqual(['carry_on_as_now'])
    expect(adapted.carry_on_as_now).toEqual(producerWarning.per_option!.carry_on_as_now)
  })

  it('adapter control: a null-prototype plain map carries its own option message', () => {
    const raw = Object.assign(Object.create(null), producerWarning.per_option)
    expect(hydrate(raw).confidence.inferenceWarnings!.find(w => w.code === TNT)!.per_option)
      .toEqual(producerWarning.per_option)
  })

  it('adapter control: an empty plain map stays present without inventing any entries', () => {
    const adapted = hydrate({}).confidence.inferenceWarnings!.find(w => w.code === TNT)!.per_option
    expect(adapted).toEqual({})
    expect(Object.getPrototypeOf(adapted!)).toBeNull()
  })

  it.each([
    ['absent', undefined], ['null', null], ['array', []], ['string', 'Not shown. Wrong shape.'],
    ['inherited option', Object.create(producerWarning.per_option!)],
  ])('adapter control: %s is not carried as a per-option map', (_kind, raw) => {
    expect(hydrate(raw).confidence.inferenceWarnings!.find(w => w.code === TNT)!.per_option).toBeUndefined()
  })
})
