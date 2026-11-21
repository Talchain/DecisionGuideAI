/**
 * The lit path (Paul, 21 Nov): highlight cards and links on the hovered or selected card's causal path.
 * Everything off the path keeps its normal look. ViewCanvas writes the path; ViewLinkEdge reads it.
 */
import type { CSSProperties, HTMLAttributes } from 'react'
import { create } from 'zustand'

/** The card ids on the lit path, or null when no path is lit (nothing hovered or selected with a neighbour to follow). */
export const useFocusPath = create<{ path: ReadonlySet<string> | null }>(() => ({ path: null }))

/** A node as path marking reads it (ViewCanvas's React Flow nodes). */
export type Focusable = { id: string; type?: string; selected?: boolean; className?: string; style?: CSSProperties; domAttributes?: HTMLAttributes<HTMLDivElement> & { 'data-path-tone'?: 'olumi' | 'person' } }

/** The card that lights the path: the hovered card, else the selected one; only a node of `cardType` lights one. */
export function focusIdOf(nodes: readonly Focusable[], hovered: string | null, cardType: string): string | null {
  const selected = nodes.find((n) => n.selected === true && n.type === cardType)?.id ?? null
  return hovered !== null && nodes.some((n) => n.id === hovered && n.type === cardType) ? hovered : selected
}

/** Mark cards on the lit path, preserving their classes and styles. Off-path nodes and the question stay unchanged. No path: the same array. */
export function markPath<N extends Focusable>(nodes: N[], lit: ReadonlySet<string> | null, question: string, toneOf?: (node: N) => 'olumi' | 'person'): N[] {
  if (lit === null) return nodes
  return nodes.map((n): N => (n.id !== question && lit.has(n.id) ? {
    ...n, className: `${n.className ?? ''} v12-on-path`.trim(),
    ...(toneOf == null ? {} : { domAttributes: { ...n.domAttributes, 'data-path-tone': toneOf(n) } }),
  } : n))
}
