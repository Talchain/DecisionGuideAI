import { RunDeltaSchema, type RunDelta } from '@talchain/schemas/boundary'

export const RUN_CHANGE_LABELS = new Map([
  ['opt_60', 'Raise to £60'],
  ['opt_49', 'Keep £49'],
  ['fac_price', 'Pro price'],
])

/** Real contract parsing keeps the positive control on the producer's shape. */
export function runChangeDelta(overrides: Partial<RunDelta> = {}): RunDelta {
  return RunDeltaSchema.parse({
    attribution_case: 'C2_unpaired',
    pair_provenance: { seed_equal: false, hash_equal: false, builds_equal: 'equal', n_equal: true },
    leader: { changed: false, noise_verdict: 'not_noise_qualified' },
    win_probabilities: [
      { option_id: 'opt_60', prior: 0.41, current: 0.44, noise_verdict: 'signal' },
      { option_id: 'opt_49', prior: 0.59, current: 0.56, noise_verdict: 'within_noise' },
    ],
    flip_thresholds: [],
    endpoints: {
      prior: { run_id: 'run-a', computed_at: '2026-09-30T13:02:00.000Z' },
      current: { run_id: 'run-b', computed_at: '2026-09-30T13:09:00.000Z' },
    },
    input_coverage: 'complete',
    input_changes: [{
      entity_kind: 'option_setting', entity_id: 'fac_price', option_id: 'opt_60', field: 'value',
      label_before: 'Pro price', label_after: 'Pro price',
      before: { raw: 59, unit: '£' }, after: { raw: 60, unit: '£' }, change: 'changed',
    }],
    ...overrides,
  })
}
