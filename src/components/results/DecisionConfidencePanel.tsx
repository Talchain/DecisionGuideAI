/**
 * DecisionConfidencePanel — Post-analysis triage panel (mirrors pre-analysis "Decision readiness").
 *
 * Structure (post-analysis triage panel):
 * 1. Health header — ring ("trust"), result headline, dimension bars
 *    (Evidence/Robustness/Framing — supplied by upstream coachingReadinessDimensions)
 * 2. Action-card body — extracted to TriageActionCardsBody for reuse by AnalysisHeroV17
 *    (Result checks + flip-risk + conditional scenarios + EVPI-ranked queue + dominant nudge + checks footer)
 *
 * Uses shared TriageHealthHeader + TriageActionCardsBody.
 */

import { useMemo, memo, type ReactNode } from 'react'
import { Info } from 'lucide-react'
import Tooltip from '@/components/Tooltip'
import { TriageHealthHeader } from '@/components/shared/TriageHealthHeader'
import type { DecisionHealthRingDimensions } from '@/components/shared/DecisionHealthRing'
import { HeroQualifier } from './HeroQualifier'
import { useCanvasStore } from '@/canvas/store'
import { resolveDisplayedFreshness } from '@/canvas/store/analysisFreshness'
import { buildCertaintyCopy } from './utils/certaintyCopy'
import { GOAL_ANCHOR_COPY, COMPARATIVE_COPY } from './utils/goalAnchorCopy'
import { NO_CLAIM_VERDICT } from '@/lib/decisionVerdict'
import { calibrateUncertaintyCopy } from './utils/uncertaintyCalibration'
import { typography } from '@/styles/typography'
import type { ResultsSectionDataReturn } from './useResultsSectionData'
import { TriageActionCardsBody } from './TriageActionCardsBody'

// ── Types ───────────────────────────────────────────────────────────────────

interface DecisionConfidencePanelProps {
  data: ResultsSectionDataReturn
  /** Transition bridge: count of items user verified pre-analysis */
  verifiedCount?: number
  /** Transition bridge: weighted influence fraction user covered */
  influenceCoverage?: number
  onFocusNode?: (nodeId: string) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
  /** Handler for setting a factor value via inline editor */
  onSetValue?: (nodeId: string, rawValue: number) => void
  /** Handler for confirming a factor value */
  onConfirm?: (nodeId: string) => void
  /** Show influence/EVOI metrics on triage cards */
  expertMode?: boolean
  /** Lookup: factor node ID → current observed value + unit/cap (for pre-filling triage card editors) */
  nodeValueLookup?: Record<string, { value: number | null; unit: string | null; cap: number | null; displayValue?: string | null }>
  /** Brief 5.8B D2c: handler invoked by the dominant-factor "Research" chip (moved from DriversSection). */
  onSendMessage?: (text: string) => void
  /** Brief 5.8B D2c: AI affordance rendered inside the T1 checks-footer MissingKnowledgePrompt. */
  aiAffordance?: ReactNode
}

// Post-analysis uses a single-value ring (winner's win probability).
// The 4-dimension composite (Structure/Evidence/Coverage/Verified) is a
// pre-analysis readiness concept; conflating it with post-analysis trust
// misled users into reading the percentage as win probability.
// See Brief 4 Task 1 + UI-Data_Audit "hero disambiguation".

// ── Transition bridge banner ────────────────────────────────────────────────

