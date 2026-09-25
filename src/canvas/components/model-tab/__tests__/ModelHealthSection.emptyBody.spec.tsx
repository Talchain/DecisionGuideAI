/**
 * ModelHealthSection — the Model card must never render an EXPANDED, EMPTY body.
 *
 * WITNESSED on deployed `b93904c9` (staging--olumi.netlify.app), Model tab, a
 * real analysed 15-element model: the "Model card" accordion carried
 * `aria-expanded="true"` and its `innerText` was the single word `Model card`.
 * The only node inside was the 14px `modelcard-discuss` icon button.
 *
 * ⚠ IT IS NOT A DATA GAP, AND THE FIELD-NAME CHECK CAME BACK NEGATIVE.
 * There is no producer key sitting unread. On the V5-canonical path (baked ON
 * for staging) `applyV5State.ts:2171` explicitly passes `rawV2Response: null`,
 * and every audit field this card renders is read from `rawV2Response.*` in
 * `ModelTabBody.tsx:634-666`. The values genuinely do not exist there:
 * `mapV5AnalysisToReport.ts:870-875` records that "the V5 contract carries NO
 * seed field ... Never default to 0 - a fabricated seed is a provenance lie",
 * and the only hash on that path is a LOCAL fnv1a-64 digest deliberately
 * labelled `response_hash_source: 'local'` so the UI never presents it as an
 * engine identity. Wiring those through would be the fabrication, not the fix.
 *
 * THE ACTUAL MECHANISM IS A GATING ASYMMETRY between two predicates that answer
 * different questions (trap 21):
 *   · `isPreAnalysis` is computed from DATA PRESENCE
 *     (`!hasAuditSignal && !hasQualitySignal`).
 *   · Every render of that data is gated on `showDetail` (expert mode), except
 *     the `nSamples` one-liner and the root-node warning.
 *   · `ceeQuality` arrives at DRAFT time (`DraftChat.tsx:813` reads
 *     `draftData.quality`), not at analysis time, so `hasQualitySignal` is true
 *     for essentially every drafted model whatever the user has run.
 * So a plain-mode user's own draft quality SUPPRESSES the pre-analysis copy
 * while rendering nothing in its place. Expanded box, no body.
 *
 * Paul's own measurement independently pins plain mode: the header carried no
 * `N / 10` tier pill, and `qualityLabel` is `showDetail && overall != null`.
 *
 * ⛔ THE FIX MAY NOT SURFACE THE NUMBERS. Paul ruled 9 Sep 2026 that the bare
 * scores sit behind expert mode; this file's header records a previous attempt
 * that deleted `overall` for everyone under a "progressive disclosure" alibi.
 *
 * The control is named by its on-screen name: `WorkspaceShellTabStrip.tsx:380`
 * renders `aria-label="Enable expert mode"` / `title="Toggle expert mode"`.
 * ("Show full detail" survives only in stale comments and is NOT on screen.)
 *
 * ⭐⭐ RE-POINTED FOR V2 GAP 30 (24 Sep 2026, `FIDELITY-GAPS-INDEX-20260924.txt`
 * #30 — "The Model card opens at rest to a placeholder: 'This card's details
 * are shown in expert mode.'"). The prototype (`prototype-v2-reference.html`)
 * has no disclosure that opens itself onto a sentence saying there is nothing
 * to see. The card now says WHERE its details are by staying CLOSED rather
 * than by opening and printing a sentence — same invariant this file has
 * always protected ("never an expanded, empty body"), reached by collapsing
 * instead of by a placeholder. The `model-card-detail-hidden` testid and its
 * sentence are gone; the tests that named them now assert the collapse
 * instead, and the Accordion mock below was widened to actually gate its
 * children on `isExpanded`/`defaultExpanded` — the old mock rendered children
 * unconditionally, which could not have told an open, empty card apart from a
 * closed one.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelHealthSection } from '../ModelHealthSection'
import type { AuditTrailData } from '../ModelHealthSection'
import { DetailToggleContext } from '../DetailToggleContext'

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

/**
 * ⭐ V2 GAP 30: THIS MOCK NOW GATES `children` ON EXPANSION, WHICH THE OLD ONE
 * DID NOT. A mock that always renders children cannot tell an OPEN empty card
 * apart from a CLOSED one — exactly the distinction this file's fix turns on
 * (forcing `isExpanded={false}` when there is nothing renderable). The real
 * `Accordion` hides collapsed content behind `aria-hidden`/`inert` rather than
 * unmounting it; this mock unmounts instead, which is enough to prove
 * "nothing is disclosed" without reproducing the real component's transition
 * mechanics.
 */
vi.mock('../../../../components/results/Accordion', () => ({
  Accordion: ({
    children,
    title,
    tierLabel,
    testId,
    isExpanded,
    defaultExpanded,
  }: {
    children: React.ReactNode
    title: string
    tierLabel?: string
    testId?: string
    isExpanded?: boolean
    defaultExpanded?: boolean
  }) => {
    const expanded = isExpanded !== undefined ? isExpanded : !!defaultExpanded
    return (
      <div data-testid={testId}>
        <button type="button" aria-expanded={expanded}>{title}</button>
        {tierLabel && <span data-testid="accordion-tier-label">{tierLabel}</span>}
        {expanded && children}
      </div>
    )
  },
}))

const NULL_AUDIT: AuditTrailData = {
  seedUsed: null,
  responseHash: null,
  nSamples: null,
  repairsApplied: null,
  inferenceWarnings: null,
  autoNoiseApplied: null,
  autoNoiseProvenance: null,
  stabilityPenaltyFactor: null,
}

