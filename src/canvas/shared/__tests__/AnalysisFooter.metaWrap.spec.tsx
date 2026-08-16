/**
 * AnalysisFooter — the post-analysis robustness footer's meta line must show
 * the producer's WHOLE sentence, not its first clause.
 *
 * WHY THIS EXISTS (manual test, 2026-08-16). The pinned footer read as
 * self-contradictory: headline "Ranking sensitive to assumptions" above a body
 * that appeared to say "none of the factors we could test changed which option
 * leads…". Derived at the producer's bytes, the two DO agree — the reason is a
 * two-clause sentence whose SECOND clause is the half that justifies the
 * verdict:
 *
 *   display_verdict: "fragile"
 *   display_verdict_reason: "none of the factors we could test changed which
 *     option leads on its own, BUT THIS RESULT SCORED LOW ON OUR OTHER
 *     ROBUSTNESS CHECKS"
 *     (src/v5/__tests__/fixtures/live-analysis-turn-walkA-2026-08-04.json:617-618)
 *
 *   display_verdict: "moderate"
 *   display_verdict_reason: "…on its own, AND THIS RESULT MOSTLY HELD UP UNDER
 *     THE OTHER CHANGES WE TESTED"
 *     (src/v5/__tests__/fixtures/live-analysis-turn-T3-20260808T155759Z.json)
 *
 * The contradiction was therefore manufactured ENTIRELY by the UI: the meta
 * span carried Tailwind's `truncate` (white-space:nowrap + overflow:hidden +
 * text-overflow:ellipsis), a hard single line, and 130–137 characters do not
 * fit beside the status column. The clip lands around the comma and deletes
 * the reconciling clause.
 *
 * The fix is to let the sentence wrap. NO copy is authored here: the headline
 * stays derived from `display_verdict` (derivePostFooterStatus) and the body
 * stays the producer's `display_verdict_reason` verbatim (derivePostFooterMeta
 * — already pinned by postAnalysisFooter.spec.ts). Inventing a UI sentence
 * that claims robustness the producer did not measure is exactly what this
 * repo forbids.
 *
 * ⚠ SCOPE OF THIS EVIDENCE (jsdom, trap 3): jsdom computes no layout, so these
 * assertions CANNOT prove visual truncation or its absence. What they pin is
 * the CLASS CONTRACT — the single-line clamp utility is absent and a wrapping
 * treatment is present on the element that carries the producer sentence.
 * Re-adding `truncate` REDs this spec; that is the whole guarantee, and it is
 * the guarantee that was missing (no test asserted clamp behaviour before).
 *
 * BINDING: every assertion binds to `data-testid="sticky-footer-meta"` — the
 * element identity — never to a class predicate some other span could satisfy.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AlertTriangle } from 'lucide-react'
import { AnalysisFooter } from '../AnalysisFooter'

/**
 * Verbatim producer reason from the walkA capture — the exact pair that made
 * the footer read as self-contradictory on staging. Kept as a literal (not
 * imported from the fixture) so this spec pins the SENTENCE SHAPE the fix is
 * about, and stays meaningful if that capture is ever re-recorded.
 */
const PRODUCER_REASON_FRAGILE =
  'none of the factors we could test changed which option leads on its own, ' +
  'but this result scored low on our other robustness checks'

function renderPostAnalysisFooter(metaText: string) {
  return render(
    <AnalysisFooter
      statusIcon={AlertTriangle}
      statusIconClassName="text-warning"
      statusText="Ranking sensitive to assumptions"
      metaText={metaText}
      // The ONLY placement any production caller uses: OutputsDock.tsx:2907
      // (post-analysis robustness footer) and pre-analysis/StickyFooter.tsx:144.
      // The 'inline' branch has zero production mounts.
      metaPlacement="stacked"
      testId="results-analysis-footer"
    />,
  )
}

describe('AnalysisFooter — stacked meta line shows the whole producer sentence', () => {
  it('does NOT clamp the meta line to a single truncated row', () => {
    renderPostAnalysisFooter(PRODUCER_REASON_FRAGILE)
    const meta = screen.getByTestId('sticky-footer-meta')
    // `truncate` is the defect: it is white-space:nowrap + ellipsis, so the
    // "but this result scored low…" clause is unreachable at any viewport.
    expect(meta.className).not.toMatch(/\btruncate\b/)
    expect(meta.className).not.toMatch(/\bwhitespace-nowrap\b/)
    expect(meta.className).not.toMatch(/\bline-clamp-1\b/)
  })

  it('gives the meta line an explicit wrapping treatment', () => {
    renderPostAnalysisFooter(PRODUCER_REASON_FRAGILE)
    const meta = screen.getByTestId('sticky-footer-meta')
    expect(meta.className).toMatch(/\bwhitespace-normal\b/)
    expect(meta.className).toMatch(/\bbreak-words\b/)
  })

  it('renders the producer reason verbatim, INCLUDING the clause that justifies the headline', () => {
    // Non-discriminating on its own — the text is in the DOM with `truncate`
    // too, because CSS clips visually and jsdom applies no CSS. It is kept as
    // the honest statement of what the surface must say, and it REDs if a
    // later change rewrites or elides the producer's second clause.
    renderPostAnalysisFooter(PRODUCER_REASON_FRAGILE)
    const meta = screen.getByTestId('sticky-footer-meta')
    expect(meta.textContent).toBe(PRODUCER_REASON_FRAGILE)
    expect(meta.textContent).toContain('but this result scored low on our other robustness checks')
  })

  it('leaves the headline as the verdict-derived string, unrewritten', () => {
    renderPostAnalysisFooter(PRODUCER_REASON_FRAGILE)
    // The headline is derivePostFooterStatus(display_verdict) — 'fragile' and
    // 'moderate' both map here. It is NOT softened to match a half-read body.
    expect(screen.getByText('Ranking sensitive to assumptions')).toBeInTheDocument()
  })
})
