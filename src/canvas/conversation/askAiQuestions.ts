/** A1 Q1–Q20. Product-authored questions carry labels, never model figures. */
export type AskStage = 'drafted' | 'ran-current' | 'stale' | 'withheld'
export interface QuestionContext {
  stage: AskStage
  otherLabel?: string
  label?: string
  kind?: string
  sourceLabel?: string
  targetLabel?: string
  goalLabel?: string
  decisionLabel?: string
  baseline?: boolean
  optionLabels?: string[]
  authoredContext?: string
  validateQuestion?: string
}
const named = (label: string | undefined, generic: string) => label ? `‘${label}’` : generic
const element = (c: QuestionContext) => named(c.label, 'this element')
const goal = (c: QuestionContext) => named(c.goalLabel ?? (c.kind === 'goal' ? c.label : undefined), 'the goal')
const decision = (c: QuestionContext) => named(c.decisionLabel ?? (c.kind === 'decision' ? c.label : undefined), 'this decision')
const link = (c: QuestionContext) => c.sourceLabel && c.targetLabel
  ? `the link from ‘${c.sourceLabel}’ to ‘${c.targetLabel}’` : 'this link'
const linkQuestion = (c: QuestionContext) => c.stage === 'ran-current'
  ? `How much does the comparison depend on ${link(c)}?`
  : c.sourceLabel && c.targetLabel ? `Why would ‘${c.sourceLabel}’ change ‘${c.targetLabel}’, and how sure are we?`
    : 'Why would this link change the outcome, and how sure are we?'

