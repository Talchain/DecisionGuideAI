import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
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

describe('Replay chip tooltip', () => {
  beforeEach(() => {
    vi.resetModules()
    mockFlags({ isSseEnabled: () => true, isParamsEnabled: () => true, isReplayEnabled: () => true })
    try { localStorage.setItem('feature.replay', '1') } catch {}
    FakeEventSource.instances = []
    FakeEventSource.install()
  })
  afterEach(() => {
    FakeEventSource.uninstall()
    cleanup()
  })

  it('shows a title with "Replayed from " and a local time', async () => {
    const { default: SandboxStreamPanel } = await import('../../components/SandboxStreamPanel')
    render(<SandboxStreamPanel />)

    const seedInput = screen.getByTestId('param-seed') as HTMLInputElement
    fireEvent.change(seedInput, { target: { value: '42' } })
    fireEvent.click(screen.getByTestId('start-btn'))
    const first = FakeEventSource.instances[0]
    act(() => { first.emit('open'); first.emit('done') })

    const replayBtn = await screen.findByTestId('replay-btn')
    fireEvent.click(replayBtn)

    const chip = await screen.findByTestId('replayed-chip')
    const title = chip.getAttribute('title') || ''
    expect(title.startsWith('Replayed from ')).toBe(true)
  })
})
