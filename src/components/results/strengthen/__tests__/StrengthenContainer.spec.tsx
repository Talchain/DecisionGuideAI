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
import { fireEvent, render, screen } from '@testing-library/react'
import { StrengthenContainer, adaptivePriorityFromStage } from '../StrengthenContainer'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { selectActive, useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { useAskOlumiStore } from '../../coaching/askOlumiStore'
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
              evpiPercentagePoints: 8,
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

  it('without the producer flag the UI-threshold fallback stays honestly labelled', () => {
    render(
      <StrengthenContainer
        data={makeData({
          goalThreshold: 62,
          drivers: [
            { factorKey: 'fac_churn', factorLabel: 'Churn', evpiPercentagePoints: 8, canFocus: true },
          ],
        })}
      />,
    )
    const voi = selectActive(useStrengthenStore.getState()).find((r) =>
      r.id.startsWith('strengthen:voi:'),
    )
    expect(voi).toBeDefined()
    expect(voi!.snapshot.sourceLine.toLowerCase()).toContain('ui threshold')
  })
})

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

  it('the primary action still dispatches and marks in progress (two distinct routes)', () => {
    const dispatch = vi.fn()
    useGuidanceStore.setState({ _dispatchAction: dispatch } as never)
    render(<StrengthenContainer data={makeData({ goalThreshold: null })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Define success' }))
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ action_type: 'discuss', source: 'strengthen_panel' }),
    )
    expect(useStrengthenStore.getState().records['strengthen:success-measure'].status).toBe(
      'in_progress',
    )
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
