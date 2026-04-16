import { draftTurn, runTurn, buildFollowup, sleep, enforceHardMutationChecks } from './_common.mjs'
import { hasGraphPatchBlock, isStructuralPatch, patchAddedNodeKind, patchEdgeCalibrationOnly } from '../assertions.mjs'

export const NAME = 's1-add-option'
export const DESCRIPTION = 'Draft, then add a third option — must route to structural edit, not calibration.'

export async function run(ctx, mode) {
  // T1 — draft
  const draft = await draftTurn({
    ctx,
    scenarioName: NAME,
    brief: 'Should I raise £250k or £750k for my seed-stage SaaS startup? We have 8 months of runway, £18k MRR growing 10% month-on-month, a team of 4, and need to reach Series A readiness (target £50k MRR) within 12 months. Primary goal: maximise probability of raising Series A at a strong valuation.',
    mode,
  })
  if (!draft.ok) return { name: NAME, pass: false, logs: ctx.turnLogs, failures: draft.failures }
  await sleep(500)

  // T2 — add option
  const t2Msg = 'Add a third option: bootstrap without raising any funding'
  const t2 = await runTurn({
    ctx,
    scenarioName: NAME,
    mode,
    spec: {
      message: t2Msg,
      turn_type: 'conversation',
      build: (c) => buildFollowup(c, t2Msg, {
        analysis_state: c.analysisState,
      }),
    },
  })
  const failures = []
  if (t2.transportError) return scenarioResult(false, ctx, t2.log.failures)

  const ops = t2.ops
  if (!hasGraphPatchBlock(t2.envelope?.blocks)) failures.push('t2_missing_graph_patch')
  if (!isStructuralPatch(ops)) failures.push('t2_not_structural')
  if (!patchAddedNodeKind(ops, 'option')) failures.push('t2_no_option_added')
  const calibrationOnly = ops.length > 0 && ops.every(patchEdgeCalibrationOnly)
  if (calibrationOnly) failures.push('t2_calibration_only')

  enforceHardMutationChecks(t2.log, failures)

  if (failures.length > 0) { t2.log.pass = false; t2.log.failures.push(...failures) }
  return scenarioResult(failures.length === 0, ctx, failures)
}

function scenarioResult(pass, ctx, failures) {
  return { name: NAME, pass, logs: ctx.turnLogs, failures }
}
