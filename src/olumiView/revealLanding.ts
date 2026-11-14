/**
 * THE REVEAL LANDS ON ITS DIFFERENCE (premium pass P1, DL 10 Nov; the approved V11 Reveal comp, 7 Nov v2.1). When a reveal is on the board,
 * the dock opens on the contested card's panel (RevealDock: the people's own words with their stance, Olumi's unconfirmed reading, the one
 * question, "Bring evidence" or "Keep it open"), as the comp shows it, instead of a generic next step the person has to look past. Once per
 * reveal (the scenario and the views its chips gather, as revealCamera keys it), only while nothing is open, only on the latest version.
 * Closing the panel is final for that reveal: it does not open again until the reveal changes only when new views are revealed.
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
import { viewLaying } from './canvas'

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
const STORAGE_PREFIX = 'olumi:reveal-landed:'
const hasLanded = (key: string): boolean => {
  try { return LANDED.has(key) || localStorage.getItem(`${STORAGE_PREFIX}${key}`) === '1' } catch { return LANDED.has(key) }
}
const rememberLanding = (key: string): void => {
  LANDED.add(key)
  try { localStorage.setItem(`${STORAGE_PREFIX}${key}`, '1') } catch { /* memory still prevents repeated landings */ }
}
/** Tests only: forget every landing. */
export function resetRevealLanding(persistent = true): void {
  LANDED.clear()
  if (!persistent) return
  try { for (const k of Object.keys(localStorage)) if (k.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k) } catch { /* unavailable */ }
}

/** Mounted once beside the reveal camera (ViewCanvas). */
export function useRevealLanding(): void {
  const view = useViewStore((s) => s.view), sid = useViewStore((s) => s.sid), at = useViewStore((s) => s.at)
  const key = useMemo(() => {
    const ids = chipViewIds(revealOf(view)?.marks ?? []).join(',')
    return ids === '' ? '' : `${sid}:${view?.you_id}:${ids}`
  }, [view, sid])
  useEffect(() => {
    // On an earlier version nothing lands, and the reveal is not spent: back on the latest it lands then.
    if (key === '' || at !== null || hasLanded(key)) return
    const land = () => {
      const o = useReveal.getState()
      if (o.selected !== null || o.evidence !== null || hasLanded(key)) return
      const chip = landingChipOf(revealOf(useViewStore.getState().view))
      if (chip === null) return
      rememberLanding(key)
      noteLanded(chip.key, useUIStore.getState().activeOutputTab)
      openView(chip.views[0]!, chip.card, chip.key)
    }
    // Capture the opening camera after layout and framing settle, rather than an intermediate first-paint transform.
    const pane = document.querySelector('.react-flow__viewport')
    if (pane === null) { land(); return }
    let raf = 0, last = '', since = performance.now()
    const start = since
    const tick = () => {
      const nodes = [...document.querySelectorAll('.react-flow__node')]
      const signature = getComputedStyle(pane).transform + nodes.map((n) => { const r = n.getBoundingClientRect(); return `${r.x},${r.y},${r.width},${r.height}` }).join('|')
      if (viewLaying() || signature !== last) { last = signature; since = performance.now() }
      if (!viewLaying() && nodes.length > 0 && performance.now() - since >= 800) { land(); return }
      // Landing is optional; a canvas that has not settled keeps its explicit chip opener.
      if (performance.now() - start < 20_000) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [key, at])
}
