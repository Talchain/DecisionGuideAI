/**
 * ⭐ ONE GLYPH PER CARD CUE — the picture the card draws AND the picture the
 * visual key draws, from one place (design-gap audit row 28; contract v3 §03
 * "Icons make the next reasoning move accessible").
 *
 * The key (`CanvasLegendPopover`) exists so these glyphs are a public code, not
 * a private one. A key that picked its own glyphs would be a hand-maintained
 * mirror of the card (CLAUDE.md trap 12): the card changes its icon, the key
 * keeps the old one, and the drift reads green. So each card component and the
 * key import the SAME reference from here, and
 * `CanvasLegendPopover.iconRows.spec.tsx` compares what the two actually paint.
 *
 * References only — no JSX, no hooks, no store — so the key, which the toolbar
 * and the footer both mount, can import it without pulling a card's behaviour
 * or its store wiring into the chrome.
 *
 * Source exceptions are NOT here: their glyphs already have one owner,
 * `VALUE_PROVENANCE_ICON` (`domain/valueProvenanceIcon.ts`), which the card's
 * `NodeProvenanceMark` and the key both read.
 */
import { Brain, LocateFixed, MessageCircle, SearchCheck, type LucideIcon } from 'lucide-react'

/**
 * "Worth reviewing" — `NodeAttentionMarker`. Lucide's stock equivalent of the
 * contract's target mark (circle, centre, four ticks); see that file.
 */
export const ATTENTION_CUE_GLYPH: LucideIcon = LocateFixed

/** The attention glyph's lighter stroke — contract v3.1 `.node .attention`. */
export const ATTENTION_CUE_STROKE = 1.6

/** "Evidence worth seeking" — the rail's evidence icon (`NodeSignalRailIcons`). */
export const EVIDENCE_CUE_GLYPH: LucideIcon = SearchCheck

/** "Behavioural check" — the rail's behaviour icon (`NodeSignalRailIcons`). */
export const BEHAVIOUR_CUE_GLYPH: LucideIcon = Brain

/**
 * "Explore with Olumi" — the rail's coaching icon (`NodeCoachingIcon`).
 * `MessageCircle` exactly: Panel's R3 made "ask / hand this to Olumi" one glyph
 * across the canvas and the panel (see `askOlumiOneGlyph.spec.tsx`).
 */
export const COACHING_CUE_GLYPH: LucideIcon = MessageCircle
