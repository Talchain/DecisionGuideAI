import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../store'

// Bug 3-export regression: exportLocal previously read summary, p10, p50, p90
// directly off the report root, but ReportV1 doesn't have those fields there.
// summary lives at insights.summary; bands live at run.bands.{p10,p50,p90}
// (preferred) with results.{conservative,likely,optimistic} as a legacy
// fallback (matches extractP50 in runHistory.ts).

describe('exportLocal — Bug 3-export regression', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset()
  })

  it('emits summary + bands from canonical report.run.bands path', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        seed: 42,
        hash: 'h-test',
        report: {
          insights: { summary: 'Recommend option A.' },
          run: { bands: { p10: 0.1, p50: 0.5, p90: 0.9 } },
        } as any,
      },
    })

    const json = useCanvasStore.getState().exportLocal()
    const parsed = JSON.parse(json)

    expect(parsed.lastRun).not.toBeNull()
    expect(parsed.lastRun.summary).toBe('Recommend option A.')
    expect(parsed.lastRun.p10).toBe(0.1)
    expect(parsed.lastRun.p50).toBe(0.5)
    expect(parsed.lastRun.p90).toBe(0.9)
    expect(parsed.lastRun.seed).toBe(42)
    expect(parsed.lastRun.hash).toBe('h-test')
  })

  it('falls back to results.{conservative,likely,optimistic} when run.bands absent', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        seed: 7,
        hash: 'h-fallback',
        report: {
          insights: { summary: 'Fallback path.' },
          results: { conservative: 0.2, likely: 0.6, optimistic: 0.8 },
        } as any,
      },
    })

    const json = useCanvasStore.getState().exportLocal()
    const parsed = JSON.parse(json)

    expect(parsed.lastRun.summary).toBe('Fallback path.')
    expect(parsed.lastRun.p10).toBe(0.2)
    expect(parsed.lastRun.p50).toBe(0.6)
    expect(parsed.lastRun.p90).toBe(0.8)
  })

  it('emits null bands and undefined summary when neither report path is populated', () => {
    useCanvasStore.setState({
      results: {
        status: 'complete',
        progress: 100,
        seed: 0,
        hash: 'h-empty',
        report: {} as any,
      },
    })

    const json = useCanvasStore.getState().exportLocal()
    const parsed = JSON.parse(json)

    expect(parsed.lastRun.summary).toBeUndefined()
    expect(parsed.lastRun.p10).toBeNull()
    expect(parsed.lastRun.p50).toBeNull()
    expect(parsed.lastRun.p90).toBeNull()
  })
})
