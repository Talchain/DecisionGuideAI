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

import { useMemo, memo, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronRight, Info, X } from 'lucide-react'
import Tooltip from '@/components/Tooltip'
import { TriageHealthHeader } from '@/components/shared/TriageHealthHeader'
import type { DecisionHealthRingDimensions } from '@/components/shared/DecisionHealthRing'
import { HeroQualifier } from './HeroQualifier'
import { useAnalysisFreshnessState } from '@/lib/useAnalysisFreshnessState'
import { buildCertaintyCopy } from './utils/certaintyCopy'
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
  // P0 V5 golden-path repair (Wave 3 wiring, third-round follow-up):
  // single-source freshness verdict consumed by HeroQualifier alongside
  // completeness reasons and dimension scores. Stale wire freshness
  // wins above the other two qualifier sources.
  const freshnessState = useAnalysisFreshnessState()

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

  // Post-analysis ring shows winner's win probability directly. The readiness
  // composite (Structure/Evidence/Coverage/Verified) is pre-analysis-only.
  const winProbability = data.recommendation.recommendedOption?.winProbability
  const hasWinProbability = typeof winProbability === 'number' && Number.isFinite(winProbability)
  const winProbabilityScore = hasWinProbability ? Math.round(winProbability! * 100) : null

  // ringDimensions is required by the DecisionHealthRing prop contract even
  // in 'single' mode (it's used for the composite fallback / a11y label).
  // Pass the win-probability value across so any aria-label computation is
  // consistent with the score shown.
  const ringDimensions: DecisionHealthRingDimensions = {
    structure: hasWinProbability ? winProbability! : 0,
    evidence: hasWinProbability ? winProbability! : 0,
    coverage: hasWinProbability ? winProbability! : 0,
    verified: hasWinProbability ? winProbability! : 0,
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
    })
  }, [
    data.recommendation.recommendedOption,
    data.recommendation.coachingReadiness,
    data.recommendation.recommendationStability,
    data.recommendation.analysisStatus,
    data.recommendation.allOptions.length,
    data.confidence.tier.tier,
    winProbabilityGap,
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
      { label: 'Robustness', value: readinessDimensions.robustness, tooltip: 'How sensitive the recommendation is to assumption shifts.' },
      { label: 'Framing', value: readinessDimensions.clarity, tooltip: 'How clearly the decision and options are framed.' },
    ]
  }, [readinessDimensions])

  // Stability indicator renders adjacent to the win-probability ring. Suppressed
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
          ringCaption={hasWinProbability ? 'win probability' : undefined}
          secondaryIndicator={stabilityIndicator}
          qualifier={
            // P0 V5 golden-path repair:
            //   Wave 3 (third-round follow-up): pass `freshness` and
            //     `freshnessReason` from `useAnalysisFreshnessState`
            //     so a stale CEE verdict surfaces ahead of completeness
            //     and dimension qualifiers. Stale results are the
            //     highest-impact warning the panel can give.
            //   Wave 4: pass `completenessReasons` alongside dimensions.
            //     Partial source data is more critical than a low
            //     evidence dimension.
            //   Existing: dimensions remain the lowest-priority qualifier.
            readinessDimensions ||
            (data.completeness?.reasons?.length ?? 0) > 0 ||
            freshnessState.freshness === 'stale' ? (
              <HeroQualifier
                dimensions={readinessDimensions}
                completenessReasons={data.completeness?.reasons}
                freshness={freshnessState.freshness}
                freshnessReason={freshnessState.reason}
              />
            ) : undefined
          }
          testId="confidence-health-header"
          noCardWrapper
          titleAdornment={autoNoiseAdornment}
        />

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
