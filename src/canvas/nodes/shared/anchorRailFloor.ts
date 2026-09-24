/**
 * ⛔ THE ANCHOR RAIL SITS BESIDE ONLY WHERE THE OLD NORMAL FLOOR PUT IT.
 *
 * Landing (zoom 0.5, label scale 2) now counts as the Normal rung. At scale 2
 * the Question's beside-rail covered its own "Top gap" line (review
 * 5822709101, Canvas Browser Gate `nodeControlOcclusion` @vendor-selection
 * 1440×900, `dec_cdp`; base ✓). So an anchor (Question, Goal) keeps the rail
 * beside its text only at zoom ≥ `ICON_LEGIBLE_ZOOM`; below it, the anchor
 * keeps its old landing rule — hover row drawn below the card.
 *
 * `LodSync` writes this from the live viewport, as it writes `lodRung`. Kept
 * out of the canvas store and out of xyflow's: a card rendered without either
 * provider (many specs) reads the default, `true`, which is the old behaviour.
 */
import { create } from 'zustand'
import { ICON_LEGIBLE_ZOOM } from '../../utils/zoomLegibility'

interface AnchorRailFloorState {
  readonly fitsBeside: boolean
}

export const useAnchorRailFloorStore = create<AnchorRailFloorState>(() => ({ fitsBeside: true }))

export const anchorRailFitsBesideAtZoom = (zoom: number): boolean => zoom >= ICON_LEGIBLE_ZOOM

export const selectAnchorRailFitsBeside = (s: AnchorRailFloorState): boolean => s.fitsBeside

export function setAnchorRailFitsBeside(fitsBeside: boolean): void {
  if (useAnchorRailFloorStore.getState().fitsBeside !== fitsBeside) useAnchorRailFloorStore.setState({ fitsBeside })
}
