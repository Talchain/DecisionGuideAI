/**
 * 05 A1 tracks the focused subject shared by the canvas and panel for the current scenario. Lane C consumes this hook.
 */
import { create } from 'zustand'
import { useCanvasStore } from '../../canvas/store'
import { allOptionCards } from '../layout'
import { ringFrom } from '../reasoning/tabRing'
import { shownModel, useViewStore } from '../store'

export type FocusKind = 'card' | 'link' | 'option' | 'gap' | 'disagreement'
export type FocusSubject = { kind: FocusKind; id: string; cards: readonly string[]; source: 'canvas' | 'panel'; sid: string } | null

const useFocusStore = create<{ subject: FocusSubject }>(() => ({ subject: null }))

export function useFocusSubject(): FocusSubject {
  const sid = useViewStore((s) => s.sid)
  const subject = useFocusStore((s) => s.subject)
  return subject?.sid === sid ? subject : null
}

export function setFocusSubject(s: Omit<NonNullable<FocusSubject>, 'sid'> | null): void {
  ringFrom('focus-subject', [])
  const { sid } = useViewStore.getState()
  if (sid === null) return

  useFocusStore.setState({ subject: s === null ? null : { ...s, sid } })
  if (s?.source === 'panel') ringFrom('focus-subject', s.cards)
}

export function installCanvasFocus(): () => void {
  const unsubscribeCanvas = useCanvasStore.subscribe((next, prev) => {
    const { nodeIds } = next.selection
    if (nodeIds.size !== 1) return
    const [id] = nodeIds
    if (id === undefined || (prev.selection.nodeIds.size === 1 && prev.selection.nodeIds.has(id))) return

    const view = useViewStore.getState()
    const model = shownModel(view)
    if (!model?.cards.some((card) => card.id === id)) return

    const { subject } = useFocusStore.getState()
    if (subject?.source === 'panel' && subject.sid === view.sid && subject.cards.includes(id)) return

    const kind = allOptionCards(model).some((card) => card.id === id) ? 'option' : 'card'
    setFocusSubject({ kind, id, cards: [id], source: 'canvas' })
  })

  const clear = () => {
    ringFrom('focus-subject', [])
    useFocusStore.setState({ subject: null })
  }
  const unsubscribeView = useViewStore.subscribe((next, prev) => {
    if (next.sid !== prev.sid) clear()
  })

  return () => {
    unsubscribeCanvas()
    unsubscribeView()
    clear()
  }
}
