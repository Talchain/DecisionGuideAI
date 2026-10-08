import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'

const EPOCH = 'olumi-canvas-identity-epoch'
const WORDS = 'Someone signed in or out in another tab. Reload this tab to carry on.'
let Lock: ComponentType
let scenarios: typeof import('../../../canvas/store/scenarios')

beforeEach(async () => {
  cleanup()
  vi.resetModules()
  localStorage.clear()
  localStorage.setItem(EPOCH, 'era-A|owner:A')
  scenarios = await import('../../../canvas/store/scenarios')
  Lock = (await import('../StaleTabLock')).default
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

function mount() {
  return render(<><button>Underlying control</button><Lock /></>)
}
function rotate() { localStorage.setItem(EPOCH, 'era-B|owner:B') }
function epochEvent() { fireEvent(window, new StorageEvent('storage', { key: EPOCH })) }

describe('S-G2 sticky tab lock', () => {
  it.each(['mount', 'storage', 'visible', 'focus'] as const)('detects a stale tab on %s', trigger => {
    if (trigger === 'mount') rotate()
    mount()
    if (trigger !== 'mount') {
      rotate()
      if (trigger === 'storage') epochEvent()
      if (trigger === 'visible') {
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
        fireEvent(document, new Event('visibilitychange'))
      }
      if (trigger === 'focus') fireEvent(window, new Event('focus'))
    }
    const dialog = screen.getByRole('alertdialog', { name: WORDS })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Reload' })).toHaveFocus()
  })

  it('never unlocks when storage recovers or this tab adopts an era after it locked', () => {
    mount()
    rotate()
    epochEvent()
    localStorage.setItem(EPOCH, 'era-A|owner:A')
    epochEvent()
    scenarios.adoptIdentityEpochAtSignIn('A')
    fireEvent(window, new Event('focus'))
    expect(screen.getByRole('alertdialog', { name: WORDS })).toBeInTheDocument()
  })

  it('blocks pointer events, saved-focus keypresses, ⌘S and palette shortcuts; traps focus', () => {
    const click = vi.fn()
    const key = vi.fn()
    const shortcut = vi.fn()
    const view = render(<><button onClick={click} onKeyDown={key}>Underlying control</button><Lock /></>)
    const underneath = screen.getByRole('button', { name: 'Underlying control' })
    underneath.focus()
    window.addEventListener('keydown', shortcut)
    try {
      rotate()
      epochEvent()
      const reload = screen.getByRole('button', { name: 'Reload' })
      fireEvent.pointerDown(underneath)
      fireEvent.click(underneath)
      fireEvent.keyDown(underneath, { key: 'Enter' })
      fireEvent.keyDown(window, { key: 's', metaKey: true })
      fireEvent.keyDown(reload, { key: 'k', metaKey: true })
      fireEvent.keyDown(reload, { key: 'Tab', shiftKey: true })
      underneath.focus()
      expect(reload).toHaveFocus()
      expect(click).not.toHaveBeenCalled()
      expect(key).not.toHaveBeenCalled()
      expect(shortcut).not.toHaveBeenCalled()
      expect(view.container).toHaveAttribute('inert')
    } finally { window.removeEventListener('keydown', shortcut) }
  })

  it('Reload calls location.reload once', () => {
    const reload = vi.fn()
    mount()
    rotate()
    epochEvent()
    vi.stubGlobal('location', { reload })
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('queued auth adoption for A in B’s era immediately locks without a storage event', () => {
    mount()
    rotate()
    act(() => { expect(scenarios.adoptIdentityEpochAtSignIn('A')).toBe(false) })
    expect(screen.getByRole('alertdialog', { name: WORDS })).toBeInTheDocument()
    expect(localStorage.getItem(EPOCH)).toBe('era-B|owner:B')
  })

  it('readable removal of a held epoch locks', () => {
    mount()
    localStorage.removeItem(EPOCH)
    epochEvent()
    expect(screen.getByRole('alertdialog', { name: WORDS })).toBeInTheDocument()
  })

  it('a hidden visibility transition waits until visible', () => {
    mount()
    rotate()
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    visibility.mockReturnValue('visible')
    fireEvent(document, new Event('visibilitychange'))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
  })

  it('unreadable boot storage never locks', async () => {
    vi.resetModules()
    const get = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      if (key === EPOCH) throw new Error('read refused')
      return get.call(this, key)
    })
    scenarios = await import('../../../canvas/store/scenarios')
    Lock = (await import('../StaleTabLock')).default
    mount()
    epochEvent()
    fireEvent(window, new Event('focus'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('S-G2 round 2 P1: A sign-in rejected after both boot reads fail shows Reload when storage recovers', async () => {
    vi.resetModules()
    localStorage.setItem(EPOCH, 'guest-era|owner:none')
    const get = Storage.prototype.getItem
    const refused = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      if (key === EPOCH) throw new Error('Both boot reads refused')
      return get.call(this, key)
    })
    scenarios = await import('../../../canvas/store/scenarios')
    Lock = (await import('../StaleTabLock')).default
    mount()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    refused.mockRestore()

    act(() => { expect(scenarios.adoptIdentityEpochAtSignIn('A')).toBe(false) })

    expect(screen.getByRole('alertdialog', { name: WORDS })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toHaveFocus()
    expect(localStorage.getItem(EPOCH)).toBe('guest-era|owner:none')
  })

  it('CONTROL P2: a witnessed unreadable boot recovers unchanged without auth, stays unlocked and saves', async () => {
    vi.resetModules()
    localStorage.setItem(EPOCH, 'unchanged-guest-era|owner:none')
    const get = Storage.prototype.getItem
    let refused = false
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
      if (key === EPOCH && !refused) {
        refused = true
        throw new Error('First boot read refused')
      }
      return get.call(this, key)
    })
    scenarios = await import('../../../canvas/store/scenarios')
    Lock = (await import('../StaleTabLock')).default
    mount()
    fireEvent(window, new Event('focus'))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(scenarios.saveAutosave({ timestamp: 1, nodes: [], edges: [] })).toBe(true)
    expect(JSON.parse(localStorage.getItem('olumi-canvas-autosave') ?? 'null')?.identityEpoch).toBe('unchanged-guest-era|owner:none')
  })

  it.each(['fresh boot', 'own sign-out then work', 'matching owner sign-in', 'held-era first sign-in', 'current refresh', 'unrelated key', 'unreadable'] as const)('CONTROL: %s never locks', async control => {
    if (control === 'fresh boot') {
      localStorage.clear()
      vi.resetModules()
      scenarios = await import('../../../canvas/store/scenarios')
      Lock = (await import('../StaleTabLock')).default
    }
    mount()
    act(() => {
      if (control === 'own sign-out then work') {
        scenarios.crossIdentityBoundaryInThisTab('own-signout', null)
        expect(scenarios.saveAutosave({ timestamp: 1, nodes: [], edges: [] })).toBe(true)
      }
      if (control === 'matching owner sign-in') {
        localStorage.setItem(EPOCH, 'owned-A|owner:A')
        scenarios.adoptIdentityEpochAtSignIn('A')
      }
      if (control === 'held-era first sign-in' || control === 'current refresh') scenarios.adoptIdentityEpochAtSignIn('A')
      if (control === 'unrelated key') {
        rotate()
        fireEvent(window, new StorageEvent('storage', { key: 'unrelated' }))
        return
      }
      if (control === 'unreadable') {
        const get = Storage.prototype.getItem
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key) {
          if (key === EPOCH) throw new Error('read refused')
          return get.call(this, key)
        })
      }
      fireEvent(window, new Event('focus'))
    })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
