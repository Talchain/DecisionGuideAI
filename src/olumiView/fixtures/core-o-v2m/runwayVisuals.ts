// Synthetic payloads typed to olumi-core wip/o-v2m:src/view/schema.ts:528–540 (VisualV3).
import type { VisualV3 } from '../../visual'

export const versionVisual = {
  kind: 'visual',
  chart: 'CH-bands',
  quantity: 'runway',
  aim: 'aim_runway',
  run: 'runway-run-1',
  unit: 'month',
  label: 'Cash runway by funding plan',
  options: [
    { option: 'opt_b', letter: 'B', label: 'Raise £2m for a bigger team', text: '10–20 months, around 15', p10: 10, p50: 15, p90: 20 },
    { option: 'opt_a', letter: 'A', label: 'Raise £1.3m and run lean', text: '12 months if we run lean', p10: 12, p50: 12, p90: 12 },
  ],
  version: 7,
} satisfies VisualV3

export const proposalVisual = {
  kind: 'visual',
  chart: 'CH-bands',
  quantity: 'runway',
  run: 'runway-run-2',
  unit: 'month',
  label: 'Cash runway under the proposed funding plan',
  options: [
    { option: 'opt_a', letter: 'A', label: 'Raise £1.3m and run lean', text: '8–16 months, around 12', p10: 8, p50: 12, p90: 16 },
    { option: 'opt_b', letter: 'B', label: 'Raise £2m for a bigger team', text: 'Runway depends on the bigger team’s monthly spend.', withheld: true },
  ],
  proposal: 9,
} satisfies VisualV3
