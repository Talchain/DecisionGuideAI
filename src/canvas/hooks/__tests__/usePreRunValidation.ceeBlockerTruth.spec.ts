/**
 * CEE blocker truth — the producer's question must reach the user.
 *
 * WHY THIS EXISTS (measured, not inferred):
 * CEE's `analysis_ready.blockers[]` entries carry `message` — an actionable,
 * per-pair question naming BOTH the option and the factor. The UI declared and
 * read `reason`, a field NO producer writes, so every CEE blocker arrived with
 * `message: undefined` and the card fell back to static copy asserting the
 * factor "is not connected" — FALSE for `missing_value`, where the factor is
 * connected and only the option's effect value is absent.
 *
 * THE FIXTURES BELOW ARE WIRE-DERIVED, NOT SELF-AUTHORED. Every field name and
 * the message wording are copied verbatim from real `POST /proxy/v5/turn`
 * responses captured against deployed CEE build `f18d941` on 2026-08-29
 * (17 blocker objects across 6 drafts spanning 3 brief classes; `reason`
 * present in 0 of 17, `message` present in 17 of 17, all `missing_value`).
 * Producer of record: `olumi-assistants-service/src/schemas/analysis-ready.ts`
 * (`AnalysisBlocker`) minted at `src/cee/transforms/analysis-ready.ts`.
 *
 * A fixture the consumer authors from its own model of the producer is exactly
 * how this shipped green: the pre-existing specs all wrote `reason`.
 */
import { describe, it, expect } from 'vitest'
import { validateBeforeRun } from '../usePreRunValidation'
import type { CEEAnalysisReady } from '../../../adapters/cee/types'
import type { Node } from '@xyflow/react'

/** Verbatim from resp-A1.json, deployed CEE f18d941, 2026-08-29. */
const WIRE_MISSING_VALUE_BLOCKER = {
  option_id: '5fdf255f',
  option_label: 'Outsource to an Agency',
  factor_id: 'a2af4a80',
  factor_label: 'Agency delivery speed',
  blocker_type: 'missing_value' as const,
  message:
    'Factor "Agency delivery speed" is currently Moderate (0.5). What should option "Outsource to an Agency" set it to?',
  suggested_action: 'add_value' as const,
}

/**
 * A connection-family blocker. `missing_connection` is the ONE type for which
 * "not connected" is true, so it is the discriminating twin: a change that
 * makes the value-family honest must NOT also rewrite this one.
 */
const WIRE_MISSING_CONNECTION_BLOCKER = {
  factor_id: 'c0ffee01',
  factor_label: 'Regulatory pressure',
  blocker_type: 'missing_connection' as const,
  message: 'Factor "Regulatory pressure" has no option affecting it.',
  suggested_action: 'add_edge' as const,
}

function makeNode(id: string, kind: string, data: Record<string, unknown> = {}): Node {
  return {
    id,
    type: 'custom',
    position: { x: 0, y: 0 },
    data: { label: id, kind, category: 'controllable', ...data },
  } as Node
}

function makeReady(blockers: unknown[]): CEEAnalysisReady {
  return {
    status: 'needs_user_input',
    goal_node_id: 'goal_speed',
    options: [
      { id: '5fdf255f', label: 'Outsource to an Agency', status: 'ready', interventions: {} },
    ],
    blockers,
  } as unknown as CEEAnalysisReady
}

const NODES: Node[] = [
  makeNode('a2af4a80', 'factor', { label: 'Agency delivery speed' }),
  makeNode('c0ffee01', 'factor', { label: 'Regulatory pressure' }),
  makeNode('goal_speed', 'goal'),
]

describe('CEE blocker truth — the producer question reaches the user', () => {
  it("carries CEE's own per-pair question as the blocker message", () => {
    const result = validateBeforeRun('goal_speed', NODES, [], makeReady([WIRE_MISSING_VALUE_BLOCKER]))

    // Bind by IDENTITY (factor_id), never by a value predicate another blocker
    // could satisfy.
    const blocker = result.blockers.find(b => b.affectedIds?.[0] === 'a2af4a80')
    expect(blocker).toBeDefined()
    expect(blocker!.message).toBe(WIRE_MISSING_VALUE_BLOCKER.message)
  })

  it('does not offer the destructive retry_draft remedy for a missing option value', () => {
    const result = validateBeforeRun('goal_speed', NODES, [], makeReady([WIRE_MISSING_VALUE_BLOCKER]))

    const blocker = result.blockers.find(b => b.affectedIds?.[0] === 'a2af4a80')
    expect(blocker).toBeDefined()
    // Re-drafting discards options the user added in chat AND cannot supply a
    // value the model omitted — it is destructive and futile here.
    expect(blocker!.action?.type).not.toBe('retry_draft')
    expect(blocker!.action?.type).toBe('configure_option')
    expect(blocker!.action?.optionId).toBe('5fdf255f')
  })

  it('keeps retry_draft for a connection-family blocker (discriminating twin)', () => {
    const result = validateBeforeRun(
      'goal_speed',
      NODES,
      [],
      makeReady([WIRE_MISSING_CONNECTION_BLOCKER]),
    )

    const blocker = result.blockers.find(b => b.affectedIds?.[0] === 'c0ffee01')
    expect(blocker).toBeDefined()
    expect(blocker!.message).toBe(WIRE_MISSING_CONNECTION_BLOCKER.message)
    expect(blocker!.action?.type).toBe('retry_draft')
  })
})
