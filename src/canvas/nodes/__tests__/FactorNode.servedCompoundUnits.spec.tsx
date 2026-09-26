/**
 * ⭐⭐ A FACTOR CARD READS "£49 / month", "7% / month", "50 / 100" — served
 * `cd6a82e4`, Paul's pricing brief (26 Sep 2026).
 *
 * MEASURED ON THE SERVED BOARD: the factor cards read "49 GBP per month brief",
 * "7 percent per month est.", "50 index out of 100 est." and, on a second board,
 * "60 score out of 100" and "49 £/month". The contract reference board reads
 * "£49 per subscriber / month" and "8% trials convert".
 *
 * ⭐ THE FIXTURES ARE THE WIRE. Each `observedState` below is copied from
 * `observed_state` in `joined-1-cd6a82e4-5f941f2/turns.jsonl` (the five factors
 * of that model); the `£/month` and `score out of 100` units are from the second
 * served screenshot. Asserted by identity: the exact text of the figure and the
 * unit spans on the exact node id.
 *
 * ⛔ NOTHING INVENTED, NOTHING DROPPED: `7 percent per month` reads `7% / month`
 * (NOT `700%` — the plain-percent ×100 is not extended to compounds), and a
 * plain word unit (`200 subscribers`) is untouched — the CONTROL.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const factor = (label: string, observedState: Record<string, unknown>) => ({
  label, type: 'factor', category: 'controllable', observedState,
})

const renderFactor = (id: string, data: Record<string, unknown>, lodRung: 'full' | 'line' = 'full') => {
  useCanvasStore.setState({
    nodes: [{ id, type: 'factor', position: { x: 0, y: 0 }, data }],
    edges: [], ceeAnalysisReady: null, viewMode: 'standard', lodRung,
    goalConstraints: [], analysisStateV1: null, importPendingServerRegistration: false,
    currentScenarioId: 'served-compound-units',
    analysisFreshness: null, analysisFreshnessDirty: false, v5AnalysisFact: null,
    hasCompletedFirstRun: false, results: { status: 'idle', report: null },
  } as never)
  return render(
    <ReactFlowProvider>
      <FactorNode
        id={id} type="factor" data={data as never} selected={false}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </ReactFlowProvider>,
  )
}

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: [], edges: [] } as never)
})

/** [node id, label, served observed_state, expected figure, expected unit words] */
const SERVED: Array<[string, string, Record<string, unknown>, string, string]> = [
  ['pro_plan_price', 'Pro plan price',
    { cap: 200, unit: 'GBP per month', value: 0.245, source: 'brief_extraction', raw_value: 49, declared_scale: 'unit_interval' },
    '£49', '/ month'],
  ['monthly_pro_churn', 'Monthly Pro churn',
    { unit: 'percent per month', value: 0.07, source: 'cee_inference', raw_value: 7, extractionType: 'inferred' },
    '7%', '/ month'],
  ['price_sensitivity_index', 'Price sensitivity index',
    { unit: 'index out of 100', value: 0.5, source: 'cee_inference', raw_value: 50, extractionType: 'inferred' },
    '50', '/ 100'],
  ['monthly_pro_new_subscribers', 'Monthly Pro new subscribers',
    { unit: 'subscribers per month', value: 0.04, source: 'cee_inference', raw_value: 20, extractionType: 'inferred' },
    '20', 'subscribers / month'],
  // Second served board (bf5-after-cd6a82e4/03-after-run.png).
  ['pro_plan_price_b', 'Pro plan price',
    { unit: '£/month', value: 0.245, source: 'brief_extraction', raw_value: 49 },
    '£49', '/ month'],
  ['ai_feature_perceived_value', 'AI feature perceived value',
    { unit: 'score out of 100', value: 0.6, source: 'cee_inference', raw_value: 60, extractionType: 'inferred' },
    '60', '/ 100'],
]

describe('served cd6a82e4 — a factor card reads its compound unit compactly', () => {
  it.each(SERVED)('%s (%s) %j reads figure "%s" + unit "%s"', (id, label, observedState, figure, unitWords) => {
    renderFactor(id, factor(label, observedState))
    const c = screen.getByTestId('node-title').closest('[role="group"]') as HTMLElement
    expect(c, 'PRECONDITION: the card renders').not.toBeNull()
    expect(within(c).getByTestId(`factor-value-figure-${id}`).textContent).toBe(figure)
    expect(within(c).getByTestId(`factor-value-unit-${id}`).textContent).toBe(unitWords)
  })

  /**
   * ⭐ ONE RUNG DOWN, THE SAME READING. The reduced line (`node-lod-line-text`,
   * `lodMetricLine.ts`) read the unsplit readout — "7 percent per month",
   * CSS-cut to "7 percent per …" — while the full card beside it read "7% /
   * month" (witnessed on a local build seeded with the served board). It reads
   * the card's visible text now.
   */
  it.each([
    ['monthly_pro_churn', 'Monthly Pro churn', SERVED[1][2], '7% / month'],
    ['pro_plan_price', 'Pro plan price', SERVED[0][2], '£49 / month'],
    ['price_sensitivity_index', 'Price sensitivity index', SERVED[2][2], '50 / 100'],
  ])('%s (%s) %j — the reduced (line-rung) value reads "%s"', (id, label, observedState, reduced) => {
    renderFactor(id as string, factor(label as string, observedState as Record<string, unknown>), 'line')
    expect(screen.getByTestId('node-lod-line-text').textContent).toBe(reduced)
  })

  it('CONTROL — a plain word unit is untouched: "200" + "subscribers"', () => {
    renderFactor('pro_paying_subscribers', factor('Pro paying subscribers',
      { unit: 'subscribers', value: 0.1, source: 'cee_inference', raw_value: 200, extractionType: 'inferred' }))
    expect(screen.getByTestId('factor-value-figure-pro_paying_subscribers').textContent).toBe('200')
    expect(screen.getByTestId('factor-value-unit-pro_paying_subscribers').textContent).toBe('subscribers')
  })
})
