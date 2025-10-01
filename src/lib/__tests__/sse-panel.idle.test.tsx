import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock flags ON so the panel renders, run-report remains ON but unused here
vi.mock('../../flags', () => ({
  isSseEnabled: () => true,
  isReportCopyEnabled: () => false,
  isRunReportEnabled: () => true,
  isConfidenceChipsEnabled: () => false,
  isParamsEnabled: () => false,
  isConfigDrawerEnabled: () => false,
  isCanvasEnabled: () => false,
  isJobsProgressEnabled: () => false,
  isTelemetryEnabled: () => false,
  isHintsEnabled: () => false,
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
    const set = this.listeners.get(type); if (set) set.forEach((cb) => cb(ev))
  }
}

describe('SandboxStreamPanel idle hint', () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    FakeEventSource.install()
  })
  afterEach(() => {
    FakeEventSource.uninstall()
  })

  it('shows hint when idle; disappears on Start; stays hidden after terminal', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    // Idle hint visible and aria-hidden true
    const hint = screen.getByTestId('idle-hint')
    expect(!!hint).toBe(true)
    expect(hint.getAttribute('aria-hidden')).toBe('true')

    // Start streaming hides hint and sets aria-busy
    fireEvent.click(screen.getByTestId('start-btn'))
    const out = screen.getByTestId('stream-output')
    expect(out.getAttribute('aria-busy')).toBe('true')
    expect(screen.queryByTestId('idle-hint')).toBeNull()

    // Emit done terminal
    const first = FakeEventSource.instances[0]
    act(() => {
      first.emit('open')
      first.emit('done')
    })

    // Hint remains hidden
    expect(screen.queryByTestId('idle-hint')).toBeNull()
  })
})
