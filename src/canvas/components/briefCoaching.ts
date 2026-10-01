/**
 * ⭐ SCIENCE-GROUNDED COACHING WHILE THE FIRST DRAFT IS BUILT (Paul, 1 Oct 2026: "We need to design that panel so it
 * looks good, is easy to digest, and takes the opportunity to provide science-grounded, concise, easy-to-understand,
 * action-oriented coaching.").
 *
 * The first draft takes about a minute, and the user is looking straight at their brief. Each card shows:
 * - ONE habit with a named, citable basis;
 * - ONE sentence on why it helps;
 * - ONE action, which pre-fills Olumi's next message once the draft lands. It is never sent.
 *
 * ── WHICH CARDS, AND WHY THIS IS NOT THE UI DECIDING ─────────────────────────
 * The choice reads only what the brief card already shows: which of the four slots are EMPTY, and how many options
 * the user wrote. No language is parsed and no inference is made. A gap is coached first (goal, then limits, then
 * options), and the always-useful habits (pre-mortem, outside view) fill the rest, up to `MAX_BRIEF_COACHING_CARDS`.
 *
 * ── WORDS ───────────────────────────────────────────────────────────────────
 * The pre-mortem, outside-view and widen-options actions reuse the coaching prompts the panel already sends
 * (`ACTIONS_MENU`), so one act has one wording. The science lines name their source in brackets, as `SIGNAL_COPY`'s
 * "Pre-mortem (Klein)" already does. They state each method's claim and attach no figure.
 */
import { ACTIONS_MENU } from './pre-analysis-v3/constants'

export const MAX_BRIEF_COACHING_CARDS = 3

export type BriefCoachingId = 'goal' | 'limits' | 'options' | 'pre_mortem' | 'outside_view'

export interface BriefCoachingCard {
  id: BriefCoachingId
  /** The habit, as a short imperative. */
  title: string
  /** Why it helps, with its source in brackets. One or two lines. */
  science: string
  /** The button's words. */
  actionLabel: string
  /** What the action pre-fills in Olumi's next message (never sent). */
  prefill: string
}

const menuPrompt = (id: string): string => {
  const entry = (ACTIONS_MENU as readonly { id: string; prompt: string }[]).find((a) => a.id === id)
  if (!entry) throw new Error(`briefCoaching: ACTIONS_MENU has no '${id}'`)
  return entry.prompt
}

export const BRIEF_COACHING_CARDS: Readonly<Record<BriefCoachingId, BriefCoachingCard>> = Object.freeze({
  goal: {
    id: 'goal',
    title: 'Make success measurable',
    science: 'A specific target guides effort better than a vague aim (goal-setting research, Locke & Latham). A number and a date let Olumi score every option against yours.',
    actionLabel: 'Add a target',
    prefill: 'My target is ',
  },
  limits: {
    id: 'limits',
    title: 'Name your limits',
    science: 'We tend to take the first option that clears our bar (satisficing, Simon). Saying where the bar is — a budget, a date, a must-have — tests every option fairly.',
    actionLabel: 'Add your limits',
    prefill: 'My limits are: ',
  },
  options: {
    id: 'options',
    title: 'Add a real alternative',
    science: 'Decisions that weigh a single option fail far more often than those comparing two or more (Nutt’s studies of organisational decisions).',
    actionLabel: 'Ask for options',
    prefill: menuPrompt('widen_options'),
  },
  pre_mortem: {
    id: 'pre_mortem',
    title: 'Run a pre-mortem',
    science: 'Imagining the decision has already failed brings out more of the reasons it could (prospective hindsight; Klein’s pre-mortem).',
    actionLabel: 'Start a pre-mortem',
    prefill: menuPrompt('pre_mortem'),
  },
  outside_view: {
    id: 'outside_view',
    title: 'Take the outside view',
    science: 'Forecasts built only from the case in hand run optimistic. Start from how similar decisions usually turn out, then adjust (Kahneman & Lovallo).',
    actionLabel: 'Ask for base rates',
    prefill: menuPrompt('outside_view'),
  },
})

export interface BriefShape {
  /** The goal slot holds the user's words. */
  hasGoal: boolean
  /** The "Things to consider" slot holds the user's words. */
  hasLimits: boolean
  /** How many options the user wrote. */
  optionCount: number
}

/** The cards for this brief: gaps first (goal → limits → options), then the always-useful habits. */
export function briefCoachingFor(shape: BriefShape): BriefCoachingCard[] {
  const ids: BriefCoachingId[] = []
  if (!shape.hasGoal) ids.push('goal')
  if (!shape.hasLimits) ids.push('limits')
  if (shape.optionCount < 2) ids.push('options')
  ids.push('pre_mortem', 'outside_view')
  return ids.slice(0, MAX_BRIEF_COACHING_CARDS).map((id) => BRIEF_COACHING_CARDS[id])
}

/**
 * The one pre-fill a click queues while the draft is still being built. It is taken (and cleared) when the draft
 * lands, so the action never pulls the user away from the brief mid-build and never sends anything.
 */
let queuedPrefill: string | null = null
export function queueBriefCoachingPrefill(text: string): void {
  queuedPrefill = text
}
export function takeQueuedBriefCoachingPrefill(): string | null {
  const t = queuedPrefill
  queuedPrefill = null
  return t
}
