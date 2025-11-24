import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ShareDrawer } from '../ShareDrawer'
import { useCanvasStore } from '../../store'
import type { StoredRun } from '../../store/runHistory'
import * as runHistory from '../../store/runHistory'

function ensureMatchMedia() {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    })
  }
}

function buildRun({
  id,
  ts,
  hash,
  p10 = 100,
  p50 = 200,
  p90 = 300,
  units = 'percent',
}: {
  id: string
  ts: number
  hash: string
  p10?: number
  p50?: number
  p90?: number
  units?: 'currency' | 'percent' | 'count'
}): StoredRun {
  const unitSymbol = units === 'currency' ? '$' : undefined

  return {
    id,
    ts,
    seed: 1,
    hash,
    adapter: 'mock',
    summary: 'Mock summary',
    graphHash: `graph-${id}`,
    report: {
      schema: 'report.v1',
      meta: { seed: 1, response_id: `response-${id}`, elapsed_ms: 500 },
      model_card: { response_hash: hash, response_hash_algo: 'sha256', normalized: true },
      results: {
        conservative: p10,
        likely: p50,
        optimistic: p90,
        units,
        unitSymbol,
      },
      confidence: { level: 'medium', why: 'Mock run' },
      drivers: [],
      run: {
        responseHash: hash,
        bands: { p10, p50, p90 },
      },
    },
  }
}

describe('ShareDrawer decision summary', () => {
  beforeEach(() => {
    ensureMatchMedia()

    // Reset canvas store to a clean baseline for each test
    if (typeof useCanvasStore.getState().reset === 'function') {
      useCanvasStore.getState().reset()
    }

    // Explicitly clear scenario metadata so decision summary tests start neutral
    useCanvasStore.setState({
      currentScenarioFraming: null,
      currentScenarioLastResultHash: null,
      currentScenarioLastRunAt: null,
      currentScenarioLastRunSeed: null,
    } as any)

    try {
      localStorage.clear()
    } catch {}

    vi.restoreAllMocks()
  })

  it('renders a Copy decision summary button', () => {
    render(<ShareDrawer isOpen={true} onClose={() => {}} />)

    expect(screen.getByRole('button', { name: 'Copy decision summary' })).toBeInTheDocument()
  })

  it('copies a formatted decision summary to the clipboard when clicked', async () => {
    // Seed scenario framing and last-run metadata in the store
    useCanvasStore.setState({
      currentScenarioFraming: {
        title: 'Choose pricing strategy',
        goal: 'Maximise revenue while maintaining market share',
        timeline: 'Next 2 quarters',
      },
      currentScenarioLastResultHash: 'aaaa1111aaaa1111',
      currentScenarioLastRunAt: '2025-11-18T10:00:00.000Z',
      currentScenarioLastRunSeed: '42',
    } as any)

    // Mock run history to return a matching run
    const run = buildRun({
      id: 'run-1',
      ts: Date.parse('2025-11-18T10:00:00.000Z'),
      hash: 'aaaa1111aaaa1111',
      p10: 100,
      p50: 200,
      p90: 300,
      units: 'percent',
    })
    vi.spyOn(runHistory, 'loadRuns').mockReturnValue([run])

    // Mock clipboard API
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    })

    render(<ShareDrawer isOpen={true} onClose={() => {}} />)

    const button = screen.getByRole('button', { name: 'Copy decision summary' })
    fireEvent.click(button)

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })

    const summaryArg = writeText.mock.calls[0][0] as string

    expect(summaryArg).toContain('Decision: Choose pricing strategy')
    expect(summaryArg).toContain('Goal: Maximise revenue while maintaining market share')
    expect(summaryArg).toContain('Time horizon: Next 2 quarters')
    expect(summaryArg).toContain('Most likely outcome:')
    expect(summaryArg).toContain('run aaaa1111…')

    // Button label should flip to "Summary copied" briefly
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Summary copied' })).toBeInTheDocument()
    })
  })

  it('still copies a graceful summary when there is no framing or last run', async () => {
    // No framing, no last-run metadata, no run history
    vi.spyOn(runHistory, 'loadRuns').mockReturnValue([])

    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: {
        writeText,
      },
    })

    render(<ShareDrawer isOpen={true} onClose={() => {}} />)

    const button = screen.getByRole('button', { name: 'Copy decision summary' })
    fireEvent.click(button)

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })

    const summaryArg = writeText.mock.calls[0][0] as string
    expect(summaryArg).toContain('This decision has not yet been framed or analysed.')
  })
})
