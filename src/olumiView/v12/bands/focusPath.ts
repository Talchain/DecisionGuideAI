/**
 * The lit path (Paul, 16 Nov, R1): while a card is hovered or selected, the cards and links off its causal path fade (production's rule:
 * cards to 0.25, links to 0.18), and only then; nothing is faded at rest. The board writes the path here (ViewCanvas), the links read it
 * (ViewLinkEdge), so both fade from one answer (bands.ts causalPathOf).
 */
import type { CSSProperties } from 'react'
import { create } from 'zustand'

/** The opacity of a card off the lit path (production's own: canvas/nodes/BaseNode opacity-25) and of a link off it (canvas/edges/StyledEdge, 0.18). */
export const CARD_OFF_PATH_OPACITY = 0.25
export const LINK_OFF_PATH_OPACITY = 0.18

/** The card ids on the lit path, or null when no path is lit (nothing hovered or selected with a neighbour to follow). */
export const useFocusPath = create<{ path: ReadonlySet<string> | null }>(() => ({ path: null }))

/** A node as the fade reads it (ViewCanvas's React Flow nodes). */
export type Fadeable = { id: string; type?: string; selected?: boolean; className?: string; style?: CSSProperties }

/** The card that lights the path: the hovered card, else the selected one; only a node of `cardType` lights one. */
export function focusIdOf(nodes: readonly Fadeable[], hovered: string | null, cardType: string): string | null {
  const selected = nodes.find((n) => n.selected === true && n.type === cardType)?.id ?? null
  return hovered !== null && nodes.some((n) => n.id === hovered && n.type === cardType) ? hovered : selected
}

/** The nodes with every one off the lit path faded (CARD_OFF_PATH_OPACITY, class `v12-off-path`); the question never fades. No path: the same array. */
export function fadeOffPath<N extends Fadeable>(nodes: N[], lit: ReadonlySet<string> | null, question: string): N[] {
  if (lit === null) return nodes
  return nodes.map((n): N => (n.id === question || lit.has(n.id) ? n : { ...n, style: { ...n.style, opacity: CARD_OFF_PATH_OPACITY, transition: 'opacity 300ms ease' }, className: `${n.className ?? ''} v12-off-path`.trim() }))
}
