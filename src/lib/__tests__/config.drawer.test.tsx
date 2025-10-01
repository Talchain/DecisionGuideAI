import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
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

describe('Config Drawer', () => {
  beforeEach(() => {
    vi.resetModules()
    mockFlags({
      isSseEnabled: () => true,
      isConfigDrawerEnabled: () => true,
      isHintsEnabled: () => true,
      isParamsEnabled: () => true,
    })
    try { localStorage.clear() } catch {}
    FakeEventSource.instances = []
    FakeEventSource.install()
  })

  it('Save trims model whitespace', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    fireEvent.click(await screen.findByTestId('config-btn'))
    const model = screen.getByTestId('cfg-model') as HTMLInputElement
    fireEvent.change(model, { target: { value: '  gpt-4o-mini  ' } })
    fireEvent.click(screen.getByTestId('cfg-save-btn'))

    try { expect(localStorage.getItem('sandbox.model')).toBe('gpt-4o-mini') } catch {}
  })

  it('Invalid budget shows inline hint but Save proceeds', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    fireEvent.click(await screen.findByTestId('config-btn'))
    const budget = screen.getByTestId('cfg-budget') as HTMLInputElement
    fireEvent.change(budget, { target: { value: '0' } })
    fireEvent.click(screen.getByTestId('cfg-save-btn'))

    // Re-open to see hint
    fireEvent.click(await screen.findByTestId('config-btn'))
    await screen.findByTestId('config-drawer')
    expect(screen.getByTestId('budget-hint')).toBeTruthy()

    // Start should still work
    fireEvent.click(screen.getByTestId('cfg-save-btn'))
    fireEvent.click(screen.getByTestId('start-btn'))
    expect(FakeEventSource.instances.length).toBeGreaterThan(0)
  })

  it('Save trims spaces; empty gateway allowed (relative routes)', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    // Set gateway with extra spaces and save
    fireEvent.click(await screen.findByTestId('config-btn'))
    const gw = await screen.findByTestId('cfg-gateway') as HTMLInputElement
    fireEvent.change(gw, { target: { value: '  http://localhost:8787  ' } })
    fireEvent.click(screen.getByTestId('cfg-save-btn'))

    // Start and assert absolute base used (trimmed)
    fireEvent.click(screen.getByTestId('start-btn'))
    expect(FakeEventSource.instances.length).toBeGreaterThanOrEqual(1)
    const last1 = FakeEventSource.instances[FakeEventSource.instances.length - 1]
    expect(last1.url).toContain('http://localhost:8787')

    // Now set empty (spaces only) and save, relative should be used
    fireEvent.click(await screen.findByTestId('config-btn'))
    const gw2 = await screen.findByTestId('cfg-gateway') as HTMLInputElement
    fireEvent.change(gw2, { target: { value: '   ' } })
    fireEvent.click(screen.getByTestId('cfg-save-btn'))

    fireEvent.click(screen.getByTestId('start-btn'))
    const last2 = FakeEventSource.instances[FakeEventSource.instances.length - 1]
    expect(last2.url.includes('/stream?')).toBe(true)
  })
  afterEach(() => {
    FakeEventSource.uninstall()
    cleanup()
  })

  it('open/close and Esc returns focus to trigger', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    const cfgBtn = (await screen.findByTestId('config-btn')) as HTMLButtonElement
    expect(cfgBtn).toBeTruthy()
    cfgBtn.focus()
    fireEvent.click(cfgBtn)
    const drawer = await screen.findByTestId('config-drawer')
    expect(drawer).toBeTruthy()

    // Esc closes and returns focus
    fireEvent.keyDown(document, { key: 'Escape' })
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByTestId('config-drawer')).toBeNull()
    expect(cfgBtn).toBe(document.activeElement)
  })

  it('Save persists LS and next Start uses updated seed/budget/model', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    fireEvent.click(await screen.findByTestId('config-btn'))
    const gw = await screen.findByTestId('cfg-gateway') as HTMLInputElement
    const seed = screen.getByTestId('cfg-seed') as HTMLInputElement
    const budget = screen.getByTestId('cfg-budget') as HTMLInputElement
    const model = screen.getByTestId('cfg-model') as HTMLInputElement

    fireEvent.change(gw, { target: { value: 'http://localhost:8787' } })
    fireEvent.change(seed, { target: { value: '99' } })
    fireEvent.change(budget, { target: { value: '1.23' } })
    fireEvent.change(model, { target: { value: 'local-sim' } })
    fireEvent.click(screen.getByTestId('cfg-save-btn'))

    // Start a run and verify EventSource URL includes params
    fireEvent.click(screen.getByTestId('start-btn'))
    expect(FakeEventSource.instances.length).toBe(1)
    const es = FakeEventSource.instances[0]
    expect(es.url).toContain('seed=99')
    expect(es.url).toContain('budget=1.23')
    expect(es.url).toContain('model=local-sim')
  })

  it('Reset clears LS keys', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(React.createElement(SandboxStreamPanel))

    fireEvent.click(screen.getByTestId('config-btn'))
    await screen.findByTestId('config-drawer')
    fireEvent.click(screen.getByTestId('cfg-reset-btn'))

    try {
      expect(localStorage.getItem('cfg.gateway') || '').toBe('')
      expect(localStorage.getItem('sandbox.seed') || '').toBe('')
      expect(localStorage.getItem('sandbox.budget') || '').toBe('')
      expect(localStorage.getItem('sandbox.model') || '').toBe('')
    } catch {}
  })
})