export const QUESTIONS = {
  'lever-today': (c: QuestionContext) => `Should ${element(c)} be today’s value, or something the options change?`,
  connect: (c: QuestionContext) => `How does ${element(c)} affect this decision, and what should it link to?`,
  differentiate: (c: QuestionContext) => `How does ${element(c)} differ from ${named(c.otherLabel, 'the other option')} in practice, and what should each change in the model?`,
  explain: (c: QuestionContext) => ({
    drafted: `What does ${element(c)} do in this decision, and what is it assumed to depend on?`,
    'ran-current': `How much does ${element(c)} matter to the options’ chances of meeting the goal, and why?`,
    stale: `I’ve changed the model since the last Run. How might that change what ${element(c)} does here?`,
    withheld: `What does Olumi still need about ${element(c)} before it can say how likely each option is to meet the goal?`,
  })[c.stage],
  challenge: (c: QuestionContext) => {
    if (c.kind === 'option') {
      if (c.stage === 'withheld') return `What is missing before Olumi can say how likely ${element(c)} is to meet the goal?`
      if (c.stage === 'drafted') return `What would make ${element(c)} a worse choice than it looks, what is it assuming, and what alternative is missing?`
      return `What does ${element(c)}’s chance of meeting the goal rest on most, and what evidence would change it?`
    }
    const question = c.kind === 'decision' ? `Is ${decision(c)} the right question, how is it framed, and what is it assuming?`
      : c.kind === 'goal' ? `Is ${goal(c)} the outcome we actually want, or a stand-in for it?`
      : c.kind === 'constraint' ? `Is ${element(c)} a real limit, is it set at the right level, and who could relax it?`
      : c.kind === 'risk' ? `What could make ${element(c)} happen, and what evidence would change how we see that risk?`
      : c.kind === 'outcome' ? `What would have to be true for ${element(c)} to happen, and what evidence would challenge that?`
      : `What is the figure for ${element(c)} based on, and what would make a different figure more defensible?`
    return question
  },
  link: linkQuestion,
  // Examine uses Q3 unless its open assumption qualifies for the routed press.
  'examine-link': linkQuestion,
  'question-link': (c: QuestionContext) => `Is ${link(c)} right, and what other route could reach the goal?`,
  'test-link': (c: QuestionContext) => `What happens to the comparison without ${link(c)}?`,
  goal: (c: QuestionContext) => c.stage === 'ran-current'
    ? `What does reaching ${goal(c)} depend on most in this model, and what would change that?`
    : c.stage === 'withheld' ? `What does Olumi still need before it can say how likely ${goal(c)} is to be reached?`
      : `What would success look like for ${goal(c)}? Words first, a number only if it’s what we care about.`,
  widen: (c: QuestionContext) => {
    const question = c.stage === 'ran-current' ? `What other options could reach ${goal(c)}?`
      : `What other ways could we reach ${goal(c)} that aren’t on the board yet?`
    return c.optionLabels?.length
      ? `For ${decision(c)}, I have ${c.optionLabels.length} ${c.optionLabels.length === 1 ? 'option' : 'options'}: ${c.optionLabels.map(label => `‘${label}’`).join(', ')}. ${question}`
      : question
  },
  'pre-mortem': (c: QuestionContext) => c.stage === 'ran-current' || c.stage === 'withheld'
    ? 'Imagine this decision went badly a year from now. What most plausibly went wrong?'
    : `What could make ${c.kind === 'option' ? element(c) : decision(c)} go badly that isn’t in the model yet?`,
  risks: (_c: QuestionContext) => 'What could go wrong, or unexpectedly well, that this model doesn’t have yet?',
  gaps: (c: QuestionContext) => c.stage === 'ran-current'
    ? 'What is this Run not seeing that could change how the options compare?'
    : 'What is missing from this model that could change how the options compare?',
  'what-would-change': (c: QuestionContext) => c.stage === 'ran-current'
    ? 'What would change how the options compare?' : 'What would most change how the options compare?',
  strengthen: (_c: QuestionContext) => 'What would most strengthen this model?',
  review: (_c: QuestionContext) => 'What should we check before relying on this Run?',
  limits: (c: QuestionContext) => ({ drafted: 'What can this model not tell us yet?',
    'ran-current': 'What are the limits of this analysis, and which matter most for our decision?',
    stale: 'Is this Run still current for the model we have now?', withheld: 'What would let Olumi say how likely each option is?',
  })[c.stage],
  commit: (_c: QuestionContext) => 'What is still open before we commit, and how could we test it?',
  unblock: (_c: QuestionContext) => 'What do I need to add so the analysis can run?',
  'method:reframe': (c: QuestionContext) => `Is ${decision(c)} the right question, or too narrow? What other framings should we consider?`,
  'method:opposite': (_c: QuestionContext) => 'What is the strongest honest case against how this model reads now, and what would change my mind?',
  'method:outside-view': (c: QuestionContext) => `How do decisions like ${decision(c)} usually turn out, and how is ours different?`,
  'method:trade-offs': (_c: QuestionContext) => 'What does each option gain, give up and depend on?',
  'method:bias': (_c: QuestionContext) => 'Which reasoning biases could be shaping this model, and how would we test for them?',
  'compare-runs': (_c: QuestionContext) => 'What changed between these two Runs, and what should we look at next?',
  finding: (c: QuestionContext) => `Why does Olumi flag ${element(c)}, and what should we do about it?`,
  option: (c: QuestionContext) => c.stage === 'ran-current'
    ? c.baseline ? 'What happens to the goal if we keep things as they are?'
      : `What does ${element(c)}’s chance of meeting the goal rest on, and what would change it?`
    : c.stage === 'withheld' ? `What’s missing before Olumi can say how likely ${element(c)} is to meet the goal?`
      : `What would have to be true for ${element(c)} to meet the goal?`,
  estimate: (c: QuestionContext) => `Help me estimate ${element(c)}: what range is sensible, and what would narrow it?`,
  evidence: (c: QuestionContext) => `What evidence supports ${element(c)}, and what would count against it?`,
  'goal-low': (c: QuestionContext) => c.stage === 'stale'
    ? `The model has changed since the last Run. What could explain the low chance of meeting ${goal(c)}, and what needs checking again?`
    : c.stage === 'withheld' ? `What is missing before we can understand the chance of meeting ${goal(c)}?`
      : `What explains the low chance of meeting ${goal(c)}, and which assumptions should we examine?`,
  'goal-realistic': (c: QuestionContext) => `Is the target for ${goal(c)} realistic, and what evidence would help me judge it?`,
  'reduce-risk': (c: QuestionContext) => `What could reduce ${element(c)}, and what would need to change in this model?`,
  'other-options': (c: QuestionContext) => `What would need to change for another option to be better supported than ${c.label || 'this option'}?`,
  'close-call': (c: QuestionContext) => `What would need to be true for ${c.label || 'this option'} to be the better choice?`,
  'counter-case': (c: QuestionContext) => `Set aside the numbers for a moment. What would have to be true for ${c.label || 'this option'} to be the wrong choice here? What could this model be missing?`,
  'support-option': (c: QuestionContext) => `What would need to change for ${element(c)} to be better supported, and what evidence would we need?`,
  'compare-options': (_c: QuestionContext) => 'How do the options compare in what they gain, give up and depend on?',
  'inaction-risks': (c: QuestionContext) => `What risks does keeping ${element(c)} as it is carry, and what could make them worse?`,
  'missing-outcome': (_c: QuestionContext) => 'Where else could this lead that the model doesn’t have yet?',
  // FB1 rail families whose existing questions the register explicitly keeps.
  'factor-change': (c: QuestionContext) => `What happens to the options if ${element(c)} changes?`,
  confirm: (c: QuestionContext) => `What would it take to confirm ${element(c)}?`,
  'risk-indicators': (c: QuestionContext) => `What early signs would tell us ${element(c)} is starting to happen, and what should trigger a response?`,
  'risk-size': (c: QuestionContext) => `How likely is ${element(c)}, and how serious would it be if it happened?`,
  mitigation: (c: QuestionContext) => c.authoredContext
    ? `What factors or actions could reduce ${element(c)}, and what would that change?${c.authoredContext}`
    : `What factors or actions could reduce ${element(c)}?`,
  falsify: (c: QuestionContext) => `What evidence or result would show that ${element(c)} will not happen? What would have to be true for it to fail?`,
  consequences: (c: QuestionContext) => `What would ${c.label || 'this outcome'} mean for this model, including possible benefits and downsides?${c.authoredContext ?? ''}`,
  'validate-outcome': (c: QuestionContext) => c.validateQuestion ?? `How can I validate my assumption about ${c.label || 'this outcome'}?${c.authoredContext ?? ''}`,
  'missing-factor': (_c: QuestionContext) => 'What else could change how this turns out that the model doesn’t have yet?',
  name: (_c: QuestionContext) => 'Help me find a clear name for this part of the model so I can choose the wording.',
  // Q15, the Reasoning methods with no typed CEE route (a pre-mortem is Q6 and a different option is Q5; trade-offs reuse `compare-options`).
  'method-reframe': (c: QuestionContext) => `Is ${decision(c)} the right question, or too narrow? What other framings should we consider?`,
  'method-opposite': (_c: QuestionContext) => 'What is the strongest honest case against how this model reads now, and what would change my mind?',
  'method-outside-view': (c: QuestionContext) => `How do decisions like ${c.decisionLabel ? `‘${c.decisionLabel}’` : 'this one'} usually turn out, and how is ours different?`,
  'method-bias': (_c: QuestionContext) => 'Which reasoning biases could be shaping this model, and how would we test for them?',
} satisfies Record<string, (c: QuestionContext) => string>
export type AskIntent = keyof typeof QUESTIONS

