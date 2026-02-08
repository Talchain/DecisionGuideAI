/**
 * Results Panel v7 — Storybook Stories (CSF3)
 *
 * Two scenarios:
 *   1. ClearWinner — 3 options, stability 0.78, denormalised user units
 *   2. CloseResult — 2 options, stability 0.51, normalised model scores
 *
 * These mount the real sub-components (HeroSection, RangeVisualization,
 * DriversSection, TornadoChart, ConfidenceSection) with fixture data.
 * Canvas store is NOT required — components accept data via props.
 */

import React from 'react'
import { HeroSection, type OptionWinShare } from './HeroSection'
import { RangeVisualization } from './RangeVisualization'
import { DriversSection } from './DriversSection'
import { TornadoChart, type TornadoRow } from './TornadoChart'
import { ConfidenceSection } from './ConfidenceSection'
import { SectionHeader } from './SectionHeader'
import type {
  RecommendationSectionData,
  DriversSectionData,
  ConfidenceSectionData,
  DriverItem,
  OptionResult,
} from './types'

// ---------------------------------------------------------------------------
// Fixture: Clear Winner (3 options, denormalised)
// ---------------------------------------------------------------------------

const clearWinnerOptions: OptionResult[] = [
  {
    id: 'option-build-in-house',
    label: 'Build in-house',
    expected: 640,
    outcome: { mean: 640, p10: 380, p50: 620, p90: 890 },
    p10: 380, p50: 620, p90: 890,
    isRecommended: true,
    winProbability: 0.71,
    goalProbability: 0.64,
    rank: 1,
  },
  {
    id: 'option-outsource',
    label: 'Outsource',
    expected: 480,
    outcome: { mean: 480, p10: 260, p50: 460, p90: 710 },
    p10: 260, p50: 460, p90: 710,
    isRecommended: false,
    winProbability: 0.22,
    goalProbability: 0.31,
    rank: 2,
  },
  {
    id: 'option-hybrid',
    label: 'Hybrid approach',
    expected: 410,
    outcome: { mean: 410, p10: 190, p50: 390, p90: 640 },
    p10: 190, p50: 390, p90: 640,
    isRecommended: false,
    winProbability: 0.07,
    goalProbability: 0.18,
    rank: 3,
  },
]

const clearWinnerDrivers: DriverItem[] = [
  {
    factorKey: 'factor-tech-lead',
    factorLabel: 'Tech lead hired',
    rawElasticity: 0.42,
    normalisedInfluence: 1.0,
    influenceScore: 0.42,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    confidence: 0.55,
  },
  {
    factorKey: 'factor-market-timing',
    factorLabel: 'Market timing',
    rawElasticity: 0.31,
    normalisedInfluence: 0.74,
    influenceScore: 0.31,
    rank: 2,
    direction: 'positive',
    semanticLabel: 'strong',
    canFocus: true,
    confidence: 0.72,
  },
  {
    factorKey: 'factor-budget',
    factorLabel: 'Budget available',
    rawElasticity: 0.18,
    normalisedInfluence: 0.43,
    influenceScore: 0.18,
    rank: 3,
    direction: 'positive',
    semanticLabel: 'moderate',
    canFocus: true,
    confidence: 0.88,
  },
]

const clearWinnerTornadoRows: TornadoRow[] = clearWinnerDrivers.map(d => ({
  factorKey: d.factorKey,
  label: d.factorLabel,
  lowOutcome: 640 - (d.influenceScore ?? 0) * (640 - 380),
  highOutcome: 640 + (d.influenceScore ?? 0) * (890 - 640),
  canFocus: d.canFocus,
}))

const clearWinnerDriversData: DriversSectionData = {
  drivers: clearWinnerDrivers,
  driversStatus: 'computed',
  topDrivers: clearWinnerDrivers.slice(0, 3),
  totalCount: 3,
  hasMagnitudeData: true,
}

const clearWinnerConfidence: ConfidenceSectionData = {
  tier: { tier: 'fair', icon: '⚡', label: 'Fair', description: 'Some assumptions need validation' },
  qualityScore: 62,
  uncertainties: [
    {
      code: 'fragile_edge',
      message: '"Tech lead hired → Customers acquired" is sensitive — if wrong, Outsource wins instead',
      severity: 'warning',
      factorConfidence: 0.55,
    },
  ],
  topUncertainties: [],
  improvements: [
    {
      action: 'Validate tech lead hiring timeline',
      reason: 'This is the biggest driver and has medium confidence',
      priority: 1,
      source: 'quality_factor',
    },
  ],
  topImprovements: [],
  robustnessStatus: 'computed',
  topFragileEdge: {
    fromId: 'factor-tech-lead',
    fromLabel: 'Tech lead hired',
    toId: 'goal-customers',
    toLabel: 'Customers acquired',
    alternativeWinnerLabel: 'Outsource',
    switchProbability: 0.22,
  },
}

