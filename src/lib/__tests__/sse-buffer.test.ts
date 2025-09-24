import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import React from 'react'

// Buffer behavior tests for SandboxStreamPanel rAF micro-batching

// Mock flags so the panel renders, hints off to avoid tooltip differences
vi.mock('../../flags', () => ({
  isSseEnabled: () => true,
  isRunReportEnabled: () => false,
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

describe('SandboxStreamPanel rAF token buffer', () => {
  let savedRAF: any

  beforeEach(() => {
    vi.useFakeTimers()
    // Force microtask fallback by disabling requestAnimationFrame
    savedRAF = (globalThis as any).requestAnimationFrame
    ;(globalThis as any).requestAnimationFrame = undefined
    FakeEventSource.instances = []
    FakeEventSource.install()
  })
  afterEach(() => {
    cleanup()
    FakeEventSource.uninstall()
    ;(globalThis as any).requestAnimationFrame = savedRAF
    vi.useRealTimers()
  })

  it('batches multiple tokens within a frame into one flush', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    fireEvent.click(screen.getByTestId('start-btn'))
    const es = FakeEventSource.instances[0]

    act(() => {
      es.emit('open')
      es.emit('token', 'A', '1')
      es.emit('token', 'B', '2')
      es.emit('token', 'C', '3')
    })

    const out = screen.getByTestId('stream-output')
    // Before microtask flush, text should be empty
    expect(out.textContent).toBe('')

    // Microtask flush (fallback path) + React commit
    await Promise.resolve()
    await Promise.resolve()

    expect(out.textContent).toBe('ABC')
  })

  it('flushes buffered tokens on terminal (done)', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    fireEvent.click(screen.getByTestId('start-btn'))
    const es = FakeEventSource.instances[0]

    act(() => {
      es.emit('open')
      es.emit('token', 'X', '1')
      es.emit('token', 'Y', '2')
      es.emit('done')
    })

    const out = screen.getByTestId('stream-output')
    await Promise.resolve()
    await Promise.resolve()
    expect(out.textContent).toBe('XY')
  })

  it('stop gates tokens after flushing any pending buffer', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    fireEvent.click(screen.getByTestId('start-btn'))
    const stopBtn = screen.getByTestId('stop-btn')
    const es = FakeEventSource.instances[0]

    act(() => {
      es.emit('open')
      es.emit('token', 'Q', '1')
    })

    // Stop — should flush 'Q' and then block future tokens
    fireEvent.click(stopBtn)
    await Promise.resolve()
    await Promise.resolve()

    const out = screen.getByTestId('stream-output')
    expect(out.textContent).toBe('Q')

    act(() => {
      es.emit('token', 'R', '2')
      es.emit('token', 'S', '3')
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(out.textContent).toBe('Q')
  })
})
