/**
 * KeyQuestionCard — the DSK grounding badge's NEGATIVE TWIN (ROADMAP 2.491, P1).
 *
 * ## Why this file is HERE and not next to the V17 hero
 *
 * The first version of this lane's render tests targeted `HeroKeyQuestion`
 * (analysisHeroV17). **That component does not mount on staging.**
 * `netlify.toml:78` sets `VITE_FEATURE_ANALYSIS_HERO_PANEL = "1"`, and
 * `ResultsBody` hosts `KeyQuestionCard` INSIDE that flag-ON arm while
 * `HeroKeyQuestion` lives in the `!flag` arm — the two are mutually exclusive
 * by the same fork. A deployed-DOM census found `key-question-card` in 14
 * captures and `hero-v17-key-question` in ZERO.
 *
 * That is the SAME defect row 2.466 was opened for: lane 1's DSK grounding
 * badge shipped DARK on the V17 hero for exactly this reason. Reproducing it
 * with the same badge's negative twin, in the same feature, past a spec written
 * to prevent it, is why these tests now bind to the surface the deployed flags
 * actually mount. The mount-path proof itself lives in
 * `results/__tests__/ResultsBody.keyQuestionLiveMount.spec.tsx`, which renders
 * the real `ResultsBody` under the real flag seam.
 *
 * This spec lives INSIDE the analysis-hero module because the module's
 * inertness guard allow-lists only ResultsBody/HeroGallery as external
 * importers.
 *
 * ## RED-first signature at pristine (UI e01dbd4a)
 *
 * `Unable to find an element by: [data-testid="dsk-general-guidance"]` — the
 * testid appears in 0 files at pristine.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { useCanvasStore } from '../../../../canvas/store'
import { readDecisionReviewWireState } from '../../../../v5/decisionReviewAdapter'
import { KeyQuestionCard } from '../KeyQuestionCard'

const MARKER = 'dsk-general-guidance'
const COPY = 'General guidance — not drawn from our attested evidence base.'

/** Seed through the REAL adapter, as `applyV5State` does. */
function seedRawPrompts(prompts: unknown[]): void {
  const state = readDecisionReviewWireState({
    decision_review: {
      produced_at: '2026-08-05T13:00:00.000Z',
      decision_quality_prompts: prompts,
    },
  })
  if (state.kind !== 'v0_30') throw new Error(`synthetic payload did not classify v0_30: ${state.kind}`)
  useCanvasStore.setState(s => ({
    runMeta: { ...s.runMeta, decisionReview030: state.review },
  }))
}

// The two live shapes, from the walk of 2026-08-05, with the verdicts CEE
// #825 now attaches. Identity anchors: the exact question strings.
const GENERAL_Q = 'What would make you shift from Add Permanent Night Shift to Lease Second Depot?'
const GENERAL_PROMPT = {
  question: GENERAL_Q,
  principle: 'Consider-the-opposite',
  applies_because: 'Add Permanent Night Shift leads with a high margin.',
  dsk_grounding: 'general',
}
const ATTESTED_Q = 'What is the base rate for UK parcel depots needing emergency capacity expansion?'
const ATTESTED_PROMPT = {
  question: ATTESTED_Q,
  principle: 'Outside view and reference class forecasting',
  applies_because: 'Volume risk is the main uncertainty.',
  dsk_claim_id: 'DSK-T-002',
  dsk_protocol_id: 'DSK-P-002',
  evidence_strength: 'strong',
  dsk_grounding: 'attested',
}

