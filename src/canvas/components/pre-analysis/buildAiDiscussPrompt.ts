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
  | { kind: 'bias'; biasType: string }
  | { kind: 'goal'; label: string }

export function buildAiDiscussPrompt(el: AiDiscussElement): string {
  switch (el.kind) {
    case 'factor':
      return `Tell me about ${el.label}. How does it affect my decision and what should I consider?`
    case 'edge':
      return `Tell me about the relationship between ${el.from} and ${el.to}. How important is it?`
    case 'option':
      return `Tell me about ${el.label}. What are its strengths and weaknesses?`
    case 'bias':
      return `Tell me more about ${el.biasType} and how it might affect my thinking.`
    case 'goal':
      return `Help me define what success looks like for this decision and suggest a measurable target.`
  }
}
