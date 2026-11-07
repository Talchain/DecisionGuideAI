/**
 * A card's badge: the records core folded into it, as core words them. Pressing it opens or closes them, a new read of the View with what
 * the person has opened (`?open=` card id → the record ids the badge holds, exactly as the View handed them out); nothing is re-folded
 * here (olumi-core API.md, the View, "What the person has opened"). A badge folding a record a held proposal adds or changes is marked
 * as core's page marks it: outlined, with core's change glyphs (`badge.change`, `+` added, `↻` changed) beside its text, so a change
 * behind a fold is seen before it is approved (final review 00004 #3).
 */
import type { ViewCard } from './client'
import { useViewStore } from './store'

/** `words`: what the badge folds, in core's words ("1 open question", "2 figures, 2 calculations"; core wip/strategy-n2c cba67b49, DL's
 *  ruling 7 Nov). Not yet in the vendored schema (re-vendored with n2c after N2), so it is read as optional here: absent, the glyphs alone. */
type BadgeT = NonNullable<ViewCard['badge']> & { readonly words?: string }
/** Core's words for what the badge folds, or null (none sent, or empty). */
export const badgeWords = (badge: BadgeT): string | null => (typeof badge.words === 'string' && badge.words !== '' ? badge.words : null)

export function toggleBadge(cardId: string, badge: BadgeT): Promise<boolean> {
  const { opened, setOpened } = useViewStore.getState()
  const open = new Map(opened.open)
  if (badge.open) open.delete(cardId)
  else open.set(cardId, badge.records)
  return setOpened({ open, all: opened.all })
}

export function Badge({ cardId, badge, at }: { cardId: string; badge: BadgeT; at: string }) {
  return (
    <button
      type="button" className={`nodrag nopan inline-flex min-h-[24px] min-w-[24px] items-center cursor-pointer text-left underline-offset-2 hover:underline ${badge.proposed ? 'rounded border border-dashed border-info px-1' : ''}`}
      title={badge.title} aria-label={badge.label} aria-expanded={badge.open} data-proposed={badge.proposed || undefined}
      onClick={(e) => { e.stopPropagation(); void toggleBadge(cardId, badge) }}
    >{badgeWords(badge) !== null
        // The card face names what is folded, in core's words, with core's glyphs kept beside them as the icon.
        ? <span className="inline-flex items-center gap-1"><span aria-hidden="true" data-view={`${at}.badge.text`}>{badge.text}</span><span data-view={`${at}.badge.words`}>{badge.words}</span></span>
        : <span data-view={`${at}.badge.text`}>{badge.text}</span>}{badge.proposed && badge.change !== '' ? <> <span className="text-info" data-view={`${at}.badge.change`}>{badge.change}</span></> : null}</button>
  )
}
