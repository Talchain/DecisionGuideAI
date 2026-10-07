import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AnalysisHeroContainer } from '../AnalysisHeroContainer'
import { makeHeroData, makeOption } from '../__fixtures__/hero.fixtures'
import type { InferenceWarning } from '../../types'
import { readGoalIdentityWithheld } from '../../utils/goalIdentityWithheld'
import { readGoalChanceRange } from '../../utils/goalChanceRange'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'
import b9 from './fixtures/s6/b9-df15c8c.s6-cee.turn.json'
import unseen1 from './fixtures/s6/unseen-1.s6-cee.turn.json'
import unseen2 from './fixtures/s6/unseen-2.s6-cee.turn.json'
import served from './fixtures/s6/served-666dad1e-unseen1-run1.turn.json'

const ids = vi.hoisted(() => ({ next: 0 }))
vi.mock('react', async importOriginal => {
  const react = await importOriginal<typeof import('react')>()
  return { ...react, useId: () => react.useState(() => `:r${(ids.next++).toString(32)}:`)[0] }
})
beforeEach(() => { ids.next = 0 })
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../../../../canvas/analysis/canonicalRunRegistry', () => ({ executeCanonicalRun: vi.fn() }))
afterEach(cleanup)

type Turn = typeof b9 | typeof unseen1 | typeof unseen2 | typeof served
const TNT = 'GOAL_FIGURES_TARGET_NOT_TESTABLE'
const BASELINE = '‘Carry on as now’: not shown yet. It needs nothing more of its own; it waits until the other options can be tested against your target, so all are shown on the same footing.'

function fromTurn(turn: Turn) {
  const enrichment = turn.blocks[0].enrichment
  const labels = new Map(turn.draft_graph.nodes.map(n => [n.id, n.label]))
  const options = enrichment.option_comparison.map(o => makeOption({ id: o.option_id, label: o.option_label }))
  const data = makeHeroData({ options, topDriverLabel: null, recommendation: {
    isNormalised: true, goalThreshold: 24000, outcomeUnit: 'currency', outcomeUnitSymbol: '£',
    goalLabel: 'monthly profit', goalFiguresWithheldMessage: readGoalIdentityWithheld(enrichment)?.message,
    storyHeadlines: {}, flipThresholds: [],
  } })
  data.goalChanceRange = readGoalChanceRange(enrichment.inference_warnings)
  data.goalChanceLicence = readGoalChanceLicence(enrichment.inference_warnings)
  data.goalChanceDriverNames = { labelOf: id => labels.get(id) ?? null, unitOf: () => null }
  // Adapter shape: confidence.inferenceWarnings, with affected_nodes and only the carried message entries.
  data.confidence.inferenceWarnings = enrichment.inference_warnings.map(w => ({
    code: w.code, affected_nodes: [], message: w.message, severity: w.severity,
    ...('option_ids' in w ? { option_ids: structuredClone(w.option_ids) } : {}),
    ...('per_option' in w ? { per_option: structuredClone(w.per_option) } : {}),
  })) as InferenceWarning[]
  return data
}

function targetWarning(data: ReturnType<typeof fromTurn>) {
  return data.confidence.inferenceWarnings!.find(w => w.code === TNT)!
}
function row(id: string) {
  const node = screen.getAllByTestId('goal-option-withheld-line').find(n => n.getAttribute('data-option-id') === id)
  expect(node, `withheld option ${id}`).toBeTruthy()
  return { id: node!.getAttribute('data-option-id'), text: node!.textContent }
}
function expectedLine(data: ReturnType<typeof fromTurn>, id: string, message: string) {
  const label = data.recommendation.allOptions.find(o => o.id === id)!.label
  return `‘${label}’: not shown yet. ${message.slice('Not shown.'.length).trim()}`
}
function mount(data: ReturnType<typeof fromTurn>) {
  return render(<AnalysisHeroContainer data={data} fragileEdgeCount={0} />)
}

