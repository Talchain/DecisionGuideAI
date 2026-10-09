import { RunDeltaInputChangeSchema, type RunDeltaInputChange } from '@talchain/schemas/boundary'
import type { Intervention } from '../../../domain/nodes'
import { runChangeDelta } from './runChangeArtefact'

// Wire bytes copied from e2e/core/journey/fixtures/j1/llm/0026-openai.json:
// request.input[4].content[0].text -> canonical_state.run_delta.input_changes[0].
// The two link rows below are separate controls for truncation and sizing/strength folding.
export const C1_OPTION_ROW: RunDeltaInputChange = RunDeltaInputChangeSchema.parse({"entity_kind":"option_setting","entity_id":"existing_customer_price_change","option_id":"raise_prices_10","field":"value","label_before":"Existing-customer price change","label_after":"Existing-customer price change","before":{"raw":10,"unit":"%"},"after":{"raw":12,"unit":"%"},"change":"changed"})

// Canvas intervention values deliberately differ from the wire raw/unit frame; Compare must read the wire.
// Provenance belongs to the stored intervention, not to the delta's closed row type.
export const C1_INTERVENTIONS: { before: Intervention; after: Intervention } = {
  before: { value: 0.10, source: 'user_specified' },
  after: { value: 0.12, source: 'user_specified' },
}

// Endpoint ids/times copied from the same 0026-openai.json canonical_state.run_delta.
export const C1_ENDPOINTS = {
  "prior": {
    "run_id": "4c3bba94e3f301fc9285d80feb0d4163adabaaa357c23abd6aa9d634764d6fc7",
    "computed_at": "2026-10-09T02:29:08.529Z"
  },
  "current": {
    "run_id": "760492745ed6844007f07299ffcfc41f824278be5694bc90b6d08afdf0c41b48",
    "computed_at": "2026-10-09T02:29:48.437Z"
  }
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
