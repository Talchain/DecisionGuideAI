/**
 * ⭐ ONE QUESTION WHILE THE FIRST DRAFT IS BUILT (Paul, 21 Oct 2026, of the drafting screen: "a lot of text and not a
 * lot of useful functionality"). Replaces the three habit cards of 1 Oct (#2392), which asked the user to queue a
 * method they could not act on until the draft landed, and showed the same two methods for every brief.
 *
 * The first draft takes about a minute, and the user is looking straight at their brief. The sheet asks ONE question
 * about THIS brief, which the user can answer in the wait:
 * - the first gap the brief card already shows (goal → limits → options);
 * - with no gap, a pre-mortem question (prospective hindsight, Klein), because it needs nothing the brief lacks.
 *
 * ── WHY THESE QUESTIONS (said in plain words on screen, never as a citation) ─────
 * - goal: a specific target and date lets every option be tested against it (goal-setting, Locke & Latham);
 * - limits: a stated threshold stops an option passing just by being first (satisficing, Simon);
 * - options: decisions that weigh one option fail more often than those that compare several (Nutt);
 * - pre_mortem: imagining a failure surfaces more of its causes (prospective hindsight, Klein).
 *
 * ── WHICH QUESTION, AND WHY THIS IS NOT THE UI DECIDING ─────────────────────
 * The choice reads only what the brief card already shows: which slots are EMPTY, and how many options the user
 * wrote. No language is parsed and no inference is made.
 *
 * ── WHAT AN ANSWER DOES ─────────────────────────────────────────────────────
 * The answer becomes a PRE-FILL of Olumi's next message once the draft lands. It is never sent: the user reads it
 * beside their model and sends it, edits it or deletes it.
 */

export type BriefPromptId = 'goal' | 'limits' | 'options' | 'pre_mortem'

export interface BriefPrompt {
  id: BriefPromptId
  /** The question, as the user would ask it of themselves. */
  question: string
  /** Why it helps, in one plain line (≤ `BRIEF_PROMPT_WHY_MAX` characters). */
  why: string
  /** A synthetic example, never a brief's own words. */
  placeholder: string
  /** Leads the pre-fill, so the message reads as the user's answer. */
  lead: string
}

/** One line at the sheet's measure: the why never wraps to a paragraph. */
export const BRIEF_PROMPT_WHY_MAX = 90

export const BRIEF_PROMPTS: Readonly<Record<BriefPromptId, BriefPrompt>> = Object.freeze({
  goal: {
    id: 'goal',
    question: 'What would success look like, and by when?',
    why: 'A number and a date let Olumi test every option against them.',
    placeholder: 'e.g. 500 paying customers by June',
    lead: 'My target is: ',
  },
  limits: {
    id: 'limits',
    question: 'What limits does this have to respect?',
    why: 'A budget, deadline or must-have stops an option passing just by being first.',
    placeholder: 'e.g. no more than £50k, live before March',
    lead: 'My limits are: ',
  },
  options: {
    id: 'options',
    question: 'What else could you do instead?',
    why: 'Comparing at least two options leads to better choices than weighing one.',
    placeholder: 'e.g. partner with a supplier instead',
    lead: 'Another option to consider: ',
  },
  pre_mortem: {
    id: 'pre_mortem',
    question: 'If this goes wrong, what is the most likely reason?',
    why: 'Naming a likely failure now points Olumi at what to check first.',
    placeholder: 'e.g. the team is stretched too thin',
    lead: 'If this goes wrong, the most likely reason is: ',
  },
})

export interface BriefShape {
  /** The goal slot holds the user's words. */
  hasGoal: boolean
  /** The "Things to consider" slot holds the user's words. */
  hasLimits: boolean
  /**
   * How many options the user wrote, or `null` when it is not known: the "Structure it" Options field is ONE free-text
   * box, and this card parses no language (header), so "A; B" there is not counted as one option, or as two. Paul's
   * 1 Oct preview showed "1" beside two options, and the card coached "add a real alternative" to someone who had.
   */
  optionCount: number | null
}

/** The one question for this brief: the first gap (goal → limits → options), else a pre-mortem. */
export function briefPromptFor(shape: BriefShape): BriefPrompt {
  if (!shape.hasGoal) return BRIEF_PROMPTS.goal
  if (!shape.hasLimits) return BRIEF_PROMPTS.limits
  // Only a KNOWN count of fewer than two asks for another option; an unknown count (the user's own field) never does.
  if (shape.optionCount !== null && shape.optionCount < 2) return BRIEF_PROMPTS.options
  return BRIEF_PROMPTS.pre_mortem
}

/** The pre-fill for an answer: the prompt's lead plus the user's words, or null for an empty answer. */
export function briefPromptPrefill(prompt: BriefPrompt, answer: string): string | null {
  const text = answer.trim()
  return text ? `${prompt.lead}${text}` : null
}

/**
 * The one pre-fill an answer queues while the draft is still being built. It is taken (and cleared) when the draft
 * lands, so the answer never pulls the user away from the brief mid-build and never sends anything.
 */
let queuedPrefill: string | null = null
export function queueBriefCoachingPrefill(text: string | null): void {
  queuedPrefill = text
}
export function takeQueuedBriefCoachingPrefill(): string | null {
  const t = queuedPrefill
  queuedPrefill = null
  return t
}
