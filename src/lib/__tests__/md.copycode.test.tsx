import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import React from 'react'

// Flags OFF -> no copy buttons

describe('Markdown Copy Code (flags OFF)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    try { localStorage.setItem('feature.streamBuffer', '1') } catch {}
    // Ensure md preview OFF
    vi.resetModules()
    vi.doMock('../../flags', () => ({
      isSseEnabled: () => true,
      isRunReportEnabled: () => false,
      isJobsProgressEnabled: () => false,
      isConfigDrawerEnabled: () => false,
      isCanvasEnabled: () => false,
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
  })
  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('does not render copy buttons when preview/copy flags are OFF', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)
    expect(screen.queryByTestId('copy-code-btn')).toBeNull()
  })
})

// Flags ON -> copy works

describe('Markdown Copy Code (flags ON)', () => {
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

  let savedRAF: any
  let writeSpy: any

  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
    FakeEventSource.instances = []
    FakeEventSource.install()
    try {
      localStorage.setItem('feature.streamBuffer', '1')
      localStorage.setItem('feature.mdPreview', '1')
      localStorage.setItem('feature.copyCode', '1')
    } catch {}

    vi.doMock('../../flags', () => ({
      isSseEnabled: () => true,
      isRunReportEnabled: () => false,
      isJobsProgressEnabled: () => false,
      isConfigDrawerEnabled: () => false,
      isCanvasEnabled: () => false,
      isConfidenceChipsEnabled: () => false,
      isTelemetryEnabled: () => false,
      isHintsEnabled: () => false,
      isParamsEnabled: () => false,
      isHistoryEnabled: () => false,
      isHistoryRerunEnabled: () => false,
      isExportEnabled: () => false,
      isMarkdownPreviewEnabled: () => true,
      isShortcutsEnabled: () => false,
      isCopyCodeEnabled: () => true,
      isScenariosEnabled: () => false,
    }))

    savedRAF = (globalThis as any).requestAnimationFrame
    ;(globalThis as any).requestAnimationFrame = undefined

    const nav: any = (globalThis as any).navigator || {}
    if (!nav.clipboard) nav.clipboard = {}
    writeSpy = vi.fn().mockResolvedValue(undefined)
    nav.clipboard.writeText = writeSpy
    ;(globalThis as any).navigator = nav
  })
  afterEach(() => {
    ;(globalThis as any).requestAnimationFrame = savedRAF
    FakeEventSource.uninstall()
    vi.useRealTimers()
    vi.restoreAllMocks()
    cleanup()
  })

  it('renders copy buttons for fenced blocks and copies exact code', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    fireEvent.click(screen.getByTestId('start-btn'))
    const es = FakeEventSource.instances[0]

    const md = [
      'Here is a sample:',
      '```js',
      'const x = 1;',
      'console.log(x);',
      '```',
    ].join('\n')

    act(() => { es.emit('open'); es.emit('token', md, '1'); es.emit('done') })

    // Allow microtask flush and async effects (md preview + copy overlays)
    await Promise.resolve(); await Promise.resolve()
    await vi.advanceTimersByTimeAsync(0)

    const btn = screen.getByTestId('copy-code-btn') as HTMLButtonElement
    expect(btn).toBeTruthy()
    expect(btn.textContent).toBe('Copy')

    await act(async () => {
      fireEvent.click(btn)
      await Promise.resolve()
    })
    expect(writeSpy).toHaveBeenCalledTimes(1)
    expect(writeSpy.mock.calls[0][0]).toBe('const x = 1;\nconsole.log(x);')

    // ARIA live status announces and then clears
    await Promise.resolve(); await Promise.resolve()
    expect(screen.getByTestId('copy-aria-status').textContent).toBe('Copied')
    await vi.advanceTimersByTimeAsync(1300)
    expect(screen.getByTestId('copy-aria-status').textContent).toBe('')
  })
})
