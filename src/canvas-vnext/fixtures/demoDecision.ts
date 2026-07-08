// Demo decision map — FIXTURE DATA, never analysis output.
//
// Fence rules (machine-enforced by __tests__/importIsolation.spec.ts):
//   - Only the vNext demo-load path (CanvasVNext's empty-state button) and
//     this module's own tests may import from fixtures/.
//   - Fixture nodes/edges are rendered from vNext-LOCAL state and are NEVER
//     written into useCanvasStore.
//   - The fixture VM carries provenance 'fixture', which forces the
//     persistent "Example data — not analysis output" pill.
//
// The VM is built through the SAME pure builder as live data so the demo
// exercises the real derivation path (status banding, fragility, why-lines).

import type { Node, Edge } from '@xyflow/react'
import { buildGraphExperienceVM } from '../vm/buildGraphExperienceVM'
import type { GraphExperienceVM } from '../vm/types'

export const demoNodes: Node[] = [
  { id: 'demo-goal', type: 'goal', position: { x: 520, y: 40 }, data: { label: 'Grow annual revenue' } },
  { id: 'demo-decision', type: 'decision', position: { x: 60, y: 220 }, data: { label: 'How should we grow?' } },
  { id: 'demo-opt-shop', type: 'option', position: { x: 320, y: 100 }, data: { label: 'Open a second location' } },
  { id: 'demo-opt-online', type: 'option', position: { x: 320, y: 240 }, data: { label: 'Launch an online store' } },
  { id: 'demo-opt-wait', type: 'option', position: { x: 320, y: 380 }, data: { label: 'Keep things as they are', is_baseline: true } },
  { id: 'demo-factor-demand', type: 'factor', position: { x: 620, y: 220 }, data: { label: 'Customer demand' } },
  { id: 'demo-factor-costs', type: 'factor', position: { x: 620, y: 360 }, data: { label: 'Setup costs' } },
  { id: 'demo-risk-staff', type: 'risk', position: { x: 880, y: 300 }, data: { label: 'Key staff overstretched' } },
]

export const demoEdges: Edge[] = [
  // Structural wiring (decision → options): neutral thin lines, no claims.
  { id: 'demo-e-d-shop', source: 'demo-decision', target: 'demo-opt-shop', data: {} },
  { id: 'demo-e-d-online', source: 'demo-decision', target: 'demo-opt-online', data: {} },
  { id: 'demo-e-d-wait', source: 'demo-decision', target: 'demo-opt-wait', data: {} },
  // Causal edges with varied strength / direction / certainty.
  { id: 'demo-e-shop-goal', source: 'demo-opt-shop', target: 'demo-goal', data: { weight: 0.8, direction: 'positive', beliefExists: 0.85 } },
  { id: 'demo-e-online-goal', source: 'demo-opt-online', target: 'demo-goal', data: { weight: 0.5, direction: 'positive', beliefExists: 0.6 } },
  { id: 'demo-e-wait-goal', source: 'demo-opt-wait', target: 'demo-goal', data: { weight: 0.1, direction: 'positive', beliefExists: 0.9 } },
  {
    id: 'demo-e-demand-goal',
    source: 'demo-factor-demand',
    target: 'demo-goal',
    data: {
      weight: 0.6,
      direction: 'positive',
      beliefExists: 0.55,
      causal_claims: [
        { claim_type: 'evidence', statement: 'Footfall surveys show demand rising 12% year on year.', source: 'Local chamber of commerce, 2025' },
      ],
    },
  },
  { id: 'demo-e-costs-goal', source: 'demo-factor-costs', target: 'demo-goal', data: { weight: 0.45, direction: 'negative', beliefExists: 0.8 } },
  { id: 'demo-e-staff-goal', source: 'demo-risk-staff', target: 'demo-goal', data: { weight: 0.35, direction: 'negative', beliefExists: 0.5 } },
]

// Hand-written EXAMPLE report — plausible shapes only, never produced by any
// engine. Runs through buildGraphExperienceVM so the demo shows a leading
// option, a close second, a behind reason, and a fragile edge.
const demoReport: Record<string, any> = {
  option_probabilities: {
    'demo-opt-shop': { win_probability: 0.58, goal_probability: 0.64, confidence: 0.8 },
    'demo-opt-online': { win_probability: 0.34, goal_probability: 0.41, confidence: 0.75 },
    'demo-opt-wait': { win_probability: 0.08, goal_probability: 0.12, confidence: 0.9 },
  },
  robustness: {
    recommended_option_id: 'demo-opt-shop',
    fragile_edges: [
      { edge_id: 'demo-e-staff-goal', from_id: 'demo-risk-staff', to_id: 'demo-goal', switch_probability: 0.42 },
    ],
    robust_edges: [],
  },
  factor_sensitivity: [
    { factor_id: 'demo-factor-demand', label: 'Customer demand', importance_score: 0.7 },
    { factor_id: 'demo-factor-costs', label: 'Setup costs', importance_score: 0.4 },
  ],
}

const demoCeeAnalysisReady = {
  options: [
    { id: 'demo-opt-shop', interventions: { 'demo-factor-demand': { value: 0.8 } } },
    { id: 'demo-opt-online', interventions: { 'demo-factor-demand': { value: 0.5 } } },
    { id: 'demo-opt-wait', interventions: {} },
  ],
} as { options: { id: string; interventions?: Record<string, unknown> }[] }

export function buildDemoVM(): GraphExperienceVM {
  return buildGraphExperienceVM({
    provenance: 'fixture',
    nodes: demoNodes,
    edges: demoEdges,
    report: demoReport,
    ceeAnalysisReady: demoCeeAnalysisReady,
    displayState: 'complete',
    goalThreshold: null,
    prefillChatAvailable: false,
  })
}