// ---------------------------------------------------------------------------
// Fixture: Close Result (2 options, normalised — no goalThresholdCap)
// ---------------------------------------------------------------------------

const closeResultOptions: OptionResult[] = [
  {
    id: 'option-expand',
    label: 'Expand',
    expected: 0.52,
    outcome: { mean: 0.52, p10: 0.18, p50: 0.50, p90: 0.84 },
    p10: 0.18, p50: 0.50, p90: 0.84,
    isRecommended: true,
    winProbability: 0.51,
    rank: 1,
  },
  {
    id: 'option-consolidate',
    label: 'Consolidate',
    expected: 0.48,
    outcome: { mean: 0.48, p10: 0.15, p50: 0.46, p90: 0.81 },
    p10: 0.15, p50: 0.46, p90: 0.81,
    isRecommended: false,
    winProbability: 0.49,
    rank: 2,
  },
]

const closeResultDrivers: DriverItem[] = [
  {
    factorKey: 'factor-demand',
    factorLabel: 'Customer demand',
    rawElasticity: 0.55,
    normalisedInfluence: 1.0,
    influenceScore: 0.55,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    confidence: 0.35,
  },
  {
    factorKey: 'factor-competition',
    factorLabel: 'Competitive pressure',
    rawElasticity: 0.32,
    normalisedInfluence: 0.58,
    influenceScore: 0.32,
    rank: 2,
    direction: 'negative',
    semanticLabel: 'strong',
    canFocus: true,
    confidence: 0.48,
  },
]

const closeResultTornadoRows: TornadoRow[] = closeResultDrivers.map(d => ({
  factorKey: d.factorKey,
  label: d.factorLabel,
  lowOutcome: 0.52 - (d.influenceScore ?? 0) * (0.52 - 0.18),
  highOutcome: 0.52 + (d.influenceScore ?? 0) * (0.84 - 0.52),
  canFocus: d.canFocus,
}))

const closeResultDriversData: DriversSectionData = {
  drivers: closeResultDrivers,
  driversStatus: 'computed',
  topDrivers: closeResultDrivers.slice(0, 2),
  totalCount: 2,
  hasMagnitudeData: true,
}

const closeResultConfidence: ConfidenceSectionData = {
  tier: { tier: 'needs_work', icon: '⚠️', label: 'Needs work', description: 'Key assumptions are fragile' },
  qualityScore: 38,
  uncertainties: [
    {
      code: 'fragile_edge',
      message: '"Customer demand → Revenue growth" is highly sensitive — if wrong, Consolidate wins',
      severity: 'critical',
      factorConfidence: 0.35,
    },
    {
      code: 'fragile_edge',
      message: '"Competitive pressure → Revenue growth" could shift the outcome significantly',
      severity: 'warning',
      factorConfidence: 0.48,
    },
  ],
  topUncertainties: [],
  improvements: [
    {
      action: 'Research customer demand forecasts',
      reason: 'Biggest driver with lowest confidence',
      priority: 1,
      source: 'quality_factor',
    },
    {
      action: 'Assess competitive landscape',
      reason: 'Second driver with medium confidence',
      priority: 2,
      source: 'quality_factor',
    },
  ],
  topImprovements: [],
  robustnessStatus: 'computed',
  topFragileEdge: {
    fromId: 'factor-demand',
    fromLabel: 'Customer demand',
    toId: 'goal-revenue',
    toLabel: 'Revenue growth',
    alternativeWinnerLabel: 'Consolidate',
    switchProbability: 0.49,
  },
}

// ---------------------------------------------------------------------------
// Storybook Meta + Stories (CSF3)
// ---------------------------------------------------------------------------

export default {
  title: 'Results Panel v7',
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'panel' },
  },
}

/** Wrapper that mimics the dock panel width and background */
function PanelWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 380,
        maxHeight: '90vh',
        overflow: 'auto',
        background: 'var(--bg-panel, #FFFDF7)',
        borderRadius: 16,
        padding: 16,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div className="flex flex-col gap-[18px]">
        {children}
      </div>
    </div>
  )
}

// ── Story 1: Clear Winner ────────────────────────────────────────────────

