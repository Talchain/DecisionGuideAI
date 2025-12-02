import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { __resetTelemetryCounters, __getTelemetryCounters } from '../../lib/telemetry'
import { useCanvasStore } from '../store'
import * as useEngineLimitsModule from '../hooks/useEngineLimits'
import type { UseEngineLimitsReturn } from '../hooks/useEngineLimits'
import { render, waitFor } from '@testing-library/react'
import { ToastProvider } from '../ToastContext'
import { useCanvasKeyboardShortcuts } from '../hooks/useCanvasKeyboardShortcuts'
import { useRunEligibilityCheck } from '../hooks/useRunEligibilityCheck'

vi.mock('../hooks/useEngineLimits', () => ({
  useEngineLimits: vi.fn(),
}))

const mockUseEngineLimits = vi.mocked(useEngineLimitsModule.useEngineLimits)

const createMockLimitsReturn = (overrides?: Partial<UseEngineLimitsReturn>): UseEngineLimitsReturn => ({
  limits: {
    nodes: { max: 200 },
    edges: { max: 500 },
    engine_p95_ms_budget: 30000,
  },
  source: 'live',
  loading: false,
  error: null,
  fetchedAt: Date.now(),
  retry: vi.fn(),
  ...overrides,
})

function KeyboardRunHarness() {
  const checkRunEligibility = useRunEligibilityCheck()

  const handleRunSimulation = () => {
    checkRunEligibility()
  }

  useCanvasKeyboardShortcuts({
    onRunSimulation: handleRunSimulation,
  })

  return null
}

describe('ReactFlowGraph keyboard run telemetry', () => {
  beforeEach(() => {
    mockUseEngineLimits.mockReset()
    mockUseEngineLimits.mockReturnValue(createMockLimitsReturn())

    try {
      localStorage.setItem('feature.telemetry', '1')
    } catch {}
    __resetTelemetryCounters()
  })

  afterEach(() => {
    useCanvasStore.getState().resetCanvas()
  })

  it('tracks sandbox.run.blocked when Cmd+Enter is pressed on an empty graph', async () => {
    // Ensure clean empty graph
    useCanvasStore.getState().resetCanvas()

    render(
      <ToastProvider>
        <KeyboardRunHarness />
      </ToastProvider>,
    )

    const event = new KeyboardEvent('keydown', { metaKey: true, key: 'Enter' })
    window.dispatchEvent(event)

    await waitFor(() => {
      const counters = __getTelemetryCounters()
      expect(counters['sandbox.run.blocked']).toBe(1)
      expect(counters['sandbox.run.clicked']).toBe(0)
    })
  })

  it('tracks sandbox.run.clicked when Cmd+Enter is pressed on a non-empty, healthy graph', async () => {
    const { resetCanvas, addNode } = useCanvasStore.getState()
    resetCanvas()
    addNode({ x: 0, y: 0 })
    useCanvasStore.setState({ graphHealth: null } as any)

    render(
      <ToastProvider>
        <KeyboardRunHarness />
      </ToastProvider>,
    )

    const event = new KeyboardEvent('keydown', { metaKey: true, key: 'Enter' })
    window.dispatchEvent(event)

    await waitFor(() => {
      const counters = __getTelemetryCounters()
      expect(counters['sandbox.run.clicked']).toBe(1)
      expect(counters['sandbox.run.blocked']).toBe(0)
    })
  })
})
