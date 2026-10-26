import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { __resetTelemetryCounters, __getTelemetryCounters } from '../../lib/telemetry'
import { useCanvasStore } from '../store'
import { render, waitFor } from '@testing-library/react'
import { ToastProvider } from '../ToastContext'
import { useCanvasKeyboardShortcuts } from '../hooks/useCanvasKeyboardShortcuts'
import { useRunEligibilityCheck } from '../hooks/useRunEligibilityCheck'

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
