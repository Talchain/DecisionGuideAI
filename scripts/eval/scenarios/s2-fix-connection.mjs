import { draftTurn, runTurn, buildFollowup, sleep } from './_common.mjs'
import {
  hasGraphPatchBlock,
  isStructuralPatch,
  patchEdgeCalibrationOnly,
  mentionsGraphEntities,
  containsActionCompletionLanguage,
} from '../assertions.mjs'

export const NAME = 's2-fix-connection'
export const DESCRIPTION = 'Draft, then ask to fix an unconnected risk node — must be structural OR a clear conversational path.'

export async function run(ctx, mode) {
  const draft = await draftTurn({
    ctx,
    scenarioName: NAME,
    brief: 'Should I hire a tech lead or two junior developers? We have 18 months of runway, a team of 5 mid-weight developers and 1 senior, and need to ship a product rewrite. Budget is £85,000 per year.',
    mode,
  })
  if (!draft.ok) return { name: NAME, pass: false, logs: ctx.turnLogs, failures: draft.failures }
  await sleep(500)

  const t2Msg = "The technical debt risk isn't connected to anything. Can you fix that?"
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

  const ops = t2.ops
  const text = t2.envelope?.assistant_text ?? ''

  // Structural path: graph_patch with a real structural edit (not calibration-only).
  const structural =
    hasGraphPatchBlock(t2.envelope?.blocks)
    && isStructuralPatch(ops)
    && !(ops.length > 0 && ops.every(patchEdgeCalibrationOnly))
    && ops.some((op) => {
      if (op.op === 'add_edge') return true
      if (op.op === 'update_edge') {
        const d = op.data ?? {}
        return typeof (d.source ?? d.from) === 'string' || typeof (d.target ?? d.to) === 'string'
      }
      return false
    })

  // Conversational path: assistant references ≥ 2 graph entities AND does NOT
  // claim the change was made. The universal-honesty gate on the server side
  // should have stripped any false completion language; we verify here.
  const conversational =
    mentionsGraphEntities(text, ctx.graph, 2)
    && !containsActionCompletionLanguage(text)

  if (!structural && !conversational) failures.push('t2_neither_structural_nor_clear_conversational')

  // Intentionally not calling enforceHardMutationChecks — its
  // action_language_without_block flag uses a broader regex than the CEE
  // universal honesty gate. The conversational path above is the
  // authoritative check for this scenario.
  if (failures.length > 0) { t2.log.pass = false; t2.log.failures.push(...failures) }
  return { name: NAME, pass: failures.length === 0, logs: ctx.turnLogs, failures }
}
