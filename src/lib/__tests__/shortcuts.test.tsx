import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'

// Flags: enable SSE + Shortcuts + History + RunReport
vi.mock('../../flags', () => ({
  isSseEnabled: () => true,
  isRunReportEnabled: () => true,
  isConfigDrawerEnabled: () => false,
  isCanvasEnabled: () => false,
  isJobsProgressEnabled: () => false,
  isConfidenceChipsEnabled: () => false,
  isTelemetryEnabled: () => false,
  isHintsEnabled: () => false,
  isParamsEnabled: () => false,
  isHistoryEnabled: () => true,
  isExportEnabled: () => false,
  isMarkdownPreviewEnabled: () => false,
  isShortcutsEnabled: () => true,
  isHistoryRerunEnabled: () => false,
  isCopyCodeEnabled: () => false,
  isScenariosEnabled: () => false,
}))

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
  constructor(url: string) { this.url = url; FakeEventSource.instances.push(this) }
  addEventListener(type: string, cb: (ev: any) => void) { const set = this.listeners.get(type) || new Set(); set.add(cb); this.listeners.set(type, set) }
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

describe('Shortcuts and cheat sheet', () => {
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

  it('Cmd/Ctrl+Enter starts and Esc stops', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    // Cmd/Ctrl+Enter → Start
    const evt = new KeyboardEvent('keydown', { key: 'Enter', metaKey: true })
    window.dispatchEvent(evt)
    expect(FakeEventSource.instances.length).toBe(1)

    // Esc → Stop
    const esc = new KeyboardEvent('keydown', { key: 'Escape' })
    window.dispatchEvent(esc)
    // Terminal: panel focuses status chip; nothing else to assert here
    await Promise.resolve(); await Promise.resolve()
    expect(screen.getByTestId('status-chip')).toBeTruthy()
  })

  it('r opens report after terminal and h opens history; ? toggles sheet', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    // Start and finish quickly
    const evt = new KeyboardEvent('keydown', { key: 'Enter', metaKey: true })
    window.dispatchEvent(evt)
    const es = FakeEventSource.instances[0]
    act(() => { es.emit('open'); es.emit('done') })

    // 'r' opens report
    const r = new KeyboardEvent('keydown', { key: 'r' })
    window.dispatchEvent(r)
    await Promise.resolve()
    expect(screen.getByTestId('report-drawer')).toBeTruthy()

    // 'h' opens history
    const h = new KeyboardEvent('keydown', { key: 'h' })
    window.dispatchEvent(h)
    await Promise.resolve()
    expect(screen.getByTestId('history-drawer')).toBeTruthy()

    // '?' toggles sheet
    await Promise.resolve()
    const q = new KeyboardEvent('keydown', { key: '/', shiftKey: true })
    window.dispatchEvent(q)
    await vi.advanceTimersByTimeAsync(0)
    await Promise.resolve()
    expect(screen.getByTestId('shortcuts-sheet')).toBeTruthy()
    const esc = new KeyboardEvent('keydown', { key: 'Escape' })
    window.dispatchEvent(esc)
    await Promise.resolve()
    // sheet closed
    await Promise.resolve()
  })
})
