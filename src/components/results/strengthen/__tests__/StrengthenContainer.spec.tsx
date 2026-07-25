/**
 * StrengthenContainer wiring pins — the parity rebuild's container contracts:
 * - producer worth_investigating threads from driver rows into the engine
 *   (honest producer source line, not the UI-threshold fallback);
 * - broaden is gated on the PRODUCER bias signal (CEE draft-coaching
 *   bias_signals), never local option counting;
 * - "Work through this with Olumi" PREFILLS the Ask-Olumi drawer (no
 *   auto-send, no status mutation);
 * - setting a success target credits the success-measure rec directly
 *   (no stale "Define what success looks like" after a pre-analysis set);
 * - the producer stage signal floats matching recs to the top (UI-SEM-076).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { StrengthenContainer, adaptivePriorityFromStage } from '../StrengthenContainer'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { selectActive, useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useAskOlumiStore } from '../../coaching/askOlumiStore'
import { useSuccessMeasureStore, useDecisionRecordStore } from '../../modals'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const makeData = (over: {
  goalThreshold?: number | null
  analysisStatus?: string
  drivers?: Array<Record<string, unknown>>
} = {}): ResultsSectionDataReturn =>
  ({
    recommendation: {
      goalThreshold: over.goalThreshold ?? null,
      analysisStatus: over.analysisStatus ?? 'computed',
    },
    confidence: {
      challengeFragileEdges: [],
      robustnessStatus: null,
      robustnessLevel: null,
    },
    drivers: { drivers: over.drivers ?? [] },
  }) as unknown as ResultsSectionDataReturn

beforeEach(() => {
  useStrengthenStore.getState()._reset()
  try { sessionStorage.clear() } catch { /* jsdom */ }
  useGuidanceStore.setState({ guidanceItems: [], _dispatchAction: null, _sendMessage: null } as never)
  useAskOlumiStore.setState({ isOpen: false, context: '', draft: '', label: '', targetId: null })
  useCanvasStore.setState({
    currentStage: null,
    draftCoaching: null,
    results: { ...useCanvasStore.getState().results, hash: 'h-test' },
  } as never)
})

describe('StrengthenContainer — worth_investigating threading', () => {
  it('a producer-flagged driver row produces the VOI rec with the PRODUCER source line', () => {
    render(
      <StrengthenContainer
        data={makeData({
          goalThreshold: 62,
          drivers: [
            {
              factorKey: 'fac_churn',
              factorLabel: 'Churn',
              worthInvestigating: true,
              canFocus: true,
            },
          ],
        })}
      />,
    )
    const voi = selectActive(useStrengthenStore.getState()).find((r) =>
      r.id.startsWith('strengthen:voi:'),
    )
    expect(voi).toBeDefined()
    expect(voi!.snapshot.sourceLine.toLowerCase()).toContain('flagged by the engine')
    expect(voi!.snapshot.sourceLine.toLowerCase()).not.toContain('ui threshold')
  })

  it('without the producer flag nothing is recommended — the UI threshold is gone, not relabelled', () => {
    // ⛔ This spec used to assert that an unflagged factor still produced a
    // recommendation, "honestly labelled" as resting on a UI threshold. The
    // label was honest; the THRESHOLD was not. It admitted factors on
    // `evpi_percentage_points > 5` — a figure ISL measures at 0.0 for the very
    // factors PLoT scores at 12.3 / 10.2 / 6.6 in the same response. Disclosing
    // the basis of a refuted number does not make it evidence. Selection is now
    // the producer's explicit flag and nothing else.
    render(
      <StrengthenContainer
        data={makeData({
          goalThreshold: 62,
          drivers: [
            { factorKey: 'fac_churn', factorLabel: 'Churn', canFocus: true },
          ],
        })}
      />,
    )
    const voi = selectActive(useStrengthenStore.getState()).find((r) =>
      r.id.startsWith('strengthen:voi:'),
    )
    expect(voi).toBeUndefined()
  })
})

// ⚠ RELOCATED, NOT DELETED (F5a/F5b).
//
// This describe block asserted the Lane-2 / Codex-R3-B1 rule that the LEHI
// trigger keys on `displayInfluence`, not raw `influenceScore`. It used LEHI
// as its PROBE — and LEHI is confidence-gated. Once the factor-confidence
// display policy was applied (the F5b fix: the engine can no longer read a
// bare `confidence` number, and `DISPLAY_SAFE_DRIVER_CONFIDENCE` is `false`),
// LEHI cannot fire from this container at all, so BOTH divergence cases would
// have gone green by returning `undefined` for the same reason — a pair of
// assertions that no longer discriminate anything. Leaving them here would
// have been exactly the guarantee-theatre this lane exists to remove: two
// green tests protecting nothing.
//
// The rule itself is unchanged and still worth pinning, so the assertions
// moved DOWN to the engine, where the policy's documented `displaySafe` test
// seam can open the confidence gate and let the influence floor be the only
// variable:
//   src/components/results/strengthen/__tests__/buildRecommendations.spec.ts
//   → "LEHI floor keys on the DISPLAY influence, not the raw producer score"
//
// The container's own mapping (`influence: d.displayInfluence ?? d.influenceScore`,
// StrengthenContainer.tsx) is unchanged by this lane.