function TransitionBridge({ verifiedCount, influenceCoverage }: { verifiedCount?: number; influenceCoverage?: number }) {
  // Only render when user actually verified items pre-analysis
  if (!verifiedCount || verifiedCount <= 0) return null

  const parts: string[] = []
  if (verifiedCount != null && verifiedCount > 0) {
    parts.push(`You verified ${verifiedCount} item${verifiedCount === 1 ? '' : 's'}`)
  }
  if (influenceCoverage != null && influenceCoverage > 0) {
    parts.push(`covering ${Math.round(influenceCoverage * 100)}% of influence`)
  }

  if (parts.length === 0) return null

  return (
    <div className={`px-3 py-2 rounded-md bg-panel-hover ${typography.panelMeta} text-text-light`}>
      {parts.join(', ')}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export const DecisionConfidencePanel = memo(function DecisionConfidencePanel({
  data,
  verifiedCount,
  influenceCoverage,
  onFocusNode,
  onHoverEnter,
  onHoverLeave,
  onSetValue,
  onConfirm,
  expertMode: _expertMode,
  nodeValueLookup,
  onSendMessage,
  aiAffordance,
}: DecisionConfidencePanelProps) {
  // Freshness for the hero qualifier comes from the CEE-only freshness slice
  // (the single source of truth), routed through the same display rule as the
  // AnalysisFreshnessNotice. This deliberately replaces the legacy
  // useAnalysisFreshnessState path, which fabricated 'stale' from a local edit
  // signal — the UI must never fabricate 'stale', and a fabricated stale qualifier
  // contradicted the CEE-only notice. The hero now surfaces ONLY a genuine CEE
  // 'stale' verdict (resolveDisplayedFreshness can only ever downgrade fresh→unknown,
  // never invent stale).
  const ceeFreshness = useCanvasStore((s) => s.analysisFreshness)
  const freshnessDirty = useCanvasStore((s) => s.analysisFreshnessDirty)
  const displayedFreshness = resolveDisplayedFreshness(ceeFreshness, freshnessDirty)

  // Audit B3 (P0): visible auto-noise disclosure marker. Renders only when
  // PLoT explicitly emitted `applied=true` with a provisional calibration
  // status — old/cached responses without the field yield no marker
  // (graceful degradation). Mirrors A1's DriversSection.tsx Info+Tooltip
  // pattern. User-facing copy avoids "auto-noise" / "variance" jargon per
  // brief — `multiplier`, `formula_version`, etc. are payload-only fields
  // and never appear in user-visible strings.
  const showAutoNoiseMarker =
    data.autoNoiseProvenance?.applied === true &&
    data.autoNoiseProvenance?.isProvisional === true
  const autoNoiseTooltipContent =
    'Outcome ranges include an operational uncertainty adjustment pending pilot calibration.'
  const autoNoiseAriaLabel =
    'Outcome uncertainty adjustment — operational estimate pending pilot calibration'
  const autoNoiseAdornment = showAutoNoiseMarker ? (
    <Tooltip content={autoNoiseTooltipContent}>
      <button
        type="button"
        // Mirrors A1's DriversSection.tsx:823 touch-target enlargement
        // pattern: `before:` pseudo-element extends the hit area to ≥44px
        // without affecting flow layout. The icon glyph is 14px (w-3.5);
        // `-inset-4` adds 16px of pseudo-element bleed on every axis,
        // giving a 14 + 32 = 46px effective hit area (DS v5 / WCAG 2.5.5
        // requires ≥44px). A1's pattern uses `-inset-y-4` because the
        // anchor text supplies horizontal width; for an icon-only button
        // we extend symmetrically.
        className="bg-transparent border-0 p-0 cursor-help inline-flex items-center justify-center text-text-light focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-info rounded relative before:absolute before:content-[''] before:-inset-4"
        aria-label={autoNoiseAriaLabel}
        data-testid="auto-noise-provisional-marker"
      >
        <Info className="w-3.5 h-3.5 text-text-light flex-shrink-0" aria-hidden="true" />
      </button>
    </Tooltip>
  ) : undefined

  // ── Post-analysis ring: ONE quantity, and its caption names THAT quantity
  //
  // ⭐ RE-ANCHORED 2026-07-31 (§6 map row 3). The ring was filled from the
  // winner's COMPARATIVE number and captioned "win probability" — a number
  // that answers neither of the two questions the product may answer, given
  // the most prominent position on the panel.
  //
  // It now prefers the GOAL number (question A). The comparative number is
  // the fallback when the run carried no success target, because ISL
  // computes a goal probability only when a threshold was supplied.
  //
  // ⚠ THE SCORE AND THE CAPTION MOVE TOGETHER, ALWAYS. They are derived from
  // one `ringClaim` object below rather than from two independent
  // expressions, so it is not possible to relabel the caption while the arc
  // stays filled from the other quantity — which would have a user reading a
  // goal figure off a comparative arc, strictly worse than the defect being
  // fixed. `__tests__/reanchor.confidenceRing.spec.tsx` is the pin, and the
  // lane's mutation-check reverts exactly that pairing.
  const ringWinner = data.recommendation.recommendedOption
  const goalProbability = ringWinner?.goalProbability
  const winProbability = ringWinner?.winProbability
  const isFiniteProb = (v: number | null | undefined): v is number =>
    typeof v === 'number' && Number.isFinite(v)

  const ringClaim: { value: number; caption: string } | null = isFiniteProb(goalProbability)
    ? {
        value: goalProbability,
        caption: GOAL_ANCHOR_COPY.label(ringWinner?.goalFitIsSubstitutedJoint === true),
      }
    : isFiniteProb(winProbability)
      ? { value: winProbability, caption: COMPARATIVE_COPY.label }
      : null

  const hasWinProbability = ringClaim != null
  const winProbabilityScore = ringClaim ? Math.round(ringClaim.value * 100) : null

  // ringDimensions is required by the DecisionHealthRing prop contract even
  // in 'single' mode (it's used for the composite fallback / a11y label).
  // Pass the SAME value the arc is filled from across, so any aria-label
  // computation is consistent with the score shown.
  const ringDimensions: DecisionHealthRingDimensions = {
    structure: ringClaim?.value ?? 0,
    evidence: ringClaim?.value ?? 0,
    coverage: ringClaim?.value ?? 0,
    verified: ringClaim?.value ?? 0,
  }

  // Headline from coaching data, with a tier-calibrated fallback so the
  // panel doesn't claim "is the leading option" when evidence is weak.
  // Brief 5.1 Task 4: certaintyCopy is the single source for both the
  // fallback headline AND the tier-driven caveat. Coaching sources are
  // allowed to override the headline wording (they went through the
  // coaching pipeline), but the caveat is derived purely from tier
  // fields — if evidence is weak the caveat renders regardless of
  // whatever headline text is in play. That closes the loophole where
  // an upstream "clear leading option" string could mask a
  // needs_work / needs_evidence bundle.
  //
  // Brief 5.2 Task 1: Brief 5.1's caveat guarantee alone wasn't enough —
  // PLoT can still supply "Option A is the clear leader with a 95-point
  // advantage" which rendered verbatim because coachingHeadline won the
  // precedence chain. When the tier is weak (certainty.caveat is present),
  // we now swap in certainty.headline instead so the headline softens with
  // the caveat. winProbabilityGap preserves the numeric lead as "by N
  // points" without the over-confident framing.
  const winProbabilityGap = useMemo(() => {
    const options = data.recommendation.allOptions
    if (!options || options.length < 2) return undefined
    const winner = data.recommendation.recommendedOption
    if (!winner || typeof winner.winProbability !== 'number') return undefined
    const runnerUp = options
      .filter(o => o.id !== winner.id && typeof o.winProbability === 'number')
      .reduce<typeof winner | null>((best, cur) => {
        if (!best) return cur
        return (cur.winProbability ?? 0) > (best.winProbability ?? 0) ? cur : best
      }, null)
    if (!runnerUp || typeof runnerUp.winProbability !== 'number') return undefined
    const gapPct = (winner.winProbability - runnerUp.winProbability) * 100
    return gapPct > 0 ? gapPct : undefined
  }, [data.recommendation.allOptions, data.recommendation.recommendedOption])

  const certainty = useMemo(() => {
    const winner = data.recommendation.recommendedOption
    if (!winner) return null
    return buildCertaintyCopy({
      winnerLabel: winner.label,
      confidenceTier: data.confidence.tier.tier,
      coachingReadiness: data.recommendation.coachingReadiness,
      recommendationStability: data.recommendation.recommendationStability,
      analysisStatus: data.recommendation.analysisStatus,
      optionCount: data.recommendation.allOptions.length,
      winProbabilityGap,
      // SINGLE VERDICT: the shared "is there a leading option?" answer,
      // derived from the same PLoT report the canvas badge reads.
      //
      // ROADMAP 1.267: `buildCertaintyCopy` now REQUIRES it, and this is the
      // one place the hook's optional field is resolved. `verdict` is absent
      // only on the hook's pre-first-run early return, which also returns
      // `recommendedOption: null` — so the `if (!winner) return null` above
      // already claimed that path and the fallback is unreachable in
      // production. It is still spelled NO_CLAIM_VERDICT rather than left to
      // an optional parameter, because "unreachable today" is how the
      // original hole was argued too: the honest fallback is silence, and
      // returning null here would be WORSE than silence — a null `certainty`
      // hands the headline to `coachingHeadline` below, which is exactly the
      // producer copy that says "clear leader".
      verdict: data.recommendation.verdict ?? NO_CLAIM_VERDICT,
    })
  }, [
    data.recommendation.recommendedOption,
    data.recommendation.coachingReadiness,
    data.recommendation.recommendationStability,
    data.recommendation.analysisStatus,
    data.recommendation.allOptions.length,
    data.confidence.tier.tier,
    winProbabilityGap,
    data.recommendation.verdict,
  ])

  // Brief 5.2 follow-up (ChatGPT P0 #1): the earlier gate was too narrow —
  // only caveat-bearing branches suppressed PLoT coaching overrides, which
  // let unstable, partial, single-option, fair-tier, and fallback branches
  // regress to strong "clear leader" language even though certaintyCopy
  // emitted a conservative lede. The `conservative` flag marks every
  // branch except Rule 6 (strong + ready) so coaching overrides are now
  // scoped to the single tier combination where they are genuinely safe.
  const headline = certainty?.conservative
    ? certainty.headline
    : (data.recommendation.coachingHeadline
       ?? data.recommendation.coachingDecisionStatement
       ?? certainty?.headline
       ?? null)

  // Caveat is tier-driven. It attaches whenever buildCertaintyCopy
  // returned one — the decision table only produces a caveat when
  // confidenceTier === 'needs_work' or readiness is weak, so the
  // presence of certainty.caveat is itself the honesty signal.
  const healthHeaderCoaching = certainty?.caveat ?? null

  // ── D2a hero: readiness dimension bars + qualifier + stability indicator ──
  // The post-analysis bundle supplies a 3-dim readiness set
  // ({evidence, robustness, clarity}) — see useResultsSectionData.ts:1238.
  // The wireframe pictures a 4-dim set ({Structure/Evidence/Coverage/Verified}).
  // Per Paul's directive ("use whatever the data supplies — do not invent
  // dimensions") we render only the 3 keys the response actually provides.
  // The label "Framing" maps to `clarity` because the upstream coaching
  // taxonomy treats clarity-of-framing as the user-facing concept.
  const readinessDimensions = data.recommendation.coachingReadinessDimensions
  const heroDimensions = useMemo(() => {
    if (!readinessDimensions) return undefined
    return [
      { label: 'Evidence', value: readinessDimensions.evidence, tooltip: 'How well-supported your factor estimates are.' },
      { label: 'Robustness', value: readinessDimensions.robustness, tooltip: 'How sensitive the result is to assumption shifts.' },
      { label: 'Framing', value: readinessDimensions.clarity, tooltip: 'How clearly the decision and options are framed.' },
    ]
  }, [readinessDimensions])

  // Stability indicator renders adjacent to the ring. Suppressed
  // when the field is missing — never emits "Stability: NaN%".
  const stabilityScore = data.recommendation.recommendationStability
  const stabilityIndicator = useMemo(() => {
    if (typeof stabilityScore !== 'number' || !Number.isFinite(stabilityScore)) return null
    const pct = Math.round(stabilityScore * 100)
    return (
      <p
        className={`${typography.panelMeta} text-text-light`}
        data-testid="hero-stability-indicator"
      >
        Stability: {pct}%
      </p>
    )
  }, [stabilityScore])

  // Sci-4B: verbal uncertainty calibration — maps the wire robustness band
  // (recommendation.robustnessLevel/robustnessLabel) + the winner's outcome
  // interval to a fixed verbal-framing sentence. Honest-render: renders
  // nothing when the wire carries no robustness signal at all (see
  // calibrateUncertaintyCopy / UI-SEM-073).
  const winnerOutcome = data.recommendation.recommendedOption?.outcome
  const uncertaintyCopy = useMemo(
    () =>
      calibrateUncertaintyCopy({
        robustnessLevel: data.recommendation.robustnessLevel,
        robustnessLabel: data.recommendation.robustnessLabel,
        p10: winnerOutcome?.p10 ?? null,
        p90: winnerOutcome?.p90 ?? null,
      }),
    [data.recommendation.robustnessLevel, data.recommendation.robustnessLabel, winnerOutcome],
  )

  return (
    <div className="space-y-4 animate-fade-in" data-testid="decision-confidence-panel">
      {/* Transition bridge — sits OUTSIDE the T1 card so the bridge can
          appear and disappear without disturbing the card chrome. */}
      <TransitionBridge verifiedCount={verifiedCount} influenceCoverage={influenceCoverage} />

      {/* ── T1 Decision confidence card ────────────────────────────────────
         The whole T1 stack lives in one outer .sc card (border-panel-border,
         bg-panel, rounded-lg) per the wireframe + 5.8A T1DecisionReadinessCard
         pattern. Sub-blocks are separated by `.sep` dividers
         (border-t border-panel-border) instead of being independent cards
         so the user reads the stack as a single unit. */}
      <div
        className="rounded-lg border border-panel-border bg-panel p-3 space-y-3"
        data-testid="t1-decision-confidence-card"
      >
        {/* 1. Hero — header rendered without its own card chrome so we
            don't double-shell. */}
        <TriageHealthHeader
          title="Decision confidence"
          ringLabel="%"
          ringDimensions={ringDimensions}
          dimensions={heroDimensions}
          headline={headline}
          coaching={healthHeaderCoaching}
          overrideScore={winProbabilityScore}
          mode="single"
          ringCaption={ringClaim?.caption}
          secondaryIndicator={stabilityIndicator}
          qualifier={
            // Qualifier precedence: a genuine CEE 'stale' verdict is the
            // highest-impact warning, then completeness reasons, then dimensions.
            // Freshness is the CEE-only verdict (never a fabricated local stale).
            readinessDimensions ||
            (data.completeness?.reasons?.length ?? 0) > 0 ||
            displayedFreshness === 'stale' ? (
              <HeroQualifier
                dimensions={readinessDimensions}
                completenessReasons={data.completeness?.reasons}
                freshness={displayedFreshness ?? undefined}
                freshnessReason={ceeFreshness?.freshnessReason}
              />
            ) : undefined
          }
          testId="confidence-health-header"
          noCardWrapper
          titleAdornment={autoNoiseAdornment}
        />

        {/* Sci-4B: calibrated verbal uncertainty framing, rendered near the
            hero headline. Absent when the wire carries no robustness signal. */}
        {uncertaintyCopy && (
          <p
            className={`${typography.panelMeta} text-text-light`}
            data-testid="uncertainty-calibration-copy"
          >
            {uncertaintyCopy.text}
          </p>
        )}

        {/* Action-card body — extracted to TriageActionCardsBody for reuse by AnalysisHeroV17. */}
        <TriageActionCardsBody
          data={data}
          onFocusNode={onFocusNode}
          onHoverEnter={onHoverEnter}
          onHoverLeave={onHoverLeave}
          onSetValue={onSetValue}
          onConfirm={onConfirm}
          nodeValueLookup={nodeValueLookup}
          onSendMessage={onSendMessage}
          aiAffordance={aiAffordance}
        />
      </div>
    </div>
  )
})

export default DecisionConfidencePanel
