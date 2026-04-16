import { draftTurn, runTurn, buildFollowup, sleep } from './_common.mjs'
import { hasHtmlOrCodeFence } from '../assertions.mjs'

export const NAME = 's4-pros-cons'
export const DESCRIPTION = 'Draft, then ask for pros/cons. Must be a substantive response with at least two pro/con terms.'

const PROS_CONS_VOCAB = [
  /advantage/i, /disadvantage/i, /trade.?off/i, /stronger/i, /weaker/i,
  /risk/i, /benefit/i, /upside/i, /downside/i, /\bpro\b/i, /\bcon\b/i,
  /compare/i, /favou?r/i,
]

export async function run(ctx, mode) {
  const draft = await draftTurn({
    ctx,
    scenarioName: NAME,
    brief: 'Should I raise £250k or £750k for my seed-stage SaaS startup? We have 8 months of runway, £18k MRR growing 10% month-on-month, a team of 4, and need to reach Series A readiness (target £50k MRR) within 12 months. Primary goal: maximise probability of raising Series A at a strong valuation.',
    mode,
  })
  if (!draft.ok) return { name: NAME, pass: false, logs: ctx.turnLogs, failures: draft.failures }
  await sleep(500)

  const t2Msg = 'Can you help me work out the pros and cons?'
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
  if (!text.trim()) failures.push('empty_assistant_text')
  if (hasHtmlOrCodeFence(text)) failures.push('contains_html_or_code')
  if (text.length >= 4000) failures.push(`too_long:${text.length}`)
  if (text.length <= 200) failures.push(`too_short:${text.length}`)
  const vocabHits = PROS_CONS_VOCAB.filter((r) => r.test(text)).length
  if (vocabHits < 2) failures.push(`insufficient_pros_cons_vocab:${vocabHits}`)

  if (failures.length > 0) { t2.log.pass = false; t2.log.failures.push(...failures) }
  return { name: NAME, pass: failures.length === 0, logs: ctx.turnLogs, failures }
}
