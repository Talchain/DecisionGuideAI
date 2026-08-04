/**
 * HeroKeyQuestion — DSK science-provenance grounding line (Lane 1, P1).
 *
 * The key-question card is the LIVE surface that consumes
 * `decision_quality_prompts`. When the prompt behind the main question is
 * grounded in a Decision Science Knowledge claim (attested by
 * `dsk_claim_id`), the card renders a compact plain-text grounding line:
 *
 *   "Grounded in: <principle> · <strength> evidence"
 *
 * Honesty rules under test:
 *  - grounding absent → NO badge (queryByTestId null). The positive tests in
 *    this suite are the in-suite control proving the badge CAN render, so the
 *    absence assertion is not vacuous (trap 13).
 *  - strength absent → badge renders the principle only; the word "evidence"
 *    must NOT appear (a forced default strength turns this test RED).
 *  - The badge is plain DOM text (screen-reader readable), not colour-only.
 *
 * Identity binding: literal ids/titles from the committed live fixtures
 * (DSK-T-002 / DSK-P-002 / "Outside view and reference class forecasting" /
 * strong; DSK-T-003 / medium).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeroKeyQuestion } from '../HeroKeyQuestion'
import type { KeyQuestion } from '../analysisHeroVM.types'

function renderCard(keyQuestion: KeyQuestion) {
  return render(
    <HeroKeyQuestion
      keyQuestion={keyQuestion}
      onPrefillChat={vi.fn()}
      chatPrefillAvailable={true}
    />,
  )
}

const BASE: KeyQuestion = {
  text: 'What is the base rate for user adoption success when mid-size teams move from status quo systems to new CRMs?',
  extras: [],
  chips: ['High', 'Some', 'Not sure', 'Add note'],
}

describe('HeroKeyQuestion — DSK grounding line', () => {
  it('renders the grounding line with principle + strength as plain text, claim id in data attributes (r3[1] identity)', () => {
    renderCard({
      ...BASE,
      grounding: {
        principle: 'Outside view and reference class forecasting',
        claimId: 'DSK-T-002',
        protocolId: 'DSK-P-002',
        strength: 'strong',
      },
    } as KeyQuestion)
    const badge = screen.getByTestId('dsk-grounding')
    expect(badge.textContent).toBe('Grounded in: Outside view and reference class forecasting · strong evidence')
    expect(badge.getAttribute('data-dsk-claim-id')).toBe('DSK-T-002')
    expect(badge.getAttribute('data-dsk-protocol-id')).toBe('DSK-P-002')
  })

  it('renders a medium-strength grounding line (r1[0] identity: DSK-T-003)', () => {
    renderCard({
      ...BASE,
      text: 'What would make you switch to HubSpot instead of keeping the current setup?',
      grounding: {
        principle: 'Consider-the-opposite as a debiasing strategy',
        claimId: 'DSK-T-003',
        protocolId: 'DSK-P-003',
        strength: 'medium',
      },
    } as KeyQuestion)
    const badge = screen.getByTestId('dsk-grounding')
    expect(badge.textContent).toBe('Grounded in: Consider-the-opposite as a debiasing strategy · medium evidence')
    expect(badge.getAttribute('data-dsk-claim-id')).toBe('DSK-T-003')
  })

  it('NO grounding → NO badge at all (honest absence; positives above are the in-suite control)', () => {
    renderCard(BASE)
    expect(screen.queryByTestId('dsk-grounding')).toBeNull()
    // The question itself still renders — absence of provenance never hides content.
    expect(screen.getByTestId('hero-v17-key-question-text').textContent).toBe(BASE.text)
  })

  it('grounding WITHOUT strength → principle-only line, no "evidence" wording (a defaulted strength REDs this)', () => {
    renderCard({
      ...BASE,
      grounding: {
        principle: 'Outside view and reference class forecasting',
        claimId: 'DSK-T-002',
      },
    } as KeyQuestion)
    const badge = screen.getByTestId('dsk-grounding')
    expect(badge.textContent).toBe('Grounded in: Outside view and reference class forecasting')
    expect(badge.textContent).not.toContain('evidence')
    expect(badge.getAttribute('data-dsk-claim-id')).toBe('DSK-T-002')
  })

  it('accessibility: the grounding is a text node in the document flow, not colour-only signalling', () => {
    renderCard({
      ...BASE,
      grounding: {
        principle: 'Outside view and reference class forecasting',
        claimId: 'DSK-T-002',
        strength: 'strong',
      },
    } as KeyQuestion)
    const badge = screen.getByTestId('dsk-grounding')
    // Screen readers read text content: the strength must be present as WORDS.
    expect(badge.textContent).toContain('strong evidence')
    // And it must be inside the card's accessible region.
    expect(badge.closest('[aria-label="Key question"]')).not.toBeNull()
  })
})
