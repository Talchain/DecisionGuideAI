/**
 * AnalysisHeroV17 — data-state coverage (Storybook only).
 *
 * Renders the EXISTING live hero (no new panel, no new view-model, no new
 * fields) across the data states it must degrade through, using existing
 * fixtures only. Purpose: document and visually verify safe fallback /
 * unsupported / missing-data behaviour before the Decision Data Architecture
 * defines the canonical Analysis contract.
 *
 * Contract-safe: this file adds NO semantics. Every story feeds the hero data
 * shaped from the existing `resultsPanelV7` fixtures (optionally with fields
 * removed) and lets the hero's own fallbacks render. Notes describe behaviour,
 * not specific copy — wording (robustness, verdict) is under active revision.
 *
 * Documentation-only limitation (not a data state, so deliberately NOT a story):
 * the hero renders no freshness/staleness chip — there is no reliable canonical
 * stale signal on the live path yet. To be revisited with the Decision Data
 * Spine / canonical freshness work.
 */
import React from 'react'
import { AnalysisHeroV17 } from './AnalysisHeroV17'
import { buildResultsVM } from './buildResultsVM'
import { normalisedFixture } from '../../__fixtures__/resultsPanelV7.normalised.hook'
import { sensitiveFixture } from '../../__fixtures__/resultsPanelV7.sensitive.hook'
import { minimalFixture } from '../../__fixtures__/resultsPanelV7.minimal.hook'
import type { ResultsSectionDataReturn } from './useResultsSectionData'

export default {
  title: 'Results/AnalysisHeroV17 — data states',
  parameters: { layout: 'padded', backgrounds: { default: 'panel' } },
}

type RSD = ResultsSectionDataReturn

/** Shallow-merge the three sub-objects the hero reads; existing fixtures stay intact. */
function over(
  base: RSD,
  o: {
    recommendation?: Partial<RSD['recommendation']>
    drivers?: Partial<RSD['drivers']>
    confidence?: Partial<RSD['confidence']>
  } = {},
): RSD {
  return {
    ...base,
    recommendation: { ...base.recommendation, ...o.recommendation },
    drivers: { ...base.drivers, ...o.drivers },
    confidence: { ...base.confidence, ...o.confidence },
  }
}

function PanelWrapper({ note, children }: { note?: string; children: React.ReactNode }) {
  return (
    <div style={{ width: 380, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {note && (
        <p style={{ fontSize: 11, color: 'var(--text-light)', margin: '0 0 8px', lineHeight: 1.5 }}>
          {note}
        </p>
      )}
      <div
        style={{
          maxHeight: '88vh',
          overflow: 'auto',
          background: 'var(--bg-panel, #FEFEFE)',
          borderRadius: 16,
          padding: 16,
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** No-op focus handler — these are visual stories, click-to-focus is a no-op. */
const noopFocus = () => {}

function Hero({ data }: { data: RSD }) {
  return <AnalysisHeroV17 data={data} vm={buildResultsVM(data)} onFocusNode={noopFocus} />
}

type Story = (() => React.ReactElement) & { storyName?: string }

// ── 1. Full data ─────────────────────────────────────────────────────────────
export const FullData: Story = () => (
  <PanelWrapper note="Full analysis: a clear leader with robustness, drivers and a fragility warning present.">
    <Hero data={normalisedFixture} />
  </PanelWrapper>
)
FullData.storyName = '1 · Full data (clear leader)'

// ── 2. Partial / sparse data ─────────────────────────────────────────────────
export const PartialData: Story = () => (
  <PanelWrapper note="Sparse data: the hero degrades to its result context and hides sections it has no data for.">
    <Hero data={minimalFixture} />
  </PanelWrapper>
)
PartialData.storyName = '2 · Partial data (minimal)'

// ── 3. No clear leader (no winner) ───────────────────────────────────────────
export const NoClearLeader: Story = () => (
  <PanelWrapper note="No winner: with no options to compare, the hero shows its neutral no-winner result context and makes no positive winner claim.">
    <Hero data={over(normalisedFixture, { recommendation: { recommendedOption: null, allOptions: [] } })} />
  </PanelWrapper>
)
NoClearLeader.storyName = '3 · No clear leader (no winner)'

// ── 4. Sensitive result (close margin, winner present) ───────────────────────
export const SensitiveResult: Story = () => (
  <PanelWrapper note="Sensitive result: a close margin and low stability. The hero still presents the leading option, but the robustness check flags it as sensitive — this is a sensitive-result state, NOT a no-clear-leader state.">
    <Hero data={sensitiveFixture} />
  </PanelWrapper>
)
SensitiveResult.storyName = '4 · Sensitive result (winner, flagged sensitive)'

// ── 4. Missing robustness ────────────────────────────────────────────────────
export const MissingRobustness: Story = () => (
  <PanelWrapper note="Robustness absent: the robustness check renders its not-known state — the hero never presents a positive robustness claim.">
    <Hero
      data={over(normalisedFixture, {
        recommendation: {
          recommendationStability: undefined,
          robustnessLevel: undefined,
          robustnessLabel: undefined,
        },
        confidence: { rankingStability: undefined, robustnessLevel: undefined, totalHighRiskEdges: 0 },
      })}
    />
  </PanelWrapper>
)
MissingRobustness.storyName = '5 · Missing robustness (no overclaim)'

// ── 5. Coaching unavailable ──────────────────────────────────────────────────
export const CoachingUnavailable: Story = () => (
  <PanelWrapper note="No coaching inputs: the key-question and input-rows sections are absent; the hero shows only its result context and degrades quietly.">
    <Hero
      data={over(normalisedFixture, {
        drivers: { drivers: [], topDrivers: [] },
        confidence: {
          evidenceGaps: [],
          topEvidenceGaps: [],
          nextActions: [],
          topNextActions: [],
          uncertainties: [],
          topUncertainties: [],
          m2DecisionQualityPrompts: undefined,
          m1CoachingTopFragileEdge: undefined,
          topFragileEdge: undefined,
          conditionalWinners: undefined,
        },
      })}
    />
  </PanelWrapper>
)
CoachingUnavailable.storyName = '6 · Coaching unavailable'

// Note: an "unsupported field hidden" story was intentionally NOT added — it
// would be visually identical to PartialData (minimalFixture already lacks the
// optional surfaces). The hide-on-absent behaviour is proven instead by a
// present→absent differential in the fallback spec (the flip-risk callout).
