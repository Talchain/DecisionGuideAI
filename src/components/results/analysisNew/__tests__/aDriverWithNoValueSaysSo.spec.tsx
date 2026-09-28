/**
 * PJ-B3 on the Reasoning tab (Canvas 5868665431, R&C 5866297058): a factor the run RANKED but held no
 * value for read as a plain "#3 Local Talent Market Tightness" in the Challenge zone's driver list,
 * while the canvas card now says "Driver N · no value yet". Same rule here (Canvas's
 * `runHoldsNoValueFor` ∧ `!hasAnyStatedValue`, over the real V5 mapper's feed), same words.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { OlumiResponse } from '@talchain/schemas/boundary'

vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))

import { applyV5State, type V5ApplicatorStore } from '../../../../v5/applyV5State'
import { useCanvasStore } from '../../../../canvas/store'
import { useResultsSectionData } from '../../useResultsSectionData'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import realStagingFixture from '../../../../v5/__tests__/fixtures/v5-analysis-result.staging-real-shape.json'

type State = ReturnType<typeof useCanvasStore.getState>
type Block = Record<string, unknown> & { enrichment: Record<string, unknown> }

/** The run attested values for two factors; talent market carried none. */
function seedRun() {
  const block = structuredClone(realStagingFixture.blocks[0]) as unknown as Block
  const fs = block.enrichment.factor_sensitivity as Array<Record<string, unknown>>
  block.enrichment.factor_sensitivity = fs.map((f) =>
    f.factor_id === 'fac_talent_market' ? f : { ...f, value_source: 'user_override', value_defaulted: false, value_extraction_type: 'explicit' },
  )
  const envelope = { response_version: 2, assistant_text: 'Done.', blocks: [block], suggested_actions: [], insights: [], stage_indicator: 'analyse' } as unknown as OlumiResponse
  const captured: Array<{ report: unknown; hash: string }> = []
  const store: V5ApplicatorStore = {
    setCurrentStage: vi.fn(), updateNode: vi.fn(), updateEdgeData: vi.fn(), setRunMeta: vi.fn(), setCeeAnalysisReady: vi.fn(),
    nodes: [], edges: [], resultsComplete: (p) => { captured.push({ report: p.report, hash: p.hash }) }, currentResultsHash: null,
  }
  applyV5State(envelope, store)
  useCanvasStore.setState({ results: { status: 'complete', progress: 100, ...captured[0] } as unknown as State['results'], hasCompletedFirstRun: true } as Partial<State>)
}

const node = (id: string, label: string, data: Record<string, unknown> = {}) => ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { label, ...data } })

function Tab() {
  const data = useResultsSectionData()
  return <AnalysisNewTabBody resultsSectionData={data} isPreRun={false} isRunning={false} isStale={false} responseHash="run_pjb3" />
}

const driverRow = (factorId: string) => {
  fireEvent.click(screen.getByTestId('analysis-new-signals-disclose'))
  return screen.getAllByTestId('analysis-new-signals-driver').find((li) => li.getAttribute('data-factor-id') === factorId)
}

beforeEach(() => {
  seedRun()
})
afterEach(cleanup)

describe('a driver the run held no value for says so', () => {
  it('⭐ the unvalued driver reads "No value yet"; a valued one does not', () => {
    useCanvasStore.setState({
      nodes: [
        node('fac_eng_capacity', 'Engineering Capacity', { observed_state: { value: 12 } }),
        node('fac_offshore', 'Offshore Engagement', { observed_state: { value: 0.4 } }),
        node('fac_talent_market', 'Local Talent Market Tightness'),
      ] as unknown as State['nodes'],
    } as Partial<State>)
    render(<Tab />)
    const talent = driverRow('fac_talent_market')
    expect(talent, 'the unvalued factor is a shown driver').toBeDefined()
    expect(within(talent!).getByTestId('analysis-new-signals-driver-no-value')).toHaveTextContent('No value yet')
    const eng = screen.getAllByTestId('analysis-new-signals-driver').find((li) => li.getAttribute('data-factor-id') === 'fac_eng_capacity')
    expect(within(eng!).queryByTestId('analysis-new-signals-driver-no-value')).toBeNull()
  })

  it('CONTROL: the model now states a value for it → no note (the run is not the only authority)', () => {
    useCanvasStore.setState({
      nodes: [
        node('fac_eng_capacity', 'Engineering Capacity', { observed_state: { value: 12 } }),
        node('fac_offshore', 'Offshore Engagement', { observed_state: { value: 0.4 } }),
        node('fac_talent_market', 'Local Talent Market Tightness', { observed_state: { value: 0.7 } }),
      ] as unknown as State['nodes'],
    } as Partial<State>)
    render(<Tab />)
    const talent = driverRow('fac_talent_market')
    expect(talent).toBeDefined()
    expect(within(talent!).queryByTestId('analysis-new-signals-driver-no-value')).toBeNull()
  })
})
