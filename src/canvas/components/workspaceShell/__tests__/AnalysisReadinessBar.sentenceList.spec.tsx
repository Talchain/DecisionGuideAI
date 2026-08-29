/**
 * THE READINESS BAR RENDERS THE PRODUCER'S SENTENCES ONE PER LINE — the same
 * shape its neighbouring surface has rendered since #883.
 *
 * ── THE DEFECT THIS PINS ─────────────────────────────────────────────────────
 * Witnessed on deployed staging `236bb14a`, 28 Aug 2026, as a fresh guest.
 * `analysis-readiness-bar-reason` rendered SIX HUNDRED AND THREE CHARACTERS of
 * four concatenated question-pairs in one unbroken `<p>`:
 *
 *   Factor "SMB retention and churn reduction investment" is currently Moderate
 *   (0.5). What should option "double down on our current SMB base" set it to?
 *   Factor "Enterprise sales motion investment" is currently Moderate (0.5).
 *   What should option "move upmarket to enterprise customers" set it to? …
 *
 * `PanelFooter` — the OTHER surface reading the SAME `deriveReadinessDisplay`,
 * fed the SAME two values from the SAME component (`OutputsDock`
 * `runBlockedTooltip` / `runBlockedListing`) — has rendered these as a list
 * since #883. The bar never received the listing at all, so it had no
 * array to render even had it wanted one. **Two surfaces, one concept, fixed in
 * one place** — CLAUDE.md trap 21.
 *
 * ⚠ NOTHING IS TRUNCATED OR SUMMARISED. The same bytes render one per line, and
 * `display.subline` stays their exact join. `THE UNION IS EXACT` pins that: a
 * "fix" that shortened the producer's words would be putting ours in its mouth.
 *
 * ⚠ THE ONE-BLOCKER TWIN IS PART OF THE CONTRACT, exactly as it is for the
 * footer: a list of one renders a bullet where prose belonged — a regression in
 * the common small case bought with a fix for the rare large one.
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { AnalysisReadinessBar } from '../AnalysisReadinessBar'
import { useCanvasStore } from '../../../store'

/** The shape actually witnessed on staging — not an invented fixture. */
const REAL = [
  'Factor "SMB retention and churn reduction investment" is currently Moderate (0.5). What should option "double down on our current SMB base" set it to?',
  'Factor "Enterprise sales motion investment" is currently Moderate (0.5). What should option "move upmarket to enterprise customers" set it to?',
  'Factor "Enterprise sales motion investment" is currently Moderate (0.5). What should option "Hybrid: pilot enterprise while defending SMB" set it to?',
]

const renderShut = (sentences?: readonly string[]) =>
  render(
    <AnalysisReadinessBar
      preRunWithModel
      canRun={false}
      isAnalysing={false}
      blockedReason={(sentences ?? REAL).join(' ')}
      blockedListing={
        sentences
          ? { summary: sentences.join(' '), sentences: sentences.map((text) => ({ text })) }
          : undefined
      }
      nothingHasAnswered={false}
      onAnalyse={() => {}}
    />,
  )

