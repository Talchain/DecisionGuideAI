import type { Rect } from './placeNear'
import type { ClosestAnchor } from './Tip'

type PlaceHost = {
  regionFor(el: ClosestAnchor | null): Rect
  openBoxes(): readonly Rect[]
  cards(el: ClosestAnchor | null): readonly Rect[]
}

const defaults: PlaceHost = {
  regionFor: () => ({ left: 8, top: 8, right: window.innerWidth - 8, bottom: window.innerHeight - 8 }),
  openBoxes: () => [],
  cards: () => [],
}

export const placeHost: PlaceHost = { ...defaults }

export function installPlaceHost(host: PlaceHost): () => void {
  Object.assign(placeHost, host)
  return () => { Object.assign(placeHost, defaults) }
}
