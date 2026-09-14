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
 * The card therefore says WHERE its details are, and shows none of them.
 *
 * The control is named by its on-screen name: `WorkspaceShellTabStrip.tsx:380`
 * renders `aria-label="Enable expert mode"` / `title="Toggle expert mode"`.
 * ("Show full detail" survives only in stale comments and is NOT on screen.)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ModelHealthSection } from '../ModelHealthSection'
import type { AuditTrailData } from '../ModelHealthSection'
import { DetailToggleContext } from '../DetailToggleContext'

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../../../components/results/Accordion', () => ({
  Accordion: ({ children, title, tierLabel, testId }: { children: React.ReactNode; title: string; tierLabel?: string; testId?: string }) => (
    <div data-testid={testId}>
      <span>{title}</span>
      {tierLabel && <span data-testid="accordion-tier-label">{tierLabel}</span>}
      {children}
    </div>
  ),
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
  // ── Direction 1: NOTHING to show ⇒ the new sentence MUST render ────────────
  // A mutant reverting the fix REDs here.

  it('renders the detail-hidden sentence in plain mode when only draft quality is present (the witnessed render)', () => {
    render(<ModelHealthSection ceeQuality={QUALITY} />)

    const section = screen.getByTestId('model-health-section')
    expect(section).toBeInTheDocument()

    // Bound by IDENTITY (test id), never by a value predicate another node could satisfy.
    const notice = screen.getByTestId('model-card-detail-hidden')
    expect(notice).toBeInTheDocument()
    // The LITERAL rendered sentence.
    expect(notice.textContent).toBe(DETAIL_HIDDEN_SENTENCE)

    // The regression itself: the body is no longer the heading alone.
    expect(section.textContent).not.toBe('Model card')
  })

  it('renders the detail-hidden sentence in plain mode when an audit signal exists but every row of it is gated behind expert mode', () => {
    // repairsApplied alone ⇒ hasAuditSignal true ⇒ isPreAnalysis false,
    // while the repairs row itself renders only under `showDetail`.
    render(
      <ModelHealthSection
        auditTrail={{ ...NULL_AUDIT, repairsApplied: [{ code: 'CLAMP_EDGE_WEIGHT' }] }}
      />,
    )
    const notice = screen.getByTestId('model-card-detail-hidden')
    expect(notice.textContent).toBe(DETAIL_HIDDEN_SENTENCE)
  })

  // ── Direction 2: something IS on screen ⇒ the sentence MUST NOT render ─────
  // A mutant suppressing the real content REDs here, on a DIFFERENT assertion.

  it('does NOT render the detail-hidden sentence in expert mode: the sub-scores are on screen', () => {
    render(
      <DetailToggleContext.Provider value={{ showDetail: true }}>
        <ModelHealthSection ceeQuality={QUALITY} />
      </DetailToggleContext.Provider>,
    )
    // The real content is present, bound by identity.
    expect(screen.getByTestId('quality-row-structure')).toBeInTheDocument()
    expect(screen.queryByTestId('model-card-detail-hidden')).not.toBeInTheDocument()
  })

  it('does NOT render the detail-hidden sentence in plain mode when the methodology one-liner is on screen', () => {
    render(<ModelHealthSection ceeQuality={QUALITY} auditTrail={{ ...NULL_AUDIT, nSamples: 5000 }} />)
    expect(screen.getByTestId('model-card-methodology')).toBeInTheDocument()
    expect(screen.queryByTestId('model-card-detail-hidden')).not.toBeInTheDocument()
  })

  it('does NOT render the detail-hidden sentence in plain mode when the root-node warning is on screen', () => {
    render(
      <ModelHealthSection
        ceeQuality={QUALITY}
        auditTrail={{ ...NULL_AUDIT, inferenceWarnings: [{ code: 'ROOT_NODE_DEFAULT_VALUE' }] }}
      />,
    )
    expect(screen.getByTestId('root-node-warning')).toBeInTheDocument()
    expect(screen.queryByTestId('model-card-detail-hidden')).not.toBeInTheDocument()
  })

  it('does NOT render the detail-hidden sentence when the pre-analysis block is on screen', () => {
    // No quality, no audit signal ⇒ genuinely pre-analysis ⇒ that copy owns the body.
    render(<ModelHealthSection factorCount={4} edgeCount={6} />)
    expect(screen.getByTestId('model-card-pre-analysis')).toBeInTheDocument()
    expect(screen.queryByTestId('model-card-detail-hidden')).not.toBeInTheDocument()
  })

  // ── The notice must not smuggle the numbers Paul ruled behind the toggle ───

  it('names expert mode and states no score', () => {
    render(<ModelHealthSection ceeQuality={QUALITY} />)
    const notice = screen.getByTestId('model-card-detail-hidden')
    expect(notice.textContent).toMatch(/expert mode/)
    // No digits at all: the sentence must not leak `overall` or any sub-score.
    expect(notice.textContent).not.toMatch(/\d/)
    // British English, and no em dash in a product string.
    expect(notice.textContent).not.toMatch(/—/)
  })
})
