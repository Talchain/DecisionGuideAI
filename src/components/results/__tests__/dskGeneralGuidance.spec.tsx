/**
 * 2.491 — the grounding badge's NEGATIVE TWIN.
 *
 * ## RED-first signature at pristine (UI e01dbd4a)
 *
 * At pristine there is no `dsk-general-guidance` testid anywhere in the repo,
 * so every "renders the marker" case below fails with
 * `Unable to find an element by: [data-testid="dsk-general-guidance"]`.
 *
 * The product statement of that failure, which is the defect: a prompt with no
 * `dsk_claim_id` rendered its question and NOTHING else. Absence-of-badge is
 * silent, and no user reads silence as "this one is improvised" — so an
 * unattested science-flavoured question was indistinguishable from an attested
 * one. Measured live 2026-08-05: 44% of decision-quality prompts.
 *
 * ## Why the positive control is mandatory here (trap 13)
 *
 * "The marker appears" is an ABSENCE-shaped claim about the other arm: it only
 * means something if the harness can also SEE the grounded case rendering
 * WITHOUT it. Every describe below therefore asserts both arms from the same
 * render, and the mixed-fixture test renders both in one tree.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeroKeyQuestion } from '../analysisHeroV17/HeroKeyQuestion'
import {
  mapDecisionQualityPrompts,
  isGeneralGuidance,
  deriveDskGrounding,
} from '../utils/decisionQualityPrompts'
import type { KeyQuestion } from '../analysisHeroV17/analysisHeroVM.types'

const noop = () => {}

function renderKQ(kq: KeyQuestion) {
  return render(<HeroKeyQuestion keyQuestion={kq} onPrefillChat={noop} chatPrefillAvailable />)
}

const BASE = { chips: [] as string[], extras: [] as string[] }

// ============================================================================
// The mapper — wire verdict → view flag
// ============================================================================

describe('mapDecisionQualityPrompts carries the 2.491 verdict', () => {
  it('carries general, attested and resolved; ignores an unknown value', () => {
    const mapped = mapDecisionQualityPrompts([
      { question: 'q-general', principle: 'Consider-the-opposite', dsk_grounding: 'general' },
      {
        question: 'q-attested',
        principle: 'Outside view and reference class forecasting',
        dsk_claim_id: 'DSK-T-002',
        evidence_strength: 'strong',
        dsk_grounding: 'attested',
      },
      {
        question: 'q-resolved',
        principle: 'Pre-mortem and prospective hindsight',
        dsk_claim_id: 'DSK-T-001',
        evidence_strength: 'medium',
        dsk_grounding: 'resolved',
      },
      { question: 'q-bogus', principle: 'x', dsk_grounding: 'definitely-grounded-trust-me' },
      { question: 'q-absent', principle: 'x' },
    ])

    expect(mapped.map(m => m.groundingState)).toEqual([
      'general',
      'attested',
      'resolved',
      undefined, // outside the closed vocabulary ⇒ fails closed
      undefined, // no verdict on the wire ⇒ no verdict in the view
    ])

    // Identity-bound (trap 19): assert per named question, not "some entry".
    expect(isGeneralGuidance(mapped.find(m => m.question === 'q-general')!)).toBe(true)
    // POSITIVE CONTROL — the harness sees the other three states as NOT general.
    expect(isGeneralGuidance(mapped.find(m => m.question === 'q-attested')!)).toBe(false)
    expect(isGeneralGuidance(mapped.find(m => m.question === 'q-resolved')!)).toBe(false)
    expect(isGeneralGuidance(mapped.find(m => m.question === 'q-absent')!)).toBe(false)
  })

  it('a RESOLVED prompt gets the ordinary grounding badge — it is genuinely cited', () => {
    // The whole point of `resolved`: CEE recovered the id from the bundle, so
    // this is attested science and must NOT be disclaimed.
    const [m] = mapDecisionQualityPrompts([
      {
        question: 'q',
        principle: 'Pre-mortem and prospective hindsight',
        dsk_claim_id: 'DSK-T-001',
        dsk_protocol_id: 'DSK-P-001',
        evidence_strength: 'medium',
        dsk_grounding: 'resolved',
      },
    ])
    expect(deriveDskGrounding(m)?.claimId).toBe('DSK-T-001')
    expect(isGeneralGuidance(m)).toBe(false)
  })

  it('ABSENCE of the verdict is not general — a payload with no verdict is not disclaimed', () => {
    // Fail-closed the other way. A pre-2.491 CEE, DSK disabled, or a bundle
    // load failure must render NOTHING, not a disclaimer we cannot support.
    const [m] = mapDecisionQualityPrompts([{ question: 'q', principle: 'Consider-the-opposite' }])
    // Precondition (trap 13b): the fixture must genuinely lack the key, or this
    // test rots silently the day someone tidies it.
    expect(m.groundingState).toBeUndefined()
    expect(isGeneralGuidance(m)).toBe(false)
  })
})

// ============================================================================
// The render — both arms, from the same harness
// ============================================================================

describe('HeroKeyQuestion renders the general-guidance marker', () => {
  const COPY = 'General guidance — not drawn from our attested evidence base.'

  it('renders the marker and NO grounding badge for a general prompt', () => {
    renderKQ({ ...BASE, text: 'What would make you switch?', generalGuidance: true })

    expect(screen.getByTestId('dsk-general-guidance').textContent).toBe(COPY)
    // The property that makes the marker meaningful.
    expect(screen.queryByTestId('dsk-grounding')).toBeNull()
  })

  it('POSITIVE CONTROL: renders the badge and NO marker for a grounded prompt', () => {
    // This is the assertion that stops the test above from passing vacuously:
    // it proves the harness CAN see a grounded render, in the same component,
    // with the same query.
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
    expect(screen.queryByTestId('dsk-general-guidance')).toBeNull()
  })

  it('renders NEITHER when there is no verdict at all', () => {
    renderKQ({ ...BASE, text: 'A question with no DSK verdict' })
    expect(screen.queryByTestId('dsk-general-guidance')).toBeNull()
    expect(screen.queryByTestId('dsk-grounding')).toBeNull()
  })

  it('binds the marker to the general question, not merely to "a question"', () => {
    // DISCRIMINATING PAIR, render-side: two hero cards in one tree, one general
    // and one grounded. Exactly one marker must exist, and it must sit in the
    // general card's subtree — a marker rendered for every question would pass
    // a naive "the marker exists" assertion and fail this one.
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

    expect(container.querySelectorAll('[data-testid="dsk-general-guidance"]')).toHaveLength(1)
    expect(
      screen.getByTestId('host-general').querySelector('[data-testid="dsk-general-guidance"]'),
    ).not.toBeNull()
    expect(
      screen.getByTestId('host-grounded').querySelector('[data-testid="dsk-general-guidance"]'),
    ).toBeNull()
    expect(
      screen.getByTestId('host-grounded').querySelector('[data-testid="dsk-grounding"]'),
    ).not.toBeNull()
  })
})
