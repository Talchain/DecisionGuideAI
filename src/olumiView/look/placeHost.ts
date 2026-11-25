import type { Rect } from './placeNear'

type PlaceHost = {
  regionFor(el: Element | null): Rect
  openBoxes(): readonly Rect[]
  cards(el: Element | null): readonly Rect[]
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
