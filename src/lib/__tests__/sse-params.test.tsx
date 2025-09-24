import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import React from 'react'

// Enable SSE + Params + Chips
vi.mock('../../flags', () => ({
  isSseEnabled: () => true,
  isRunReportEnabled: () => false,
  isConfidenceChipsEnabled: () => true,
  isTelemetryEnabled: () => false,
  isHintsEnabled: () => false,
  isParamsEnabled: () => true,
  isHistoryEnabled: () => false,
  isHistoryRerunEnabled: () => false,
  isExportEnabled: () => false,
  isMarkdownPreviewEnabled: () => false,
  isShortcutsEnabled: () => false,
  isCopyCodeEnabled: () => false,
}))

// Spy for fetchRunReport to capture params
const reportSpy = vi.fn(async (_args: any) => ({
  seed: Number(_args.seed ?? 0),
  orgId: _args.org,
  userId: 'tester',
  route: 'critique',
  traceId: 't',
  startedAt: '2025-09-23T18:00:00.000Z',
  finishedAt: '2025-09-23T18:00:05.250Z',
  totals: {},
  steps: [],
}))
vi.mock('../runReport', () => ({
  fetchRunReport: (args: any) => reportSpy(args),
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

  constructor(url: string) { this.url = url; FakeEventSource.instances.push(this) }
  addEventListener(type: string, cb: (ev: any) => void) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type)!.add(cb) }
  close() { this.closed = true }
  emit(type: string, data?: string, id?: string) {
    if (this.closed) return
    if (type === 'open') { this.onopen?.({}); return }
    if (type === 'error') { this.onerror?.({}); return }
    const ev: any = { data, lastEventId: id }
    if (type === 'message') this.onmessage?.(ev)
    const set = this.listeners.get(type); if (set) set.forEach((cb) => cb(ev))
  }
}

describe('SandboxStreamPanel with params', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.instances = []
    FakeEventSource.install()
    reportSpy.mockClear()
    try { window.localStorage.setItem('feature.streamBuffer', '0') } catch {}
  })
  afterEach(() => {
    cleanup()
    FakeEventSource.uninstall()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('passes seed/budget/model to SSE URL and fetchRunReport', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    // Configure params
    fireEvent.change(screen.getByTestId('param-seed'), { target: { value: '42' } })
    fireEvent.change(screen.getByTestId('param-budget'), { target: { value: '3.5' } })
    fireEvent.change(screen.getByTestId('param-model'), { target: { value: 'local-sim' } })

    // Start stream
    fireEvent.click(screen.getByTestId('start-btn'))
    expect(FakeEventSource.instances.length).toBe(1)
    const es = FakeEventSource.instances[0]
    // SSE URL contains params
    expect(es.url).toContain('seed=42')
    expect(es.url).toContain('budget=3.5')
    expect(es.url).toContain('model=local-sim')

    // Finish stream to trigger report fetch
    act(() => {
      es.emit('open')
      es.emit('done')
    })

    // Allow any microtasks to settle
    await vi.advanceTimersByTimeAsync(0)

    // Assert report mapping received same params
    expect(reportSpy).toHaveBeenCalledTimes(1)
    const args = reportSpy.mock.calls[0][0]
    expect(args.seed).toBe('42')
    expect(args.budget).toBe(3.5)
    expect(args.model).toBe('local-sim')
  })
})
