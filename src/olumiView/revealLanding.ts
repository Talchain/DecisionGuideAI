/**
 * THE REVEAL LANDS ON ITS DIFFERENCE (premium pass P1, DL 10 Nov; the approved V11 Reveal comp, 7 Nov v2.1). When a reveal is on the board,
 * the dock opens on the contested card's panel (RevealDock: the people's own words with their stance, Olumi's unconfirmed reading, the one
 * question, "Bring evidence" or "Keep it open"), as the comp shows it, instead of a generic next step the person has to look past. Once per
 * reveal (the scenario and the views its chips gather, as revealCamera keys it), only while nothing is open, only on the latest version.
 * Closing the panel is final for that reveal: it does not open again until the reveal changes or the page is opened again.
 *
 * Which card: core's disagreement chip first; else the chip that gathers the most people (the most-discussed card), in core's order on a
 * tie. Evidence chips never land: the panel is for the people's views.
 */
import { useEffect, useMemo } from 'react'
import { useViewStore } from './store'
import { revealOf, useReveal, type CardChip, type Reveal } from './reveal'
import { chipViewIds } from './layout'
import { openView } from './RevealMarks'
import { noteLanded } from './revealReturn'
import { useUIStore } from '../stores/uiStore'

/** The chip the dock lands on, or null when the reveal has no chip with views. */
export function landingChipOf(r: Reveal | null): CardChip | null {
  if (r === null) return null
  let best: CardChip | null = null
  for (const chips of r.cardChips.values()) {
    for (const c of chips) {
      if (c.kind === 'evidence' || c.views.length === 0) continue
      if (c.kind === 'disagreement' && best?.kind !== 'disagreement') { best = c; continue }
      if (best === null || (best.kind !== 'disagreement' && c.views.length > best.views.length)) best = c
    }
  }
  return best
}

/** The reveals this page has landed on: kept for the page's life, so a canvas mounted again (another scenario and back) never reopens it. */
const LANDED = new Set<string>()
/** Tests only: forget every landing. */
export function resetRevealLanding(): void { LANDED.clear() }

/** Mounted once beside the reveal camera (ViewCanvas). */
export function useRevealLanding(): void {
  const view = useViewStore((s) => s.view), sid = useViewStore((s) => s.sid), at = useViewStore((s) => s.at)
  const key = useMemo(() => {
    const ids = chipViewIds(revealOf(view)?.marks ?? []).join(',')
    return ids === '' ? '' : `${sid}:${ids}`
  }, [view, sid])
  useEffect(() => {
    // On an earlier version nothing lands, and the reveal is not spent: back on the latest it lands then.
    if (key === '' || at !== null || LANDED.has(key)) return
    LANDED.add(key)
    const o = useReveal.getState()
    if (o.selected !== null || o.evidence !== null) return
    const chip = landingChipOf(revealOf(useViewStore.getState().view))
    if (chip === null) return
    noteLanded(chip.key, useUIStore.getState().activeOutputTab)
    openView(chip.views[0]!, chip.card, chip.key)
  }, [key, at])
}
