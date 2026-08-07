/**
 * scrollAnalysisResultIntoView — ROADMAP 2.204-R3, the DOM half.
 *
 * The policy half lives in runReturnSignal.spec.ts; the wiring half in
 * OutputsDock.runReturnsToOlumi.spec.tsx. This file pins the three things the
 * helper itself can get wrong: which card it picks, which alignment it asks for,
 * and what it does when there is nothing to scroll to.
 *
 * jsdom implements no layout (platform trap 3), so nothing here claims a pixel —
 * only which element was asked, with which options.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  scrollAnalysisResultIntoView,
  ANALYSIS_RESULT_CARD_SELECTOR,
} from '../scrollAnalysisResultIntoView'

function mountCards(count: number): HTMLElement[] {
  const cards: HTMLElement[] = []
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    el.setAttribute('data-testid', 'v5-analysis-result')
    el.dataset.index = String(i)
    el.scrollIntoView = vi.fn()
    document.body.appendChild(el)
    cards.push(el)
  }
  return cards
}

describe('scrollAnalysisResultIntoView', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('scrolls the card TOP into view', () => {
    const [card] = mountCards(1)
    expect(scrollAnalysisResultIntoView()).toBe(true)
    expect(card.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('RERUN: picks the LAST card, never the first', () => {
    // The transcript keeps every run's card. `querySelector` (first match) would
    // park the tester on the previous run's numbers — the exact defect the
    // "derive at call time" rule exists to prevent.
    const cards = mountCards(3)
    expect(scrollAnalysisResultIntoView()).toBe(true)
    expect(cards[0].scrollIntoView).not.toHaveBeenCalled()
    expect(cards[1].scrollIntoView).not.toHaveBeenCalled()
    expect(cards[2].scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('FAIL-CLOSED: reports false and throws nothing when no card is mounted', () => {
    expect(scrollAnalysisResultIntoView()).toBe(false)
  })

  it('FAIL-CLOSED: reports false when the environment has no scrollIntoView', () => {
    const el = document.createElement('div')
    el.setAttribute('data-testid', 'v5-analysis-result')
    ;(el as unknown as { scrollIntoView: unknown }).scrollIntoView = undefined
    document.body.appendChild(el)
    expect(scrollAnalysisResultIntoView()).toBe(false)
  })

  it('the selector is the testid V5AnalysisResultBlock actually renders', () => {
    // A selector constant is a hand-maintained mirror of a render site (trap 12).
    // This is the cheap half of guarding it; the component spec is the other
    // half — it queries the real rendered card by the same testid and would RED
    // if the render site moved.
    const [card] = mountCards(1)
    expect(document.querySelectorAll(ANALYSIS_RESULT_CARD_SELECTOR)).toHaveLength(1)
    expect(document.querySelector(ANALYSIS_RESULT_CARD_SELECTOR)).toBe(card)
  })
})
