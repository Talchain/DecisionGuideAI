/**
 * K5 "IF IT FAILED", read through the vendored View contract (view.v3.json): when the pre_mortem move is taken, every card a failure story
 * rests on carries `failed` (one entry per story), and an option card `failed_reason` (the one story most within the team's control); the
 * reply's `stories` and `stories_heading`. All of it is Olumi's; nothing here is written by the UI. Every reader returns nothing (draw nothing)
 * when core does not send the field.
 */
import type { ViewCard, ViewTurn } from './client'

export type Failed = ViewCard['failed'][number]
export type FailedReason = NonNullable<ViewCard['failed_reason']>
type Answer = NonNullable<ViewTurn['answer']>
export type Story = Answer['stories'][number]

/** The failure stories resting on this card, in core's order; [] when none. */
export const failedOf = (c: ViewCard): ReadonlyArray<Failed> => c.failed ?? []
/** An option's story most within the team's control; null when none (or not an option). */
export const failedReasonOf = (c: ViewCard): FailedReason | null => c.failed_reason ?? null
/** The pre-mortem's stories on the reply they came with, exactly as Olumi gave them, [] on a reply with none; the heading is core's when there are stories, else null. */
export const storiesOf = (answer: Answer): ReadonlyArray<Story> => answer.stories ?? []
export const storiesHeadingOf = (answer: Answer): string | null => answer.stories_heading ?? null
