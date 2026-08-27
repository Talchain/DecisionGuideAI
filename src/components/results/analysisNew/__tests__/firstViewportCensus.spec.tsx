/**
 * FIRST-VIEWPORT CENSUS — the check that catches what per-component tests cannot.
 *
 * ⭐ WHY THIS FILE EXISTS, MEASURED NOT THEORISED. On a real completed run the
 * first viewport of Analysis (New) said the same three things twice, roughly
 * 120px apart:
 *
 *     glance verdict   "Sensitive — small changes could flip this result"
 *     key insight #1   "This result is sensitive to uncertainty /
 *                       small changes could flip this result"
 *
 * …and the same again for the leader sentence and the hinge. Ninety tests were
 * green at the time, and NONE of them could see it: every one rendered a single
 * section, and duplication is a property of the COMPOSITION. It was found by
 * looking at a screenshot.
 *
 * This is the automated form of that look. It renders the whole surface and
 * asserts a property of the assembled thing rather than of any part: no
 * sentence the user reads is repeated.
 *
 * ⚠ WHAT IT DELIBERATELY DOES NOT DO. It makes no claim about pixels, layout,
 * the fold or visual hierarchy — jsdom cannot support one (trap 3), and a
 * spec that pretended otherwise would be worse than none. Height and width are
 * witnessed in a real browser; what is mechanised here is TEXT REDUNDANCY,
 * which jsdom is authoritative about.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { genuineDecision, highUncertainty, openStrategicChallenge } from './analysisNewFixtures'

afterEach(() => cleanup())

const renderSurface = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_census"
    />,
  )

/**
 * Sentences a user actually reads, normalised.
 *
 * ⚠ ONLY LEAF ELEMENTS. Taking `textContent` from every node would count each
 * sentence once per ancestor and make the duplicate check fire on everything —
 * a guard that always fails is as useless as one that never does.
 */
function visibleSentences(root: HTMLElement): string[] {
  const out: string[] = []
  root.querySelectorAll('p, span, h3, li, dd, dt, button').forEach((el) => {
    if (el.querySelector('p, span, h3, li, dd, dt, button')) return
    const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    // Short fragments are furniture (counts, chevrons, one-word chips), not
    // claims about the user's situation.
    if (t.length >= 25) out.push(t.toLowerCase())
  })
  return out
}

describe('no claim is stated twice on the assembled surface', () => {
  for (const [name, make] of Object.entries({
    'a genuine decision': genuineDecision,
    'an open strategic challenge': openStrategicChallenge,
    'a high-uncertainty run': highUncertainty,
  })) {
    it(`states each sentence once — ${name}`, () => {
      const { container } = renderSurface(make())
      const sentences = visibleSentences(container.querySelector('[data-testid="analysis-new-tab-body"]')!)

      // POSITIVE CONTROL: an empty census would pass this trivially, and that is
      // exactly how a composition guard rots (trap 13).
      expect(sentences.length, 'the surface rendered almost no prose — this census is vacuous').toBeGreaterThan(2)

      const seen = new Map<string, number>()
      for (const s of sentences) seen.set(s, (seen.get(s) ?? 0) + 1)
      const repeated = [...seen.entries()].filter(([, n]) => n > 1).map(([s]) => s)
      expect(repeated, `these sentences appear more than once on one surface:\n${repeated.join('\n')}`).toEqual([])
    })
  }
})

describe('the glance and the sections below it do not restate each other', () => {
  it('no key insight repeats the glance headline or its trust line', () => {
    // The EXACT defect that shipped, bound to the two surfaces by testid so a
    // future change that reintroduces it fails here by name.
    renderSurface(genuineDecision())
    const glance = screen.getByTestId('analysis-new-glance').textContent ?? ''
    const insights = screen.queryByTestId('analysis-new-key-insights')?.textContent ?? ''

    const headline = screen.getByTestId('analysis-new-glance-headline').textContent ?? ''
    expect(headline.length).toBeGreaterThan(10)
    expect(insights).not.toContain(headline)

    const trust = screen.getByTestId('analysis-new-glance-verdict').textContent ?? ''
    // The producer's reason is the part most likely to be echoed below.
    const reason = trust.split('—').pop()?.trim() ?? ''
    expect(reason.length, 'no reason in the trust line — this assertion would be vacuous').toBeGreaterThan(10)
    expect(insights).not.toContain(reason)
    expect(glance).toContain(reason)
  })

  it('the census can actually detect a repeat', () => {
    // ⭐ The discriminating half. Without it, "no duplicates found" could mean
    // the detector is broken rather than the surface being clean.
    const el = document.createElement('div')
    el.innerHTML =
      '<p>This result is sensitive to uncertainty and could flip.</p>' +
      '<p>This result is sensitive to uncertainty and could flip.</p>'
    const s = visibleSentences(el)
    const seen = new Map<string, number>()
    for (const x of s) seen.set(x, (seen.get(x) ?? 0) + 1)
    expect([...seen.values()].some((n) => n > 1)).toBe(true)
  })
})