describe('AnalysisReadinessBar — producer sentences render as a list', () => {
  it('PRECONDITION: the fixture is multi-sentence and long enough that a paragraph is the wrong shape', () => {
    // Without this the assertions below could pass on a one-sentence fixture,
    // where a paragraph is CORRECT — the guard would be agreeing with itself.
    expect(REAL.length).toBeGreaterThan(1)
    expect(REAL.join(' ').length).toBeGreaterThan(400)
  })

  it('renders ONE LIST ITEM PER PRODUCER SENTENCE', () => {
    renderShut(REAL)
    const list = screen.getByTestId('analysis-readiness-bar-reason-list')
    expect(list.querySelectorAll('li')).toHaveLength(REAL.length)
  })

  it('EVERY ITEM IS BYTE-IDENTICAL to a sentence the producer wrote', () => {
    renderShut(REAL)
    const items = Array.from(
      screen.getByTestId('analysis-readiness-bar-reason-list').querySelectorAll('li'),
    ).map((li) => li.textContent)
    expect(items).toEqual([...REAL])
  })

  it('THE UNION IS EXACT — joining the rendered items reproduces the joined string', () => {
    renderShut(REAL)
    const items = Array.from(
      screen.getByTestId('analysis-readiness-bar-reason-list').querySelectorAll('li'),
    ).map((li) => li.textContent ?? '')
    expect(items.join(' ')).toBe(REAL.join(' '))
  })

  it('THE ONE-BLOCKER TWIN: a single sentence renders as prose, NOT a list of one', () => {
    renderShut([REAL[0]])
    expect(screen.queryByTestId('analysis-readiness-bar-reason-list')).toBeNull()
    expect(screen.getByTestId('analysis-readiness-bar-reason')).toHaveTextContent(REAL[0])
  })

  it('NO SENTENCES SUPPLIED: today’s single paragraph, unchanged', () => {
    // The additive contract. A caller that supplies nothing gets exactly the
    // behaviour that shipped before this change — which is what makes the
    // OutputsDock wiring, and not this component, the thing that turns it on.
    renderShut(undefined)
    expect(screen.queryByTestId('analysis-readiness-bar-reason-list')).toBeNull()
    expect(screen.getByTestId('analysis-readiness-bar-reason')).toHaveTextContent(REAL.join(' '))
  })

  it('EACH LINE IS A DEEP-LINK when its node is on the canvas — the wiring, not just the component', () => {
    // `BlockerLine` has its own spec; this asserts the BAR actually renders
    // through it, so the affordance cannot exist on one pre-run surface and not
    // the other — the two-surfaces-one-state defect this file was written for.
    useCanvasStore.setState({
      nodes: [
        { id: 'opt_keep', position: { x: 0, y: 0 }, data: { label: 'keep what we have' } },
      ] as never,
    })
    render(
      <AnalysisReadinessBar
        preRunWithModel
        canRun={false}
        isAnalysing={false}
        blockedReason={REAL.join(' ')}
        blockedListing={{
          summary: REAL.join(' '),
          sentences: [{ text: REAL[0], scope: { id: 'opt_keep' } }, { text: REAL[1] }],
        }}
        nothingHasAnswered={false}
        onAnalyse={() => {}}
      />,
    )
    expect(screen.getByTestId('blocker-option-link-opt_keep')).toHaveTextContent(REAL[0])
    // TWIN, in the same render: the unscoped line stays plain text.
    expect(screen.getByText(REAL[1]).tagName).not.toBe('BUTTON')
  })

  it('EVERY RENDER SITE PASSES THE SENTENCES — the prop cannot exist unplugged', () => {
    // ⚠ THIS TEST EXISTS BECAUSE A MUTANT SURVIVED. Deleting
    // `blockedListing={runBlockedListing}` from `OutputsDock` left all seven
    // assertions above GREEN, because they render this component directly and
    // never traverse the wiring. That is this estate's dominant defect —
    // capability built and not plugged in — reproduced in miniature inside the
    // very change that fixes an instance of it.
    //
    // DERIVED, not a list: it finds the render sites itself, so a SECOND host
    // added later is held to the same requirement on the day it lands.
    const root = resolve(__dirname, '../../../../..')
    const walk = (rel: string): string[] => {
      const abs = resolve(root, rel)
      if (!statSync(abs).isDirectory()) return /\.tsx?$/.test(rel) ? [rel] : []
      return readdirSync(abs).flatMap((e) => walk(join(rel, e)))
    }
    const files = walk('src').filter((f) => !/\.(spec|test)\.tsx?$/.test(f))
    const sites: Array<{ file: string; passes: boolean }> = []
    for (const rel of files) {
      const src = readFileSync(resolve(root, rel), 'utf8')
      for (const m of src.matchAll(/<AnalysisReadinessBar\b([\s\S]*?)\/>/g)) {
        sites.push({ file: rel, passes: /\bblockedListing=/.test(m[1]) })
      }
    }
    // PRECONDITION: a scan that finds nothing would pass vacuously for ever.
    expect(sites.length, 'no <AnalysisReadinessBar> render site found — scanner blind').toBeGreaterThan(0)
    expect(
      sites.filter((s) => !s.passes).map((s) => s.file),
      'this host renders the bar without handing it the producer sentences',
    ).toEqual([])
  })

  it('A MISMATCHED ARRAY IS NOT RENDERED — the byte-identity guard still governs', () => {
    // `readinessDisplay.ts` carries the array ONLY when its join equals the
    // VETTED subline, because `vetBlockedReason` can SUBSTITUTE a composed
    // fallback for producer text it will not pass. Rendering the array anyway
    // would show our fallback in one surface and the producer's sentences in
    // the other. This asserts the bar inherits that guard rather than
    // re-deciding it — pinned here because it is the one way this change could
    // make the two surfaces disagree again.
    render(
      <AnalysisReadinessBar
        preRunWithModel
        canRun={false}
        isAnalysing={false}
        blockedReason="A vetted fallback that is not the listing's summary."
        blockedListing={{ summary: REAL.join(' '), sentences: REAL.map((text) => ({ text })) }}
        nothingHasAnswered={false}
        onAnalyse={() => {}}
      />,
    )
    expect(screen.queryByTestId('analysis-readiness-bar-reason-list')).toBeNull()
  })
})
