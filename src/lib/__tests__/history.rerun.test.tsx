import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'

// Flags: enable SSE, Params, History, and HistoryRerun
vi.mock('../../flags', () => ({
  isSseEnabled: () => true,
  isRunReportEnabled: () => false,
  isJobsProgressEnabled: () => false,
  isConfigDrawerEnabled: () => false,
  isCanvasEnabled: () => false,
  isConfidenceChipsEnabled: () => false,
  isHintsEnabled: () => false,
  isParamsEnabled: () => true,
  isHistoryEnabled: () => true,
  isHistoryRerunEnabled: () => true,
  isExportEnabled: () => false,
  isTelemetryEnabled: () => false,
  isMarkdownPreviewEnabled: () => false,
  isShortcutsEnabled: () => false,
  isCopyCodeEnabled: () => false,
  isScenariosEnabled: () => false,
}))

// Prime session defaults
vi.mock('../../lib/session', async (importOriginal) => {
  const mod: any = await importOriginal()
  return { ...mod, getDefaults: () => ({ sessionId: 'sandbox', org: 'local' }) }
})

class FakeEventSource {
  static instances: FakeEventSource[] = []
  static install() {
    ;(globalThis as any)._RealES = (globalThis as any).EventSource
    ;(globalThis as any).EventSource = FakeEventSource as any
  }
  static uninstall() {
    ;(globalThis as any).EventSource = (globalThis as any)._RealES
  }
  url: string
  closed = false
  onopen: ((ev: any) => void) | null = null
  onmessage: ((ev: any) => void) | null = null
  onerror: ((ev: any) => void) | null = null
  private listeners = new Map<string, Set<(ev: any) => void>>()
  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }
  addEventListener(type: string, cb: (ev: any) => void) {
    const set = this.listeners.get(type) || new Set()
    set.add(cb)
    this.listeners.set(type, set)
  }
  close() { this.closed = true }
  emit(type: string, data?: string, id?: string) {
    if (this.closed) return
    if (type === 'open') { this.onopen?.({}); return }
    if (type === 'error') { this.onerror?.({}); return }
    const ev: any = { data, lastEventId: id }
    if (type === 'message') this.onmessage?.(ev)
    const set = this.listeners.get(type)
    if (set) set.forEach((cb) => cb(ev))
  }
}


describe('Run History Re-run', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.instances = []
    FakeEventSource.install()
    try {
      localStorage.clear()
      localStorage.setItem('feature.sseStreaming', '1')
      localStorage.setItem('feature.params', '1')
      localStorage.setItem('feature.history', '1')
      localStorage.setItem('feature.historyRerun', '1')
      // Deterministic, direct append
      localStorage.setItem('feature.streamBuffer', '0')
      // Seed one history item
      const seedEntry = [{
        id: 'x1', ts: Date.now() - 1000, status: 'done',
        durationMs: 10, estCost: 0.01, seed: '42', budget: 3.5, model: 'local-sim',
        route: 'critique', sessionId: 'sandbox', org: 'local'
      }]
      localStorage.setItem('sandbox.history', JSON.stringify(seedEntry))
    } catch {}
  })
  afterEach(() => {
    FakeEventSource.uninstall()
    vi.useRealTimers()
    cleanup()
  })

  it('clicking Re-run snaps params, starts streaming, URL includes params, and new entry appends at terminal', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    // Open History
    const btn = screen.getByTestId('history-btn')
    fireEvent.click(btn)
    expect(screen.getByTestId('history-drawer')).toBeTruthy()

    // Click Re-run
    const rerun = screen.getByTestId('rerun-btn')
    fireEvent.click(rerun)

    // A new ES should be created
    expect(FakeEventSource.instances.length).toBe(1)
    const es = FakeEventSource.instances[0]

    // URL should include snapped params
    expect(es.url).toContain('seed=42')
    expect(es.url).toContain('budget=3.5')
    expect(es.url).toContain('model=local-sim')

    // Drive stream
    act(() => {
      es.emit('open')
      es.emit('token', 'Hi', '1')
      es.emit('token', '!', '2')
      es.emit('done')
    })

    // Focus moves to status chip at terminal
    expect(screen.getByTestId('status-chip')).toBeTruthy()

    // History now includes new entry at top
    fireEvent.click(screen.getByTestId('history-btn'))
    screen.getByTestId('history-list')
    const statuses = screen.getAllByTestId('history-status')
    expect(statuses[0].textContent).toContain('Done')
  })
})
