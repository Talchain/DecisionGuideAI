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
 *  ruling 7 Nov); `icon`: its glyphs alone, with no sign and no count ("○", "● ↝ ⚑"; core cd99ab32), since `text` carries the count the
 *  words say again. Not yet in the vendored schema (re-vendored with n2c after N2), so both are read as optional here. */
type BadgeT = NonNullable<ViewCard['badge']> & { readonly words?: string; readonly icon?: string }
const said = (s: unknown): s is string => typeof s === 'string' && s !== ''
/** Core's icon and words for what the badge folds, only when core sends both; else null (the badge draws core's `text` alone). */
export const badgeNamed = (badge: BadgeT): { readonly icon: string; readonly words: string } | null =>
  said(badge.icon) && said(badge.words) ? { icon: badge.icon, words: badge.words } : null
/** Core's face for the badge (olumi.view/3 `badge.face`, DL 10 Nov): whole words composed from its counts that fit one 12px line of the card
 *  ("1 claim, 1 link and 2 more"), never cut here; its `words` stay whole on hover. Null from a core before `face`. */
export const badgeFace = (badge: BadgeT & { readonly face?: string }): string | null => (said(badge.face) ? badge.face : null)

export function toggleBadge(cardId: string, badge: BadgeT): Promise<boolean> {
  const { opened, setOpened } = useViewStore.getState()
  const open = new Map(opened.open)
  if (badge.open) open.delete(cardId)
  else open.set(cardId, badge.records)
  return setOpened({ open, all: opened.all })
}

export function Badge({ cardId, badge, at }: { cardId: string; badge: BadgeT; at: string }) {
  const face = badgeFace(badge), named = face === null ? badgeNamed(badge) : null
  // With a face, the hover says the badge's words whole first (the face may say "and 2 more"), then core's title for what it folds.
  const title = face !== null && said(badge.words) ? (said(badge.title) ? `${badge.words}\n${badge.title}` : badge.words) : badge.title
  return (
    <button
      type="button" className={`nodrag nopan inline-flex min-h-[24px] min-w-[24px] items-center cursor-pointer text-left underline-offset-2 hover:underline ${badge.proposed ? 'rounded border border-dashed border-info px-1' : ''}`}
      title={title} aria-label={badge.label} aria-expanded={badge.open} data-proposed={badge.proposed || undefined} data-badge-words={face === null ? undefined : badge.words}
      onClick={(e) => { e.stopPropagation(); void toggleBadge(cardId, badge) }}
    >{face !== null
        // One line, whole (core keeps it within the card), core's glyphs before it when it sends any.
        ? <span className="inline-flex items-center gap-1 whitespace-nowrap">{said(badge.icon) ? <span aria-hidden="true" data-view={`${at}.badge.icon`}>{badge.icon}</span> : null}<span data-view={`${at}.badge.face`}>{face}</span></span>
        : named !== null
        // The card face names what is folded, in core's words, with core's glyphs (no count: the words say it) as the icon.
        // DL round 5 (rehearsal item 9): core's words wrap without leaving one word alone on the last line ('out').
        ? <span className="inline-flex items-start gap-1"><span aria-hidden="true" className="shrink-0 whitespace-nowrap" data-view={`${at}.badge.icon`}>{named.icon}</span><span className="[text-wrap:pretty]" data-view={`${at}.badge.words`}>{named.words}</span></span>
        : <span data-view={`${at}.badge.text`}>{badge.text}</span>}{badge.proposed && badge.change !== '' ? <> <span className="text-info" data-view={`${at}.badge.change`}>{badge.change}</span></> : null}</button>
  )
}
