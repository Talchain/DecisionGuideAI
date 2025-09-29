import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('../../flags', () => ({
  isSseEnabled: () => true,
  isRunReportEnabled: () => true,
  isReportCopyEnabled: () => false,
  isConfigDrawerEnabled: () => false,
  isCanvasEnabled: () => false,
  isJobsProgressEnabled: () => false,
  isConfidenceChipsEnabled: () => false,
  isTelemetryEnabled: () => false,
  isHintsEnabled: () => false,
  isParamsEnabled: () => true,
  isHistoryEnabled: () => true,
  isHistoryRerunEnabled: () => false,
  isExportEnabled: () => false,
  isMarkdownPreviewEnabled: () => false,
  isShortcutsEnabled: () => false,
  isCopyCodeEnabled: () => false,
  isScenariosEnabled: () => false,
}))

vi.mock('../../lib/runReport', () => ({
  fetchRunReport: async () => ({
    seed: 1234,
    userId: 'tester',
    route: 'critique',
    traceId: 'trace-abc123',
    startedAt: '2025-09-23T18:00:00.000Z',
    finishedAt: '2025-09-23T18:00:05.250Z',
    totals: { inputTokens: 1200, outputTokens: 256, costUsd: 0.0123 },
    steps: [
      { id: 'step-1', type: 'plan', status: 'ok', attempts: 1, durationMs: 210, outcome: 'planned' },
      { id: 'step-2', type: 'critique', status: 'ok', attempts: 1, durationMs: 3310 }
    ],
  }),
}))

class FakeEventSource {
  static instances: FakeEventSource[] = []
  static install() {
    ;(globalThis as any)._RealEventSource = (globalThis as any).EventSource
    ;(globalThis as any).EventSource = FakeEventSource as any
  }
  static uninstall() {
    ;(globalThis as any).EventSource = (globalThis as any)._RealEventSource
  }

  url: string
  closed = false
  onopen: ((this: FakeEventSource, ev: any) => any) | null = null
  onmessage: ((this: FakeEventSource, ev: any) => any) | null = null
  onerror: ((this: FakeEventSource, ev: any) => any) | null = null
  private listeners = new Map<string, Set<(ev: any) => void>>()

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, cb: (ev: any) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(cb)
  }

  close() {
    this.closed = true
  }

  emit(type: string, data?: string, id?: string) {
    if (this.closed) return
    if (type === 'open') {
      this.onopen?.({})
      return
    }
    if (type === 'error') {
      this.onerror?.({})
      return
    }
    const ev: any = { data, lastEventId: id }
    if (type === 'message') {
      this.onmessage?.(ev)
    }
    const set = this.listeners.get(type)
    if (set) set.forEach((cb) => cb(ev))
  }
}

describe('RunReportDrawer via SandboxStreamPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.instances = []
    FakeEventSource.install()
  })
  afterEach(() => {
    FakeEventSource.uninstall()
    vi.useRealTimers()
  })

  it('enables View report after terminal and renders mock data; Esc closes and returns focus', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    const start = screen.getByTestId('start-btn')
    fireEvent.click(start)

    expect(FakeEventSource.instances.length).toBe(1)
    const first = FakeEventSource.instances[0]

    act(() => {
      first.emit('open')
      first.emit('done')
    })

    const viewBtn = screen.getByTestId('view-report-btn') as HTMLButtonElement
    expect(viewBtn.disabled).toBe(false)

    fireEvent.click(viewBtn)

    // Flush pending state updates
    await vi.advanceTimersByTimeAsync(0)

    const seedChip = screen.getByTestId('report-seed')
    expect(seedChip.textContent).toContain('Seed: 1234')
    const routeChip = screen.getByTestId('report-route')
    expect(routeChip.textContent).toContain('Route: critique')

    const totals = screen.getByTestId('report-totals')
    expect(totals.textContent).toContain('inputTokens')
    expect(totals.textContent).toContain('1200')

    const steps = screen.getByTestId('report-steps')
    expect(steps.textContent).toContain('step-1')
    expect(steps.textContent).toContain('plan')

    // Press Esc to close
    const drawer = screen.getByTestId('report-drawer')
    fireEvent.keyDown(drawer, { key: 'Escape' })

    await vi.advanceTimersByTimeAsync(0)
    expect(document.activeElement).toBe(viewBtn)
  })
})
