/**
 * Fixture: `ContestedEdgeCard` inputs.
 *
 * ONE partial-over-defaults builder for the contested-edge card's edge, nodes
 * and `ValidationMetadata`, shared by every suite that renders it. It was
 * previously a private copy inside `ContestedEdgeCard.spec.tsx`; ROADMAP 1.68
 * added telemetry suites that needed the same shape, and a second copy is the
 * hand-maintained mirror (trap 12) in fixture form — the next field added to
 * `ValidationMetadata` would be a compile error in one spec and a silent wrong
 * default in the other. Same reasoning as `__fixtures__/v7EvidenceModel.ts`.
 *
 * The node labels are deliberately parameterisable: the PII suite drives them
 * with a canary, and an absence assertion is only worth running if the fixture
 * can be proven to have put the value on the surface first.
 */

import type { Edge, Node } from '@xyflow/react'
import type { ValidationMetadata } from '../canvas/domain/validation'

export function makeContestedNode(id: string, label: string): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label } }
}

export function makeContestedValidation(
  overrides: Partial<ValidationMetadata> = {},
): ValidationMetadata {
  return {
    status: 'contested',
    contested_reasons: ['strength_band_change'],
    pass1: { strength_mean: 0.6, strength_std: 0.08, exists_probability: 0.7 },
    pass2: {
      strength_mean: 0.35,
      strength_std: 0.12,
      exists_probability: 0.7,
      reasoning: 'Typical B2B ROI shows moderate conversion effects',
      basis: 'domain_prior',
      needs_user_input: false,
    },
    max_divergence: 0.5,
    distance_to_goal: 1,
    evoi_rank: null,
    evoi_impact: null,
    was_shown: false,
    user_action: 'pending',
    resolved_value: null,
    resolved_by: 'default',
    ...overrides,
  } as ValidationMetadata
}

export function makeContestedEdge(
  id: string,
  source: string,
  target: string,
  validation?: ValidationMetadata,
): Edge {
  return {
    id,
    source,
    target,
    data: {
      weight: 0.6,
      direction: 'positive',
      beliefExists: 0.7,
      provenance: 'assumption',
      ...(validation ? { validation } : {}),
    },
  }
}
