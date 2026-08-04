/**
 * KeyQuestionCard — honesty + rendering rules (ROADMAP 2.466, P1).
 *
 * The card surfaces the live turn's first safe decision-quality question plus
 * lane 1's DSK grounding line on the results surface a tester actually sees
 * (the lens-hero posture). Its honesty contract is lane 1's, VERBATIM:
 *   - no attested `dsk_claim_id` ⇒ NO grounding line at all — never a default
 *     id, never an inferred strength. The QUESTION may still show (a question
 *     needs no citation to be honest).
 *   - strength renders only when the closed-vocabulary value was attested.
 *   - every string reaches the DOM through `mapDecisionQualityPrompts`'
 *     sanitisation (the single mapping site).
 *
 * Fixture data: the two verbatim live captures (r1/r3, CEE 76d2e1c) — r3[0]
 * is the REAL uncited case on the live wire, which is why it anchors the
 * honest-absence tests by identity (its exact question text), not by a value
 * predicate another entry could satisfy.
 *
 * This spec lives INSIDE the analysis-hero module because the module's
 * inertness guard allow-lists only ResultsBody/HeroGallery as external
 * importers.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { useCanvasStore } from '../../../../canvas/store'
import { readDecisionReviewWireState } from '../../../../v5/decisionReviewAdapter'
import { KeyQuestionCard } from '../KeyQuestionCard'
import r1Block from '../../../../v5/__tests__/fixtures/live-decision-review-0_30.r1-cee-76d2e1c.json'
import r3Block from '../../../../v5/__tests__/fixtures/live-decision-review-0_30.r3-cee-76d2e1c.json'

/** Seed runMeta.decisionReview030 through the REAL adapter, as applyV5State does. */
function seedFromBlock(block: unknown): void {
  const enrichment = (block as Record<string, unknown>).enrichment as Record<string, unknown>
  const state = readDecisionReviewWireState(enrichment)
  if (state.kind !== 'v0_30') throw new Error(`fixture did not classify v0_30: ${state.kind}`)
  useCanvasStore.setState(s => ({
    runMeta: { ...s.runMeta, decisionReview030: state.review },
  }))
}

function seedRawPrompts(prompts: unknown[]): void {
  const state = readDecisionReviewWireState({
    decision_review: {
      produced_at: '2026-08-04T13:56:03.240Z',
      decision_quality_prompts: prompts,
    },
  })
  if (state.kind !== 'v0_30') throw new Error(`synthetic payload did not classify v0_30: ${state.kind}`)
  useCanvasStore.setState(s => ({
    runMeta: { ...s.runMeta, decisionReview030: state.review },
  }))
}

// r3[0]'s exact live question — the identity anchor for the uncited case.
const R3_UNCITED_QUESTION =
  'What would make you seriously consider switching from Keep Current Setup (Status Quo) to HubSpot?'

describe('KeyQuestionCard — data presence gating', () => {
  beforeEach(() => {
    useCanvasStore.setState(s => ({ runMeta: { ...s.runMeta, decisionReview030: null } }))
  })
  afterEach(cleanup)

  it('renders NOTHING when no decisionReview030 exists (pre-analysis / legacy turn)', () => {
    render(<KeyQuestionCard />)
    expect(screen.queryByTestId('key-question-card')).toBeNull()
  })

  it('renders NOTHING when the review carries zero prompts', () => {
    seedRawPrompts([])
    render(<KeyQuestionCard />)
    expect(screen.queryByTestId('key-question-card')).toBeNull()
  })

  it('never gates on reviewStatus — data presence alone mounts the card (the legacy field stays unset)', () => {
    // The V17 card's reviewStatus==='complete' gate is exactly what dark-shipped
    // lane 1 on live turns; this host must not inherit it. runMeta here has NO
    // reviewStatus at all, which is the live V5 posture.
    seedFromBlock(r1Block)
    expect(
      (useCanvasStore.getState().runMeta as Record<string, unknown> | null)?.reviewStatus,
    ).toBeUndefined()
    render(<KeyQuestionCard />)
    expect(screen.getByTestId('key-question-card')).toBeInTheDocument()
  })
})

describe('KeyQuestionCard — cited prompt (r1: DSK-T-003, medium)', () => {
  beforeEach(() => {
    useCanvasStore.setState(s => ({ runMeta: { ...s.runMeta, decisionReview030: null } }))
    seedFromBlock(r1Block)
  })
  afterEach(cleanup)

  it('shows the live question text, sanitised through the single mapping site', () => {
    expect(screen.queryByTestId('key-question-card')).toBeNull() // control: not rendered yet
    render(<KeyQuestionCard />)
    expect(screen.getByTestId('key-question-text')).toHaveTextContent(
      'What would make you switch to HubSpot instead of keeping the current setup?',
    )
  })

  it("renders lane 1's grounding line VERBATIM: testid, data-* ids, copy shape", () => {
    render(<KeyQuestionCard />)
    const grounding = screen.getByTestId('dsk-grounding')
    expect(grounding).toHaveAttribute('data-dsk-claim-id', 'DSK-T-003')
    expect(grounding).toHaveAttribute('data-dsk-protocol-id', 'DSK-P-003')
    expect(grounding.textContent).toBe(
      'Grounded in: Consider-the-opposite as a debiasing strategy · medium evidence',
    )
  })
})

