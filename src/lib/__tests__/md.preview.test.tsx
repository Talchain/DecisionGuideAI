import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import React from 'react'

// Flags: enable SSE + Markdown preview
vi.mock('../../flags', () => ({
  isSseEnabled: () => true,
  isRunReportEnabled: () => false,
  isConfidenceChipsEnabled: () => false,
  isTelemetryEnabled: () => false,
  isHintsEnabled: () => false,
  isParamsEnabled: () => false,
  isHistoryEnabled: () => false,
  isExportEnabled: () => false,
  isMarkdownPreviewEnabled: () => true,
  isShortcutsEnabled: () => false,
  isHistoryRerunEnabled: () => false,
  isCopyCodeEnabled: () => false,
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

describe('Markdown preview', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.instances = []
    FakeEventSource.install()
    try { localStorage.setItem('feature.streamBuffer', '1') } catch {}
  })

  it('allows only safe links and blocks javascript: URLs', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    fireEvent.click(screen.getByTestId('start-btn'))
    const es = FakeEventSource.instances[0]

    act(() => { es.emit('open'); es.emit('token', '[ok](https://example.com) [mailto](mailto:hi@example.com) [bad](javascript:alert(1))', '1') })
    await Promise.resolve(); await Promise.resolve()

    const html = screen.getByTestId('md-preview').innerHTML
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('href="mailto:hi@example.com"')
    // javascript: is rewritten to '#'
    expect(html).toContain('href="#"')
  })
  afterEach(() => {
    cleanup()
    FakeEventSource.uninstall()
    vi.useRealTimers()
  })

  let savedRAF: any
  beforeEach(() => {
    savedRAF = (globalThis as any).requestAnimationFrame
    ;(globalThis as any).requestAnimationFrame = undefined
  })
  afterEach(() => {
    ;(globalThis as any).requestAnimationFrame = savedRAF
  })

  it('updates on microtask flush when buffer is ON', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    fireEvent.click(screen.getByTestId('start-btn'))
    const es = FakeEventSource.instances[0]

    act(() => { es.emit('open'); es.emit('token', 'Hello', '1') })
    // Before flush
    expect(screen.getByTestId('md-preview').innerHTML).toBe('')

    // Allow microtask flush
    await Promise.resolve(); await Promise.resolve()

    expect(screen.getByTestId('md-preview').innerHTML).toContain('Hello')
  })

  it('sanitizes HTML content', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    fireEvent.click(screen.getByTestId('start-btn'))
    const es = FakeEventSource.instances[0]

    act(() => { es.emit('open'); es.emit('token', '<script>alert(1)</script>', '1') })
    await Promise.resolve(); await Promise.resolve()

    const html = screen.getByTestId('md-preview').innerHTML
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script>')
  })

  it('updates on terminal flush when buffer is OFF', async () => {
    try { localStorage.setItem('feature.streamBuffer', '0') } catch {}
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    fireEvent.click(screen.getByTestId('start-btn'))
    const es = FakeEventSource.instances[0]
    act(() => { es.emit('open'); es.emit('token', '# Title', '1') })

    // Without flush, preview should still be empty
    await Promise.resolve(); await Promise.resolve()
    expect(screen.getByTestId('md-preview').innerHTML).toBe('')

    act(() => { es.emit('done') })
    await Promise.resolve(); await Promise.resolve()
    expect(screen.getByTestId('md-preview').innerHTML).toContain('<h1>Title</h1>')
  })
})
