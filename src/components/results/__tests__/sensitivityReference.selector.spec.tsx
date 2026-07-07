/**
 * Lane UI-W5 (feature A): sensitivity reference selector resolution.
 *
 * useResultsSectionData resolves `sensitivity_reference_option_id` with the
 * same precedence as flip_thresholds / headline_banded:
 *   mapped report (survives save + hydrate) → raw V2 response (fresh run)
 * and resolves id → label from the canvas options list (nodeLabelMap).
 *
 * Fail-closed pins:
 *  - neither source discloses → sensitivityReference is null;
 *  - id present but no matching canvas node → optionId kept, optionLabel
 *    null (caption suppressed downstream — internal ids never become copy).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCanvasStore } from '../../../canvas/store'
import { useResultsSectionData } from '../useResultsSectionData'

const NODES = [
  { id: 'goal-1', type: 'goal', data: { label: 'Revenue', kind: 'goal' }, position: { x: 0, y: 0 } },
  { id: 'opt_contractor', type: 'option', data: { label: 'Hire a contractor', kind: 'option' }, position: { x: 1, y: 0 } },
  { id: 'opt_diy', type: 'option', data: { label: 'Do it yourself', kind: 'option' }, position: { x: 2, y: 0 } },
]

const BASE_REPORT = {
  schema: 'report.v1',
  results: { conservative: 10, likely: 20, optimistic: 30 },
  option_probabilities: {},
}

function setStore(overrides: Record<string, unknown>): void {
  useCanvasStore.setState({
    nodes: NODES,
    edges: [],
    hasCompletedFirstRun: true,
    currentScenarioFraming: null,
    runMeta: {},
    ceeAnalysisReady: undefined,
    results: { status: 'complete', progress: 100, report: BASE_REPORT },
    rawV2Response: null,
    ...overrides,
  } as never)
}

describe('useResultsSectionData.sensitivityReference', () => {
  beforeEach(() => {
    setStore({})
  })

  it('is null when neither the mapped report nor the raw response discloses a reference option', () => {
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.sensitivityReference).toBeNull()
  })

  it('resolves from the mapped report and maps id → canvas option label', () => {
    setStore({
      results: {
        status: 'complete',
        progress: 100,
        report: { ...BASE_REPORT, sensitivity_reference_option_id: 'opt_contractor' },
      },
    })
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.sensitivityReference).toEqual({
      optionId: 'opt_contractor',
      optionLabel: 'Hire a contractor',
    })
  })

  it('falls back to the raw V2 response on fresh runs (report not yet carrying the field)', () => {
    setStore({
      rawV2Response: { sensitivity_reference_option_id: 'opt_diy' },
    })
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.sensitivityReference).toEqual({
      optionId: 'opt_diy',
      optionLabel: 'Do it yourself',
    })
  })

  it('prefers the mapped report over the raw response when both are present', () => {
    setStore({
      results: {
        status: 'complete',
        progress: 100,
        report: { ...BASE_REPORT, sensitivity_reference_option_id: 'opt_contractor' },
      },
      rawV2Response: { sensitivity_reference_option_id: 'opt_diy' },
    })
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.sensitivityReference?.optionId).toBe('opt_contractor')
  })

  it('fail-closed label: unresolvable id keeps optionId but yields optionLabel null', () => {
    setStore({
      rawV2Response: { sensitivity_reference_option_id: 'opt_deleted' },
    })
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.sensitivityReference).toEqual({
      optionId: 'opt_deleted',
      optionLabel: null,
    })
  })

  it('treats an empty-string disclosure as absent', () => {
    setStore({
      rawV2Response: { sensitivity_reference_option_id: '' },
    })
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.sensitivityReference).toBeNull()
  })
})
