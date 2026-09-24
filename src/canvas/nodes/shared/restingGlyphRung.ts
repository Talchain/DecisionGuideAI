/**
 * ⭐ ONE RESTING ICON SET — the rung gate for the glyphs a card carries at rest
 * (contract v3.1 pt 6; gap U6, 24 Sep).
 *
 * Paul's two served screenshots sat either side of `ICON_LEGIBLE_ZOOM`: at the
 * `full` rung the cards carried the rail's coaching icon; one rung down, at
 * `quiet`, the icon was gone but OTHER resting glyphs were still hanging off the
 * cards — the evidence-gap "?" on factor corners and the corner coaching marker.
 * Two different icon sets for one board, decided by a two-point zoom difference.
 *
 * v3.1 pt 6: "Keep one very discreet, consistent coaching icon at Normal zoom.
 * Hide it at quiet/far zoom, where selection and the inspector still reach it."
 * The contract's far-zoom rung is "readable identity and a simple attention
 * cue" — so the resting glyphs that are neither follow the coaching icon off the
 * card at `quiet` and `line`. The "Worth reviewing" attention marker is NOT
 * gated here: it is the one far-zoom cue the contract keeps.
 *
 * ⚠ THE SAME PREDICATE `useCoachingIconChip` READS (`NodeCoachingIcon.tsx`,
 * `atNormalZoom`), undefined-safe the same way: a store double without
 * `lodRung` reads as `full`, an ordinary card. The thresholds are untouched —
 * this reads the rung `LodSync` already writes. `restingIconSet.v31.cards.spec`
 * pins that the icon and every glyph gated here agree at all three rungs.
 */
export function selectRestingGlyphsShown(state: unknown): boolean {
  return ((state as { lodRung?: string } | null | undefined)?.lodRung ?? 'full') === 'full'
}
