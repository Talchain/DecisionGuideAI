/**
 * THE ANALYSIS COCKPIT — ONE surface, per-state mount paths (PX-C).
 *
 * ## What this file exists to prevent
 *
 * The Analysis tab carried FOUR parallel implementations of "the analysis":
 * the hero panel (live), `AnalysisHeroV17` + `DecisionConfidencePanel` (both
 * inside an analysis-hero flag arm that was STRUCTURALLY DARK, because staging
 * baked the flag `"1"`), and the V7 assessment group on the unflagged
 * "Alt view" dock tab. Three generations of the same feature have shipped dark
 * through that fork (CLAUDE.md trap 3b, instances 1-3). This file binds the
 * consolidation: ONE cockpit, mounted unconditionally, with the per-factor
 * act-on-it model as a DESIGNED SECTION inside the hero's chrome rather than a
 * chromeless sibling div.
 *
 * ## Binding discipline
 *
 * - Every assertion binds by IDENTITY (a named factor, a named testid), never
 *   by a value predicate another object could satisfy (trap 19).
 * - The mount-path assertions assert CONTAINMENT (`toContainElement`), so a
 *   component that renders somewhere else on the tab cannot satisfy them —
 *   that is the whole point of a mount-path spec.
 * - §4 asserts the dark arm is GONE at the FILESYSTEM, not merely unmounted:
 *   a deleted fork cannot dark-ship a fourth time.
 * - ⚠ SCOPE (trap 3): jsdom proves DOM presence and containment. It cannot
 *   prove visibility, layout, or above-the-fold. Screenshots carry that claim.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { stripComments } from '../../../../../tests/helpers/stripSourceComments'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

import { ResultsBody } from '../../ResultsBody'
import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  EvidenceGapItem,
  ImprovementsSectionData,
  OptionResult,
} from '../../types'

const SRC = resolve(process.cwd(), 'src')

/** The one evidence factor, named once — owned by the triage queue. */
const GAP_NODE_ID = 'node_ramp_up'
const GAP_LABEL = 'Ramp-up time'
/** The one fragile-edge factor, named once — owned by the act-on-it rows. */
const RISK_NODE_ID = 'node_customer_demand'
const RISK_LABEL = 'Customer demand'
/** The one bias finding, named once — owned by the act-on-it rows. */
const BIAS_TYPE = 'Anchoring'

function makeData(): ResultsSectionDataReturn {
  const winner = {
    id: 'opt_a',
    label: 'Option A',
    expected: 0.8,
    outcome: { mean: 0.8, p10: 0.6, p50: 0.78, p90: 0.95 },
    p10: 0.6,
    p50: 0.78,
    p90: 0.95,
    isRecommended: true,
    winProbability: 0.7,
    goalProbability: 0.7,
  } as unknown as OptionResult
  const runnerUp = {
    id: 'opt_b',
    label: 'Option B',
    expected: 0.4,
    outcome: { mean: 0.4, p10: 0.2, p50: 0.38, p90: 0.6 },
    p10: 0.2,
    p50: 0.38,
    p90: 0.6,
    isRecommended: false,
    winProbability: 0.3,
    goalProbability: 0.3,
  } as unknown as OptionResult

  const recommendation = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
    goalThreshold: 0.6,
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.6,
    robustnessLevel: 'medium',
    isNormalised: false,
  } as unknown as DecisionResultData

  const drivers: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: false,
  }

  const gap: EvidenceGapItem = {
    factorId: 'fac_ramp',
    factorLabel: GAP_LABEL,
    confidence: 40,
    voi: 0.5,
    suggestion: 'This estimate is the AI’s, not yours.',
    targetNodeId: GAP_NODE_ID,
  }

  const confidence = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [gap],
    topEvidenceGaps: [gap],
    nextActions: [],
    topNextActions: [],
    topFragileEdge: {
      fromId: RISK_NODE_ID,
      fromLabel: RISK_LABEL,
      toId: 'node_revenue',
      toLabel: 'Revenue growth',
      alternativeWinnerLabel: 'Option B',
      switchProbability: 0.35,
    },
    m2BiasFindings: [
      {
        type: BIAS_TYPE,
        source: 'm2',
        description: 'The first figure discussed is doing a lot of work here.',
        affectedElements: [],
        linkedCritiqueCode: '',
      },
    ],
  } as unknown as ConfidenceSectionData

  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  } as ImprovementsSectionData

  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
    completeness: { status: 'full', missing: [], reasons: [] },
    autoNoiseProvenance: null,
  } as unknown as ResultsSectionDataReturn
}

function renderCockpit(props: { isRunning?: boolean; isStale?: boolean } = {}) {
  const onConfirmFactor = vi.fn()
  const onSetFactorValue = vi.fn()
  const onFocusNode = vi.fn()
  render(
    <ResultsBody
      resultsSectionData={makeData()}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      onConfirmFactor={onConfirmFactor}
      onSetFactorValue={onSetFactorValue}
      onFocusNode={onFocusNode}
      nodeValueLookup={{ [GAP_NODE_ID]: { value: 12, unit: 'weeks', cap: null } }}
      isRunning={props.isRunning}
      isStale={props.isStale}
    />,
  )
  return { onConfirmFactor, onSetFactorValue, onFocusNode }
}

/** The ONE cockpit root, by identity. */
function cockpit(): HTMLElement {
  return screen.getByTestId('analysis-hero-panel')
}

