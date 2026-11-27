import type { ViewCard, ViewModel } from '../client'

/** Every option card in the View's order, live or not (the Summary shows a withheld option's status and reason too). */
export const allOptionCards = (model: ViewModel): ViewCard[] => model.cards.filter((c) => c.family === 'option')
/**
 * The option cards core compares, in the View's own order: what the chances block draws. An option core does not compare carries its
 * status on its card ("removed", "ruled out"); it has no chance to show, and the block leaves it out as the base does (review 00051).
 */
export const optionCards = (model: ViewModel): ViewCard[] => allOptionCards(model).filter((c) => c.status === null)

/** The cards core marks `challenged` (a challenge, a disagreement, evidence that challenges), in the View's order. */
export const challengedCards = (model: ViewModel): ViewCard[] => model.cards.filter((c) => c.challenged === true)

/** The science kinds Worth checking first knows how to say (olumi.view/3 `run.science[].kind`). */
const WORTH_KINDS: ReadonlySet<string> = new Set(['worth'])
/**
 * The Run's science lines Worth checking first draws, each with its place in `run.science` (its View path): only the kinds it knows. A
 * kind core adds later (D2: middle, better, an 'unresolved' status) is drawn as nothing until this page knows what it means.
 */
export const worthLinesOf = <T extends { kind: string }>(science: readonly T[]): { line: T; i: number }[] =>
  science.map((line, i) => ({ line, i })).filter(({ line }) => WORTH_KINDS.has(line.kind))
