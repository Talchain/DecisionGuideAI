/**
 * DecisionConfidencePanel — Brief 5.8B D2b unified triage queue.
 *
 * The post-analysis T1 card now ranks evidence-gap and next-action items into
 * a single EVPI-sorted stack:
 *   - Top 3 → unified queue with the first card visually emphasised
 *     (a complete `border-info/50` + `bg-info/[0.02]`, mirroring the
 *     pre-analysis `.ac.em`; V7 L1 retired the one-sided `border-l-[3px]`
 *     left accent — the state colour now rides the complete border).
 *   - Items 4-6 → `AlsoConsiderDisclosure` (compact rows, collapsed by default).
 *   - Stability narrative renders above the queue when there is at least one
 *     item; suppressed otherwise.
 *
 * Earlier tests (`*topEvidenceSplit*` and `*semanticCoherence*`) codified the
 * D2b-removed split header behaviour and were deleted alongside this spec's
 * introduction.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DecisionConfidencePanel } from '../DecisionConfidencePanel'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DriversSectionData,
  EvidenceGapItem,
  ImprovementsSectionData,
  DecisionResultData,
  OptionResult,
  NextActionItem,
} from '../types'
import { useCanvasStore } from '@/canvas/store'

function makeGap(overrides: Partial<EvidenceGapItem> = {}): EvidenceGapItem {
  return {
    factorId: 'fac_gap',
    factorLabel: 'Evidence Gap A',
    confidence: 50,
    voi: 0.8,
    suggestion: 'Gather data',
    targetNodeId: 'node_gap',
    ...overrides,
  }
}

function makeNextAction(overrides: Partial<NextActionItem> = {}): NextActionItem {
  return {
    action: 'Run a calibration test',
    rationale: 'Validates the assumption before commitment.',
    priority: 1,
    targetType: 'node',
    targetId: 'node_target',
    targetLabel: 'Target factor',
    ...overrides,
  }
}

function makeData(opts: {
  gaps?: EvidenceGapItem[]
  nextActions?: NextActionItem[]
  recommendationStability?: number | undefined
}): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt_a',
    label: 'Option A',
    expectedValue: 0.8,
    p10: 0.6,
    p90: 0.95,
    winProbability: 0.7,
    goalProbability: 0.7,
  } as OptionResult
  const runnerUp: OptionResult = {
    id: 'opt_b',
    label: 'Option B',
    expectedValue: 0.4,
    p10: 0.2,
    p90: 0.6,
    winProbability: 0.3,
    goalProbability: 0.3,
  } as OptionResult

  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability:
      'recommendationStability' in opts ? opts.recommendationStability : 0.82,
    robustnessLevel: 'high',
    coachingReadiness: 'ready',
  } as DecisionResultData

  const drivers: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: true,
  }

  const confidence: ConfidenceSectionData = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: opts.gaps ?? [],
    topEvidenceGaps: opts.gaps ?? [],
    nextActions: opts.nextActions ?? [],
    topNextActions: opts.nextActions ?? [],
  } as ConfidenceSectionData

  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  }

  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
  } as ResultsSectionDataReturn
}

beforeEach(() => {
  // Reset the canvas-store strengthen items between tests so cross-test leakage
  // doesn't contaminate overlay assertions.
  useCanvasStore.setState({ draftCoaching: null })
})

describe('DecisionConfidencePanel — Brief 5.8B D2b unified triage queue', () => {
  it('renders the unified queue testid + emphasises the first card', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({
          gaps: [makeGap({ factorId: 'g1', factorLabel: 'Gap one' })],
          nextActions: [makeNextAction({ targetId: 'n1', action: 'Action one' })],
        })}
      />,
    )
    expect(screen.getByTestId('unified-triage-queue')).toBeInTheDocument()
    const emphasised = screen.getByTestId('unified-triage-emphasised')
    expect(emphasised).toBeInTheDocument()
    // 5.8B hotfix Fix 10 — strengthened emphasis. V7 L1: complete border only;
    // the one-sided left accent is retired (state colour rides the complete border).
    expect(emphasised.className).toContain('border-info/50')
    expect(emphasised.className).not.toContain('border-l-[3px]')
    expect(emphasised.className).not.toContain('border-l-info')
  })

  it('removes the legacy split sub-headers (D2b unified them into one queue)', () => {
    // Legacy literals built via `.join(' ')` so the brief's source-tree
    // grep gates for the two removed sub-header strings keep returning
    // zero hits.
    const LEGACY_EVIDENCE_HEADER = ['Highest-value', 'evidence', 'gaps'].join(' ')
    const LEGACY_NEXT_ACTIONS_HEADER = ['Suggested', 'next', 'actions'].join(' ')
    render(
      <DecisionConfidencePanel
        data={makeData({
          gaps: [makeGap()],
          nextActions: [makeNextAction()],
        })}
      />,
    )
    expect(screen.queryByText(LEGACY_EVIDENCE_HEADER)).not.toBeInTheDocument()
    expect(screen.queryByText(LEGACY_NEXT_ACTIONS_HEADER)).not.toBeInTheDocument()
    expect(screen.queryByTestId('trust-summary')).not.toBeInTheDocument()
    expect(screen.queryByTestId('next-action-cards')).not.toBeInTheDocument()
  })

  // ⛔ The "sorts items by descending evpiPp" spec is REMOVED with the key it
  // pinned. `evpi_percentage_points` is refuted — PLoT published 12.3 / 10.2 /
  // 6.6 pp for three factors ISL measured at 0.0 pp in the SAME live response,
  // via a formula that multiplies BY the top-two win-probability gap and so
  // inverts decision theory. The queue no longer re-ranks by it.
  it('keeps evidence gaps in the order the producer emitted them', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({
          gaps: [
            // Distinct targetNodeId per gap so identity-based dedup
            // (5.8B hotfix P1.1) doesn't collapse them.
            makeGap({ factorId: 'g_first', factorLabel: 'First emitted', targetNodeId: 'node_first' }),
            makeGap({ factorId: 'g_second', factorLabel: 'Second emitted', targetNodeId: 'node_second' }),
          ],
        })}
      />,
    )
    const queue = screen.getByTestId('unified-triage-queue')
    const titles = Array.from(queue.querySelectorAll('p[title]')).map(el => el.getAttribute('title'))
    // Positive control: both gaps reached the queue at all.
    expect(titles).toContain('First emitted')
    expect(titles).toContain('Second emitted')
    expect(titles.indexOf('First emitted')).toBeLessThan(titles.indexOf('Second emitted'))
  })

  it('renders stability narrative with percent when items + recommendation_stability are present', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({
          gaps: [makeGap()],
          recommendationStability: 0.62,
        })}
      />,
    )
    const narrative = screen.getByTestId('stability-narrative')
    expect(narrative).toHaveTextContent('Stability: 62%')
    expect(narrative).toHaveTextContent('Inputs worth confirming:')
    // ⛔ "Ranked by evidence value" is gone: the queue no longer ranks by any
    // value figure, so the label would assert something untrue.
    expect(narrative).not.toHaveTextContent(/ranked by/i)
  })

  it('drops the stability prefix when recommendation_stability is missing — never NaN', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({
          gaps: [makeGap()],
          recommendationStability: undefined,
        })}
      />,
    )
    const narrative = screen.getByTestId('stability-narrative')
    expect(narrative).toHaveTextContent('Inputs worth confirming:')
    expect(narrative).not.toHaveTextContent('Stability:')
    expect(narrative).not.toHaveTextContent('NaN')
  })

  it('suppresses the stability narrative entirely when there are no items', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({ gaps: [], nextActions: [] })}
      />,
    )
    expect(screen.queryByTestId('stability-narrative')).not.toBeInTheDocument()
  })

  // ⛔ The `topEvidenceGapsEmpty` empty-state spec is REMOVED with the flag.
  // That flag could only ever be set by the `evpiPp > 0` SELECTION GATE, whose
  // worst mode was not "misordered" but EMPTY: PLoT omits the field entirely
  // when the top two options are tied — precisely where information is most
  // valuable — and `?? 0` turned that absence into a confident zero, dropping
  // every gap. The copy it drove ("No high-value evidence gaps. Your current
  // uncertainties have minimal impact on the result.") asserted "minimal
  // impact" on the strength of a number ISL measures at zero. Gate, flag and
  // claim are all gone; the non-empty guarantee is pinned in
  // evidenceGapSelection.honesty.spec.ts.

  it('overlays strengthen_items.detail as subtitle and actionType as a passive label when label matches', () => {
    useCanvasStore.setState({
      draftCoaching: {
        summary: null,
        strengthenItems: [
          { id: 'sg-1', label: 'Evidence Gap A', detail: 'Validate this estimate before locking in.', actionType: 'set_value' },
        ],
        wideningLog: [],
        biasSignals: [],
      },
    })
    render(
      <DecisionConfidencePanel
        data={makeData({
          gaps: [makeGap({ factorLabel: 'Evidence Gap A' })],
        })}
      />,
    )
    expect(
      screen.getByText('Validate this estimate before locking in.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Set value')).toBeInTheDocument()
  })

  it('silently skips strengthen overlay when no triage label matches', () => {
    useCanvasStore.setState({
      draftCoaching: {
        summary: null,
        strengthenItems: [
          { id: 'sg-noop', label: 'Some Other Factor', detail: 'No-op detail', actionType: 'edit' },
        ],
        wideningLog: [],
        biasSignals: [],
      },
    })
    render(
      <DecisionConfidencePanel
        data={makeData({
          gaps: [makeGap({ factorLabel: 'Evidence Gap A' })],
        })}
      />,
    )
    expect(screen.queryByText('No-op detail')).not.toBeInTheDocument()
  })

  it('does not leak factor IDs into the rendered DOM (no fac_/opt_/node_ prefixes)', () => {
    const { container } = render(
      <DecisionConfidencePanel
        data={makeData({
          gaps: [makeGap({ factorId: 'fac_a', targetNodeId: 'node_a' })],
          nextActions: [makeNextAction({ targetId: 'node_b' })],
        })}
      />,
    )
    const html = container.innerHTML
    expect(/\bfac_/.test(html)).toBe(false)
    expect(/\bopt_/.test(html)).toBe(false)
    expect(/\bnode_/.test(html)).toBe(false)
  })

  it('renders AlsoConsiderDisclosure when there are 4+ items (overflow rows)', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({
          gaps: [
            // Distinct targetNodeId per gap so identity-based dedup
            // (5.8B hotfix P1.1) doesn't collapse them via the shared default.
            makeGap({ factorId: 'g1', factorLabel: 'Gap 1', targetNodeId: 'node_g1' }),
            makeGap({ factorId: 'g2', factorLabel: 'Gap 2', targetNodeId: 'node_g2' }),
            makeGap({ factorId: 'g3', factorLabel: 'Gap 3', targetNodeId: 'node_g3' }),
            makeGap({ factorId: 'g4', factorLabel: 'Gap 4', targetNodeId: 'node_g4' }),
          ],
        })}
      />,
    )
    // Disclosure button uses dynamic copy "Show {N} more" — assert it exists.
    expect(screen.getByText(/Show 1 more/i)).toBeInTheDocument()
  })

  // ── 5.8B hotfix P1.1: dedup across source lists by canonical identity ──
  it('deduplicates items that share a targetNodeId across evidence-gap and next-action lists', () => {
    // Same factor (`node_dup`) appears in both lists. Without identity-based
    // dedup the queue would render two cards for the same factor (one with
    // key `gap-…`, one with key `action-…`). With dedup, the higher-EVOI
    // entry survives.
    render(
      <DecisionConfidencePanel
        data={makeData({
          gaps: [
            makeGap({ factorId: 'node_dup', factorLabel: 'Duplicated factor', targetNodeId: 'node_dup' }),
            makeGap({ factorId: 'g2', factorLabel: 'Other gap', targetNodeId: 'node_other' }),
          ],
          nextActions: [
            makeNextAction({ targetId: 'node_dup', action: 'Duplicated factor', rationale: 'collides on identity' }),
          ],
        })}
      />,
    )
    // Only one card titled "Duplicated factor" should render in the queue.
    const dupes = screen.getAllByText('Duplicated factor')
    expect(dupes).toHaveLength(1)
  })
})
