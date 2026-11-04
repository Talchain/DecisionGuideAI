/**
 * K5 "IF IT FAILED", AHEAD OF CORE (DL 4 Nov, R3): core's shapes at github-3c's wip/k5 (8ceb3b872 the cards, 073f14c the reply's
 * stories; olumi.view/3), read here until DGAI
 * vendors that core. Then this file goes: vendor view.v3.json, regenerate types.ts, and read the fields straight. When the pre_mortem move
 * is taken, every card a failure story rests on carries `failed` (one entry per story: its number, the story in Olumi's words, Olumi's
 * mark), and an option card `failed_reason` (the one story most within the team's control, core's words for that, Olumi's mark). All of
 * it is Olumi's; nothing here is written by the UI. Every reader returns nothing (draw nothing) when core does not send the field.
 */
import type { ViewCard } from './client'

export type OlumiMark = { glyph: string; title: string }
export type Failed = { n: number; title: string; olumi: OlumiMark }
export type FailedReason = { text: string; title: string; olumi: OlumiMark }
type CardK5 = ViewCard & { failed?: ReadonlyArray<Failed>; failed_reason?: FailedReason | null }

/** The failure stories resting on this card, in core's order; [] when none (or a core before K5). */
export const failedOf = (c: ViewCard): ReadonlyArray<Failed> => (c as CardK5).failed ?? []
/** An option's story most within the team's control; null when none (or not an option, or a core before K5). */
export const failedReasonOf = (c: ViewCard): FailedReason | null => (c as CardK5).failed_reason ?? null

/**
 * The pre-mortem's stories on the reply they came with (core wip/k5 073f14c, olumi.view/3 `chat[].answer.stories` and `.stories_heading`):
 * exactly as Olumi gave them, [] on a reply with none; the heading is core's ("If it failed") when there are stories, else null.
 */
export type Story = { text: string; rests_on: ReadonlyArray<string>; option: string | null; in_control: boolean }
type AnswerK5 = { stories?: ReadonlyArray<Story>; stories_heading?: string | null }
export const storiesOf = (answer: object): ReadonlyArray<Story> => (answer as AnswerK5).stories ?? []
export const storiesHeadingOf = (answer: object): string | null => (answer as AnswerK5).stories_heading ?? null
