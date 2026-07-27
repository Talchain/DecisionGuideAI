/**
 * Shared fixture for the intervention-finiteness guards.
 *
 * `VALID_CONTROL_*` is a FULLY VALID graph + option set: every intervention
 * value is a finite number, in both the bare-number and the wrapper-object
 * shape. It exists to hold the positive control honest — the guards must be
 * provably inert on well-formed input, byte-for-byte.
 */

import type { Node, Edge } from '@xyflow/react'
import type { UIOption } from '../../../../types/options'

export const VALID_CONTROL_GOAL = 'goal_revenue'

export const VALID_CONTROL_NODES: Node[] = [
  {
    id: 'goal_revenue',
    position: { x: 0, y: 0 },
    data: { kind: 'goal', label: 'Revenue', observedState: { value: 0.5, std: 0.1 } },
  },
  {
    id: 'factor_price',
    position: { x: 0, y: 100 },
    data: { kind: 'factor', label: 'Price', observedState: { value: 0.4, std: 0.05 } },
  },
  {
    id: 'factor_volume',
    position: { x: 0, y: 200 },
    data: { kind: 'factor', label: 'Volume', observedState: { value: 0.6, std: 0.08 } },
  },
  {
    id: 'opt_hold',
    position: { x: 200, y: 0 },
    data: { kind: 'option', label: 'Hold price' },
  },
  {
    id: 'opt_cut',
    position: { x: 200, y: 100 },
    data: { kind: 'option', label: 'Cut price' },
  },
]

export const VALID_CONTROL_EDGES: Edge[] = [
  {
    id: 'e1',
    source: 'factor_price',
    target: 'goal_revenue',
    data: { weight: 0.7, direction: 'positive', beliefExists: 0.9, strengthStd: 0.1 },
  },
  {
    id: 'e2',
    source: 'factor_volume',
    target: 'goal_revenue',
    data: { weight: 0.5, direction: 'positive', beliefExists: 0.8, strengthStd: 0.05 },
  },
]

/**
 * Both intervention shapes the wire path must carry unchanged: a bare number
 * and a `{ value, ... }` wrapper. Includes `0`, the value most likely to be
 * lost by a falsiness bug in a guard.
 */
export const VALID_CONTROL_OPTIONS: UIOption[] = [
  {
    id: 'opt_hold',
    label: 'Hold price',
    status: 'ready',
    interventions: {
      factor_price: {
        value: 0.4,
        source: 'user_specified',
        target_match: { node_id: 'factor_price', match_type: 'exact_id', confidence: 'high' },
      },
      factor_volume: { value: 0, source: 'user_specified' },
    },
    source: 'legacy_node',
  },
  {
    id: 'opt_cut',
    label: 'Cut price',
    status: 'ready',
    interventions: {
      factor_price: { value: 0.2, source: 'brief_extraction' },
      factor_volume: { value: -1.5, source: 'brief_extraction' },
    },
    source: 'legacy_node',
  },
]
