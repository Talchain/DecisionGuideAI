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
import { THREAD_SCROLLER_ATTRIBUTE } from '../../conversation/hooks/threadScroll'

/**
 * A thread (the scroller `ChatThread` marks) holding `count` cards. Geometry is explicit (jsdom has none): the
 * thread's top is at 100 and card i's top at 100 + 600·(i+1) - thread.scrollTop, so "bring card i to the thread's
 * top" means `thread.scrollTo({ top: 600·(i+1) + scrollTop-at-call })`.
 */
function mountThreadWithCards(count: number): { thread: HTMLElement; cards: HTMLElement[]; scrollTo: ReturnType<typeof vi.fn> } {
  const thread = document.createElement('div')
  thread.setAttribute(THREAD_SCROLLER_ATTRIBUTE, '')
  thread.getBoundingClientRect = () => ({ top: 100, bottom: 700, left: 0, right: 0, width: 0, height: 600, x: 0, y: 100, toJSON: () => ({}) })
  const scrollTo = vi.fn()
  ;(thread as unknown as { scrollTo: unknown }).scrollTo = scrollTo
  const cards: HTMLElement[] = []
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div')
    el.setAttribute('data-testid', 'v5-analysis-result')
    el.dataset.index = String(i)
    const top = 100 + 600 * (i + 1)
    el.getBoundingClientRect = () => ({ top: top - thread.scrollTop, bottom: top - thread.scrollTop + 400, left: 0, right: 0, width: 0, height: 400, x: 0, y: 0, toJSON: () => ({}) })
    el.scrollIntoView = vi.fn()
    thread.appendChild(el)
    cards.push(el)
  }
  document.body.appendChild(thread)
  return { thread, cards, scrollTo }
}

describe('scrollAnalysisResultIntoView', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('brings the card TOP to the thread\'s top by scrolling the THREAD, never scrollIntoView (which moves the dock too)', () => {
    const { cards, scrollTo } = mountThreadWithCards(1)
    expect(scrollAnalysisResultIntoView()).toBe(true)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith({ top: 600, behavior: 'smooth' })
    expect(cards[0].scrollIntoView, 'scrollIntoView scrolls every ancestor, the dock\'s overflow-hidden aside included').not.toHaveBeenCalled()
  })

  it('RERUN: picks the LAST card, never the first', () => {
    // The transcript keeps every run's card. `querySelector` (first match) would
    // park the tester on the previous run's numbers — the exact defect the
    // "derive at call time" rule exists to prevent.
    const { scrollTo } = mountThreadWithCards(3)
    expect(scrollAnalysisResultIntoView()).toBe(true)
    expect(scrollTo).toHaveBeenCalledTimes(1)
    expect(scrollTo).toHaveBeenCalledWith({ top: 1800, behavior: 'smooth' })
  })

  it('FAIL-CLOSED: reports false and throws nothing when no card is mounted', () => {
    expect(scrollAnalysisResultIntoView()).toBe(false)
  })

  it('FAIL-CLOSED: a card outside any chat thread is not scrolled, and the page is not moved', () => {
    const el = document.createElement('div')
    el.setAttribute('data-testid', 'v5-analysis-result')
    el.scrollIntoView = vi.fn()
    document.body.appendChild(el)
    expect(scrollAnalysisResultIntoView()).toBe(false)
    expect(el.scrollIntoView).not.toHaveBeenCalled()
  })

  it('the selector is the testid V5AnalysisResultBlock actually renders', () => {
    // A selector constant is a hand-maintained mirror of a render site (trap 12).
    // This is the cheap half of guarding it; the component spec is the other
    // half — it queries the real rendered card by the same testid and would RED
    // if the render site moved.
    const { cards } = mountThreadWithCards(1)
    expect(document.querySelectorAll(ANALYSIS_RESULT_CARD_SELECTOR)).toHaveLength(1)
    expect(document.querySelector(ANALYSIS_RESULT_CARD_SELECTOR)).toBe(cards[0])
  })
})
