import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
// Mock the flags so the panel renders. This must be defined before importing the component.
vi.mock('../../flags', () => ({
  isSseEnabled: () => true,
  isRunReportEnabled: () => true,
  isConfigDrawerEnabled: () => false,
  isJobsProgressEnabled: () => false,
  isConfidenceChipsEnabled: () => false,
  isTelemetryEnabled: () => false,
  isHintsEnabled: () => false,
  isParamsEnabled: () => false,
  isHistoryEnabled: () => false,
  isHistoryRerunEnabled: () => false,
  isExportEnabled: () => false,
  isCanvasEnabled: () => false,
  isCanvasDefaultEnabled: () => false,
  isScenarioImportPreviewEnabled: () => false,
  isMarkdownPreviewEnabled: () => false,
  isShortcutsEnabled: () => false,
  isCopyCodeEnabled: () => false,
  isScenariosEnabled: () => false,
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
    if (type === 'message') this.onmessage?.(ev)
    const set = this.listeners.get(type)
    if (set) set.forEach((cb) => cb(ev))
  }
}

describe('SandboxStreamPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    try { window.localStorage.setItem('feature.streamBuffer', '0') } catch {}
    FakeEventSource.instances = []
    FakeEventSource.install()
  })
  afterEach(() => {
    FakeEventSource.uninstall()
    vi.useRealTimers()
  })

  it('streams tokens, shows cost, reconnects once, and focuses status on terminal', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    const start = screen.getByTestId('start-btn')
    const stop = screen.getByTestId('stop-btn')

    // Start streaming
    fireEvent.click(start)

    // First connection opens
    expect(FakeEventSource.instances.length).toBe(1)
    const first = FakeEventSource.instances[0]
    act(() => {
      first.emit('open')
      // Stream tokens and cost
      first.emit('token', 'Hello ', '1')
      first.emit('token', 'world', '2')
      first.emit('cost', '0.01')
    })

    const outEl = screen.getByTestId('stream-output')
    expect(outEl.textContent).toBe('Hello world')
    const cost = screen.getByTestId('cost-badge')
    expect(cost.textContent).toBe('$0.01')

    // Transient error triggers reconnect hint and single retry
    act(() => {
      first.emit('error')
    })
    const hint = screen.getByTestId('reconnect-hint')
    expect(!!hint).toBe(true)

    await vi.advanceTimersByTimeAsync(60)
    expect(FakeEventSource.instances.length).toBe(2)
    const second = FakeEventSource.instances[1]
    expect(second.url).toContain('lastEventId=2')

    // Reconnect clears hint on open
    act(() => {
      second.emit('open')
      // Emits duplicate of id=2 should be ignored, new token id=3 appended
      second.emit('token', 'world_DUP', '2')
      second.emit('token', '!', '3')
      second.emit('done')
    })

    const output = screen.getByTestId('stream-output')
    expect(output.textContent).toBe('Hello world!')

    // Status updated and focused
    const chip = screen.getByTestId('status-chip')
    await vi.advanceTimersByTimeAsync(0)
    expect(chip.textContent).toBe('Done')
    expect(document.activeElement).toBe(chip)

    // Now test Stop behaviour quickly
    fireEvent.click(start)
    const third = FakeEventSource.instances[2]
    act(() => {
      third.emit('open')
      third.emit('token', 'A', '10')
    })
    fireEvent.click(stop)
    const chip2 = screen.getByTestId('status-chip')
    await vi.advanceTimersByTimeAsync(0)
    expect(chip2.textContent).toBe('Cancelled')
    // Further tokens after stop should not append because connection is closed
    act(() => {
      third.emit('token', 'SHOULD_NOT_APPEND', '11')
    })
    expect(screen.getByTestId('stream-output').textContent).not.toContain('SHOULD_NOT_APPEND')

    // Server later emits ABORTED terminal; panel should show Aborted and move focus
    act(() => {
      third.emit('aborted')
    })
    const chip3 = screen.getByTestId('status-chip')
    await vi.advanceTimersByTimeAsync(0)
    expect(chip3.textContent).toBe('Aborted')
    expect(document.activeElement).toBe(chip3)
  })
})
