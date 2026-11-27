import { useCanvasStore } from '../../canvas/store'
import { allOptionCards } from '../layout'
import { ringFrom } from '../reasoning/tabRing'
import { shownModel, useViewStore } from '../store'
import { useStoredFocusSubject } from './state'
import { setFocusSubject } from './subject'

export function installCanvasFocus(): () => void {
  function clear() {
    ringFrom('focus-subject', [])
    useStoredFocusSubject.setState({ subject: null })
  }

  const unsubscribeView = useViewStore.subscribe((next, prev) => {
    if (next.sid !== prev.sid) clear()
  })
  const unsubscribeCanvas = useCanvasStore.subscribe((next, prev) => {
    const { nodeIds } = next.selection
    const { subject } = useStoredFocusSubject.getState()
    if (nodeIds.size === 0 && prev.selection.nodeIds.size > 0 && subject?.source === 'canvas') {
      setFocusSubject(null)
      return
    }
    if (nodeIds.size !== 1) return
    const [id] = nodeIds
    if (id === undefined || (prev.selection.nodeIds.size === 1 && prev.selection.nodeIds.has(id))) return
    const state = useViewStore.getState()
    const model = shownModel(state)
    if (model === null || !model.cards.some((card) => card.id === id)) return
    if (subject?.source === 'panel' && subject.sid === state.sid && subject.cards.includes(id)) return
    const kind = allOptionCards(model).some((card) => card.id === id) ? 'option' : 'card'
    setFocusSubject({ kind, id, cards: [id], source: 'canvas' })
  })

  return () => {
    unsubscribeCanvas()
    unsubscribeView()
    clear()
  }
}