/** Identity mapping, never inference from generated prose or model figures. */
export const COACHING_ASK_INTENTS: Readonly<Record<string, AskIntent>> = {
  decision_explore_more_options: 'widen', decision_what_could_go_wrong: 'pre-mortem',
  decision_challenge_result: 'what-would-change', decision_compare_options: 'compare-options',
  goal_is_this_the_real_goal: 'challenge', goal_why_so_low: 'goal-low', goal_target_realistic: 'goal-realistic',
  factor_help_estimate: 'estimate', factor_what_if_changes: 'factor-change',
  factor_confirm_top_influence: 'confirm', factor_evidence_supports: 'evidence',
  option_what_could_go_wrong: 'pre-mortem', option_why_win_lose: 'option',
  option_risks_of_inaction: 'inaction-risks', option_what_would_change: 'other-options', option_why_lead: 'option',
  option_counter_case: 'counter-case', option_what_would_change_close_call: 'close-call', option_what_would_make_lead: 'support-option',
  risk_leading_indicator: 'risk-indicators', risk_size_exposure: 'risk-size',
  risk_what_reduces: 'reduce-risk', risk_add_mitigation: 'mitigation',
  outcome_what_would_falsify: 'falsify', outcome_explore_consequences: 'consequences',
  outcome_what_strengthens: 'explain', outcome_validate_assumption: 'validate-outcome', action_what_must_be_true: 'option',
}
