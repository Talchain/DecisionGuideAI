/**
 * RunHistory Live Refresh Tests (Codex P1)
 *
 * Tests the automatic refresh behaviour when runs are added/modified/deleted:
 * - Same-tab updates (via runsBus)
 * - Cross-tab updates (via storage events)
 * - Visibility wake-up (when tab becomes visible)
 * - No render storms (debouncing works)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { __resetTelemetryCounters, __getTelemetryCounters } from '../../../lib/telemetry'
import { RunHistory } from '../RunHistory'
import * as runHistory from '../../store/runHistory'
import * as runsBus from '../../store/runsBus'
import { useCanvasStore } from '../../store'
import type { ReportV1 } from '../../../adapters/plot/types'

// Helper to create a mock run
function createMockRun(id: string, seed: number, hash: string, ts: number = Date.now()): runHistory.StoredRun {
  return {
    id,
    ts,
    seed,
    hash,
    adapter: 'mock' as const,
    summary: `Test run ${id}`,
    graphHash: `graph-hash-${id}`,
    report: {
      schema: 'report.v1',
      meta: { seed, response_id: id, elapsed_ms: 100 },
      model_card: {
        response_hash: hash,
        response_hash_algo: 'sha256' as const,
        normalized: true as const
      },
      results: { conservative: 0.5, likely: 0.6, optimistic: 0.7 },
      confidence: { level: 'medium' as const, why: 'Test' },
      drivers: []
    } as ReportV1,
    graph: { nodes: [], edges: [] }
  }
}

describe('RunHistory Live Refresh (Codex P1)', () => {
  let mockOnViewRun: ReturnType<typeof vi.fn>
  let mockOnCompare: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Clear localStorage and bus
    localStorage.clear()
    runsBus.clear()

    // Reset mocks
    mockOnViewRun = vi.fn()
    mockOnCompare = vi.fn()

    // Suppress window.confirm
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    // Reset scenario framing
    useCanvasStore.setState({ currentScenarioFraming: null } as any)
  })

  afterEach(() => {
    localStorage.clear()
    runsBus.clear()
    vi.restoreAllMocks()
  })

  it('loads initial runs on mount', async () => {
    // Seed storage with 3 runs
    const runs = [
      createMockRun('run-1', 1337, 'hash-1', Date.now()),
      createMockRun('run-2', 1338, 'hash-2', Date.now() - 1000),
      createMockRun('run-3', 1339, 'hash-3', Date.now() - 2000)
    ]
    runHistory.saveRuns(runs)

    render(<RunHistory onViewRun={mockOnViewRun} onCompare={mockOnCompare} />)

    // Wait for initial load (200ms debounce)
    await waitFor(() => {
      expect(screen.getByText('Seed: 1337')).toBeInTheDocument()
      expect(screen.getByText('Seed: 1338')).toBeInTheDocument()
      expect(screen.getByText('Seed: 1339')).toBeInTheDocument()
    }, { timeout: 500 })
  })

  it('refreshes when a run is added (same-tab update)', async () => {
    // Start with 2 runs
    const initialRuns = [
      createMockRun('run-1', 1337, 'hash-1', Date.now()),
      createMockRun('run-2', 1338, 'hash-2', Date.now() - 1000)
    ]
    runHistory.saveRuns(initialRuns)

    render(<RunHistory onViewRun={mockOnViewRun} onCompare={mockOnCompare} />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Seed: 1337')).toBeInTheDocument()
    }, { timeout: 500 })

    // Add a new run (this will emit via bus)
    const newRun = createMockRun('run-3', 1339, 'hash-3', Date.now())
    runHistory.addRun(newRun)

    // Wait for refresh (200ms debounce + RAF)
    await waitFor(() => {
      expect(screen.getByText('Seed: 1339')).toBeInTheDocument()
    }, { timeout: 500 })

    // Verify all 3 runs are visible
    expect(screen.getByText('Seed: 1337')).toBeInTheDocument()
    expect(screen.getByText('Seed: 1338')).toBeInTheDocument()
  })

  it('refreshes when a run is deleted (same-tab update)', async () => {
    // Start with 3 runs
    const runs = [
      createMockRun('run-1', 1337, 'hash-1', Date.now()),
      createMockRun('run-2', 1338, 'hash-2', Date.now() - 1000),
      createMockRun('run-3', 1339, 'hash-3', Date.now() - 2000)
    ]
    runHistory.saveRuns(runs)

    render(<RunHistory onViewRun={mockOnViewRun} onCompare={mockOnCompare} />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Seed: 1337')).toBeInTheDocument()
      expect(screen.getByText('Seed: 1339')).toBeInTheDocument()
    }, { timeout: 500 })

    // Click delete on run-2
    const deleteButtons = screen.getAllByLabelText('Delete')
    fireEvent.click(deleteButtons[1]) // Middle run

    // Wait for refresh
    await waitFor(() => {
      expect(screen.queryByText('Seed: 1338')).not.toBeInTheDocument()
    }, { timeout: 500 })

    // Verify other runs still visible
    expect(screen.getByText('Seed: 1337')).toBeInTheDocument()
    expect(screen.getByText('Seed: 1339')).toBeInTheDocument()
  })

  it('refreshes when a run is pinned (same-tab update)', async () => {
    // Start with 2 runs
    const runs = [
      createMockRun('run-1', 1337, 'hash-1', Date.now()),
      createMockRun('run-2', 1338, 'hash-2', Date.now() - 1000)
    ]
    runHistory.saveRuns(runs)

    render(<RunHistory onViewRun={mockOnViewRun} onCompare={mockOnCompare} />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Seed: 1337')).toBeInTheDocument()
    }, { timeout: 500 })

    // Click pin button
    const pinButtons = screen.getAllByLabelText('Pin')
    fireEvent.click(pinButtons[0])

    // Wait for refresh (pin state should update)
    await waitFor(() => {
      const unpinButtons = screen.getAllByLabelText('Unpin')
      expect(unpinButtons.length).toBeGreaterThan(0)
    }, { timeout: 500 })
  })

  it('refreshes on cross-tab storage event', async () => {
    // Start with 1 run
    const initialRuns = [createMockRun('run-1', 1337, 'hash-1', Date.now())]
    runHistory.saveRuns(initialRuns)

    render(<RunHistory onViewRun={mockOnViewRun} onCompare={mockOnCompare} />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Seed: 1337')).toBeInTheDocument()
    }, { timeout: 500 })

    // Simulate another tab adding a run
    const newRuns = [
      createMockRun('run-2', 1338, 'hash-2', Date.now()),
      ...initialRuns
    ]
    localStorage.setItem(runHistory.STORAGE_KEY, JSON.stringify(newRuns))

    // Dispatch storage event (simulates cross-tab update)
    const storageEvent = new StorageEvent('storage', {
      key: runHistory.STORAGE_KEY,
      newValue: JSON.stringify(newRuns),
      oldValue: JSON.stringify(initialRuns),
      storageArea: localStorage
    })
    window.dispatchEvent(storageEvent)

    // Wait for refresh
    await waitFor(() => {
      expect(screen.getByText('Seed: 1338')).toBeInTheDocument()
    }, { timeout: 500 })

    // Both runs should be visible
    expect(screen.getByText('Seed: 1337')).toBeInTheDocument()
  })

  it('refreshes when tab becomes visible', async () => {
    // Start with 1 run
    const initialRuns = [createMockRun('run-1', 1337, 'hash-1', Date.now())]
    runHistory.saveRuns(initialRuns)

    render(<RunHistory onViewRun={mockOnViewRun} onCompare={mockOnCompare} />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Seed: 1337')).toBeInTheDocument()
    }, { timeout: 500 })

    // Simulate storage update while tab is hidden (no bus emit, no storage event)
    const newRuns = [
      createMockRun('run-2', 1338, 'hash-2', Date.now()),
      ...initialRuns
    ]
    localStorage.setItem(runHistory.STORAGE_KEY, JSON.stringify(newRuns))

    // Mock document.visibilityState
    Object.defineProperty(document, 'visibilityState', {
      writable: true,
      configurable: true,
      value: 'visible'
    })

    // Dispatch visibility change event
    const visibilityEvent = new Event('visibilitychange')
    document.dispatchEvent(visibilityEvent)

    // Wait for refresh
    await waitFor(() => {
      expect(screen.getByText('Seed: 1338')).toBeInTheDocument()
    }, { timeout: 500 })
  })

  it('does not create render storm with rapid updates', async () => {
    // Start with 1 run
    const initialRuns = [createMockRun('run-1', 1337, 'hash-1', Date.now())]
    runHistory.saveRuns(initialRuns)

    render(<RunHistory onViewRun={mockOnViewRun} onCompare={mockOnCompare} />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Seed: 1337')).toBeInTheDocument()
    }, { timeout: 500 })

    // Rapidly emit 5 bus events (simulating rapid updates)
    runsBus.emit()
    runsBus.emit()
    runsBus.emit()
    runsBus.emit()
    runsBus.emit()

    // Wait for debounce to settle
    await new Promise(resolve => setTimeout(resolve, 300))

    // Component should still be stable (no errors)
    expect(screen.getByText('Seed: 1337')).toBeInTheDocument()
  })

  it('preserves selection across refresh', async () => {
    // Start with 3 runs
    const runs = [
      createMockRun('run-1', 1337, 'hash-1', Date.now()),
      createMockRun('run-2', 1338, 'hash-2', Date.now() - 1000),
      createMockRun('run-3', 1339, 'hash-3', Date.now() - 2000)
    ]
    runHistory.saveRuns(runs)

    const { container } = render(<RunHistory onViewRun={mockOnViewRun} onCompare={mockOnCompare} />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Seed: 1337')).toBeInTheDocument()
    }, { timeout: 500 })

    // Select first two runs (click the div containers, not buttons)
    const runCards = container.querySelectorAll('.cursor-pointer')
    fireEvent.click(runCards[0])
    fireEvent.click(runCards[1])

    // Verify compare button appears
    await waitFor(() => {
      expect(screen.getByText(/Compare 2 runs/)).toBeInTheDocument()
    })

    // Add a new run (triggers refresh)
    const newRun = createMockRun('run-4', 1340, 'hash-4', Date.now())
    runHistory.addRun(newRun)

    // Wait for refresh
    await waitFor(() => {
      expect(screen.getByText('Seed: 1340')).toBeInTheDocument()
    }, { timeout: 500 })

    // Selection should be preserved
    expect(screen.getByText(/Compare 2 runs/)).toBeInTheDocument()
  })

  it('shows current decision label when a scenario title is present and runs exist', async () => {
    const runs = [
      createMockRun('run-1', 1337, 'hash-1', Date.now()),
    ]
    runHistory.saveRuns(runs)

    useCanvasStore.setState({
      currentScenarioFraming: { title: 'Choose pricing strategy' },
    } as any)

    render(<RunHistory onViewRun={mockOnViewRun} onCompare={mockOnCompare} />)

    await waitFor(() => {
      const context = screen.getByTestId('run-history-scenario-context')
      expect(context).toHaveTextContent('Choose pricing strategy')
    })
  })

  it('highlights the last run for the current decision when scenario metadata is present', async () => {
    const runs = [
      createMockRun('run-1', 1337, 'aaaa1111', Date.now() - 2000),
      createMockRun('run-2', 1338, 'bbbb2222', Date.now()),
    ]
    runHistory.saveRuns(runs)

    useCanvasStore.setState({
      currentScenarioFraming: { title: 'Choose pricing strategy' },
      currentScenarioLastResultHash: 'bbbb2222',
      results: { hash: 'aaaa1111' },
    } as any)

    render(<RunHistory onViewRun={mockOnViewRun} onCompare={mockOnCompare} />)

    await waitFor(() => {
      expect(screen.getByText('Seed: 1338')).toBeInTheDocument()
    }, { timeout: 500 })

    const badges = screen.getAllByTestId('run-history-scenario-last-run')
    expect(badges).toHaveLength(1)
    expect(badges[0]).toHaveTextContent('Last run for this decision')
  })

  it('shows decision-aware empty state when there are no runs but a scenario title', async () => {
    useCanvasStore.setState({
      currentScenarioFraming: { title: 'Choose pricing strategy' },
    } as any)

    render(<RunHistory onViewRun={mockOnViewRun} onCompare={mockOnCompare} />)

    const empty = await screen.findByTestId('run-history-empty')
    expect(empty).toHaveTextContent('No runs yet for this decision')
    const context = screen.getByTestId('run-history-scenario-context')
    expect(context).toHaveTextContent('Choose pricing strategy')
  })

  it('removes deleted run from selection', async () => {
    // Start with 3 runs
    const runs = [
      createMockRun('run-1', 1337, 'hash-1', Date.now()),
      createMockRun('run-2', 1338, 'hash-2', Date.now() - 1000),
      createMockRun('run-3', 1339, 'hash-3', Date.now() - 2000)
    ]
    runHistory.saveRuns(runs)

    const { container } = render(<RunHistory onViewRun={mockOnViewRun} onCompare={mockOnCompare} />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Seed: 1337')).toBeInTheDocument()
    }, { timeout: 500 })

    // Select all 3 runs (click the div containers)
    const runCards = container.querySelectorAll('.cursor-pointer')
    fireEvent.click(runCards[0])
    fireEvent.click(runCards[1])
    fireEvent.click(runCards[2])

    // Verify compare button shows 3 runs
    await waitFor(() => {
      expect(screen.getByText(/Compare 3 runs/)).toBeInTheDocument()
    })

    // Delete the middle run
    const deleteButtons = screen.getAllByLabelText('Delete')
    fireEvent.click(deleteButtons[1])

    // Wait for refresh
    await waitFor(() => {
      expect(screen.queryByText('Seed: 1338')).not.toBeInTheDocument()
    }, { timeout: 500 })

    // Selection should now be 2 runs (deleted one removed)
    await waitFor(() => {
      expect(screen.getByText(/Compare 2 runs/)).toBeInTheDocument()
    }, { timeout: 500 })
  })

  it('maintains sort order (newest first) after refresh', async () => {
    // Start with 2 runs
    const runs = [
      createMockRun('run-1', 1337, 'hash-1', Date.now() - 2000),
      createMockRun('run-2', 1338, 'hash-2', Date.now() - 3000)
    ]
    runHistory.saveRuns(runs)

    render(<RunHistory onViewRun={mockOnViewRun} onCompare={mockOnCompare} />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Seed: 1337')).toBeInTheDocument()
    }, { timeout: 500 })

    // Add a newer run
    const newRun = createMockRun('run-3', 1339, 'hash-3', Date.now())
    runHistory.addRun(newRun)

    // Wait for refresh
    await waitFor(() => {
      expect(screen.getByText('Seed: 1339')).toBeInTheDocument()
    }, { timeout: 500 })

    // Verify newest run is first
    const seedLabels = screen.getAllByText(/Seed: \d+/)
    expect(seedLabels[0]).toHaveTextContent('Seed: 1339')
    expect(seedLabels[1]).toHaveTextContent('Seed: 1337')
    expect(seedLabels[2]).toHaveTextContent('Seed: 1338')
  })

  it('emits sandbox.history.item.selected for each new selection', async () => {
    try {
      localStorage.setItem('feature.telemetry', '1')
    } catch {}
    __resetTelemetryCounters()

    const runs = [
      createMockRun('run-1', 1337, 'hash-1', Date.now()),
      createMockRun('run-2', 1338, 'hash-2', Date.now() - 1000),
      createMockRun('run-3', 1339, 'hash-3', Date.now() - 2000),
    ]
    runHistory.saveRuns(runs)

    const { container } = render(<RunHistory onViewRun={mockOnViewRun} onCompare={mockOnCompare} />)

    await waitFor(() => {
      expect(screen.getByText('Seed: 1337')).toBeInTheDocument()
    }, { timeout: 500 })

    const runCards = container.querySelectorAll('.cursor-pointer')
    fireEvent.click(runCards[0])
    fireEvent.click(runCards[1])

    const counters = __getTelemetryCounters()
    expect(counters['sandbox.history.item.selected']).toBe(2)
  })
})
