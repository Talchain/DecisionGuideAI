import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import React from 'react'

// Flags: enable SSE + RunReport + History + Params for this suite
vi.mock('../../flags', () => ({
  isSseEnabled: () => true,
  isRunReportEnabled: () => true,
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
}))

// Spy fetchRunReport to assert call params
const fetchSpy = vi.fn(async (_args: any) => ({
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
vi.mock('../runReport', () => ({ fetchRunReport: (args: any) => fetchSpy(args) }))

// History storage helpers
import * as history from '../history'

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

describe('RunHistoryDrawer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.instances = []
    FakeEventSource.install()
    fetchSpy.mockClear()
    history.clear()
    try { window.localStorage.setItem('feature.streamBuffer', '0') } catch {}
  })
  afterEach(() => {
    cleanup()
    FakeEventSource.uninstall()
    vi.useRealTimers()
  })

  it('records an entry on Done and opens report with params', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    fireEvent.change(screen.getByTestId('param-seed'), { target: { value: '42' } })
    fireEvent.change(screen.getByTestId('param-budget'), { target: { value: '3.5' } })
    fireEvent.change(screen.getByTestId('param-model'), { target: { value: 'local-sim' } })

    fireEvent.click(screen.getByTestId('start-btn'))
    expect(FakeEventSource.instances.length).toBe(1)
    const es = FakeEventSource.instances[0]

    act(() => {
      es.emit('open')
      es.emit('cost', '0.02', 'c1')
      es.emit('token', 'Hi', 't1')
      es.emit('done')
    })

    // Open history
    fireEvent.click(screen.getByTestId('history-btn'))
    await vi.advanceTimersByTimeAsync(1)
    const rowStatus = screen.getByTestId('history-status')
    expect(rowStatus.textContent).toContain('Done')
    expect(screen.getByTestId('history-seed').textContent).toContain('42')
    expect(screen.getByTestId('history-model').textContent).toContain('local-sim')
    expect(screen.getByTestId('history-cost').textContent).toContain('£0.02')

    // Open report for the row
    fireEvent.click(screen.getByTestId('open-report-btn'))

    // Allow microtasks
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchSpy).toHaveBeenCalled()
    const args = fetchSpy.mock.calls.at(-1)![0]
    expect(args.seed).toBe('42')
    expect(args.budget).toBe(3.5)
    expect(args.model).toBe('local-sim')
  })

  it('caps at MAX=5 newest-first', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByTestId('start-btn'))
      const es = FakeEventSource.instances.pop()!
      act(() => { es.emit('open'); es.emit('done') })
    }

    fireEvent.click(screen.getByTestId('history-btn'))
    const list = screen.getByTestId('history-list')
    // should have 5 rows
    expect(list.querySelectorAll('li').length).toBe(5)
  })

  it('empty state when no runs yet and Esc returns focus', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    // Clear history
    history.clear()

    fireEvent.click(screen.getByTestId('history-btn'))
    expect(screen.getByTestId('history-empty')).toBeTruthy()

    const trigger = screen.getByTestId('history-btn') as HTMLButtonElement
    fireEvent.keyDown(document.getElementById('history-drawer')!, { key: 'Escape' })
    await vi.advanceTimersByTimeAsync(1)
    // Focus returned
    expect(document.activeElement).toBe(trigger)
  })
})
