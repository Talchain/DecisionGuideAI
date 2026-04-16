import { draftTurn, runTurn, buildFollowup, sleep } from './_common.mjs'
import { chipsWithForbiddenActionType } from '../assertions.mjs'

export const NAME = 's7-chip-starvation'
export const DESCRIPTION = 'Draft → two calibrations → conversational question. T4 must not show misleading chips.'

// action_type values we treat as "unavailable" / misleading if surfaced as chips.
const FORBIDDEN_ACTION_TYPES = ['unavailable', '_disabled', 'disabled', 'placeholder']

export async function run(ctx, mode) {
  const draft = await draftTurn({
    ctx,
    scenarioName: NAME,
    brief: 'Should I hire a tech lead or two junior developers? We have 18 months of runway, a team of 5 mid-weight developers and 1 senior, and need to ship a product rewrite. Budget is £85,000 per year.',
    mode,
  })
  if (!draft.ok) return { name: NAME, pass: false, logs: ctx.turnLogs, failures: draft.failures }
  await sleep(500)

  // T2 — calibration
  const t2Msg = 'Set the salary cost factor to £90,000'
  const t2 = await runTurn({
    ctx, scenarioName: NAME, mode,
    spec: {
      message: t2Msg,
      turn_type: 'conversation',
      build: (c) => buildFollowup(c, t2Msg, { analysis_state: c.analysisState }),
    },
  })
  if (t2.transportError) return { name: NAME, pass: false, logs: ctx.turnLogs, failures: t2.log.failures }
  await sleep(500)

  // T3 — another calibration
  const t3Msg = 'Set the team productivity factor to high'
  const t3 = await runTurn({
    ctx, scenarioName: NAME, mode,
    spec: {
      message: t3Msg,
      turn_type: 'conversation',
      build: (c) => buildFollowup(c, t3Msg, { analysis_state: c.analysisState }),
    },
  })
  if (t3.transportError) return { name: NAME, pass: false, logs: ctx.turnLogs, failures: t3.log.failures }
  await sleep(500)

  // T4 — conversational question, the actual test turn
  const t4Msg = 'What should I think about first here?'
  const t4 = await runTurn({
    ctx, scenarioName: NAME, mode,
    spec: {
      message: t4Msg,
      turn_type: 'conversation',
      build: (c) => buildFollowup(c, t4Msg, { analysis_state: c.analysisState }),
    },
  })
  const failures = []
  if (t4.transportError) return { name: NAME, pass: false, logs: ctx.turnLogs, failures: t4.log.failures }

  const chips = t4.envelope?.suggested_actions ?? []
  const text = t4.envelope?.assistant_text ?? ''

  const badChips = chipsWithForbiddenActionType(chips, FORBIDDEN_ACTION_TYPES)
  if (badChips.length > 0) failures.push(`forbidden_chips:${badChips.map((c) => c.action_type).join(',')}`)

  // Recovery gate: either at least one legitimate chip, OR assistant text explicitly
  // acknowledges no further executable actions. Silent empty-chip state fails.
  if (chips.length === 0) {
    const acknowledges = /no (further|more) (actions|next steps|suggestions)|nothing (more|else) to/i.test(text)
    if (!acknowledges) failures.push('no_chips_and_no_recovery_message')
  }

  // Mutation-language without a backing block would be misleading here too.
  if (t4.log.flags.action_language_without_block) failures.push('action_language_without_block')

  if (failures.length > 0) { t4.log.pass = false; t4.log.failures.push(...failures) }
  return { name: NAME, pass: failures.length === 0, logs: ctx.turnLogs, failures }
}
