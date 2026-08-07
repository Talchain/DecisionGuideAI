/**
 * useNodeDisplayMetadata — the canvas confidence gate, on REAL captured bytes.
 *
 * FIND-1: `DriversSection` pinned `DISPLAY_SAFE_DRIVER_CONFIDENCE = false`
 * ("no display-safe driver-confidence source exists today, so we never render
 * raw/defaulted confidence") while this hook read the SAME
 * `factor_sensitivity[].confidence` off the SAME `results.report` with no gate,
 * feeding three canvas surfaces AND a spoken coaching line.
 *
 * ESCAPE THIS TEST IS WRITTEN TO CATCH: asserting `confidence === null` alone
 * would ALSO pass if the hook had bailed out entirely — wrong node id, report
 * shape unrecognised, `isResultsMode` false, feed empty. Every case below
 * therefore asserts, in the same call, that the hook DID resolve this factor:
 * `inSensitivityAnalysis` true and a finite `influence`. The confidence null is
 * then a null in a row the hook genuinely processed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNodeDisplayMetadata } from '../useNodeDisplayMetadata'
import bundle from '../../../components/debug/__tests__/fixtures/staging-bundles/olumi-debug-50b336a6-20260510.pre-fix.json'

const plotRows = (bundle as any).payloads.plot_response.factor_sensitivity as Record<string, unknown>[]
const FACTOR_ID = plotRows[0].factor_id as string

let mockState: { results: { status: string; report: unknown } }

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: typeof mockState) => unknown) => selector(mockState)),
}))

import { useCanvasStore } from '../../store'

function withReport(factorSensitivity: unknown[]) {
  mockState = {
    results: {
      status: 'complete',
      // Captured producer rows, verbatim — nothing edited.
      report: { factor_sensitivity: factorSensitivity },
    },
  }
  vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector(mockState))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the captured rows are what we think they are', () => {
  it('the PLoT capture carries a defaulted confidence of 0.25', () => {
    expect(plotRows.length).toBeGreaterThan(0)
    expect(FACTOR_ID).toBe('fac_marketing_expertise')
    expect(plotRows[0].confidence).toBe(0.25)
    expect((plotRows[0].confidence_components as any).sampling_stability).toBe(0)
  })
})

describe('useNodeDisplayMetadata — confidence obeys the shared display policy', () => {
  it('does not surface the defaulted 0.25 the results panel refuses to show', () => {
    withReport(plotRows)
    const { result } = renderHook(() => useNodeDisplayMetadata(FACTOR_ID, 'factor'))

    // ── the anti-vacuity guard: this factor WAS resolved ──────────────────
    expect(result.current.isResultsMode).toBe(true)
    expect(result.current.inSensitivityAnalysis).toBe(true)
    expect(typeof result.current.influence).toBe('number')
    expect(result.current.influence).toBeGreaterThan(0)

    // ── the actual claim ─────────────────────────────────────────────────
    expect(result.current.confidence).toBeNull()
  })

  it('also withholds a NON-defaulted confidence — the ruling is about the source', () => {
    // ISL's own computed 0.3756 from the same bundle. Under the ruled policy
    // this is still not display-safe, so the canvas must not print it either;
    // otherwise the canvas would keep showing a number the panel does not.
    const islRows = (bundle as any).payloads.isl_response.factor_sensitivity as Record<string, unknown>[]
    withReport(islRows)
    const nodeId = islRows[0].node_id as string
    const { result } = renderHook(() => useNodeDisplayMetadata(nodeId, 'factor'))

    expect(result.current.inSensitivityAnalysis).toBe(true)
    expect(islRows[0].confidence).toBe(0.3756)
    expect(result.current.confidence).toBeNull()
  })

  it('reports no disclosure flags while nothing is shown', () => {
    withReport(plotRows)
    const { result } = renderHook(() => useNodeDisplayMetadata(FACTOR_ID, 'factor'))
    expect(result.current.confidenceIsDefaulted).toBe(false)
    expect(result.current.confidenceIsProvisional).toBe(false)
  })

  it('leaves every other producer figure untouched (this lane gates ONE field)', () => {
    withReport(plotRows)
    const { result } = renderHook(() => useNodeDisplayMetadata(FACTOR_ID, 'factor'))
    // influence_rank 1 in the capture → top-ranked driver on the canvas.
    expect(result.current.sensitivityRank).toBe(1)
    expect(result.current.influence).toBe(1)
  })
})
