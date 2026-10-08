/**
 * optionStatusMark — the option card shows AT MOST ONE status mark.
 *
 * ⭐ DL 8 Oct (workstream D, "simplify the surface"): an option could carry up
 * to three status glyphs at once in its bottom band ("Last run" + "Last run ·
 * no new comparison yet" + "Not analysed"), two of them saying the same thing.
 * One mark wins by priority — withheld > stale > not analysed > provisional —
 * and every demoted mark is named in the winner's tooltip, so nothing the card
 * knew about its figure is lost; it is one hover away instead of one more icon.
 *
 * Within "stale", `last-run` outranks `no-new-comparison`: `last-run` is the
 * caption of the figure itself (a figure never shows without its mark), and the
 * two always arrive together (both read `runCurrency === 'changed'`).
 */
import { cardMark, type CardMarkId } from './cardMarks'

export type OptionStatusMarkId = Extract<CardMarkId, 'share-withheld' | 'last-run' | 'no-new-comparison' | 'not-analysed' | 'provisional'>

export const OPTION_STATUS_MARK_PRIORITY: readonly OptionStatusMarkId[] = [
  'share-withheld',
  'last-run',
  'no-new-comparison',
  'not-analysed',
  'provisional',
]

export interface OptionStatusMarkCandidate {
  id: OptionStatusMarkId
  testId: string
  description?: string
}

export interface PickedOptionStatusMark {
  id: OptionStatusMarkId
  testId: string
  /** The winner's own description, then "Also: …" naming every demoted mark in priority order. */
  description: string | undefined
  demoted: OptionStatusMarkId[]
}

export const OPTION_STATUS_ALSO_PREFIX = 'Also:'

/** `null` when no candidate is active. Candidates may arrive in any order. */
export function pickOptionStatusMark(candidates: readonly (OptionStatusMarkCandidate | null | false)[]): PickedOptionStatusMark | null {
  const active = candidates.filter((c): c is OptionStatusMarkCandidate => !!c)
  if (active.length === 0) return null
  const sorted = [...active].sort((a, b) => OPTION_STATUS_MARK_PRIORITY.indexOf(a.id) - OPTION_STATUS_MARK_PRIORITY.indexOf(b.id))
  const [winner, ...rest] = sorted
  const demoted = rest.map(c => c.id).filter((id, i, all) => id !== winner.id && all.indexOf(id) === i)
  const also = demoted.length > 0 ? `${OPTION_STATUS_ALSO_PREFIX} ${demoted.map(id => cardMark(id).words).join(' · ')}` : null
  const description = [winner.description || null, also].filter((s): s is string => s !== null).join(' · ') || undefined
  return { id: winner.id, testId: winner.testId, description, demoted }
}
