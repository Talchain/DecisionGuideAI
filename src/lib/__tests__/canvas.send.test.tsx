import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import React from 'react'
import { mockFlags } from '../../tests/__helpers__/mockFlags'

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

describe('Send to Canvas', () => {
  beforeEach(() => {
    vi.resetModules()
    mockFlags({ isSseEnabled: () => true, isCanvasEnabled: () => true })
    try { localStorage.clear() } catch {}
    FakeEventSource.instances = []
    FakeEventSource.install()
  })
  afterEach(() => {
    FakeEventSource.uninstall()
    cleanup()
  })

  it('shows Send to Canvas on Done and adds a note to shim surface', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    // Begin
    fireEvent.click(screen.getByTestId('start-btn'))
    const es = FakeEventSource.instances[0]

    // Emit tokens and done
    act(() => { es.emit('open'); es.emit('token', 'Hello world'); es.emit('done') })

    // Button should appear now
    const btn = await screen.findByTestId('canvas-send-btn')
    fireEvent.click(btn)

    // Drawer opens and note appears
    await screen.findByTestId('canvas-drawer')
    await new Promise((r) => setTimeout(r, 0))
    const notes = screen.getAllByTestId('canvas-note')
    expect(notes.length).toBeGreaterThanOrEqual(1)
    expect(notes[0].textContent || '').toContain('Run:')
    expect(notes[0].textContent || '').toContain('Hello world')
  })
})
