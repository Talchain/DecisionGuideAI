import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('../../flags', () => ({
  isSseEnabled: () => true,
  isRunReportEnabled: () => true,
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
    seed: 42,
    route: 'critique',
    startedAt: '2025-09-23T18:00:00.000Z',
    finishedAt: '2025-09-23T18:00:02.000Z',
    totals: { inputTokens: 10, outputTokens: 2 },
    steps: [
      { id: 's1', type: 'plan', status: 'ok', attempts: 1, durationMs: 12 },
      { id: 's2', type: 'critique', status: 'ok', attempts: 1, durationMs: 34 },
    ],
  }),
}))

function setFlagLS() { try { localStorage.setItem('feature.reportExpandAll', '1') } catch {} }

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

describe('RunReportDrawer expand/collapse all (flag-gated)', () => {
  beforeEach(() => { vi.useFakeTimers(); FakeEventSource.instances = []; FakeEventSource.install(); setFlagLS() })
  afterEach(() => { FakeEventSource.uninstall(); vi.useRealTimers(); try { localStorage.clear() } catch {} })

  it('toggle hides/shows steps rows', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    // Start and finish run
    fireEvent.click(screen.getByTestId('start-btn'))
    const es = FakeEventSource.instances[0]
    act(() => { es.emit('open'); es.emit('done') })

    const viewBtn = screen.getByTestId('view-report-btn') as HTMLButtonElement
    fireEvent.click(viewBtn)
    await vi.advanceTimersByTimeAsync(0)

    const table = screen.getByTestId('report-steps')
    // Initially expanded
    expect(table.querySelectorAll('tbody tr').length).toBeGreaterThan(0)

    const toggle = screen.getByTestId('report-expandall-btn')
    fireEvent.click(toggle)
    await vi.advanceTimersByTimeAsync(0)
    expect(table.querySelectorAll('tbody tr').length).toBe(0)

    fireEvent.click(toggle)
    await vi.advanceTimersByTimeAsync(0)
    expect(table.querySelectorAll('tbody tr').length).toBeGreaterThan(0)
  })
})