describe('StrengthenContainer — producer bias signal gates broaden', () => {
  it('a CEE narrow_framing bias signal admits the broaden rec', () => {
    useCanvasStore.setState({
      draftCoaching: {
        summary: null,
        strengthenItems: [],
        wideningLog: [],
        biasSignals: [{ type: 'narrow_framing', detail: 'Three of four options hire.' }],
      },
    } as never)
    render(<StrengthenContainer data={makeData({ goalThreshold: 62 })} />)
    expect(selectActive(useStrengthenStore.getState()).map((r) => r.id)).toContain(
      'strengthen:broaden',
    )
  })

  it('no producer bias signal → broaden never fires (fail-closed, §19)', () => {
    render(<StrengthenContainer data={makeData({ goalThreshold: 62 })} />)
    expect(selectActive(useStrengthenStore.getState()).map((r) => r.id)).not.toContain(
      'strengthen:broaden',
    )
  })
})

describe('StrengthenContainer — work-through prefills the Ask-Olumi drawer', () => {
  it('opens the drawer with the why-context and an editable prefilled draft, WITHOUT auto-sending or mutating status', () => {
    const dispatch = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: dispatch } as never)
    render(<StrengthenContainer data={makeData({ goalThreshold: null })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Work through this with Olumi' }))

    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    expect(drawer.draft).toBe('Help me work through: Define what success looks like')
    expect(drawer.context.length).toBeGreaterThan(0) // the why-line
    expect(drawer.source).toBe('chip')
    // No auto-send, no status mutation — the drawer owns dispatch.
    expect(dispatch).not.toHaveBeenCalled()
    expect(useStrengthenStore.getState().records['strengthen:success-measure'].status).toBe(
      'recommended',
    )
  })

  it('the primary action opens the Define-success MODAL and marks in progress (Round-2 wiring; Olumi stays on the sparkle)', () => {
    const dispatch = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: dispatch } as never)
    render(<StrengthenContainer data={makeData({ goalThreshold: null })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Define success' }))
    // The primary DOES the thing: structured modal, not a dialogue dispatch.
    expect(useSuccessMeasureStore.getState().isOpen).toBe(true)
    expect(dispatch).not.toHaveBeenCalled()
    expect(useStrengthenStore.getState().records['strengthen:success-measure'].status).toBe(
      'in_progress',
    )
  })
})