export const ClearWinner = () => (
  <PanelWrapper>
    {/* Section 1: Hero */}
    <div>
      <SectionHeader title="Recommendation" testId="section-header-hero" />
      <HeroSection
        winnerLabel="Build in-house"
        winnerId="option-build-in-house"
        winnerGoalProbability={0.64}
        winnerWinProbability={0.71}
        runnerUpLabel="Outsource"
        runnerUpId="option-outsource"
        runnerUpGoalProbability={0.31}
        runnerUpWinProbability={0.22}
        optionCount={3}
        hasBaseline={false}
        recommendationStability={0.78}
        analysisStatus="computed"
        topDrivers={clearWinnerDrivers.slice(0, 2).map(d => ({
          id: d.factorKey,
          label: d.factorLabel,
          direction: d.direction,
        }))}
        topFragileEdge={clearWinnerConfidence.topFragileEdge}
        goalLabel="Customers acquired"
        goalThreshold={800}
        expectedOutcome={640}
        outcomeUnit="count"
        optionWinShares={clearWinnerOptions.map(o => ({
          id: o.id,
          label: o.label,
          winProbability: o.winProbability!,
          isWinner: o.isRecommended,
        }))}
      />
    </div>

    {/* Section 2: Options comparison */}
    <div>
      <SectionHeader title="How the options compare" testId="section-header-options" />
      <RangeVisualization
        options={clearWinnerOptions}
        goalThreshold={800}
        winnerId="option-build-in-house"
        outcomeUnit="count"
      />
    </div>

    {/* Section 3: Drivers */}
    <div>
      <SectionHeader title="What's driving this" count={3} testId="section-header-drivers" />
      <DriversSection
        data={clearWinnerDriversData}
        goalLabel="Customers acquired"
        expectedOutcome={640}
        tornadoRows={clearWinnerTornadoRows}
        outcomeUnit="count"
      />
    </div>

    {/* Section 4: Strengthen */}
    <div>
      <SectionHeader title="Strengthen your analysis" count={2} testId="section-header-strengthen" />
      <ConfidenceSection
        data={clearWinnerConfidence}
        topDriverLabel="Tech lead hired"
        topDriverId="factor-tech-lead"
      />
    </div>
  </PanelWrapper>
)

ClearWinner.storyName = 'Clear winner (denormalised)'

// ── Story 2: Close Result ────────────────────────────────────────────────

export const CloseResult = () => (
  <PanelWrapper>
    {/* Section 1: Hero */}
    <div>
      <SectionHeader title="Recommendation" testId="section-header-hero" />
      <HeroSection
        winnerLabel="Expand"
        winnerId="option-expand"
        winnerWinProbability={0.51}
        runnerUpLabel="Consolidate"
        runnerUpId="option-consolidate"
        runnerUpWinProbability={0.49}
        optionCount={2}
        hasBaseline={false}
        recommendationStability={0.51}
        analysisStatus="computed"
        topDrivers={closeResultDrivers.slice(0, 2).map(d => ({
          id: d.factorKey,
          label: d.factorLabel,
          direction: d.direction,
        }))}
        topFragileEdge={closeResultConfidence.topFragileEdge}
        goalLabel="Revenue growth"
        expectedOutcome={0.52}
        isNormalised
        optionWinShares={closeResultOptions.map(o => ({
          id: o.id,
          label: o.label,
          winProbability: o.winProbability!,
          isWinner: o.isRecommended,
        }))}
      />
    </div>

    {/* Section 2: Options comparison */}
    <div>
      <SectionHeader title="How the options compare" testId="section-header-options" />
      <RangeVisualization
        options={closeResultOptions}
        winnerId="option-expand"
        isNormalised
      />
    </div>

    {/* Section 3: Drivers */}
    <div>
      <SectionHeader title="What's driving this" count={2} testId="section-header-drivers" />
      <DriversSection
        data={closeResultDriversData}
        goalLabel="Revenue growth"
        expectedOutcome={0.52}
        tornadoRows={closeResultTornadoRows}
        isNormalised
      />
    </div>

    {/* Section 4: Strengthen */}
    <div>
      <SectionHeader title="Strengthen your analysis" count={4} testId="section-header-strengthen" />
      <ConfidenceSection
        data={closeResultConfidence}
        topDriverLabel="Customer demand"
        topDriverId="factor-demand"
      />
    </div>
  </PanelWrapper>
)

CloseResult.storyName = 'Close result (normalised, near-tie)'

// ── Story 3: Tornado Chart Isolated ──────────────────────────────────────

export const TornadoChartStory = () => (
  <PanelWrapper>
    <TornadoChart
      rows={clearWinnerTornadoRows}
      expectedOutcome={640}
      outcomeUnit="count"
    />
  </PanelWrapper>
)

TornadoChartStory.storyName = 'Tornado chart (isolated)'

// ── Story 4: Tornado Chart Normalised ────────────────────────────────────

export const TornadoChartNormalised = () => (
  <PanelWrapper>
    <TornadoChart
      rows={closeResultTornadoRows}
      expectedOutcome={0.52}
      isNormalised
    />
  </PanelWrapper>
)

TornadoChartNormalised.storyName = 'Tornado chart (normalised)'