describe('S-E S6: each withheld option reads its own producer reason', () => {
  it('R1 PRECONDITION: B9 Run-wide TNT names Loyalty app deployment', () => {
    expect(targetWarning(fromTurn(b9)).message).toContain('Loyalty app deployment')
  })

  it('R1 B9: baseline ID and literal waiting reason, without another option\'s link', () => {
    const data = fromTurn(b9)
    mount(data)
    expect(row('carry_on_as_now')).toEqual({ id: 'carry_on_as_now', text: BASELINE })
    expect(row('carry_on_as_now').text).not.toContain('Loyalty app deployment')
  })

  it('R2 unseen-1: loyalty ID and exact own reason; baseline ID and literal', () => {
    const data = fromTurn(unseen1)
    mount(data)
    expect(row('loyalty_app')).toEqual({ id: 'loyalty_app',
      text: expectedLine(data, 'loyalty_app', targetWarning(data).per_option!.loyalty_app.message) })
    expect(row('loyalty_app').text).not.toContain('Fourth-shop')
    expect(row('carry_on_as_now')).toEqual({ id: 'carry_on_as_now', text: BASELINE })
  })

  it('R3 unseen-2: launch ID and exact own link reason; baseline ID and literal', () => {
    const data = fromTurn(unseen2)
    mount(data)
    expect(row('launch_loyalty_app')).toEqual({ id: 'launch_loyalty_app',
      text: expectedLine(data, 'launch_loyalty_app', targetWarning(data).per_option!.launch_loyalty_app.message) })
    expect(row('launch_loyalty_app').text).toContain('Loyalty app active')
    expect(row('launch_loyalty_app').text).not.toContain('Fourth shop')
    expect(row('carry_on_as_now')).toEqual({ id: 'carry_on_as_now', text: BASELINE })
  })

  it.each([
    ['B9', b9, ['carry_on_as_now']],
    ['unseen-1', unseen1, ['loyalty_app', 'carry_on_as_now']],
    ['unseen-2', unseen2, ['carry_on_as_now', 'launch_loyalty_app']],
  ] as const)('R4 CONTROL %s: absent per_option keeps every Run-wide line', (_name, turn, missing) => {
    const data = fromTurn(turn)
    delete targetWarning(data).per_option
    mount(data)
    expect(screen.getAllByTestId('goal-option-withheld-line').map(n => ({
      id: n.getAttribute('data-option-id'), text: n.textContent,
    }))).toEqual(missing.map(id => ({ id, text: expectedLine(data, id, targetWarning(data).message!) })))
  })

  it.each(['someone_else', 'wrong prefix', '__proto__', 'constructor', 'prototype', 'inherited', 'wrong code'] as const)(
    'R5 CONTROL %s: baseline identity keeps the exact Run-wide line', kind => {
      const data = fromTurn(b9)
      const warning = targetWarning(data)
      const ownReason = warning.per_option!.carry_on_as_now
      warning.per_option = kind === 'wrong prefix' ? { carry_on_as_now: { message: 'Not shown yet.' } }
        : kind === 'inherited' ? Object.create({ carry_on_as_now: ownReason })
          : kind === 'wrong code' ? { carry_on_as_now: ownReason }
            : Object.fromEntries([[kind, ownReason]])
      if (kind === 'wrong code') warning.code = 'GOAL_FIGURES_PLACEHOLDER_PATH'
      mount(data)
      expect(row('carry_on_as_now')).toEqual({ id: 'carry_on_as_now',
        text: expectedLine(data, 'carry_on_as_now', warning.message!) })
    },
  )
})

describe('S6b: served 666dad1e reasons bind only to the withheld option', () => {
  const clifton = 'open_fourth_clifton_shop'
  const launch = 'launch_loyalty_app'
  const placeholder = (data: ReturnType<typeof fromTurn>) =>
    data.confidence.inferenceWarnings!.find(w => w.code === 'GOAL_FIGURES_PLACEHOLDER_PATH')!
  const fallback = '‘Open fourth Clifton shop’: not shown yet in this model.'

  it('R1 PRECONDITION: the base Run-wide message names the loyalty app link', () => {
    expect(fromTurn(served).recommendation.goalFiguresWithheldMessage).toContain('Loyalty app active')
  })

  it('R1 SERVED: Clifton uses its exact placeholder words; launch keeps its own per-option reason', () => {
    const data = fromTurn(served)
    mount(data)
    expect(row(clifton).text).toBe(`‘Open fourth Clifton shop’: not shown yet. ${placeholder(data).message}`)
    expect(row(clifton).text).not.toContain('Loyalty app')
    expect(row(launch).text).toBe(expectedLine(data, launch, targetWarning(data).per_option![launch].message))
  })

  it('R2 CONTROL: a placeholder excluding Clifton never supplies its words', () => {
    const data = fromTurn(served)
    placeholder(data).option_ids = [launch]
    mount(data)
    expect(row(clifton).text).toBe(fallback)
    expect(row(clifton).text).not.toContain(placeholder(data).message!)
    expect(row(clifton).text).not.toContain('Loyalty app')
  })

  it('R3 CONTROL: absent option ids cover every row', () => {
    const data = fromTurn(served)
    delete placeholder(data).option_ids
    mount(data)
    expect(row(clifton).text).toBe(`‘Open fourth Clifton shop’: not shown yet. ${placeholder(data).message}`)
    expect(row(launch).text).toBe(expectedLine(data, launch, targetWarning(data).per_option![launch].message))
  })

  it('R4 CONTROL: an unsafe row-bound message uses the fallback', () => {
    const data = fromTurn(served)
    placeholder(data).message = 'Not shown. number_of_coffee_shops needs a size.'
    mount(data)
    expect(row(clifton).text).toBe(fallback)
  })
})
