/**
 * LOCAL ADAPTER for lane B's focus hook (05 A1), with EXACTLY the signature of `src/olumiView/focus/subject.ts` on wip/s4-lane-b-panel
 * (06-LANE-B-FOCUS-HOOK.md). S4 swaps `./focusAdapter` for `../../focus/subject` at the join; nothing else changes.
 * Behaviour here: a panel subject set with `setFocusSubject` wins; otherwise one selected canvas node is the subject (`option` when it is an
 * option card), read live from the canvas store, so this branch needs no installer (`installCanvasFocus` is a no-op here; lane B installs its own).
 */
import { useMemo } from 'react'
import { create } from 'zustand'
import { useCanvasStore } from '../../../canvas/store'
import { allOptionCards } from '../../layout'
import { ringFrom } from '../../reasoning/tabRing'
import { shownModel, useViewStore } from '../../store'

export type FocusKind = 'card' | 'link' | 'option' | 'gap' | 'disagreement'
export type FocusSubject = { kind: FocusKind; id: string; cards: readonly string[]; source: 'canvas' | 'panel'; sid: string } | null

const usePanelSubject = create<{ subject: FocusSubject }>(() => ({ subject: null }))

export function useFocusSubject(): FocusSubject {
  const sid = useViewStore((s) => s.sid)
  const model = useViewStore(shownModel)
  const panel = usePanelSubject((s) => s.subject)
  const ids = useCanvasStore((s) => s.selection.nodeIds)
  return useMemo(() => {
    if (panel !== null && panel.sid === sid) return panel
    if (sid === null || model == null || ids.size !== 1) return null
    const [id] = [...ids]
    if (id === undefined || !model.cards.some((c) => c.id === id)) return null
    const kind: FocusKind = allOptionCards(model).some((c) => c.id === id) ? 'option' : 'card'
    return { kind, id, cards: [id], source: 'canvas', sid }
  }, [panel, sid, model, ids])
}

export function setFocusSubject(s: Omit<NonNullable<FocusSubject>, 'sid'> | null): void {
  ringFrom('focus-subject', [])
  const { sid } = useViewStore.getState()
  if (sid === null) return
  usePanelSubject.setState({ subject: s === null ? null : { ...s, sid } })
  if (s?.source === 'panel') ringFrom('focus-subject', s.cards)
}

export function installCanvasFocus(): () => void {
  return () => {}
}
