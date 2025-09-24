import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

// Case tests for terminal hints and limited tip

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

describe('SandboxStreamPanel terminal hints', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    FakeEventSource.instances = []
    FakeEventSource.install()
    vi.mock('../../flags', () => ({
      isSseEnabled: () => true,
      isRunReportEnabled: () => true,
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
    }))
  })
  afterEach(() => {
    cleanup()
    FakeEventSource.uninstall()
    vi.useRealTimers()
  })

  it('limited with hints ON shows chip title and limited tip', async () => {
    vi.resetModules()
    try {
      window.localStorage.setItem('feature.sseStreaming', '1')
      window.localStorage.setItem('feature.hints', '1')
    } catch {}

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
    expect(chip.getAttribute('title')).toBe('Run hit the budget limit.')
    expect(document.activeElement).toBe(chip)

    const tip = screen.getByTestId('limited-tip')
    expect(tip.textContent).toBe('Tip: Increase your budget or reduce the scope, then try again.')
  })

  it('error with hints ON shows chip title only; no limited tip', async () => {
    vi.resetModules()
    try {
      window.localStorage.setItem('feature.sseStreaming', '1')
      window.localStorage.setItem('feature.hints', '1')
    } catch {}

    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    fireEvent.click(screen.getByTestId('start-btn'))
    const first = FakeEventSource.instances[0]
    act(() => {
      first.emit('open')
      first.emit('error') // transient retry
    })
    await vi.advanceTimersByTimeAsync(60)
    const second = FakeEventSource.instances[1]
    act(() => {
      second.emit('error') // terminal
    })

    const chip = screen.getByTestId('status-chip')
    await vi.advanceTimersByTimeAsync(0)
    expect(chip.textContent).toBe('Error')
    expect(chip.getAttribute('title')).toBe('Something went wrong during streaming.')
    expect(screen.queryByTestId('limited-tip')).toBeNull()
  })

  it('hints OFF shows no title and no limited tip', async () => {
    vi.resetModules()
    // Explicitly mock flags with hints OFF for this case
    vi.doMock('../../flags', () => ({
      isSseEnabled: () => true,
      isRunReportEnabled: () => true,
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
    }))
    try {
      window.localStorage.setItem('feature.sseStreaming', '1')
      window.localStorage.removeItem('feature.hints')
    } catch {}

    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    fireEvent.click(screen.getByTestId('start-btn'))
    const es = FakeEventSource.instances[0]
    act(() => {
      es.emit('open')
      es.emit('done')
    })

    const chip = screen.getByTestId('status-chip')
    await vi.advanceTimersByTimeAsync(0)
    expect(chip.textContent).toBe('Done')
    expect(chip.getAttribute('title')).toBeNull()
    expect(screen.queryByTestId('limited-tip')).toBeNull()
  })
})