describe('StrengthenContainer — phase-3 work-through carries the producer finding (round 2)', () => {
  it('the Ask-Olumi drawer context is the producer body VERBATIM, never the generic fallback', () => {
    const body = 'Team Maturity continues to support higher output as expected.'
    useGuidanceStore.setState({
      guidanceItems: [
        {
          item_id: 'blk_lb1',
          signal_code: 'LOAD_BEARING_ASSUMPTION',
          category: 'should_fix',
          source: 'analysis',
          title: 'A load-bearing assumption',
          detail: body,
          primary_action: { type: 'discuss', prompt: 'Walk me through this assumption.' },
          priority: 29,
        },
      ],
    } as never)
    render(<StrengthenContainer data={makeData({ goalThreshold: 62 })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Work through this with Olumi' }))

    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)
    // The drawer must receive the producer's specific finding text again —
    // the whole point of the ask is the finding, not a boilerplate line.
    expect(drawer.context).toBe(body)
    expect(drawer.context).not.toBe('Resolving it improves what the analysis can tell you.')
  })
})

describe('StrengthenContainer — decision-record wiring (Round 2)', () => {
  it('a captured decision record credits the commit rec directly', () => {
    useCanvasStore.setState({ currentScenarioId: 'scn-1' } as never)
    render(<StrengthenContainer data={makeData({ goalThreshold: 5 })} />)
    // Seed a commit rec as recommended
    useStrengthenStore.getState().reconcile(
      [
        {
          id: 'strengthen:commit',
          helpType: 'commit',
          title: 'Record the decision and what would trigger a rethink',
          signal: 's',
          whyNow: 'w',
          tryThis: 't',
          sourceLine: 'src',
          action: { kind: 'open-modal', modal: 'decision-record', label: 'Create a decision record' },
          targetId: null,
          priority: 10,
        },
      ] as never,
      'h-test',
    )
    expect(useStrengthenStore.getState().records['strengthen:commit'].status).toBe('recommended')
    act(() => {
      useDecisionRecordStore.getState().saveRecord('scn-1', {
        optionId: 'opt_a',
        optionLabel: 'Option A',
        confidence: 70,
        rationale: 'r',
        assumption: 'a',
        revisitTrigger: 'rt',
        analysedGraphHash: null,
      } as never)
    })
    expect(useStrengthenStore.getState().records['strengthen:commit'].status).toBe('addressed')
  })
})

describe('StrengthenContainer — success target credits the rec directly', () => {
  it('goalThreshold null → number marks the success rec addressed even when no analysis completes', () => {
    const { rerender } = render(
      <StrengthenContainer data={makeData({ goalThreshold: null, analysisStatus: 'unavailable' })} />,
    )
    expect(selectActive(useStrengthenStore.getState()).map((r) => r.id)).toContain(
      'strengthen:success-measure',
    )
    rerender(
      <StrengthenContainer data={makeData({ goalThreshold: 62, analysisStatus: 'unavailable' })} />,
    )
    const record = useStrengthenStore.getState().records['strengthen:success-measure']
    expect(record.status).toBe('addressed') // credited, not silently dropped
    expect(selectActive(useStrengthenStore.getState()).map((r) => r.id)).not.toContain(
      'strengthen:success-measure',
    )
  })

  it('a session that STARTS with a threshold set never fakes an addressed credit', () => {
    render(<StrengthenContainer data={makeData({ goalThreshold: 62 })} />)
    expect(useStrengthenStore.getState().records['strengthen:success-measure']).toBeUndefined()
  })
})

describe('StrengthenContainer — adaptive priority from the producer stage (UI-SEM-076)', () => {
  it('maps stages onto strengthen help types, null-safe', () => {
    expect(adaptivePriorityFromStage('frame')).toBe('clarify')
    expect(adaptivePriorityFromStage('ideate')).toBe('broaden')
    expect(adaptivePriorityFromStage('evaluate')).toBe('evaluate')
    expect(adaptivePriorityFromStage('decide')).toBe('commit')
    expect(adaptivePriorityFromStage('optimise')).toBeNull()
    expect(adaptivePriorityFromStage(null)).toBeNull()
  })

  it('an evaluate stage floats evaluate recs above the clarify foundation', () => {
    useCanvasStore.setState({ currentStage: 'evaluate' } as never)
    render(
      <StrengthenContainer
        data={makeData({
          goalThreshold: null,
          drivers: [
            { factorKey: 'fac_churn', factorLabel: 'Churn', worthInvestigating: true, canFocus: true },
          ],
        })}
      />,
    )
    const active = selectActive(useStrengthenStore.getState())
    expect(active[0].id).toBe('strengthen:voi:fac_churn')
  })
})

describe('StrengthenContainer — producer priority_rank rides through VERBATIM (UI-SEM-085 narrowed)', () => {
  it('coaching-band ranks (>= 100) order the phase-3 rows ascending — never re-inverted, never collapsed', () => {
    // The container is the historic inversion site (`100 - priority`). Seed
    // the store the way the fixed extractor writes it — rank verbatim,
    // coarse urgency equal across items (band-granular ties are normal) —
    // and require the PANEL order to be the producer's ascending rank, not
    // the arrival order a collapse would leave behind.
    const mk = (item_id: string, priorityRank: number) => ({
      item_id,
      signal_code: 'coaching',
      category: 'should_fix' as const,
      source: 'analysis' as const,
      title: `Finding ${item_id}`,
      primary_action: { type: 'discuss' as const, prompt: 'p' },
      priority: 70,
      priorityRank,
    })
    useGuidanceStore.setState({
      guidanceItems: [mk('c-201', 201), mk('c-101', 101), mk('c-150', 150)],
    } as never)
    render(<StrengthenContainer data={makeData({ goalThreshold: 62 })} />)
    const phase3 = selectActive(useStrengthenStore.getState())
      .map((r) => r.id)
      .filter((id) => id.startsWith('strengthen:phase3:'))
    expect(phase3).toEqual([
      'strengthen:phase3:c-101',
      'strengthen:phase3:c-150',
      'strengthen:phase3:c-201',
    ])
  })
})

describe('StrengthenContainer — guidance surface is absent before any analysis (standing rule)', () => {
  it('with no completed analysis and no producer guidance, no phase-3 rows or severity badges surface', () => {
    // Guidance blocks arrive with/after a run; pre-run the guidance store is
    // empty (cleared in beforeEach), so no producer coaching promotes and the
    // Stage 2 severity badge never appears. The MOUNT itself is separately
    // gated `!isPreRun && resultsSectionData` in OutputsDock.
    render(<StrengthenContainer data={makeData({ goalThreshold: 62, analysisStatus: 'unavailable' })} />)
    const ids = selectActive(useStrengthenStore.getState()).map((r) => r.id)
    expect(ids.some((id) => id.startsWith('strengthen:phase3:'))).toBe(false)
    expect(screen.queryByTestId('strengthen-rec-severity')).toBeNull()
  })
})
