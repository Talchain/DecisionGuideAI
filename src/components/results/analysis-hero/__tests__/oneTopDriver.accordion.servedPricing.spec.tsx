/**
 * ⛔ THE DRIVERS ACCORDION CROWNED A DIFFERENT "TOP" FACTOR THAN THE HERO
 * (served 7ad369b7, pricing starter, one Run, no chat turns; witness
 * `canvas/s8ffc/witness-7ad3/RESULT.md` row W2, 1280×800 and 1440×900).
 *
 * After #2124/#2130 the hero reads "Main driver: Top Account Revenue
 * Concentration" (the card's Driver 1, `drivers.driverLeader`). On the SAME
 * tab, "What's driving this" (`accordion-drivers`) badged Enterprise Revenue
 * Cannibalization Risk "Top driver" (`driver-influence-pill-fac_enterprise_revenue_risk`),
 * because the pill's crown is awarded to the panel's own maximum
 * `influence_score` — PLoT's STRUCTURAL weight, on which an option-set lever
 * with `elasticity: 0` sits at 100%. Two "top" drivers on one screen.
 *
 * Rule pinned here: "Top driver" appears on exactly the factor the hero names,
 * or on no row. The panel keeps its numbers, its rows, its order and its
 * testids; only the superlative yields to the one driver authority.
 *
 * Every served string is read from the fixture (captured payload + DOM), never
 * typed here. Assertions bind by identity: factor id on the exact test id, and
 * the exact pill text.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, renderHook, screen, cleanup, within } from '@testing-library/react'

import { useCanvasStore } from '../../../../canvas/store'
import { mapV5AnalysisToReport } from '../../../../v5/mapV5AnalysisToReport'
import { useResultsSectionData, type ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { DriversSectionData, ResultsReport } from '../../types'
import { DriversSection } from '../../DriversSection'
import { useAnalysisHero } from '../useAnalysisHero'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import type { HeroChartModel } from '../heroTypes'
import served from './fixtures/served-7ad369b7-pricing-drivers-accordion.json'

type AnalysisBlock = Parameters<typeof mapV5AnalysisToReport>[0]
type Block = typeof served.analysis_result
/** The served `factor_sensitivity[]` fields this spec reads (rows differ in which optional keys they carry). */
type SensitivityRow = {
  factor_id: string
  influence_score: number
  elasticity: number
  importance_rank: number
  zero_reason?: string
}
const sensitivityRows = (b: Block) => b.enrichment.factor_sensitivity as unknown as SensitivityRow[]

const TOP = 'fac_top_account_concentration'
const LEVER = 'fac_enterprise_revenue_risk'
const USAGE = 'fac_usage_exposure'
const CROWN = 'Top driver'
const DOM = served.served_dom as Record<string, string>
const PILL = (id: string) => `driver-influence-pill-${id}`

/** The served rows, verbatim innerText: [label, "NN%"] pairs in DOM order. */
function servedRows(): Array<{ label: string; pct: string }> {
  const lines = DOM['accordion-drivers rows (innerText, verbatim)'].split('\n')
  const rows: Array<{ label: string; pct: string }> = []
  lines.forEach((line, i) => {
    if (/^\d+%$/.test(line)) rows.push({ label: lines[i - 1], pct: line })
  })
  return rows
}

function blockWith(patch?: (b: Block) => void): Block {
  const block = JSON.parse(JSON.stringify(served.analysis_result)) as Block
  patch?.(block)
  return block
}

function seed(block: Block) {
  useCanvasStore.setState({
    nodes: served.draft_graph_nodes.map((n, i) => ({
      id: n.id,
      type: n.kind,
      position: { x: i * 10, y: 0 },
      data: { label: n.label, kind: n.kind },
    })) as never,
    results: {
      status: 'complete',
      progress: 100,
      report: mapV5AnalysisToReport(block as unknown as AnalysisBlock) as unknown as ResultsReport,
    } as never,
    hasCompletedFirstRun: true,
  } as never)
}

function sectionData(): ResultsSectionDataReturn {
  return renderHook(() => useResultsSectionData()).result.current
}

function heroModel(): HeroChartModel {
  const { result } = renderHook(() => useAnalysisHero(useResultsSectionData()))
  expect(result.current.model.kind).toBe('chart')
  return result.current.model as HeroChartModel
}

function renderDrivers(drivers: DriversSectionData) {
  return render(<DriversSection data={drivers} />)
}

/** Every rendered influence pill, in DOM order: [factorId, exact text]. */
function renderedPills(): Array<[string, string]> {
  const list = screen.getByTestId('drivers-list')
  return Array.from(list.querySelectorAll<HTMLElement>('[data-testid^="driver-influence-pill-"]')).map(
    (el) => [el.dataset.testid!.replace('driver-influence-pill-', ''), el.textContent ?? ''],
  )
}

function crownedIds(): string[] {
  return renderedPills().filter(([, text]) => text === CROWN).map(([id]) => id)
}

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    results: { status: 'idle', progress: 0 } as never,
    nodes: [] as never,
    hasCompletedFirstRun: false,
  } as never)
})

