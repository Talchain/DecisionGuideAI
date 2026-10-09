import { RunDeltaInputChangeSchema, type RunDeltaInputChange } from '@talchain/schemas/boundary'
import type { Intervention } from '../../../domain/nodes'
import { runChangeDelta } from './runChangeArtefact'

// typed contract shape, not wire bytes; wire proof = J1 J7 (advisory → hard row by P02) on this PR's CI
export const C1_OPTION_ROW: RunDeltaInputChange = RunDeltaInputChangeSchema.parse({
  entity_kind: 'option_setting', entity_id: 'existing_customer_price_change', option_id: 'raise_prices_10',
  field: 'value', label_before: 'Existing-customer price change', label_after: 'Existing-customer price change',
  before: { raw: 0.10 }, after: { raw: 0.12 }, change: 'changed',
})

// Provenance belongs to the stored intervention, not to the delta's closed row type.
export const C1_INTERVENTIONS: { before: Intervention; after: Intervention } = {
  before: { value: 0.10, source: 'user_specified' },
  after: { value: 0.12, source: 'user_specified' },
}

// Endpoint ids/times are copied from J1-2719 journey/evidence/J6-rerun.json; the rows are typed fixtures.
export const C1_ENDPOINTS = {
  prior: { run_id: '68491b910172ee5387ce43355f589417f2bdc1c0c2efd50d140f44f9718f9de2', computed_at: '2026-10-09T04:40:23.177Z' },
  current: { run_id: 'a2bd8aed0902dbd98534d5edcc98e906642fa8dbd93c57e56e8c31e16b6b58c6', computed_at: '2026-10-09T04:41:05.828Z' },
}

export const C1_LINK_ROWS: RunDeltaInputChange[] = [
  { entity_kind: 'link', entity_id: 'price_to_revenue', link: { from: 'existing_customer_price_change', to: 'revenue' },
    field: 'sizing', before: { raw: 'olumi_estimate' }, after: { raw: 'user' }, change: 'changed' },
  { entity_kind: 'link', entity_id: 'price_to_revenue', link: { from: 'existing_customer_price_change', to: 'revenue' },
    field: 'strength', before: { raw: 'slight' }, after: { raw: 'moderate' }, change: 'changed' },
]

export function c1Delta(rows: RunDeltaInputChange[] = [...C1_LINK_ROWS, C1_OPTION_ROW]) {
  return runChangeDelta({ endpoints: C1_ENDPOINTS, input_changes: rows })
}
