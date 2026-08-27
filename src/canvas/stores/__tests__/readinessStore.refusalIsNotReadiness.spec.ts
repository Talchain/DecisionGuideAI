/**
 * A REFUSAL MUST NOT BE SENT TO THE READINESS AUTHORITY AS A READINESS ASSESSMENT.
 *
 * `buildReadinessPayload` attaches `analysis_ready` to the `/graph-readiness`
 * request. Its guard was `ceeAnalysisReady?.options?.length` — a SHAPE check.
 *
 * ⚠ WHY A SHAPE CHECK CANNOT WORK HERE. CEE's identity-preserving refusal
 * (ARM B, CEE #1128) carries a NON-EMPTY `options` array on purpose, so the
 * refusal can name the model it refused about. `options.length` is therefore
 * populated on exactly the payload that must not be sent — the guard is
 * satisfied by the thing it needed to exclude.
 *
 * These cases are TWINS: identical everywhere except `status`. A guard keyed on
 * anything but the status cannot separate them, which is what makes this a test
 * of the discriminator rather than of the outcome.
 */
import { describe, it, expect } from 'vitest'
import type { Node, Edge } from '@xyflow/react'
import { buildReadinessPayload } from '../readinessStore'

const nodes = [
  { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal', kind: 'goal' } },
  { id: 'opt-a', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A', kind: 'option' } },
] as unknown as Node[]
const edges = [] as unknown as Edge[]

const OPTIONS = [{ id: 'opt-a', label: 'Option A', interventions: {} }]

function build(status: string) {
  return buildReadinessPayload({
    nodes,
    edges,
    ceeAnalysisReady: { status, goal_node_id: 'goal-1', options: OPTIONS } as never,
    currentBriefText: null,
    currentScenarioId: null,
  })
}

describe('buildReadinessPayload — a refusal is not a readiness assessment', () => {
  it('PRECONDITION: the twins differ ONLY by status, and both populate the old shape guard', () => {
    // Pins the discriminating power of the fixtures themselves (trap 13b): if
    // these stopped being twins, the assertions below would pass for the wrong
    // reason — a shape difference rather than the status.
    expect(OPTIONS.length).toBeGreaterThan(0)
    const ready = JSON.parse(build('ready'))
    const blocked = JSON.parse(build('blocked'))
    expect(ready.graph).toEqual(blocked.graph)
  })

  it('OMITS analysis_ready when CEE refused, even though options are populated', () => {
    const payload = JSON.parse(build('blocked'))
    expect(payload.analysis_ready).toBeUndefined()
  })

  it('STILL SENDS analysis_ready on a genuine readiness verdict', () => {
    const payload = JSON.parse(build('ready'))
    expect(payload.analysis_ready).toBeDefined()
    expect(payload.analysis_ready.options).toHaveLength(1)
  })

  it('sends every non-blocked producer status — one value is withheld, not a category', () => {
    for (const status of ['ready', 'needs_encoding', 'needs_user_mapping', 'needs_user_input']) {
      const payload = JSON.parse(build(status))
      expect(payload.analysis_ready, `status=${status}`).toBeDefined()
    }
  })
})