describe('served 7ad369b7 pricing run — the evidence', () => {
  it('served DOM: the hero named Top Account while the accordion crowned the lever', () => {
    expect(DOM['hero-quicklink-driver']).toBe('Main driver: Top Account Revenue Concentration')
    expect(DOM[PILL(LEVER)]).toBe(CROWN)
    expect(DOM[PILL(TOP)]).not.toBe(CROWN)
  })

  it('payload: the lever leads on structural influence_score with elasticity 0; Top Account leads on elasticity', () => {
    const rows = sensitivityRows(served.analysis_result)
    const lever = rows.find((r) => r.factor_id === LEVER)!
    const top = rows.find((r) => r.factor_id === TOP)!
    expect(lever.influence_score).toBe(1)
    expect(lever.elasticity).toBe(0)
    expect(lever.zero_reason).toBe('intervention_override')
    expect(top.importance_rank).toBe(1)
    expect(Math.abs(top.elasticity)).toBe(Math.max(...rows.map((r) => Math.abs(r.elasticity))))
  })

  it('the one driver authority on this payload is Top Account, and the hero names it by id', () => {
    seed(blockWith())
    expect(sectionData().drivers.driverLeader).toEqual({ key: TOP, leadIsClear: true })
    const model = heroModel()
    expect(model.quickLinks.mainDriver?.targetId).toBe(TOP)
    render(<AnalysisHeroPanel model={model} rerunDisabled={false} onFocusTarget={() => {}} />)
    expect(screen.getByTestId('hero-quicklink-driver').textContent).toBe(DOM['hero-quicklink-driver'])
  })
})

describe('"Top driver" appears on exactly the factor the hero names, or on no row', () => {
  it('served run: no row other than the hero\'s factor is crowned', () => {
    seed(blockWith())
    const data = sectionData()
    const heroId = heroModel().quickLinks.mainDriver?.targetId
    renderDrivers(data.drivers)
    for (const id of crownedIds()) expect(id).toBe(heroId)
  })

  it('served run: the lever\'s pill reads its tier ("High-impact driver", 100%), not the crown', () => {
    seed(blockWith())
    renderDrivers(sectionData().drivers)
    // The tier label is the one the panel's own thresholds give a 100% row —
    // the same text the served run printed on the 62% and 60% rows.
    expect(screen.getByTestId(PILL(LEVER)).textContent).toBe(DOM[PILL(USAGE)])
    expect(screen.getByTestId(PILL(LEVER)).textContent).not.toBe(CROWN)
    expect(within(screen.getByTestId('drivers-list')).queryByText(CROWN)).toBeNull()
  })

  it('nothing removed: the same rows, the same order, the same percentages, the same other pills', () => {
    seed(blockWith())
    renderDrivers(sectionData().drivers)
    const rows = servedRows()
    expect(rows.map((r) => r.pct)).toEqual(['100%', '62%', '60%'])
    expect(renderedPills().map(([id]) => id)).toEqual([LEVER, USAGE, TOP])
    for (const r of rows) {
      expect(screen.getByRole('progressbar', { name: `${r.label} influence: ${r.pct}` })).toBeInTheDocument()
    }
    expect(screen.getByTestId(PILL(USAGE)).textContent).toBe(DOM[PILL(USAGE)])
    expect(screen.getByTestId(PILL(TOP)).textContent).toBe(DOM[PILL(TOP)])
    expect(screen.getByTestId(`driver-lever-badge-${LEVER}`)).toHaveTextContent('Controlled by your options')
  })

  it('CONTROL — when the authority and the panel agree, the crown stays (served rows, two influence_scores swapped)', () => {
    seed(
      blockWith((b) => {
        const rows = sensitivityRows(b)
        const lever = rows.find((r) => r.factor_id === LEVER)!
        const top = rows.find((r) => r.factor_id === TOP)!
        ;[lever.influence_score, top.influence_score] = [top.influence_score, lever.influence_score]
      }),
    )
    const data = sectionData()
    expect(data.drivers.driverLeader).toEqual({ key: TOP, leadIsClear: true })
    const heroId = heroModel().quickLinks.mainDriver?.targetId
    expect(heroId).toBe(TOP)
    renderDrivers(data.drivers)
    expect(crownedIds()).toEqual([TOP])
    expect(renderedPills()[0]).toEqual([TOP, CROWN])
  })
})

describe('every authority verdict, on the served driver rows', () => {
  function servedDrivers(): DriversSectionData {
    seed(blockWith())
    return sectionData().drivers
  }

  it('CONTROL — no driver feed (`driverLeader` undefined): the panel keeps its own crown, as before', () => {
    renderDrivers({ ...servedDrivers(), driverLeader: undefined })
    expect(crownedIds()).toEqual([LEVER])
  })

  it('CONTROL — the authority names the panel\'s own top with a clear lead: the crown stays on it', () => {
    renderDrivers({ ...servedDrivers(), driverLeader: { key: LEVER, leadIsClear: true } })
    expect(crownedIds()).toEqual([LEVER])
  })

  it('the authority names nobody (`null`): no row is crowned', () => {
    renderDrivers({ ...servedDrivers(), driverLeader: null })
    expect(crownedIds()).toEqual([])
    expect(screen.getByTestId(PILL(LEVER)).textContent).toBe(DOM[PILL(USAGE)])
  })

  it('the authority\'s top is tied (`leadIsClear: false`), even on the panel\'s own top: no row is crowned', () => {
    renderDrivers({ ...servedDrivers(), driverLeader: { key: LEVER, leadIsClear: false } })
    expect(crownedIds()).toEqual([])
  })

  it('the crown never MOVES to the authority\'s factor when that row is not the panel\'s top (60% under 100%)', () => {
    renderDrivers(servedDrivers())
    expect(screen.getByTestId(PILL(TOP)).textContent).toBe(DOM[PILL(TOP)])
    expect(crownedIds()).toEqual([])
  })
})
