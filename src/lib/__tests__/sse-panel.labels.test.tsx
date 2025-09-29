import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

// Mock flags
vi.mock('../../flags', () => ({
  isSseEnabled: () => true,
  isRunReportEnabled: () => false,
  isConfigDrawerEnabled: () => false,
  isCanvasEnabled: () => false,
  isJobsProgressEnabled: () => false,
  isConfidenceChipsEnabled: () => false,
  isTelemetryEnabled: () => false,
  isHintsEnabled: () => false,
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

describe('SandboxStreamPanel terminal labels', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.instances = []
    FakeEventSource.install()
  })
  afterEach(() => {
    cleanup()
    FakeEventSource.uninstall()
    vi.useRealTimers()
  })

  it('announces Limited by budget', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)
    fireEvent.click(screen.getByTestId('start-btn'))
    const es = FakeEventSource.instances[0]
    act(() => {
      es.emit('open')
      es.emit('limited')
    })
    const chip = screen.getByTestId('status-chip')
    await vi.advanceTimersByTimeAsync(0)
    expect(chip.textContent).toBe('Limited by budget')
    expect(chip.getAttribute('aria-label')).toBe('Run status: Limited by budget')
    expect(document.activeElement).toBe(chip)
  })

  it('announces Error', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)
    fireEvent.click(screen.getByTestId('start-btn'))
    const first = FakeEventSource.instances[0]
    act(() => {
      first.emit('open')
      // First error triggers a single retry (non-terminal)
      first.emit('error')
    })
    await vi.advanceTimersByTimeAsync(60)
    const second = FakeEventSource.instances[1]
    act(() => {
      // Second error after retry is terminal (no further retries)
      second.emit('error')
    })
    const chip = screen.getByTestId('status-chip')
    await vi.advanceTimersByTimeAsync(0)
    expect(chip.textContent).toBe('Error')
    expect(chip.getAttribute('aria-label')).toBe('Run status: Error')
    expect(document.activeElement).toBe(chip)
  })
})
