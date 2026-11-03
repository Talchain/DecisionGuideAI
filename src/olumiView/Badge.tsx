/**
 * A card's badge: the records core folded into it, as core words them. Pressing it opens or closes them, a new read of the View with what
 * the person has opened (`?open=` card id → the record ids the badge holds, exactly as the View handed them out); nothing is re-folded
 * here (olumi-core API.md, the View, "What the person has opened").
 */
import type { ViewCard } from './client'
import { useViewStore } from './store'

type BadgeT = NonNullable<ViewCard['badge']>

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
      type="button" className="nodrag nopan cursor-pointer text-left underline-offset-2 hover:underline" title={badge.title} aria-label={badge.label}
      aria-expanded={badge.open} data-view={`${at}.badge.text`} onClick={(e) => { e.stopPropagation(); void toggleBadge(cardId, badge) }}
    >{badge.text}</button>
  )
}
