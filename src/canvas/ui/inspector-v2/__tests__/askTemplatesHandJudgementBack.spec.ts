// The judgement guards now cover the question registry that actually reaches the wire.
// 7 Oct permits explanation and comparison, while forbidding an oracle's verdict.
import { describe, it, expect } from 'vitest'
import { QUESTIONS, type QuestionContext } from '../../../conversation/askAiQuestions'
const ORACLE_OPENING = /^(Tell me|Explain|How can we|What are the key|How important)/i
const RANKING_LEXICON = /\branks?\b|\branking\b|\bbetter than\b|\b(best|winner|recommend|leads|ahead|beats)\b/i
const ORACLE_REQUEST_ANYWHERE = /\b(?:tell|show|give)\s+me\b/i
// The Q-table hands judgement back through open assumptions, evidence, alternatives,
// limits and hypothetical changes as well as first-person agency. No verdict qualifies.
const HAND_JUDGEMENT_BACK = /\b(?:mine|my|me|I)\b|assum|depend|evidence|what would|what could|what happens|what explains|what is missing|what is still open|what else|what other|what most|what should|what does|what can|what early|what factors|what risks|still need|missing before|how sure|how likely|how much|how might|is .* (?:right|real|current|starting)|which reasoning biases|which matter|how do the options|where else|how do decisions|outcome we actually want|could change/i
const STAGES = ['drafted', 'ran-current', 'stale', 'withheld'] as const
const KINDS = ['decision', 'option', 'factor', 'goal', 'risk', 'outcome', 'constraint']
const ENTRIES = Object.entries(QUESTIONS).flatMap(([intent, build]) => STAGES.flatMap(stage => KINDS.map(kind => {
  const context: QuestionContext = { stage, kind, label: 'Capacity', sourceLabel: 'Capacity', targetLabel: 'Delivery', goalLabel: 'Delivery', decisionLabel: 'Expand the team' }
  return [intent, stage, kind, build(context)] as const
})))

describe('the instruments have positive and negative controls', () => {
  it('sees all five former oracle openings, while an open assumption question passes', () => {
    for (const text of ['Tell me about the chances', 'Explain the relationship', 'How can we reduce it?', 'What are the key trade-offs?', 'How important is it?']) expect(ORACLE_OPENING.test(text)).toBe(true)
    expect(ORACLE_OPENING.test('What would make this assumption wrong?')).toBe(false)
  })
  it('sees ranking and verdicts, while comparison of dependencies passes', () => {
    for (const text of ['Which is the best option?', 'Is this better than the alternative?', 'Rank these by impact', 'Name the winner', 'Recommend an option']) expect(RANKING_LEXICON.test(text)).toBe(true)
    expect(RANKING_LEXICON.test('How do the options compare in what they depend on?')).toBe(false)
  })
  it('sees requests for an oracle anywhere, including the first-person loophole', () => {
    for (const text of ['Tell me about the chances', 'Show me which of these matters', 'Give me the answer']) {
      expect(HAND_JUDGEMENT_BACK.test(text)).toBe(true)
      expect(ORACLE_REQUEST_ANYWHERE.test(text)).toBe(true)
    }
    expect(ORACLE_REQUEST_ANYWHERE.test('what has it left to me to weigh?')).toBe(false)
  })
  it('sees real hand-backs and evidence questions, but not a closed assertion', () => {
    for (const text of ['Say which assumptions are mine to judge.', 'what has it left to me to weigh?', 'where would my knowledge change the picture?', 'If I moved this, what changes?', 'What evidence would challenge it?']) expect(HAND_JUDGEMENT_BACK.test(text)).toBe(true)
    for (const text of ['This option wins.', 'The model has decided.', 'We agree.', 'Our answer is final.']) expect(HAND_JUDGEMENT_BACK.test(text)).toBe(false)
  })
  it('walks the whole live registry, all stages and kinds', () => {
    expect(ENTRIES.length).toBe(Object.keys(QUESTIONS).length * STAGES.length * KINDS.length)
    expect(ENTRIES.length).toBeGreaterThan(0)
  })
})

describe('every registered question preserves human judgement', () => {
  it.each(ENTRIES)('%s / %s / %s has no oracle, ranking or answer handover and keeps an open inquiry', (_intent, _stage, _kind, text) => {
    expect(ORACLE_OPENING.test(text), text).toBe(false)
    expect(RANKING_LEXICON.test(text), text).toBe(false)
    expect(ORACLE_REQUEST_ANYWHERE.test(text), text).toBe(false)
    expect(HAND_JUDGEMENT_BACK.test(text), text).toBe(true)
    expect(text).not.toContain('42')
    expect(text).not.toContain('{')
  })
})