describe('KeyQuestionCard — general-guidance marker (the DEPLOYED host)', () => {
  beforeEach(() => {
    useCanvasStore.setState(s => ({ runMeta: { ...s.runMeta, decisionReview030: null } }))
  })
  afterEach(() => {
    useCanvasStore.setState(s => ({ runMeta: { ...s.runMeta, decisionReview030: null } }))
    cleanup()
  })

  it('renders the marker, and NO grounding badge, for a general prompt', () => {
    // Precondition (trap 13b): the fixture must genuinely carry the verdict and
    // genuinely lack an id, or this test proves nothing.
    expect(GENERAL_PROMPT.dsk_grounding).toBe('general')
    expect('dsk_claim_id' in GENERAL_PROMPT).toBe(false)

    seedRawPrompts([GENERAL_PROMPT])
    render(<KeyQuestionCard />)

    expect(screen.getByTestId('key-question-text')).toHaveTextContent(GENERAL_Q)
    expect(screen.getByTestId(MARKER).textContent).toBe(COPY)
    expect(screen.queryByTestId('dsk-grounding')).toBeNull()
  })

  it('POSITIVE CONTROL: renders the badge, and NO marker, for an attested prompt', () => {
    // Without this, "the marker appears" would be an assertion about an empty
    // tree. It proves the harness CAN see the grounded render, same component,
    // same queries.
    seedRawPrompts([ATTESTED_PROMPT])
    render(<KeyQuestionCard />)

    expect(screen.getByTestId('key-question-text')).toHaveTextContent(ATTESTED_Q)
    expect(screen.getByTestId('dsk-grounding')).toHaveAttribute('data-dsk-claim-id', 'DSK-T-002')
    expect(screen.queryByTestId(MARKER)).toBeNull()
  })

  it('a RESOLVED prompt gets the ordinary badge — it is genuinely cited', () => {
    // The whole point of `resolved`: CEE recovered the id from the bundle, so
    // this is attested science and must NOT be disclaimed.
    seedRawPrompts([
      {
        question: 'How could this fail?',
        principle: 'Pre-mortem and prospective hindsight',
        dsk_claim_id: 'DSK-T-001',
        dsk_protocol_id: 'DSK-P-001',
        evidence_strength: 'medium',
        dsk_grounding: 'resolved',
      },
    ])
    render(<KeyQuestionCard />)

    expect(screen.getByTestId('dsk-grounding')).toHaveAttribute('data-dsk-claim-id', 'DSK-T-001')
    expect(screen.queryByTestId(MARKER)).toBeNull()
  })

  it('ABSENCE of a verdict renders NEITHER — a payload with no verdict is not disclaimed', () => {
    // Fail-closed the other way: DSK off, bundle load failure, or a CEE build
    // predating #825 must render nothing, not a disclaimer we cannot support.
    const noVerdict = { question: 'A question with no verdict', principle: 'Consider-the-opposite' }
    expect('dsk_grounding' in noVerdict).toBe(false)

    seedRawPrompts([noVerdict])
    render(<KeyQuestionCard />)

    expect(screen.getByTestId('key-question-text')).toHaveTextContent('A question with no verdict')
    expect(screen.queryByTestId(MARKER)).toBeNull()
    expect(screen.queryByTestId('dsk-grounding')).toBeNull()
  })

  it('an unrecognised verdict fails closed to no marker', () => {
    seedRawPrompts([
      { question: 'q', principle: 'x', dsk_grounding: 'definitely-grounded-trust-me' },
    ])
    render(<KeyQuestionCard />)
    expect(screen.queryByTestId(MARKER)).toBeNull()
    expect(screen.queryByTestId('dsk-grounding')).toBeNull()
  })

  it('binds to the SELECTED question: the card shows one prompt, and marks THAT one', () => {
    // The card renders the first glossary-safe question. With a general prompt
    // first and an attested one second, the marker must appear; swapping the
    // order must make it disappear. A marker keyed to "any prompt in the list
    // is general" would pass the first and fail the second.
    seedRawPrompts([GENERAL_PROMPT, ATTESTED_PROMPT])
    const first = render(<KeyQuestionCard />)
    expect(screen.getByTestId('key-question-text')).toHaveTextContent(GENERAL_Q)
    expect(screen.getByTestId(MARKER)).toBeInTheDocument()
    first.unmount()

    seedRawPrompts([ATTESTED_PROMPT, GENERAL_PROMPT])
    render(<KeyQuestionCard />)
    expect(screen.getByTestId('key-question-text')).toHaveTextContent(ATTESTED_Q)
    expect(screen.queryByTestId(MARKER)).toBeNull()
    expect(screen.getByTestId('dsk-grounding')).toBeInTheDocument()
  })

  it('exactly one marker in the document — no double render', () => {
    seedRawPrompts([GENERAL_PROMPT])
    render(<KeyQuestionCard />)
    expect(document.querySelectorAll(`[data-testid="${MARKER}"]`)).toHaveLength(1)
  })
})
