/**
 * 2.491 — the general-guidance marker on the V17 hero: the FLAG-OFF arm.
 *
 * ## Read this before assuming these tests are the proof of anything
 *
 * `HeroKeyQuestion` does **not** mount on staging. `netlify.toml:78` sets
 * `VITE_FEATURE_ANALYSIS_HERO_PANEL = "1"` in the staging context block, and
 * `ResultsBody.tsx:383` mounts `KeyQuestionCard` inside
 * `{isAnalysisHeroPanelEnabled() && …}` while `:412` opens the `{!…&& (` arm
 * where this hero lives. The DEPLOYED proof is
 * `analysis-hero/__tests__/KeyQuestionCard.generalGuidance.spec.tsx` plus the
 * mount-path guard in `__tests__/ResultsBody.keyQuestionLiveMount.spec.tsx`.
 *
 * This file exists because the marker was shipped on BOTH hosts (matching
 * 2.466's badge, which is also on both), and an unmounted host with a live
 * render path still needs its branch pinned — otherwise deleting either the
 * render or the view-model join is a silent no-op in the suite. Both of those
 * deletions were demonstrated to SURVIVE before this file existed.
 *
 * The two mutants this file must make bite:
 *   A. delete `{keyQuestion.generalGuidance && (…)}` from HeroKeyQuestion.tsx
 *   B. delete `...(generalGuidance ? { generalGuidance: true } : {})` from
 *      buildAnalysisHeroViewModel.ts  ← the JOIN, invisible to any render
 *      test. Pinned in `buildAnalysisHeroViewModel.spec.ts` (which owns the
 *      VM fixture builder) rather than mirrored here.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeroKeyQuestion } from '../HeroKeyQuestion'
import type { KeyQuestion } from '../analysisHeroVM.types'

const MARKER = 'dsk-general-guidance'
const COPY = 'General guidance — not drawn from our attested evidence base.'
const noop = () => {}
const BASE = { chips: [] as string[], extras: [] as string[] }

function renderKQ(kq: KeyQuestion) {
  return render(<HeroKeyQuestion keyQuestion={kq} onPrefillChat={noop} chatPrefillAvailable />)
}

describe('HeroKeyQuestion (flag-OFF arm) — marker render', () => {
  it('renders the marker, and NO badge, when the VM says general', () => {
    renderKQ({ ...BASE, text: 'What would make you switch?', generalGuidance: true })
    expect(screen.getByTestId(MARKER).textContent).toBe(COPY)
    expect(screen.queryByTestId('dsk-grounding')).toBeNull()
  })

  it('POSITIVE CONTROL: renders the badge, and NO marker, when the VM says grounded', () => {
    renderKQ({
      ...BASE,
      text: 'What is the base rate?',
      grounding: {
        principle: 'Outside view and reference class forecasting',
        claimId: 'DSK-T-002',
        strength: 'strong',
      },
    })
    expect(screen.getByTestId('dsk-grounding').textContent).toBe(
      'Grounded in: Outside view and reference class forecasting · strong evidence',
    )
    expect(screen.queryByTestId(MARKER)).toBeNull()
  })

  it('renders NEITHER when the VM carries no verdict', () => {
    renderKQ({ ...BASE, text: 'A question with no verdict' })
    expect(screen.queryByTestId(MARKER)).toBeNull()
    expect(screen.queryByTestId('dsk-grounding')).toBeNull()
  })

  it('DISCRIMINATING PAIR: exactly one marker, in the general card only', () => {
    const { container } = render(
      <div>
        <div data-testid="host-general">
          <HeroKeyQuestion
            keyQuestion={{ ...BASE, text: 'general question', generalGuidance: true }}
            onPrefillChat={noop}
            chatPrefillAvailable
          />
        </div>
        <div data-testid="host-grounded">
          <HeroKeyQuestion
            keyQuestion={{
              ...BASE,
              text: 'grounded question',
              grounding: { principle: 'Outside view and reference class forecasting', claimId: 'DSK-T-002' },
            }}
            onPrefillChat={noop}
            chatPrefillAvailable
          />
        </div>
      </div>,
    )
    expect(container.querySelectorAll(`[data-testid="${MARKER}"]`)).toHaveLength(1)
    expect(screen.getByTestId('host-general').querySelector(`[data-testid="${MARKER}"]`)).not.toBeNull()
    expect(screen.getByTestId('host-grounded').querySelector(`[data-testid="${MARKER}"]`)).toBeNull()
  })
})
