/** The layer on (V12 layers menu). Its own store: R24's lens bar (`lens.ts`) is frozen and untouched. View only: a layer writes nothing. */
import { useMemo } from 'react'
import { create } from 'zustand'
import { useViewStore } from '../../store'
import { layerEntries, marksOf, type LayerId, type LayerMarks } from './layers'

export const useLayer = create<{ layer: LayerId; sid: string | null }>(() => ({ layer: 'full', sid: null }))
/** Choose a layer for the scenario open now (it does not carry into another scenario). */
export const chooseLayer = (layer: LayerId): void => useLayer.setState({ layer, sid: useViewStore.getState().sid })

/** The layer that is really on: one the View can still fill (an option taken out, or a figure's evidence removed, drops back to the full model). */
export function useActiveLayer(): LayerId {
  const layer = useLayer((s) => s.layer)
  const layerSid = useLayer((s) => s.sid)
  const sid = useViewStore((s) => s.sid)
  const view = useViewStore((s) => s.view)
  return useMemo(() => (layer === 'full' || (layerSid === sid && layerEntries(view).some((e) => e.id === layer)) ? layer : 'full'), [layer, layerSid, sid, view])
}

/** The canvas annotations of the layer on, worked out once per View. Null for the full model. */
export function useLayerMarks(): LayerMarks | null {
  const layer = useActiveLayer()
  const view = useViewStore((s) => s.view)
  return useMemo(() => marksOf(view, layer), [view, layer])
}

/** A card's place in the layer on: `dim` when the layer sets it back, `tag` Olumi's note on it (an option's name on a sensitive figure; a basis on a figure card). */
export function useLayerCard(id: string): { dim: boolean; emphasised: boolean; tag: string | null; basis: LayerMarks['basis'] extends ReadonlyMap<string, infer B> ? B | null : never } | null {
  const m = useLayerMarks()
  if (m === null) return null
  const on = m.on.has(id)
  return { dim: m.dim && !on, emphasised: m.dim && on, tag: m.tags.get(id) ?? null, basis: m.basis.get(id) ?? null }
}

/** A link's place in the layer on: emphasised, or (Causal graph) the sign it carries. */
export function useLayerLink(index: number): { emphasised: boolean; dim: boolean; sign: LayerMarks['signs'] extends ReadonlyMap<number, infer S> ? S | null : never } | null {
  const m = useLayerMarks()
  if (m === null) return null
  const on = m.links.has(index)
  return { emphasised: on, dim: m.dim && !on, sign: m.signs.get(index) ?? null }
}
