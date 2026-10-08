/**
 * PJ-B3 on the Analysis tab (DL #72 5869404773): the canvas card and the Reasoning tab (#2239) say
 * "no value yet" on a driver the run ranked while holding no value for it. Three Analysis-tab
 * surfaces still named that factor bare: the hero's "Main driver", the Drivers panel's crown row and
 * the decision brief's "What matters". Same rule here (`noValueDriverIds`: Canvas's
 * `runHoldsNoValueFor` ∧ `!hasAnyStatedValue`), same words (`DRIVER_LINE_COPY.noValueYet`).
 *
 * THE SERVED CASE, NOT A HAND-BUILT ONE: served 7ad369b7's pricing run ranks Top Account Revenue
 * Concentration first, and its `factor_sensitivity` row carries NO `value_source` while three other
 * rows carry `cee_inference`. So the hero named, and the panel ranked, an unvalued factor as the
 * main driver. Every case has a control where the model states a value.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach } from 'vitest'
import { render, renderHook, screen, cleanup } from '@testing-library/react'

import { useCanvasStore } from '../../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import { useResultsSectionData } from '../../useResultsSectionData'
import type { ResultsReport } from '../../types'
import { DriversSection } from '../../DriversSection'
import { DecisionBriefSectionContainer, uniqueLabelsOf } from '../../decision-brief/DecisionBriefSection'
import { useAnalysisHero } from '../useAnalysisHero'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import type { HeroChartModel } from '../heroTypes'
import served from './fixtures/served-7ad369b7-pricing-drivers-accordion.json'

type AnalysisBlock = Parameters<typeof mapV5AnalysisToReport>[0]

const TOP = 'fac_top_account_concentration'
const TOP_LABEL = 'Top Account Revenue Concentration'
const USAGE = 'fac_usage_exposure'
const USAGE_LABEL = 'Usage-Based Pricing Exposure'
const DOM = served.served_dom as Record<string, string>

const BRIEF = {
  version: '1',
  brief_id: '0f1e2d3c-4b5a-4968-8776-a5b4c3d2e1f0',
  created_at: '2026-09-28T12:00:00.000Z',
  top_drivers: [
    { factor_label: TOP_LABEL, sensitivity: 1, direction: 'positive' },
    { factor_label: USAGE_LABEL, sensitivity: 0.6, direction: 'positive' },
  ],
}

/** The served run and graph; `stated` gives those node ids a value in the model now. */
function seed(stated: string[] = [], relabel: Record<string, string> = {}) {
  const report = mapV5AnalysisToReport(served.analysis_result as unknown as AnalysisBlock) as unknown as ResultsReport
  useCanvasStore.setState({
    nodes: served.draft_graph_nodes.map((n, i) => ({
      id: n.id,
      type: n.kind,
      position: { x: i * 10, y: 0 },
      data: {
        label: relabel[n.id] ?? n.label,
        kind: n.kind,
        ...(stated.includes(n.id) ? { observed_state: { value: 0.3 } } : {}),
      },
    })) as never,
    results: { status: 'complete', progress: 100, report: { ...report, decision_brief: BRIEF } } as never,
    hasCompletedFirstRun: true,
  } as never)
}

function heroPill(): string {
  const { result } = renderHook(() => useAnalysisHero(useResultsSectionData()))
  const model = result.current.model as HeroChartModel
  expect(model.kind).toBe('chart')
  render(<AnalysisHeroPanel model={model} rerunDisabled={false} onFocusTarget={() => {}} />)
  return screen.getByTestId('hero-quicklink-driver').textContent ?? ''
}

function renderDrivers() {
  const data = renderHook(() => useResultsSectionData()).result.current
  render(<DriversSection data={data.drivers} />)
}

function briefDriverItems(): string[] {
  render(<DecisionBriefSectionContainer leaderClaimPermitted={false} />)
  return Array.from(screen.getByTestId('decision-brief-drivers').querySelectorAll('li')).map((li) => li.textContent ?? '')
}

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    results: { status: 'idle', progress: 0 } as never,
    nodes: [] as never,
    hasCompletedFirstRun: false,
  } as never)
})

describe('the evidence: the served run ranked an unvalued factor as its main driver', () => {
  it('Top Account carries no value_source; other rows of the same run do', () => {
    const rows = served.analysis_result.enrichment.factor_sensitivity as Array<{ factor_id: string; value_source?: string }>
    expect(rows.find((r) => r.factor_id === TOP)?.value_source).toBeUndefined()
    expect(rows.filter((r) => typeof r.value_source === 'string').length).toBeGreaterThan(0)
    expect(DOM['hero-quicklink-driver']).toBe(`Main driver: ${TOP_LABEL}`)
  })
})

describe('hero "Main driver"', () => {
  it('⭐ the unvalued main driver reads "· no value yet"', () => {
    seed()
    expect(heroPill()).toBe(`Moves the result most: ${TOP_LABEL} · no value yet`)
  })

  it('CONTROL: the model now states a value for it → no note', () => {
    seed([TOP])
    expect(heroPill()).toBe(`Moves the result most: ${TOP_LABEL}`)
  })
})

describe('Drivers panel', () => {
  it('⭐ the unvalued row says "No value yet"; a valued row does not', () => {
    seed()
    renderDrivers()
    expect(screen.getByTestId(`driver-no-value-${TOP}`)).toHaveTextContent('No value yet')
    // Its influence pill is still there: the rank stays (Canvas's ruling).
    expect(screen.getByTestId(`driver-influence-pill-${TOP}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`driver-no-value-${USAGE}`)).toBeNull()
  })

  it('CONTROL: the model now states a value for it → no note', () => {
    seed([TOP])
    renderDrivers()
    expect(screen.queryByTestId(`driver-no-value-${TOP}`)).toBeNull()
  })
})

describe('decision brief "What matters"', () => {
  it('⭐ the unvalued driver reads "· no value yet"; a valued one does not', () => {
    seed()
    const [first] = briefDriverItems()
    expect(first).toBe(`${TOP_LABEL} · no value yet`)
  })

  it('CONTROL: the model now states a value for it → the producer label, verbatim', () => {
    seed([TOP])
    expect(briefDriverItems()[0]).toBe(TOP_LABEL)
  })

  it('FAIL CLOSED: two model nodes share the label → neither is flagged (the brief row carries no id)', () => {
    seed([], { [USAGE]: TOP_LABEL })
    expect(briefDriverItems()[0]).toBe(TOP_LABEL)
  })

  it('uniqueLabelsOf keeps a label only when exactly one node wears it and that node is flagged', () => {
    const nodes = [
      { id: 'a', data: { label: ' Alpha ' } },
      { id: 'b', data: { label: 'Beta' } },
      { id: 'c', data: { label: 'Beta' } },
      { id: 'd', data: { label: 'Delta' } },
    ]
    expect([...uniqueLabelsOf(nodes, new Set(['a', 'b']))]).toEqual(['Alpha'])
  })
})
