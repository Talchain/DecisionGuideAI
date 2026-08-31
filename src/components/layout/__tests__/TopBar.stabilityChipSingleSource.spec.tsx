/**
 * LINK-TRACK R1 item 1 (contradiction cluster, C6) — THE GREEN "Stable" CHIP
 * IS THE ONLY ROBUSTNESS CLAIM IN THE PRODUCT THAT IGNORES THE DISPLAY-SAFE
 * VERDICT.
 *
 * ── THE MEASURED CONTRADICTION ─────────────────────────────────────────────
 * L3 browser lane, deployed staging `5597d867`, 2026-08-11
 * (`olumi-docs/PHASE0-EVIDENCE-2026-07-28/arch-decision-2026-08-11/L3-BROWSER-TRUTH.md`
 * §9 C6 — "the most investor-damaging contradiction in the product"), one
 * screen state:
 *
 *   Header chip     → `Stable` (green)
 *   Analysis panel  → "…treat this as provisional: the link between … is fragile."
 *   Analysis panel  → "The ordering holds in about 72% of variations, but the result is fragile…"
 *   Analysis panel  → ⚠ "Ranking sensitive to assumptions"
 *   Analysis panel  → Stability: (not available for this run)
 *   Analysis panel  → "Fragile factors (3)" · "3 factors could flip the result"
 *
 * Reproduced on B1 on 10 Aug and on B2 on a newer build, so it is systemic.
 *
 * ── ROOT CAUSE, DERIVED AT THE BYTES AT `5597d867` ─────────────────────────
 * The estate has an explicit SINGLE-SOURCE RULE for robustness claims, written
 * into `buildAnalysisHeroViewModel.ts:162`:
 *
 *   "Sensitivity caveat is gated on the display-safe robustness verdict ONLY —
 *    never raw recommendation_stability (single-source rule, see
 *    ROBUSTNESS-VERDICT-CONTRACT). The verdict is the producer's own
 *    robustness.display_verdict (PLoT #202)."
 *
 * `useAnalysisMetadata` — the sole feeder of this chip — does not follow it.
 * It reads `report.robustness.is_robust`, a raw boolean, and `is_robust` has
 * exactly ONE display consumer repo-wide: this chip. Everything else consumes
 * `display_verdict` and fails CLOSED on an absent or unrecognised token,
 * keeping the certified "Robustness unknown" state.
 *
 * So this is CLAUDE.md trap 21 exactly: two authorities answering DIFFERENT
 * questions under similar names. `is_robust` answers "did the perturbation set
 * leave the winner standing?"; `display_verdict` answers "what may this run
 * CLAIM about robustness on screen?". The chip is a display surface, so it
 * must consume the display authority. The fix is not to align the defaults —
 * it is to point the surface at the question it is actually asking.
 *
 * ── WHAT THESE CASES PIN ───────────────────────────────────────────────────
 * Case 1 is the RED: the exact deployed shape (`is_robust: true` beside a
 * `fragile` verdict) must not render "Stable".
 * Case 2 is the other measured half: no verdict on the wire, panel says
 * stability is not available — the chrome must make no claim at all.
 * Case 3 is the discriminating positive (trap 13b): a genuinely `robust`
 * verdict must still render "Stable", so the fix cannot pass by deleting the
 * chip.
 * Case 4 binds by identity rather than by a value predicate (trap 19): the
 * assertion is on the chip's own `data-stability` attribute, not on the word
 * "Stable" appearing anywhere on screen.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠⚠ SUPERSEDED BY A PRODUCT RULING, 31 Aug 2026 — READ THIS BEFORE THE ABOVE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * THE HEADER CHIP NO LONGER EXISTS. Paul's ruling on the deployed canvas:
 * *"keep that top menu very simple unless there is genuinely valuable
 * information in having something within it"*, and "all that type of
 * information for the moment should be in the right-hand panel". The whole
 * centre group went with it — stage pill, scenario count, stability chip,
 * last-run time.
 *
 * ⭐ THIS RESOLVES C6 MORE COMPLETELY THAN THE FIX ABOVE DID. The chip was
 * `stability`'s ONLY consumer (`useAnalysisMetadata`'s other live caller,
 * `GoalPanel`, destructures `scenarioCount` alone — verified). With the chip
 * gone the field has ZERO display consumers, so the header cannot contradict
 * the panel about robustness in ANY wire state, correct verdict or not.
 *
 * ⚠⚠ AND THE HONEST PART, because the previous cases anticipated exactly this
 * move. Case 3 was written as a discriminating positive with the stated
 * purpose that *"the fix cannot pass by deleting the chip"* — and deleting the
 * chip is precisely what happened. It is a legitimate product decision rather
 * than a way to make a test pass, but that distinction is invisible in a diff,
 * so it is recorded here rather than left to be inferred.
 *
 * The cases below therefore pin the STRONGER invariant — the header makes no
 * robustness claim in ANY of the four measured wire states — and keep a
 * POSITIVE CONTROL proving the probe can still see a chip when one is present.
 * Without that control every case here would pass on a page that renders
 * nothing at all (CLAUDE.md trap 13), which is now the default.
 *
 * If a robustness readout ever returns to the header, it consumes
 * `display_verdict` and never raw `is_robust` — the original ruling stands,
 * it simply has no surface to govern today.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { TopBar } from '../TopBar'
import { ToastProvider } from '../../../canvas/ToastContext'
import { useCanvasStore } from '../../../canvas/store'

/**
 * ⚠ THE PROBE IS BOUND TO AN ATTRIBUTE THAT ALREADY EXISTS AT PRISTINE.
 *
 * The first draft of this spec queried a `data-testid` the fix was going to
 * add. Four of its six cases then PASSED at pristine — not because the
 * product was right, but because `queryByTestId` returned null for an element
 * that had no testid yet. An absence probe with no positive control passes by
 * testing nothing (CLAUDE.md trap 13). `data-stability` is on the shipped
 * chip today, so every case below can genuinely see the pre-fix state.
 */
