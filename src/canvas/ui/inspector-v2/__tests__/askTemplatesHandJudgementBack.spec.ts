// The judgement guards now cover the question registry that actually reaches the wire.
// 7 Oct permits explanation and comparison, while forbidding an oracle's verdict.
import { describe, it, expect } from 'vitest'
import { QUESTIONS, type QuestionContext } from '../../../conversation/askAiQuestions'
const ORACLE_OPENING = /^(Tell me|Explain|How can we|What are the key|How important)/i
const RANKING_LEXICON = /\bthe most\b|\bmost important\b|\branks?\b|\branking\b|\bbetter than\b|\b(best|winner|recommend|leads|ahead|beats)\b/i
const ORACLE_REQUEST_ANYWHERE = /\b(?:tell|show|give)\s+me\b/i
// The Q-table hands judgement back through open assumptions, evidence, alternatives,
// limits and hypothetical changes as well as first-person agency. No verdict qualifies.
const HAND_JUDGEMENT_BACK = /\b(?:mine|my|me|I)\b|assum|depend|evidence|what would|what could|what happens|what explains|what is missing|what is still open|what else|what other|what most|what should|what does|what can|what early|what factors|what risks|still need|missing before|how sure|how likely|how much|how might|is .* (?:right|real|current|starting)|which reasoning biases|which matter|how do the options|where else|how do decisions|outcome we actually want|could change|^Should .+ be today’s value, or something the options change\?$/i
const STAGES = ['drafted', 'ran-current', 'stale', 'withheld'] as const
const KINDS = ['decision', 'option', 'factor', 'goal', 'risk', 'outcome', 'constraint', 'action', undefined]
// Every optional context branch is crossed with every stage, kind and intent.
const CONTEXTS: Array<Partial<QuestionContext>> = [
  {}, // all fallbacks
  { label: 'Capacity' },
  { otherLabel: 'Partner' }, // incomplete option pair
  { label: 'Pilot', otherLabel: 'Partner' },
  { sourceLabel: 'Capacity' }, // incomplete link: source only
  { targetLabel: 'Delivery' }, // incomplete link: target only
  { sourceLabel: 'Capacity', targetLabel: 'Delivery' },
  { goalLabel: 'Delivery', decisionLabel: 'Expand the team' },
  { label: 'Capacity', baseline: false },
  { label: 'Capacity', baseline: true },
  { optionLabels: [] },
  { decisionLabel: 'Expand the team', optionLabels: ['Pilot'] },
  { decisionLabel: 'Expand the team', optionLabels: ['Pilot', 'Partner'] },
  { label: 'Capacity', authoredContext: ' [authored context]' },
  { authoredContext: ' [authored context]' }, // mitigation's unnamed fallback
  { validateQuestion: 'How can I validate my assumption about Delivery?' },
  { label: 'Capacity', sourceLabel: 'Capacity', targetLabel: 'Delivery', goalLabel: 'Delivery',
    decisionLabel: 'Expand the team', baseline: true, optionLabels: ['Pilot', 'Partner'],
    authoredContext: ' [authored context]', validateQuestion: 'How can I validate my assumption about Delivery?' },
]
const ENTRIES = Object.entries(QUESTIONS).flatMap(([intent, build]) => STAGES.flatMap(stage =>
  KINDS.flatMap(kind => CONTEXTS.map(context => [intent, stage, kind, build({ ...context, stage, kind })] as const))))

describe('the instruments have positive and negative controls', () => {
  it('sees all five former oracle openings, while an open assumption question passes', () => {
    for (const text of ['Tell me about the chances', 'Explain the relationship', 'How can we reduce it?', 'What are the key trade-offs?', 'How important is it?']) expect(ORACLE_OPENING.test(text)).toBe(true)
    expect(ORACLE_OPENING.test('What would make this assumption wrong?')).toBe(false)
  })
  it('sees ranking and verdicts, while comparison of dependencies passes', () => {
    for (const text of ['What drives this the most?', 'What is most important here?', 'Which is the best option?', 'Is this better than the alternative?', 'Rank these by impact', 'Name the winner', 'Recommend an option']) expect(RANKING_LEXICON.test(text)).toBe(true)
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
  it('recognises a bounded value question, without accepting a closed directive', () => {
    expect(HAND_JUDGEMENT_BACK.test('Should ‘Capacity’ be today’s value, or something the options change?')).toBe(true)
    for (const text of ['Should ‘Capacity’ be today’s value?', 'Should Olumi choose the option?', 'Should ‘Capacity’ be today’s value, or something the options change.']) {
      expect(HAND_JUDGEMENT_BACK.test(text), text).toBe(false)
    }
  })
  it('keeps former oracle questions as negative hand-back controls', () => {
    for (const text of ['What drives this the most?', 'How can we reduce this?', 'How sensitive are the results to this?']) {
      expect(HAND_JUDGEMENT_BACK.test(text), text).toBe(false)
    }
  })
  it('walks the whole live registry, all stages and kinds', () => {
    expect(ENTRIES.length).toBe(Object.keys(QUESTIONS).length * STAGES.length * KINDS.length * CONTEXTS.length)
    expect(ENTRIES.length).toBeGreaterThan(0)
  })
})

describe('every registered question preserves human judgement', () => {
  it('all intents, stages, kinds and context branches keep an open inquiry', () => {
    for (const [intent, stage, kind, text] of ENTRIES) {
      const caseLabel = `${intent} / ${stage} / ${kind}: ${text}`
      expect(ORACLE_OPENING.test(text), caseLabel).toBe(false)
      expect(RANKING_LEXICON.test(text), caseLabel).toBe(false)
      expect(ORACLE_REQUEST_ANYWHERE.test(text), caseLabel).toBe(false)
      expect(HAND_JUDGEMENT_BACK.test(text), caseLabel).toBe(true)
      expect(text).not.toContain('42')
      expect(text).not.toContain('{')
    }
  })
})
