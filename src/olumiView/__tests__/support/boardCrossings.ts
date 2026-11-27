import type { View } from '../../client'
import { cardLinks, causalPlaces, QUESTION, simpleStageRow } from '../../layout'
import { boardOf } from '../../canvas'
import { useViewStore } from '../../store'
import { showSimple } from '../../v12/simpleStore'
import { bezierPolyline, crossingCounts } from './crossings'

export type BoardCount = { crossings: number; cardHits: number; straight: number; links: number; groupLinks: number }

/**
 * The crossing instrument for Simple's layout: the board as Simple draws it at `roomW` (default folds, fixture heights),
 * counting card links AND the grouped-card connectors that `boardOf` adds, each sampled along the renderer's bezier (`crossings`,
 * `cardHits`); `straight` is the old straight-segment count, kept for comparison. Limits: rails (railOf) and size wires are drawn as
 * plain beziers here, and heights are the fixture's, not measured.
 */
export async function boardCrossings(view: View, roomW: number): Promise<BoardCount> {
  showSimple(view.id)
  useViewStore.setState({ sid: view.id, view })
  const { model, extras, links: groupLinks } = boardOf(view.model!, {})
  const places = await causalPlaces(model, new Map(), { row: simpleStageRow(roomW), extras, groupLinks })
  const heights = new Map<string, number>([...model.cards, ...extras].map((card) => [card.id, card.h ?? 90]))
  const boxes = [...places].map(([id, p]) => ({ id, x: p.x, y: p.y, w: p.w!, h: id === QUESTION ? 85 : heights.get(id) ?? 90 }))
  const links = [...cardLinks(model).map(({ link }) => ({ from: link.from, to: link.to })), ...groupLinks.map((l) => ({ from: l.from, to: l.to }))]
  const curved = crossingCounts(boxes, links, (_link, from, to) => bezierPolyline(from, to))
  return { ...curved, straight: crossingCounts(boxes, links).crossings, links: cardLinks(model).length, groupLinks: groupLinks.length }
}
