/**
 * buildAiDiscussPrompt — shared prompt builder for the "Discuss with AI"
 * sparkle button (P1-2). Producing the prompt string in one place keeps
 * wording consistent across triage cards, bias triggers, option quality,
 * goal target, fragile relationships, and driver cards.
 */

export type AiDiscussElement =
  | { kind: 'factor'; label: string }
  | { kind: 'edge'; from: string; to: string }
  | { kind: 'option'; label: string }
  | {
      kind: 'bias'
      biasType: string
      /**
       * Optional micro-intervention text from CEE (e.g. a debiasing technique).
       * When present, the sparkle prompt includes it so the AI can expand on
       * the technique in context. Replaces the removed "Try this" text pill
       * per unified spec §3.3: bias cards have sparkle only, no text pills.
       */
      microInterventionStep?: string
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
    case 'bias':
      if (el.microInterventionStep) {
        return `I'm noticing ${el.biasType} in my thinking. One suggested technique: "${el.microInterventionStep}". Can you help me apply this to my decision?`
      }
      return `Tell me more about ${el.biasType} and how it might affect my thinking.`
    case 'goal':
      return `Tell me about the goal "${el.label}". How should I think about success here?`
    case 'missing':
      return `I'd like to add something to the model that's not currently captured: `
  }
}
