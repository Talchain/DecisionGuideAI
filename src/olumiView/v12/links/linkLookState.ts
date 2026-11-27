import type { ViewLink } from '../../client'
import { linkByOlumi } from '../../layout'
import { useDriverLinks } from '../../lens'
import { useViewStore } from '../../store'
import { useFocusPath } from '../bands/focusPath'
import { firstDraft as firstDraftOf } from '../fields/fields'
import type { EdgeLookState } from './edgeLook'

export type ViewLinkData = { link: ViewLink; i: number }
type LinkEnds = { source: string; target: string }

export function useLinkLookInputs() {
  const model = useViewStore((s) => s.view?.model)
  const firstDraft = useViewStore((s) => s.view !== null && firstDraftOf(s.view).firstDraft === true)
  const drivers = useDriverLinks()
  const path = useFocusPath((s) => s.path)
  return { model, firstDraft, drivers, path }
}

/** Canvas endpoint ids and Core link indices identify the edge's path and lens. */
export function linkLookState(
  { source, target }: LinkEnds,
  { link, i }: ViewLinkData,
  { model, firstDraft, drivers, path }: ReturnType<typeof useLinkLookInputs>,
): EdgeLookState {
  return {
    link,
    byOlumi: model != null && linkByOlumi(model, link.from, link.to),
    firstDraft,
    driver: drivers.has(i),
    onPath: path !== null && path.has(source) && path.has(target),
  }
}