describe('Analysis cockpit — ONE surface', () => {
  beforeEach(() => {
    localStorage.clear()
    useCanvasStore.setState({
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      draftCoaching: null,
    })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
    // The act-on-it rows' prefill-dependent actions are hidden when no chat
    // wire is registered; register one so the row action cluster is exercised.
    useGuidanceStore.setState({ _sendMessage: vi.fn() })
  })
  afterEach(() => {
    cleanup()
    localStorage.clear()
    useGuidanceStore.setState({ _sendMessage: null })
  })

  // ── §1 The act-on-it model is a DESIGNED SECTION INSIDE the cockpit ──────

  it('§1a the act-on-it section mounts INSIDE the hero panel', () => {
    renderCockpit()
    const section = screen.getByTestId('hero-act-on-it')
    expect(cockpit()).toContainElement(section)
  })

  it('§1b the fragile-edge factor gets an act-on-it row, by identity', () => {
    renderCockpit()
    const section = screen.getByTestId('hero-act-on-it')
    expect(within(section).getByText(`Verify ${RISK_LABEL}`)).toBeInTheDocument()
  })

  it('§1c the bias finding gets an act-on-it row, by identity', () => {
    renderCockpit()
    const section = screen.getByTestId('hero-act-on-it')
    expect(within(section).getByText(`Challenge ${BIAS_TYPE}`)).toBeInTheDocument()
  })

  // ── §2 De-duplication: the triage queue OWNS evidence gaps ───────────────

  it('§2a the evidence gap renders ONCE, in the triage queue, inside the cockpit', () => {
    renderCockpit()
    const host = screen.getByTestId('hero-arm-triage-actions')
    expect(cockpit()).toContainElement(host)
    expect(within(host).getByText(GAP_LABEL)).toBeInTheDocument()
    // The act-on-it rows must NOT re-render the same gap — one factor, one row.
    const section = screen.getByTestId('hero-act-on-it')
    expect(within(section).queryByText(`Verify ${GAP_LABEL}`)).not.toBeInTheDocument()
  })

  it('§2b P4 "Confirm AI estimate" survives the consolidation, exactly once', () => {
    const { onConfirmFactor } = renderCockpit()
    const buttons = screen.getAllByRole('button', { name: 'Confirm AI estimate' })
    expect(buttons).toHaveLength(1)
    expect(cockpit()).toContainElement(buttons[0])
    buttons[0].click()
    expect(onConfirmFactor).toHaveBeenCalledWith(GAP_NODE_ID)
  })

  // ── §3 States of ONE system, not a fork ──────────────────────────────────

  it('§3a the cockpit mounts unconditionally — no fork left, no superseded panel beside it', () => {
    // Was a §3a/§3b pair driving the two `feature.analysisHeroPanel`
    // localStorage postures. The flag is deleted, so the pair collapses to one
    // case carrying the union of both bodies' assertions.
    renderCockpit()
    expect(cockpit()).toBeInTheDocument()
    expect(screen.getByTestId('hero-act-on-it')).toBeInTheDocument()
    expect(screen.queryByTestId('decision-confidence-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('analysis-hero-v17')).not.toBeInTheDocument()
  })

  it('§3c the RUN-IN-FLIGHT state suppresses the mutation affordances', () => {
    renderCockpit({ isRunning: true })
    expect(
      screen.queryByRole('button', { name: 'Confirm AI estimate' }),
    ).not.toBeInTheDocument()
  })

  it('§3d the STALE state never suppresses them (Paul ruling 3, the retired lock)', () => {
    const { onConfirmFactor } = renderCockpit({ isStale: true })
    const btn = screen.getByRole('button', { name: 'Confirm AI estimate' })
    btn.click()
    expect(onConfirmFactor).toHaveBeenCalledWith(GAP_NODE_ID)
  })

  // ── §4 The dark fork is DELETED, not merely unmounted ────────────────────

  it.each([
    ['DecisionConfidencePanel', 'components/results/DecisionConfidencePanel.tsx'],
    ['AnalysisHeroV17', 'components/results/AnalysisHeroV17.tsx'],
    ['buildAnalysisHeroViewModel', 'components/results/analysisHeroV17/buildAnalysisHeroViewModel.ts'],
    ['analysisHeroV17 module', 'components/results/analysisHeroV17'],
  ])('§4a %s no longer exists on disk', (_name, rel) => {
    expect(existsSync(resolve(SRC, rel)), `${rel} should be deleted`).toBe(false)
  })

  /**
   * ⚠ Comments are STRIPPED first, deliberately. The retired flags are named
   * in ResultsBody's prose — that is the record of why the fork closed and it
   * must stay (CLAUDE.md 14b: an explanation of what a surface once did is
   * evidence, not clutter). What must not survive is a READER. A substring
   * scan over raw source cannot tell the two apart and would push the next
   * author to delete the explanation instead of the code.
   */
  it('§4b ResultsBody contains no live reader of a dead analysis-fork flag', () => {
    const path = resolve(SRC, 'components/results/ResultsBody.tsx')
    const code = stripComments(readFileSync(path, 'utf8'), path)
    for (const dead of [
      'isAnalysisHeroV17Enabled',
      'isAnalysisHeroCompareEnabled',
      'isAnalysisHeroPanelEnabled',
    ]) {
      expect(code.includes(dead), `ResultsBody still reads ${dead}`).toBe(false)
    }
    // Positive control: the scan CAN see a live reader in this file — without
    // it, a stripComments that blanked everything would pass vacuously.
    expect(code.includes('isStrengthenPanelEnabled')).toBe(true)
  })
})