describe('KeyQuestionCard — the honest-absence rule (r3[0] is uncited ON THE LIVE WIRE)', () => {
  beforeEach(() => {
    useCanvasStore.setState(s => ({ runMeta: { ...s.runMeta, decisionReview030: null } }))
    seedFromBlock(r3Block)
  })
  afterEach(cleanup)

  it('the first safe question wins even when uncited — identity-bound to r3[0]', () => {
    render(<KeyQuestionCard />)
    expect(screen.getByTestId('key-question-text')).toHaveTextContent(R3_UNCITED_QUESTION)
  })

  it('no dsk_claim_id ⇒ NO grounding line — even though a LATER prompt (DSK-T-002) is cited', () => {
    // The card must not borrow provenance from a different prompt: r3[1]
    // carries DSK-T-002/strong, and rendering it under r3[0]'s question would
    // be a false scientific claim.
    render(<KeyQuestionCard />)
    expect(screen.getByTestId('key-question-card')).toBeInTheDocument()
    expect(screen.queryByTestId('dsk-grounding')).toBeNull()
  })
})

describe('KeyQuestionCard — strength and safety edge cases', () => {
  beforeEach(() => {
    useCanvasStore.setState(s => ({ runMeta: { ...s.runMeta, decisionReview030: null } }))
  })
  afterEach(cleanup)

  it('cited id WITHOUT strength → grounding line with principle only, no "· … evidence" suffix', () => {
    seedRawPrompts([
      {
        question: 'What is the base rate for projects like this?',
        principle: 'Outside view',
        applies_because: 'Reference classes ground the estimate.',
        dsk_claim_id: 'DSK-T-002',
      },
    ])
    render(<KeyQuestionCard />)
    const grounding = screen.getByTestId('dsk-grounding')
    expect(grounding.textContent).toBe('Grounded in: Outside view')
    expect(grounding.textContent).not.toContain('evidence')
  })

  it('out-of-vocabulary strength fails closed to absent (mapper closed-vocab rule)', () => {
    seedRawPrompts([
      {
        question: 'What is the base rate for projects like this?',
        principle: 'Outside view',
        dsk_claim_id: 'DSK-T-002',
        evidence_strength: 'overwhelming', // not in weak|medium|strong
      },
    ])
    render(<KeyQuestionCard />)
    expect(screen.getByTestId('dsk-grounding').textContent).toBe('Grounded in: Outside view')
  })

  it('question copy passes through sanitizeCoachingText (arrows/em-dashes never reach the DOM)', () => {
    seedRawPrompts([
      {
        question: 'Should cost → revenue dominate — or not?',
        principle: 'P',
      },
    ])
    render(<KeyQuestionCard />)
    expect(screen.getByTestId('key-question-text').textContent).toBe(
      'Should cost to revenue dominate, or not?',
    )
  })

  it('a banned-term question is skipped; the next safe prompt renders instead', () => {
    seedRawPrompts([
      {
        question: 'What does the rank_flip_rate imply here?', // glossary-banned term
        principle: 'P1',
        dsk_claim_id: 'DSK-T-999',
      },
      {
        question: 'What outside evidence would change your mind?',
        principle: 'Outside view',
        dsk_claim_id: 'DSK-T-002',
        evidence_strength: 'strong',
      },
    ])
    render(<KeyQuestionCard />)
    expect(screen.getByTestId('key-question-text')).toHaveTextContent(
      'What outside evidence would change your mind?',
    )
    // Grounding follows the RENDERED prompt, not the skipped one.
    expect(screen.getByTestId('dsk-grounding')).toHaveAttribute('data-dsk-claim-id', 'DSK-T-002')
  })

  it('a banned-term PRINCIPLE suppresses the grounding line but not the question (glossary re-gate)', () => {
    seedRawPrompts([
      {
        question: 'What outside evidence would change your mind?',
        principle: 'The VOI and rank_flip_rate principle', // banned terms
        dsk_claim_id: 'DSK-T-002',
        evidence_strength: 'strong',
      },
    ])
    render(<KeyQuestionCard />)
    expect(screen.getByTestId('key-question-text')).toBeInTheDocument()
    expect(screen.queryByTestId('dsk-grounding')).toBeNull()
  })
})
