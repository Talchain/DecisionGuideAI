/**
 * ReanalyseBar — the model-changed claim is made ONCE, and the refusal still
 * explains itself.
 *
 * ── THE WITNESSED DEFECT (deployed `135cd7fb`, 7 Sep 2026) ─────────────────
 * Found in the `Visual Regression` capture for the Model tab, comparing today's
 * render against the reference blessed on 2 Sep. The bottom ~100px of the panel
 * said the model had changed FOUR times:
 *
 *     Model changed. Results may be out of date.               ← this bar's claim
 *     Your model changed since the last check. Olumi is        ← this bar's subline
 *     checking again, which takes a moment.      [Re-analyse]
 *     Model changed. Ask or rerun…                             ← the composer
 *
 * Against ONE line plus the composer in the reference. The composer placeholder
 * is not this component's and is deliberately out of scope here; the pair this
 * bar owns is the first two.
 *
 * ── WHY IT IS THE ESTATE'S "TWO QUESTIONS, ONE ANSWER" SHAPE ───────────────
 * The headline answers *"has the model changed?"*. The subline answers *"why can
 * the button not run?"*. Both are correct, and neither is redundant in general —
 * this is NOT a logic defect and no arm is being deleted. But when the gate's
 * reason is `BLOCKED_REASON_COPY.staleRecheck`, that sentence OPENS by restating
 * the headline's claim, so the two render as one sentence printed twice.
 *
 * ⚠ THE SHARED COMPOSER IS NOT THE PLACE TO FIX IT. `composeBlockedReason` also
 * feeds the pre-analysis footer and the readiness bar, where nothing has made the
 * claim yet and the full sentence is exactly right. Only this bar knows its own
 * headline is already on screen.
 *
 * ⚠ AND DELETING THE SUBLINE WAS THE WRONG FIX. The button is `disabled` in this
 * state; `ReanalyseBar.tsx`'s header records what an unexplained disabled control
 * costs — a `title` is unreachable by touch and by keyboard. The remainder is
 * kept, so the explanation survives. That is what `the refusal still explains
 * itself` below pins, and it is the arm that stops this fix becoming the previous
 * defect.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReanalyseBar } from '../ReanalyseBar'
import { BLOCKED_REASON_COPY } from '../../../utils/composeBlockedReason'

let mockFreshness: { freshness: string } | null = null
let mockDirty = false
let mockImportHold = false

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({
      analysisFreshness: mockFreshness,
      analysisFreshnessDirty: mockDirty,
      importPendingServerRegistration: mockImportHold,
    })
  ),
}))

/** The bar's own claim, verbatim from the component. */
const HEADLINE = 'Model changed. Results may be out of date.'

/**
 * A refusal that has NOTHING to do with staleness. This is the contrast arm of
 * every discriminating pair below: the fix must bind to the staleness sentence
 * by IDENTITY and leave every other reason untouched, so a blanket truncation
 * would pass the first assertion and fail this one.
 */
const UNRELATED_REFUSAL = 'Analysis is held on a saved example. Re-draft it live to run one.'

beforeEach(() => {
  mockFreshness = { freshness: 'stale' }
  mockDirty = false
  mockImportHold = false
})

describe('the Model tab says the model changed once', () => {
  it('PRECONDITION: the fixture mounts the bar with BOTH the claim and a subline', () => {
    // Pins the precondition in-test. Every assertion below is about a bar that
    // genuinely rendered the pair — not one that failed to mount, and not one
    // whose subline was absent for an unrelated reason. Without this, a fix that
    // simply stopped the bar rendering would pass the whole file.
    render(
      <ReanalyseBar
        onReanalyse={vi.fn()}
        canRun={false}
        blockedReason={UNRELATED_REFUSAL}
        isAnalysing={false}
      />
    )
    expect(screen.getByTestId('reanalyse-bar')).toHaveAttribute('data-reason', 'model-changed')
    expect(screen.getByText(HEADLINE)).toBeInTheDocument()
    expect(screen.getByTestId('reanalyse-blocked-reason')).toBeInTheDocument()
  })

  it('does not restate the headline underneath itself when the gate cites staleness', () => {
    render(
      <ReanalyseBar
        onReanalyse={vi.fn()}
        canRun={false}
        blockedReason={BLOCKED_REASON_COPY.staleRecheck}
        isAnalysing={false}
      />
    )
    // The claim's own sentence, derived from the shared constant rather than
    // spelled again here — if the copy is reworded this test follows it.
    const restatement = BLOCKED_REASON_COPY.staleRecheck.split('. ')[0]
    expect(screen.getByTestId('reanalyse-blocked-reason').textContent).not.toContain(restatement)
  })

  it('the refusal still explains itself — the disabled control keeps a reachable reason', () => {
    // The arm that stops this fix re-opening the defect it sits next to. A
    // `title` is unreachable by touch and by keyboard, so the subline must
    // survive as TEXT and must carry the half the headline does not say.
    render(
      <ReanalyseBar
        onReanalyse={vi.fn()}
        canRun={false}
        blockedReason={BLOCKED_REASON_COPY.staleRecheck}
        isAnalysing={false}
      />
    )
    const remainder = BLOCKED_REASON_COPY.staleRecheck.split('. ').slice(1).join('. ')
    expect(remainder.length).toBeGreaterThan(0) // the fixture itself must be able to discriminate
    expect(screen.getByTestId('reanalyse-blocked-reason')).toHaveTextContent(remainder)
    expect(screen.getByTestId('reanalyse-button')).toBeDisabled()
  })

  it('leaves the claim itself alone — the user is still told results may be out of date', () => {
    render(
      <ReanalyseBar
        onReanalyse={vi.fn()}
        canRun={false}
        blockedReason={BLOCKED_REASON_COPY.staleRecheck}
        isAnalysing={false}
      />
    )
    expect(screen.getByText(HEADLINE)).toBeInTheDocument()
  })

  it('DISCRIMINATOR: an unrelated refusal is still printed in full, verbatim', () => {
    // The second half of the pair. The first test would also pass under a
    // blanket "shorten the subline" edit; this one would not. Together they
    // prove the behaviour is bound to the staleness sentence by identity.
    render(
      <ReanalyseBar
        onReanalyse={vi.fn()}
        canRun={false}
        blockedReason={UNRELATED_REFUSAL}
        isAnalysing={false}
      />
    )
    expect(screen.getByTestId('reanalyse-blocked-reason')).toHaveTextContent(UNRELATED_REFUSAL)
  })

  it('DISCRIMINATOR: a refusal with no sentence at all still says something', () => {
    // The shared fallback arm, unchanged by this fix. A gate that refuses
    // without a reason must not leave a disabled button unexplained.
    render(
      <ReanalyseBar onReanalyse={vi.fn()} canRun={false} blockedReason={undefined} isAnalysing={false} />
    )
    const reason = screen.getByTestId('reanalyse-blocked-reason')
    expect(reason.textContent?.trim().length ?? 0).toBeGreaterThan(0)
  })
})
