import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

describe('JobsProgressPanel list + cancel', () => {
  const realFetch = (globalThis as any).fetch
  beforeEach(() => {
    vi.useFakeTimers()
    ;(globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true })
    vi.resetModules()
  })
  afterEach(() => {
    ;(globalThis as any).fetch = realFetch
    vi.useRealTimers()
  })

  function installES() {
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
    return FakeEventSource
  }

  it('flag ON: renders list, status transitions, cancel only when active', async () => {
    vi.resetModules()
    vi.doMock('../../flags', () => ({ isJobsProgressEnabled: () => true, isScenariosEnabled: () => false }))
    const FakeES = installES()
    FakeES.install()
    const { default: JobsProgressPanel } = await import('../../components/JobsProgressPanel')
    const { unmount } = render(<JobsProgressPanel />)

    // Stream starts on mount
    expect(FakeES.instances.length).toBe(1)
    const es = FakeES.instances[0]
    act(() => { es.emit('open') })

    // Initially queued
    expect(!!screen.getByTestId('jobs-list')).toBe(true)
    expect(screen.getByTestId('job-status').textContent).toBe('Queued')

    // Running shows Cancel
    act(() => { es.emit('running') })
    expect(screen.getByTestId('job-status').textContent).toBe('Running')
    // jobs-list should be aria-live polite
    expect(screen.getByTestId('jobs-list').getAttribute('aria-live')).toBe('polite')
    const cancelBtn = screen.getByTestId('job-cancel-btn')
    fireEvent.click(cancelBtn)
    expect((globalThis as any).fetch).toHaveBeenCalledTimes(1)

    // Server may echo cancelled; Cancel button should be hidden
    act(() => { es.emit('cancelled') })
    expect(screen.getByTestId('job-status').textContent).toBe('Cancelled')
    expect(screen.queryByTestId('job-cancel-btn')).toBeNull()

    FakeES.uninstall()
    unmount()
  })

  it('flag OFF: does not render jobs-list', async () => {
    vi.resetModules()
    vi.doMock('../../flags', () => ({ isJobsProgressEnabled: () => false, isScenariosEnabled: () => false }))
    const FakeES = installES(); FakeES.install()
    const { default: JobsProgressPanel } = await import('../../components/JobsProgressPanel')
    const { unmount } = render(<JobsProgressPanel />)
    expect(screen.queryByTestId('jobs-list')).toBeNull()
    FakeES.uninstall(); unmount()
  })
})
