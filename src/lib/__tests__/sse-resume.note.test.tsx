import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('../../flags', () => ({
  isSseEnabled: () => true,
  isRunReportEnabled: () => false,
  isJobsProgressEnabled: () => false,
  isConfigDrawerEnabled: () => false,
  isCanvasEnabled: () => false,
  isConfidenceChipsEnabled: () => false,
  isTelemetryEnabled: () => false,
  isHintsEnabled: () => true,
  isParamsEnabled: () => false,
  isHistoryEnabled: () => false,
  isHistoryRerunEnabled: () => false,
  isExportEnabled: () => false,
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

describe('Sandbox resume note', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.instances = []
    FakeEventSource.install()
  })
  afterEach(() => {
    FakeEventSource.uninstall()
    vi.useRealTimers()
  })

  it('shows resume note once after reconnect and clears on next Start', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    const start = screen.getByTestId('start-btn')
    fireEvent.click(start)

    expect(FakeEventSource.instances.length).toBe(1)
    const first = FakeEventSource.instances[0]
    act(() => {
      first.emit('open')
      first.emit('token', 'A', '1')
    })

    // Drop connection to trigger resume
    act(() => { first.emit('error') })
    await vi.advanceTimersByTimeAsync(60)

    expect(FakeEventSource.instances.length).toBe(2)
    const second = FakeEventSource.instances[1]
    expect(second.url).toContain('lastEventId=1')

    // First new token after reconnect triggers resume note once
    act(() => {
      second.emit('token', 'B', '2')
      second.emit('token', 'C', '3')
    })
    const note = screen.getByTestId('resume-note')
    expect(!!note).toBe(true)

    // Note should not duplicate if more tokens arrive
    act(() => { second.emit('token', 'D', '4') })
    expect(screen.getAllByTestId('resume-note').length).toBe(1)

    // New Start clears the note
    // End the current run so Start is enabled again
    act(() => { second.emit('done') })
    const start2 = screen.getByTestId('start-btn')
    fireEvent.click(start2)
    expect(screen.queryByTestId('resume-note')).toBeNull()
  })
})
