import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { mockFlags } from '../../tests/__helpers__/mockFlags'

// Minimal FakeEventSource so panel can Start without network
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

describe('Canvas Drawer (shim)', () => {
  beforeEach(() => {
    vi.resetModules()
    mockFlags({
      isSseEnabled: () => true,
      isCanvasEnabled: () => true,
      isConfigDrawerEnabled: () => true,
      isRunReportEnabled: () => true,
      isMarkdownPreviewEnabled: () => true,
    })
    try { localStorage.clear() } catch {}
    FakeEventSource.instances = []
    FakeEventSource.install()
  })
  afterEach(() => {
    FakeEventSource.uninstall()
    cleanup()
  })

  it('flags OFF ⇒ no canvas button (sanity via remock)', async () => {
    vi.resetModules()
    mockFlags({ isSseEnabled: () => true, isCanvasEnabled: () => false, isConfigDrawerEnabled: () => false })
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))
    await Promise.resolve()
    expect(screen.queryByTestId('canvas-btn')).toBeNull()
  })

  it('open/close via button and Esc returns focus', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    const btn = (await screen.findByTestId('canvas-btn')) as HTMLButtonElement
    btn.focus()
    fireEvent.click(btn)
    const drawer = await screen.findByTestId('canvas-drawer')
    expect(drawer).toBeTruthy()

    // Esc closes and focus returns
    fireEvent.keyDown(document, { key: 'Escape' })
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByTestId('canvas-drawer')).toBeNull()
    expect(btn).toBe(document.activeElement)
  })

  it('autosave ON: note persists across reload; Clear wipes', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    const view = render(React.createElement(SandboxStreamPanel))

    // Start a run and immediately finish it
    fireEvent.click(screen.getByTestId('start-btn'))
    // Emit done to surface send button
    const es = FakeEventSource.instances[0]
    es.emit('done')

    // Send to canvas
    const sendBtn = await screen.findByTestId('canvas-send-btn')
    fireEvent.click(sendBtn)

    // Drawer open and note exists
    const drawer = await screen.findByTestId('canvas-drawer')
    expect(drawer).toBeTruthy()
    // Allow addNote microtask
    await Promise.resolve()
    const notes1 = screen.getAllByTestId('canvas-note')
    expect(notes1.length).toBeGreaterThanOrEqual(1)

    // Unmount and remount component
    view.unmount()
    const view2 = render(React.createElement(SandboxStreamPanel))
    // Open drawer again
    fireEvent.click((await view2.findByTestId('canvas-btn')))
    await view2.findByTestId('canvas-drawer')
    const notes2 = await view2.findAllByTestId('canvas-note')
    expect(notes2.length).toBeGreaterThanOrEqual(1)

    // Clear (confirm OK)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(view2.getByTestId('canvas-clear-btn'))
    await new Promise((r) => setTimeout(r, 0))
    expect(view2.queryAllByTestId('canvas-note').length).toBe(0)
  })
})
