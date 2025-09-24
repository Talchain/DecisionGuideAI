import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import React from 'react'

// Enable SSE + Export + Params; RunReport can be OFF
vi.mock('../../flags', () => ({
  isSseEnabled: () => true,
  isRunReportEnabled: () => false,
  isConfidenceChipsEnabled: () => false,
  isTelemetryEnabled: () => false,
  isHintsEnabled: () => false,
  isParamsEnabled: () => true,
  isHistoryEnabled: () => false,
  isHistoryRerunEnabled: () => false,
  isExportEnabled: () => true,
  isMarkdownPreviewEnabled: () => false,
  isShortcutsEnabled: () => false,
  isCopyCodeEnabled: () => false,
}))

let triggerSpy: ReturnType<typeof vi.fn>
vi.mock('../../lib/export', async (importOriginal) => {
  const actual: any = await importOriginal()
  triggerSpy = vi.fn()
  return { ...actual, triggerDownload: triggerSpy }
})

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

describe('Export transcript', () => {
  const clickSpy = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    FakeEventSource.instances = []
    FakeEventSource.install()
    // URL methods not needed when mocking triggerDownload
    // Shim anchor click using the original createElement
    const origCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(((tag: any) => {
      const el = origCreate(tag) as any
      if (tag === 'a') { el.click = clickSpy }
      return el
    }) as any)
    try { window.localStorage.setItem('feature.streamBuffer', '0') } catch {}
  })
  afterEach(() => {
    cleanup()
    FakeEventSource.uninstall()
    vi.useRealTimers()
    ;(document.createElement as any).mockRestore?.()
    clickSpy.mockReset()
  })

  it('happy path export .txt contains metadata and transcript', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    fireEvent.change(screen.getByTestId('param-seed'), { target: { value: '42' } })
    fireEvent.change(screen.getByTestId('param-budget'), { target: { value: '3.5' } })
    fireEvent.change(screen.getByTestId('param-model'), { target: { value: 'local-sim' } })

    fireEvent.click(screen.getByTestId('start-btn'))
    const es = FakeEventSource.instances[0]
    act(() => {
      es.emit('open')
      es.emit('token', 'Hel', '1')
      es.emit('token', 'lo', '2')
      es.emit('token', '!', '3')
      es.emit('cost', '0.02', 'c')
      es.emit('done')
    })

    await vi.advanceTimersByTimeAsync(0)
    fireEvent.click(screen.getByTestId('export-txt'))
    await vi.advanceTimersByTimeAsync(0)
    expect(triggerSpy).toHaveBeenCalled()
    const args = triggerSpy.mock.calls.at(-1)!
    const txt = args[2] as string
    expect(txt).toContain('DecisionGuideAI transcript')
    expect(txt).toContain('Status: Done')
    expect(txt).toContain('Cost: £0.02')
    expect(txt).toContain('Seed: 42')
    expect(txt).toContain('Model: local-sim')
    expect(txt.trim().endsWith('Hello!')).toBe(true)
  })

  it('JSON export has meta and token list', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    fireEvent.change(screen.getByTestId('param-seed'), { target: { value: '42' } })
    fireEvent.change(screen.getByTestId('param-budget'), { target: { value: '3.5' } })
    fireEvent.change(screen.getByTestId('param-model'), { target: { value: 'local-sim' } })

    fireEvent.click(screen.getByTestId('start-btn'))
    const es = FakeEventSource.instances[0]
    act(() => {
      es.emit('open')
      es.emit('token', 'Hel', '1')
      es.emit('token', 'lo', '2')
      es.emit('token', '!', '3')
      es.emit('done')
    })

    fireEvent.click(screen.getByTestId('export-json'))
    await vi.advanceTimersByTimeAsync(0)
    const args = triggerSpy.mock.calls.at(-1)!
    const text = args[2] as string
    const obj = JSON.parse(text)
    expect(obj.meta.status).toBe('done')
    expect(obj.meta.seed).toBe('42')
    expect(obj.transcript.text).toBe('Hello!')
    expect(obj.transcript.tokens).toEqual([
      { id: '1', text: 'Hel' },
      { id: '2', text: 'lo' },
      { id: '3', text: '!' },
    ])
  })

  it('Stop → Aborted gating excludes tokens after stop', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    fireEvent.click(screen.getByTestId('start-btn'))
    const es = FakeEventSource.instances[0]
    act(() => {
      es.emit('open')
      es.emit('token', 'A', '1')
      es.emit('token', 'B', '2')
    })

    // Stop user-side; panel shows Cancelled immediately
    fireEvent.click(screen.getByTestId('stop-btn'))
    expect(screen.getByTestId('status-chip').textContent).toBe('Cancelled')

    // Server emits a late token and then Aborted terminal; token must be gated
    act(() => {
      es.emit('token', 'C', '3')
      es.emit('aborted')
    })

    // Export .txt and ensure transcript excludes 'C'
    fireEvent.click(screen.getByTestId('export-txt'))
    await vi.advanceTimersByTimeAsync(0)

    fireEvent.click(screen.getByTestId('export-txt'))
    await vi.advanceTimersByTimeAsync(0)
    const args = triggerSpy.mock.calls.at(-1)!
    const text = args[2] as string
    expect(text.endsWith('\nAB')).toBe(true)
  })

  it('export buttons hidden when not terminal', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    // Idle: no export buttons
    expect(screen.queryByTestId('export-txt')).toBeNull()
    expect(screen.queryByTestId('export-json')).toBeNull()

    fireEvent.click(screen.getByTestId('start-btn'))
    // Streaming: still none
    expect(screen.queryByTestId('export-txt')).toBeNull()
    expect(screen.queryByTestId('export-json')).toBeNull()

    const es = FakeEventSource.instances[0]
    act(() => { es.emit('open'); es.emit('done') })

    // Terminal: buttons appear
    expect(screen.getByTestId('export-txt')).toBeTruthy()
    expect(screen.getByTestId('export-json')).toBeTruthy()
  })
})
