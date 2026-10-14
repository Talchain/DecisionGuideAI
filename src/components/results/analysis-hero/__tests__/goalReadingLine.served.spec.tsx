/**
 * CEE #3059 (merged 14 Oct, b7b22b7f): when a licensed goal chance rests on Olumi's UNCONFIRMED reading of the goal, the
 * Run's stored `GOAL_CHANCE_LICENSED` record carries `goal_reading = { origin: 'olumi', readings: [{ kind, node_id, words }] }`
 * (olumi-assistants-service `src/orchestrator-v5/goal-target/goal-chance-licence.ts:242`, stamped at :1334-1338).
 *
 * The reading below is #3059's own fixture: `run-evaluated-inferred-product.test.ts:36-37` (`SAID`, the reply's exact
 * sentence) and the stored-licence expectation at :248 (`{ origin: 'olumi', readings: [{ kind: 'product', node_id, words:
 * SAID }] }`). Its `node_id` there is minted by construction (`id('Starter-tier MRR')`), so a node of THIS graph stands in.
 *
 * Real path: Paul's served Run 4276f3f9 seeded into the store → `useResultsSectionData` (the licence reader) →
 * `buildHeroModel` → `AnalysisHeroPanel` (Analysis tab) and `DecisionMatrix` (Reasoning tab) → the real `openNodeInspector`.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useCanvasStore } from '../../../../canvas/store'
import { OPEN_FULL_INSPECTOR_EVENT } from '../../../../canvas/utils/openEdgeStrengthEditor'
import { useResultsSectionData } from '../../useResultsSectionData'
import { buildAnalysisNewViewModel } from '../../analysisNew/buildAnalysisNewViewModel'
import { DecisionMatrix } from '../../analysisNew/sections/DecisionMatrix'
import { GOAL_FIGURES_WITHHELD_CODES } from '../../utils/goalIdentityWithheld'
import { readGoalChanceLicence } from '../../utils/goalChanceLicence'
import { buildHeroModel } from '../buildHeroModel'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { withCanonicalTestCells } from './helpers/canonicalTestCells'
import { CONVERTIBLE, SERVED_STAMP, fx, report, resetPaulRun, seedPaulRun } from '../../__tests__/helpers/paulRun4276f3f9'

/** #3059 `run-evaluated-inferred-product.test.ts:36-37`, byte for byte. */
const SAID = 'Olumi works out ‘Starter-tier MRR’ as ‘Starter subscription price’ × ‘Starter subscribers’. '
  + 'That’s Olumi’s reading of how they combine; tell me if it’s wrong.'
/** A derived quantity on this graph's goal path stands in for #3059's constructed product node. */
const NODE = 'investment_firm_meetings'
const GOAL_READING = { origin: 'olumi', readings: [{ kind: 'product', node_id: NODE, words: SAID }] }
const LINE = `Olumi read your goal as “${SAID}” Change it if that’s wrong.`

const MODEL_ORDER = fx.draft.nodes.filter((n) => n.kind === 'option').map((n) => n.id)
const QUOTED_ORDER = ['current_outreach', 'angel_bridge', CONVERTIBLE]
const PCT = { current_outreach: 20, angel_bridge: 41, [CONVERTIBLE]: 62 }

/** The served Run with a licensed chance; `goalReading` is the only difference between rows. */
function seed(goalReading?: unknown) {
  seedPaulRun(SERVED_STAMP)
  const state = useCanvasStore.getState()
  const source = state.results.report as unknown as Record<string, unknown>
  const probabilities = Object.fromEntries(Object.entries(report.option_probabilities).map(([id, row]) =>
    [id, { ...row, ...(id in PCT ? { goal_probability: PCT[id as keyof typeof PCT] / 100 } : {}) }]))
  const record = {
    code: 'GOAL_CHANCE_LICENSED', severity: 'info', message: 'licensed', form: 'each', option_ids: QUOTED_ORDER,
    pct_by_option: PCT, withheld_option_ids: [], target: { comparator: 'at_least', value: 1200000, unit: '£' },
    ...(goalReading === undefined ? {} : { goal_reading: goalReading }),
  }
  expect(readGoalChanceLicence([record])).not.toBeNull()
  const warnings = ((source.inference_warnings ?? []) as Array<{ code?: string }>).filter((w) =>
    !GOAL_FIGURES_WITHHELD_CODES.includes(w.code ?? '') && w.code !== 'GOAL_CHANCE_LICENSED')
  useCanvasStore.setState({
    results: { ...state.results, report: { ...source, option_probabilities: probabilities, inference_warnings: [...warnings, record] } },
    ceeAnalysisReady: { ...state.ceeAnalysisReady, goal_threshold_raw: 1200000, goal_threshold_unit: '£' },
  } as never)
  return withCanonicalTestCells(renderHook(() => useResultsSectionData()).result.current)
}

