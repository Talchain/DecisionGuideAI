/**
 * The lit path (Paul, 16 Nov, R1): while a card is hovered or selected, the cards and links off its causal path fade (production's rule:
 * cards to 0.25, links to 0.18), and only then; nothing is faded at rest. The board writes the path here (ViewCanvas), the links read it
 * (ViewLinkEdge), so both fade from one answer (bands.ts causalPathOf).
 */
import { create } from 'zustand'

/** The card ids on the lit path, or null when no path is lit (nothing hovered or selected with a neighbour to follow). */
export const useFocusPath = create<{ path: ReadonlySet<string> | null }>(() => ({ path: null }))