const STABILITY_SELECTOR = '[data-stability]'

function stabilityChip(): HTMLElement | null {
  return document.querySelector<HTMLElement>(STABILITY_SELECTOR)
}

/**
 * The shape measured on the wire: a raw `is_robust: true` alongside the
 * producer's display-safe verdict. Both live under `report.robustness`.
 */
function seedResults(robustness: Record<string, unknown>) {
  act(() => {
    useCanvasStore.setState({
      results: {
        ...useCanvasStore.getState().results,
        status: 'complete',
        report: {
          meta: { n_samples: 5000, computed_at: new Date().toISOString() },
          robustness,
        },
      },
    } as never)
  })
}

function renderTopBar() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TopBar
          scenarioTitle="Take £4m out of opex"
          onTitleChange={vi.fn()}
          onSave={vi.fn()}
          onShare={vi.fn()}
        />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('LINK-R1 C6 — the header makes no robustness claim at all', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  /**
   * THE POSITIVE CONTROL, and it is load-bearing.
   *
   * Every assertion below is an ABSENCE. With the chip removed they would all
   * pass against a blank page, a crashed render, or a probe pointed at the
   * wrong attribute. This proves the probe finds a `[data-stability]` element
   * when one genuinely exists, so the absences mean something.
   */
  it('the probe can see a stability chip when one exists', () => {
    renderTopBar()
    const marker = document.createElement('div')
    marker.setAttribute('data-stability', 'stable')
    document.body.appendChild(marker)
    try {
      expect(stabilityChip(), 'the probe cannot see a chip that is present').not.toBeNull()
    } finally {
      marker.remove()
    }
  })

  it.each([
    ['the deployed contradiction — raw is_robust beside a fragile verdict', { is_robust: true, display_verdict: 'fragile' }],
    ['a genuinely robust verdict', { is_robust: true, display_verdict: 'robust' }],
    ['a moderate verdict', { is_robust: true, display_verdict: 'moderate' }],
    ['no display verdict on the wire at all', { is_robust: true }],
    ['an explicit not_assessed', { is_robust: true, display_verdict: 'not_assessed' }],
    ['an unrecognised token', { is_robust: true, display_verdict: 'extremely_robust_probably' }],
  ])('renders no robustness claim in the header — %s', (_case, robustness) => {
    renderTopBar()
    seedResults(robustness)

    expect(
      stabilityChip(),
      'the header is claiming robustness again — it may only do so from display_verdict, and the panel owns that claim',
    ).toBeNull()
  })
})
