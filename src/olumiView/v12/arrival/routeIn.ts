import { useCallback, useLayoutEffect, useRef } from 'react'
import { useCanvasStore } from '../../../canvas/store'
import type { View } from '../../client'
import { boardDraftOf } from '../../DraftingBoard'
import { drawnModelOf } from '../../layout'
import { useViewStore } from '../../store'

const firstModelOf = (prev: View | null, next: View) =>
  prev?.id === next.id && boardDraftOf(prev) !== null && next.model?.cards.length ? next.model : null

/**
 * The first-arrival route in (Paul, 26 Nov): when a scenario's first model arrives after its draft, ring Core's deciding figure, by Core's id only:
 * `run.find_out[0].figures[0].id`, else the first `run.waits_on` item that is a drawn card; else nothing. No words are added; the chat lead says them.
 */
export function routeInOf(prev: View | null, next: View): string | null {
  const model = firstModelOf(prev, next)
  return model === null ? null : routeTargetOf(model)
}

export function routeTargetOf(model: NonNullable<View['model']>): string | null {
  const ids = new Set(drawnModelOf(model).cards.map((card) => card.id))
  const figure = model.run?.find_out?.[0]?.figures?.[0]?.id
  if (figure !== undefined && ids.has(figure)) return figure
  return model.run?.waits_on?.items.find((item) => ids.has(item.id))?.id ?? null
}

const arrived = new Set<string>()

export function useRouteIn(
  view: View | null,
  movedAt: { current: number },
  focusCard: (id: string, canFocus: () => boolean, selectOnly: boolean) => void,
): () => void {
  const activity = useRef(0)
  const draftStart = useRef({ activity: 0, moves: 0 })
  const noteCardMove = useCallback(() => { activity.current += 1 }, [])

  useLayoutEffect(() => useCanvasStore.subscribe(({ selection }, prev) => {
    if (selection === prev.selection) return
    const added = [...selection.nodeIds].some((id) => !prev.selection.nodeIds.has(id))
      || [...selection.edgeIds].some((id) => !prev.selection.edgeIds.has(id))
    if (added) activity.current += 1
  }), [])

  // The scenario whose draft this page saw running: its first model may arrive after a View that says only "done", so the draft is remembered, not read off the View before.
  const drafted = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (view === null || arrived.has(view.id)) return
    if (boardDraftOf(view) !== null) {
      if (drafted.current !== view.id) draftStart.current = { activity: activity.current, moves: movedAt.current }
      drafted.current = view.id
      return
    }
    if (drafted.current !== view.id || !view.model?.cards.length) return
    arrived.add(view.id)

    const id = routeTargetOf(view.model)
    if (id === null) return
    const start = draftStart.current
    const canFocus = () => {
      const current = useViewStore.getState()
      return current.view?.id === view.id && current.at === null
        && activity.current === start.activity && movedAt.current === start.moves
    }
    if (canFocus()) focusCard(id, canFocus, true)
  }, [view, movedAt, focusCard])

  return noteCardMove
}
