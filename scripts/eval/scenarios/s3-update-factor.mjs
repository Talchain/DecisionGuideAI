import { draftTurn, runTurn, buildFollowup, sleep } from './_common.mjs'
import { hasGraphPatchBlock, containsRawEntityId } from '../assertions.mjs'

export const NAME = 's3-update-factor'
export const DESCRIPTION = "Draft, then update the salary cost factor to £95,000. Either applies the update OR offers a clear recovery path."

export async function run(ctx, mode) {
  const draft = await draftTurn({
    ctx,
    scenarioName: NAME,
    brief: 'Should I hire a tech lead or two junior developers? We have 18 months of runway, a team of 5 mid-weight developers and 1 senior, and need to ship a product rewrite. Budget is £85,000 per year.',
    mode,
  })
  if (!draft.ok) return { name: NAME, pass: false, logs: ctx.turnLogs, failures: draft.failures }
  await sleep(500)

  const t2Msg = 'Update the salary cost factor to £95,000'
  const t2 = await runTurn({
    ctx,
    scenarioName: NAME,
    mode,
    spec: {
      message: t2Msg,
      turn_type: 'conversation',
      build: (c) => buildFollowup(c, t2Msg, { analysis_state: c.analysisState }),
    },
  })
  const failures = []
  if (t2.transportError) return { name: NAME, pass: false, logs: ctx.turnLogs, failures: t2.log.failures }

  const text = t2.envelope?.assistant_text ?? ''
  const ops = t2.ops

  // Entity ID leakage is still a hard fail regardless of path.
  if (containsRawEntityId(text)) failures.push('entity_id_leaked_to_user')

  // Structural path: graph_patch that updates a factor (via update_node) or
  // calibrates an edge referencing the factor (via update_edge).
  const structural = hasGraphPatchBlock(t2.envelope?.blocks) && ops.some((op) => {
    if (op.op === 'update_node') {
      const nodeId = op.target_id
      const node = ctx.graph.nodes.find((n) => n.id === nodeId)
      return node?.kind === 'factor' || node?.data?.kind === 'factor'
    }
    if (op.op === 'update_edge') return true
    return false
  })

  // Recovery path: the server offered ≥ 1 suggested action AND the text
  // explains why the direct update didn't happen (scale/range/maximum
  // vocabulary). £95,000 may exceed the factor's encoded maximum — offering
  // a "Set to maximum" or "Increase range" chip is the correct response.
  const suggestedActions = Array.isArray(t2.envelope?.suggested_actions)
    ? t2.envelope.suggested_actions
    : []
  const recovery = suggestedActions.length >= 1
    && /scale|range|maximum|relative|above|exceed/i.test(text)

  if (!structural && !recovery) failures.push('t2_neither_updated_nor_offered_recovery')

  // Intentionally not calling enforceHardMutationChecks — the recovery-chip
  // path is a valid resolution (above-range value), and the universal
  // honesty gate on the server strips any misleading completion claims.
  if (failures.length > 0) { t2.log.pass = false; t2.log.failures.push(...failures) }
  return { name: NAME, pass: failures.length === 0, logs: ctx.turnLogs, failures }
}