const QUALITY = { overall: 6.5, structure: 7, causality: 6, coverage: 6.5, safety: 6 }

/**
 * The literal sentence, spelled out here rather than imported.
 * ⚠ Importing the component's own constant would be a guard agreeing with
 * itself: a rename would move both sides together and this spec would stay
 * green while the rendered words changed.
 */
const DETAIL_HIDDEN_SENTENCE = "This card's details are shown in expert mode."

describe('ModelHealthSection — an expanded Model card never renders an empty body', () => {
  // ── Direction 1: NOTHING to show ⇒ the card MUST stay CLOSED, not open onto
  //    a placeholder sentence (V2 gap 30). A mutant reverting the fix REDs here.

  it('stays collapsed in plain mode when only draft quality is present (the witnessed render)', () => {
    render(<ModelHealthSection ceeQuality={QUALITY} />)

    const section = screen.getByTestId('model-health-section')
    expect(section).toBeInTheDocument()

    // Bound by IDENTITY (role), never by a value predicate another node could satisfy.
    const header = screen.getByRole('button', { name: 'Model card' })
    expect(header).toHaveAttribute('aria-expanded', 'false')

    // The placeholder sentence is gone outright — not merely hidden behind a
    // collapsed region — and the card carries nothing else to disclose either.
    expect(screen.queryByTestId('model-card-detail-hidden')).not.toBeInTheDocument()
    expect(screen.queryByText(DETAIL_HIDDEN_SENTENCE)).not.toBeInTheDocument()
    expect(section.textContent).toBe('Model card')
  })

  it('stays collapsed in plain mode when an audit signal exists but every row of it is gated behind expert mode', () => {
    // repairsApplied alone ⇒ hasAuditSignal true ⇒ isPreAnalysis false,
    // while the repairs row itself renders only under `showDetail`.
    render(
      <ModelHealthSection
        auditTrail={{ ...NULL_AUDIT, repairsApplied: [{ code: 'CLAMP_EDGE_WEIGHT' }] }}
      />,
    )
    const header = screen.getByRole('button', { name: 'Model card' })
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('model-card-detail-hidden')).not.toBeInTheDocument()
  })

  // ── Direction 2: something IS on screen ⇒ the card MUST be OPEN, and the
  //    retired sentence must never resurface. A mutant suppressing the real
  //    content REDs here, on a DIFFERENT assertion from Direction 1's.

  it('opens, with the sub-scores on screen, in expert mode', () => {
    render(
      <DetailToggleContext.Provider value={{ showDetail: true }}>
        <ModelHealthSection ceeQuality={QUALITY} />
      </DetailToggleContext.Provider>,
    )
    expect(screen.getByRole('button', { name: 'Model card' })).toHaveAttribute('aria-expanded', 'true')
    // The real content is present, bound by identity.
    expect(screen.getByTestId('quality-row-structure')).toBeInTheDocument()
    expect(screen.queryByTestId('model-card-detail-hidden')).not.toBeInTheDocument()
  })

  it('opens, with the methodology one-liner on screen, in plain mode', () => {
    render(<ModelHealthSection ceeQuality={QUALITY} auditTrail={{ ...NULL_AUDIT, nSamples: 5000 }} />)
    expect(screen.getByRole('button', { name: 'Model card' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('model-card-methodology')).toBeInTheDocument()
    expect(screen.queryByTestId('model-card-detail-hidden')).not.toBeInTheDocument()
  })

  it('opens, with the root-node warning on screen, in plain mode', () => {
    render(
      <ModelHealthSection
        ceeQuality={QUALITY}
        auditTrail={{ ...NULL_AUDIT, inferenceWarnings: [{ code: 'ROOT_NODE_DEFAULT_VALUE' }] }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Model card' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('root-node-warning')).toBeInTheDocument()
    expect(screen.queryByTestId('model-card-detail-hidden')).not.toBeInTheDocument()
  })

  it('opens, with the pre-analysis block on screen, when the card is genuinely pre-analysis', () => {
    // No quality, no audit signal ⇒ genuinely pre-analysis ⇒ that copy owns the body.
    render(<ModelHealthSection factorCount={4} edgeCount={6} />)
    expect(screen.getByRole('button', { name: 'Model card' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('model-card-pre-analysis')).toBeInTheDocument()
    expect(screen.queryByTestId('model-card-detail-hidden')).not.toBeInTheDocument()
  })

  // ── The collapsed card must not smuggle the numbers Paul ruled behind the
  //    toggle out through some OTHER route now the sentence is gone.

  it('leaks no digit and no em dash while collapsed — nothing renders, not even reworded', () => {
    render(<ModelHealthSection ceeQuality={QUALITY} />)
    const section = screen.getByTestId('model-health-section')
    expect(screen.getByRole('button', { name: 'Model card' })).toHaveAttribute('aria-expanded', 'false')
    // The retired sentence is gone outright, not reworded — the collapsed
    // card's only visible text is its own title.
    expect(section.textContent).toBe('Model card')
    expect(section.textContent).not.toMatch(/\d/)
    expect(section.textContent).not.toMatch(/—/)
  })
})

/** The literal sentence must never come back under this or any other testid. */
describe('the retired placeholder sentence is gone from the module entirely', () => {
  it('never renders, in any of the scenarios this file exercises', () => {
    render(<ModelHealthSection ceeQuality={QUALITY} />)
    expect(screen.queryByText(DETAIL_HIDDEN_SENTENCE)).not.toBeInTheDocument()
  })
})
