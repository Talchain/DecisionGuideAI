// @vitest-environment jsdom
/**
 * R1 READER FIRST — a turn that states a limit or goal as a CHANGE FROM TODAY must reach the UI.
 *
 * `@talchain/schemas` 0.61.0 appends `change_abs` / `change_rel` to `GoalThresholdFrame` (one shared instance:
 * `DraftGoalConstraintSchema.value_frame` and `NodeV3Schema.goal_threshold_frame`) and adds the optional
 * `NodeV3Schema.quantity_frame`. The UI parses every turn strictly (`OlumiResponseSchema`), and on 0.60.0 a
 * `draft_graph` block carrying `value_frame: 'change_rel'` failed the WHOLE turn — `parse_error`, "body did not
 * match OlumiResponse schema" — measured on staging 9253f60c (#72 5879900931). CEE R1 S4 (#2261) stamps these
 * values, so this pin must serve first.
 *
 * Bodies are built from the schemas package's own maximal fixtures, so the shape is the contract's, not ours.
 */
import { describe, it, expect } from 'vitest'
import {
  maximalDraftGraphBlock,
  maximalDraftGoalConstraint,
} from '@talchain/schemas/fixtures'
import { parseV5Response } from '../responseParser'

type Block = typeof maximalDraftGraphBlock

function turn(block: Block | Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({
      response_version: 2,
      assistant_text: 'drafted',
      blocks: [block],
      suggested_actions: [],
      insights: [],
      stage_indicator: 'frame',
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

function withLimitFrame(frame: string, value: number): Record<string, unknown> {
  return {
    ...maximalDraftGraphBlock,
    goal_constraints: [{ ...maximalDraftGoalConstraint, value, value_frame: frame }],
  }
}

function withGoalNode(patch: Record<string, unknown>): Record<string, unknown> {
  const goalId = maximalDraftGraphBlock.goal_node_id
  return {
    ...maximalDraftGraphBlock,
    nodes: maximalDraftGraphBlock.nodes.map((n) => (n.id === goalId ? { ...n, ...patch } : n)),
  }
}

describe('a limit stated as a change from today parses (0.61.0 value_frame)', () => {
  it.each([
    ['level (control, parsed on 0.60.0 too)', 'level', 120],
    ['change_rel — "cut by 20%"', 'change_rel', -0.2],
    ['change_abs — "no more than 2 points higher"', 'change_abs', 2],
  ])('%s → a response, with the frame carried through', async (_case, frame, value) => {
    const out = await parseV5Response(turn(withLimitFrame(frame, value)))
    expect(out.kind).toBe('response')
    if (out.kind !== 'response') return
    const block = out.response.blocks.find((b) => b.type === 'draft_graph') as Record<string, unknown> | undefined
    const limits = (block?.goal_constraints ?? []) as Array<Record<string, unknown>>
    expect(limits).toHaveLength(1)
    expect(limits[0].value_frame).toBe(frame)
    expect(limits[0].value).toBe(value)
  })
})

/**
 * REGRESSION rows, not RED rows: these parsed on 0.60.0 as well, because the `draft_graph` block types its nodes as
 * `z.array(z.unknown())` — node fields are never validated on this path (measured; #72 5879932911). They pin that the
 * re-vendor keeps it that way.
 */
describe('a goal stated as a change from today parses (0.61.0 goal_threshold_frame, quantity_frame)', () => {
  it.each([
    ['goal_threshold_frame change_rel', { goal_threshold_frame: 'change_rel' }],
    ['goal_threshold_frame change_abs', { goal_threshold_frame: 'change_abs' }],
    ['quantity_frame change', { quantity_frame: 'change' }],
  ])('%s → a response', async (_case, patch) => {
    const out = await parseV5Response(turn(withGoalNode(patch)))
    expect(out.kind).toBe('response')
  })

  it('an unknown frame is still refused (the enum grew; it did not open)', async () => {
    const out = await parseV5Response(turn(withLimitFrame('change_pct', 0.1)))
    expect(out.kind).toBe('parse_error')
  })
})
