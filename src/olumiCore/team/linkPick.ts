/**
 * A LINK CHIP OPENS WHERE THE TEAM CAN ACT ON ITS LINK (Paul's acceptance step 6, DL 9 Nov). Selecting a link's chip (core
 * `collab.link_marks`, on its line or on the card that folds it) opens the dock's Team tab with that link already picked in "Where you stand
 * on a link" (LinkStance), so doubting or keeping it is one choice and a few words, never a hunt through the picker. Where the team's
 * explanations of that link already differ, the tab is brought to that difference; otherwise to the stance form.
 *
 * The pick waits here until the form takes it: the form may not be drawn yet (the Team tab opens on this click), and it takes only a link it
 * offers (core's `model.holdable`), so a chip never picks a link the person cannot take a stance on. Nothing opens on an earlier version.
 */
import { useEffect } from 'react'
import { create } from 'zustand'
import { useUIStore } from '../../stores/uiStore'
import { useDifferences } from './differences'
import { useViewStore } from '../../olumiView/store'

type LinkRef = { readonly record: string; readonly part: string | null }

/** The stance form's key for a link: no part, whether core says null or '', is one and the same. */
export const stanceKeyOf = (l: LinkRef): string => `${l.record}|${l.part || ''}`
/** Core's record for a link in the differences (`link:<record>[:<part>]`). */
const differKeyOf = (l: LinkRef): string => `link:${l.record}${l.part ? `:${l.part}` : ''}`

export const useLinkPick = create<{ want: string | null }>()(() => ({ want: null }))

const quoted = (s: string) => s.replace(/["\\]/g, '\\$&')

/** Open the Team tab at this link: picked in the stance form, and brought into view at its difference where one exists, else at the form. */
export function openLinkStance(link: LinkRef): void {
  if (useViewStore.getState().at !== null) return
  useLinkPick.setState({ want: stanceKeyOf(link) })
  useUIStore.getState().forceActivateOutputTab('team')
  const key = differKeyOf(link)
  const ids = (useDifferences.getState().data?.differences ?? []).filter((d) => d.record === key).map((d) => `team-difference-${d.record}${d.goal ? `-${d.goal}` : ''}`)
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const at = ids.map((id) => document.querySelector(`[data-testid="${quoted(id)}"]`)).find((e) => e !== null) ?? document.querySelector('[data-testid="team-link-stance"]')
    at?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }))
}

/** The stance form takes the waiting pick once it offers that link (`offered`: the form's keys), then the pick is spent. */
export function useTakeLinkPick(offered: readonly string[], take: (key: string) => void): void {
  const want = useLinkPick((s) => s.want)
  const ready = want !== null && offered.includes(want)
  useEffect(() => {
    if (!ready || want === null) return
    take(want)
    useLinkPick.setState({ want: null })
  }, [ready, want]) // eslint-disable-line react-hooks/exhaustive-deps -- `take` is the form's setter, the same on every draw
}
