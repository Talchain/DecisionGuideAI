import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { AnalysisStateV1Schema, type RunDelta } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { CompareRunPairBody } from '../CompareRunPairBody'
import { runChangeDelta } from './__fixtures__/runChangeArtefact'

vi.mock('../../graphChanges/rowCanvasLink', () => ({
  canvasLinkOfTarget: vi.fn(() => null),
  useCanvasLight: vi.fn(() => null),
}))

const original = useCanvasStore.getState()

// J1's 0026-openai.json run_delta.input_changes row, in the producer's raw units.
const setting: NonNullable<RunDelta['input_changes']>[number] = {
  entity_kind: 'option_setting',
  entity_id: 'existing_customer_price_change',
  option_id: 'raise_prices_10',
  field: 'value',
  label_before: 'Existing-customer price change',
  label_after: 'Existing-customer price change',
  before: { raw: 10, unit: '%' },
  after: { raw: 12, unit: '%' },
  change: 'changed',
}

const link: NonNullable<RunDelta['input_changes']>[number] = {
  entity_kind: 'link',
  entity_id: 'e_price_revenue',
  field: 'strength',
  link: { from: 'existing_customer_price_change', to: 'monthly_recurring_revenue' },
  before: { raw: 'moderate' },
  after: { raw: 'strong' },
  change: 'changed',
}

// The same parsed delta builder and current-analysis seed as the v3 rows spec.
function seed(delta: RunDelta): string {
  const report = mapV5AnalysisToReport({
    type: 'analysis_result', summary: 'Options compared',
    leading_option_id: 'opt_49', win_probabilities: { opt_60: 0.44, opt_49: 0.56 },
  })
  report.producer_leader_permission = { permitted: true }
  const hash = report.model_card.response_hash
  useCanvasStore.setState({
    currentScenarioId: 'scn-1', nodes: [], edges: [],
    results: { status: 'complete', progress: 100, report, hash },
    runDelta: { delta, analysisHash: hash, scenarioId: 'scn-1' },
    analysisStateV1: AnalysisStateV1Schema.parse({
      run_state: { kind: 'complete_current', computed_at: '2026-09-30T13:09:00.000Z' },
      readiness: { status: 'ready', blockers: [] }, leader_claim: { permitted: true }, robustness: {},
      usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    }),
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match' },
    analysisFreshnessDirty: false, importPendingServerRegistration: false,
    hasCompletedFirstRun: true, ceeAnalysisReady: null,
  } as never)
  return hash
}

beforeEach(() => { useCanvasStore.setState(original, true) })
afterEach(() => { cleanup(); useCanvasStore.setState(original, true) })

describe('Compare exposes the producer input identities to the journey', () => {
  it('Row A: exposes the option setting and displays its raw percentages', () => {
    const delta = runChangeDelta({ input_changes: [setting] })
    const { container } = render(<CompareRunPairBody responseHash={seed(delta)} />)
    const rows = container.querySelectorAll('[data-testid$="-input-row"]')

    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveAttribute('data-entity-id', 'existing_customer_price_change')
    expect(rows[0]).toHaveAttribute('data-option-id', 'raise_prices_10')
    expect(rows[0]).toHaveTextContent('10%')
    expect(rows[0]).toHaveTextContent('12%')
    expect(rows[0]).not.toHaveTextContent('0.1')
  })

  it('Row B: the link and option-setting identities equal the producer identity set', () => {
    const delta = runChangeDelta({ input_changes: [link, setting] })
    const { container } = render(<CompareRunPairBody responseHash={seed(delta)} />)
    const rows = [...container.querySelectorAll('[data-testid$="-input-row"]')]

    expect(new Set(rows.map((row) => row.getAttribute('data-entity-id'))))
      .toEqual(new Set(delta.input_changes!.map((row) => row.entity_id)))
    expect(rows.find((row) => row.getAttribute('data-kind') === 'link'))
      .not.toHaveAttribute('data-option-id')
    expect(rows.find((row) => row.getAttribute('data-kind') === 'option_setting'))
      .toHaveAttribute('data-option-id', setting.option_id)
  })
})
