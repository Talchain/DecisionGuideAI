/**
 * buildAiDiscussPrompt — shared prompt builder for the "Discuss with AI"
 * sparkle button (P1-2). Producing the prompt string in one place keeps
 * wording consistent across triage cards, bias triggers, option quality,
 * goal target, fragile relationships, and driver cards.
 */

import { UNRECOGNISED_BIAS_SIGNAL_TITLE } from '../../shared/biasSignalTitles'

export type AiDiscussElement =
  | { kind: 'factor'; label: string }
  | { kind: 'edge'; from: string; to: string }
  | { kind: 'option'; label: string }
  | {
      kind: 'bias'
      biasType: string
      /** Full supplied observation, never the shortened card subtitle. */
      observation?: string | null
      /** Human-readable model context already resolved by the card producer. */
      targetLabel?: string | null
      /**
       * Optional micro-intervention text from CEE (e.g. a debiasing technique).
       * When present, the sparkle prompt includes it so the AI can expand on
       * the technique in context. Replaces the removed "Try this" text pill
       * per unified spec §3.3: bias cards have sparkle only, no text pills.
       */
      microInterventionStep?: string | null
    }
  | { kind: 'goal'; label: string }
  | { kind: 'missing' }

export function buildAiDiscussPrompt(el: AiDiscussElement): string {
  switch (el.kind) {
    case 'factor':
      return `Tell me about ${el.label}. How does it affect my decision and what should I consider?`
    case 'edge':
      return `Tell me about the relationship between ${el.from} and ${el.to}. How important is it?`
    case 'option':
      return `Tell me about ${el.label}. What are its strengths and weaknesses?`
    case 'bias': {
      const observation = el.observation?.trim()
      const targetLabel = el.targetLabel?.trim()
      const technique = el.microInterventionStep?.trim()
      const category = el.biasType.trim()
      const lines = ['Help me examine this reasoning check from Olumi.']
      if (targetLabel) lines.push(`Related model item: ${JSON.stringify(targetLabel)}.`)
      // A neutral fallback heading is not a bias category. Even a recognised
      // category is a possibility to examine, not the user's self-diagnosis.
      if (category && category !== UNRECOGNISED_BIAS_SIGNAL_TITLE) {
        lines.push(`Possible reasoning risk: ${category}.`)
      }
      lines.push(observation
        ? `Observation: ${JSON.stringify(observation)}`
        : 'No observation was supplied with this check.')
      if (technique) lines.push(`Suggested technique: ${JSON.stringify(technique)}`)
      lines.push(observation
        ? 'Assess whether this concern applies: consider evidence for and against it, another plausible explanation, and one practical next check.'
        : 'What context or evidence is needed before assessing this concern?')
      return lines.join('\n')
    }
    case 'goal':
      return `Tell me about the goal "${el.label}". How should I think about success here?`
    case 'missing':
      return `I'd like to add something to the model that's not currently captured: `
  }
}
