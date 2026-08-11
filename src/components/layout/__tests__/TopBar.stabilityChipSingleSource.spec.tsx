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

describe('LINK-R1 C6 — the header stability chip consumes the display-safe verdict', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('does NOT say "Stable" when the producer\'s display verdict is fragile, even with is_robust true', () => {
    // The deployed shape. `is_robust` said the winner survived the
    // perturbation set; `display_verdict` said the run may not claim
    // robustness. The chrome sided with the raw field.
    renderTopBar()
    seedResults({ is_robust: true, display_verdict: 'fragile' })

    const chip = stabilityChip()
    expect(
      chip?.getAttribute('data-stability') ?? null,
      'the header chip claimed stability the analysis panel had already refused',
    ).not.toBe('stable')
  })

  it('makes NO stability claim at all when the producer sent no display verdict', () => {
    // L3 §9: the panel read "Stability: (not available for this run)" on the
    // same screen as the green chip. Absence of a verdict is the certified
    // "Robustness unknown" state — the chrome must be silent, not cheerful.
    renderTopBar()
    seedResults({ is_robust: true })

    expect(
      stabilityChip(),
      'the header chip claimed stability on a run whose robustness was never assessed',
    ).toBeNull()
  })

  it('makes NO stability claim when the producer explicitly says not_assessed', () => {
    renderTopBar()
    seedResults({ is_robust: true, display_verdict: 'not_assessed' })

    expect(stabilityChip()).toBeNull()
  })

  it('STILL says "Stable" on a genuinely robust verdict — the discriminating positive', () => {
    // Without this the fix could pass by suppressing the chip unconditionally,
    // which deletes a truthful signal rather than correcting a false one.
    renderTopBar()
    seedResults({ is_robust: true, display_verdict: 'robust' })

    const chip = stabilityChip()
    expect(chip).not.toBeNull()
    expect(chip!.getAttribute('data-stability')).toBe('stable')
    expect(chip!.textContent).toContain('Stable')
  })

  it('says "Sensitive" on a moderate verdict, and binds the claim to the chip itself', () => {
    renderTopBar()
    seedResults({ is_robust: true, display_verdict: 'moderate' })

    const chip = stabilityChip()
    expect(chip).not.toBeNull()
    // Bound by identity to the chip's own attribute, never to the word
    // appearing somewhere on the screen (trap 19). `fragile` is the shipped
    // attribute vocabulary for the non-robust rendering; it is kept so this
    // change moves the SOURCE of the claim, not the DOM contract.
    expect(chip!.getAttribute('data-stability')).toBe('fragile')
    expect(chip!.textContent).toContain('Sensitive')
  })

  it('ignores an unrecognised verdict token rather than guessing (fail-closed)', () => {
    renderTopBar()
    seedResults({ is_robust: true, display_verdict: 'extremely_robust_probably' })

    expect(stabilityChip()).toBeNull()
  })
})