function renderHero(data: ReturnType<typeof seed>) {
  const model = buildHeroModel(data)
  if (model.kind !== 'chart') throw new Error('expected the chart hero')
  // The chance is shown: the reading line is said beside a speaking goal-chance arm.
  expect(model.goalChanceLeadLines?.length ?? 0).toBeGreaterThan(0)
  return render(<AnalysisHeroPanel model={model} rerunDisabled={false} />)
}

function renderMatrix(data: ReturnType<typeof seed>) {
  const vm = buildAnalysisNewViewModel({ data, recommendations: [], isPreRun: false, isRunning: false, isStale: false })
  const view = render(<DecisionMatrix data={data} comparison={vm.optionsComparison} optionOrder={MODEL_ORDER} run={{ hash: 'run-4276' }} isStale={false} />)
  fireEvent.click(screen.getByTestId('decision-matrix-toggle'))
  return view
}

afterEach(() => { cleanup(); resetPaulRun() })

describe('CEE #3059 goal_reading: the chance says it rests on Olumi’s reading of the goal, and the reading can be changed', () => {
  it('⭐ Analysis hero: CEE’s exact words, attributed to Olumi; “Change it” opens the inspector on that exact node', () => {
    const data = seed(GOAL_READING)
    expect(data.goalChanceLicence?.goalReading).toEqual({ origin: 'olumi', readings: [{ kind: 'product', nodeId: NODE, words: SAID }] })
    renderHero(data)
    const line = screen.getByTestId('hero-goal-reading')
    expect(line).toHaveAttribute('data-origin', 'olumi')
    expect(line.textContent).toBe(LINE)
    expect(screen.getByTestId('hero-goal-reading-words').textContent).toBe(`“${SAID}”`)
    expect(screen.getByTestId('hero-goal-reading-words')).toHaveAttribute('data-kind', 'product')

    const raised: Event[] = []
    const onRaise = (e: Event) => { raised.push(e) }
    window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, onRaise)
    try {
      expect(useCanvasStore.getState().selection.nodeIds.has(NODE)).toBe(false)
      fireEvent.click(screen.getByRole('button', { name: 'Change it' }))
    } finally {
      window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, onRaise)
    }
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual([NODE])
    expect(useCanvasStore.getState().nodes.filter((n) => n.selected).map((n) => n.id)).toEqual([NODE])
    expect(raised).toHaveLength(1)
  })

  it('⭐ Reasoning tab mirror: the same line beside the matrix’s chances, same node', () => {
    renderMatrix(seed(GOAL_READING))
    expect(screen.getByTestId('decision-matrix-goal-reading').textContent).toBe(LINE)
    expect(screen.getByTestId('decision-matrix-goal-reading-change')).toHaveAttribute('data-node-id', NODE)
  })

  it('NEGATIVE: no goal_reading on the licence (CEE’s CONTROL, :254) → no line on either surface', () => {
    const data = seed()
    expect(data.goalChanceLicence).not.toBeNull()
    expect(data.goalChanceLicence?.goalReading).toBeUndefined()
    renderHero(data)
    expect(screen.queryByTestId('hero-goal-reading')).toBeNull()
    cleanup()
    renderMatrix(seed())
    expect(screen.queryByTestId('decision-matrix-goal-reading')).toBeNull()
    expect(document.body.textContent).not.toContain('Olumi read your goal')
  })

  it('NEGATIVE: the user confirmed the goal, so the next Run’s licence carries no goal_reading → the line goes', () => {
    const first = renderHero(seed(GOAL_READING))
    expect(screen.getByTestId('hero-goal-reading').textContent).toBe(LINE)
    first.unmount()
    renderHero(seed())
    expect(screen.queryByTestId('hero-goal-reading')).toBeNull()
    expect(document.body.textContent).not.toContain(SAID)
  })

  it('tolerant: an unknown kind still says its words; a reading with no node or words, or a non-Olumi origin, says nothing', () => {
    const unknownKind = seed({ origin: 'olumi', readings: [{ kind: 'horizon', node_id: NODE, words: SAID }, { kind: 'level', node_id: '', words: 'x' }] })
    expect(unknownKind.goalChanceLicence?.goalReading?.readings).toEqual([{ kind: 'horizon', nodeId: NODE, words: SAID }])
    renderHero(unknownKind)
    expect(screen.getByTestId('hero-goal-reading').textContent).toBe(LINE)
    cleanup()
    expect(seed({ origin: 'user', readings: GOAL_READING.readings }).goalChanceLicence?.goalReading).toBeUndefined()
  })
})
