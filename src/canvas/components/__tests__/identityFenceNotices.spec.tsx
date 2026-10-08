/**
 * DGAI #2646: the real Save entry points and periodic autosave disclose a refused identity write.
 * A registry is a tab, as in staleTabIdentityFence.spec.ts. No store action, identity reader, persistence writer or
 * toast bridge is mocked; only React Flow's unused camera host is supplied for the palette.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>()
  return {
    ...actual,
    useReactFlow: () => ({ getNodes: () => [], getNodesBounds: vi.fn(), setViewport: vi.fn() }),
  }
})

const EPOCH_KEY = 'olumi-canvas-identity-epoch'
const SLOT = 'olumi-canvas-autosave'
const A_ID = 'aaaaaaaa-0000-4000-8000-00000000000a'
const STALE = 'Someone signed in or out in another tab, so this tab can no longer save. Changes made here since then were not saved, and reloading will discard them. Reload this tab to carry on.'
const UNREADABLE = 'This browser is not letting Olumi save right now, so this change was not saved.'

async function bootTab() {
  vi.resetModules()
  const scenarios = await import('../../store/scenarios')
  const auth = await import('../../../lib/auth/userScopedState')
  const { useCanvasStore: store } = await import('../../store')
  return { scenarios, auth, store }
}

async function bootGuestUi() {
  const tab = await bootTab()
  const { useKeyboardShortcuts } = await import('../../useKeyboardShortcuts')
  const { useAutosave } = await import('../../hooks/useAutosave')
  const { useCanvasNoticeBridge } = await import('../../hooks/useCanvasNoticeBridge')
  const { ToastProvider, useToast } = await import('../../ToastContext')
  const { CommandPalette } = await import('../CommandPalette')
  const { SnapshotManager } = await import('../SnapshotManager')
  tab.store.setState({
    currentScenarioId: A_ID,
    nodes: [{ id: 'a-private-node', type: 'decision', position: { x: 1, y: 1 }, data: { label: 'A private' } }],
    edges: [],
    isDirty: true,
  })
  return { ...tab, useKeyboardShortcuts, useAutosave, useCanvasNoticeBridge, ToastProvider, useToast, CommandPalette, SnapshotManager }
}

async function signInThenOutInAnotherTab() {
  const other = await bootTab()
  other.auth.adoptIdentityEpochAtSignIn()
  other.auth.clearUserScopedState(null)
  return other
}

type GuestUi = Awaited<ReturnType<typeof bootGuestUi>>

/** The production bridge feeds the production ToastProvider; the assertion reads the visible alert. */
function mountHost(tab: GuestUi, mode: 'keyboard' | 'palette' | 'autosave' | 'snapshot') {
  function Host() {
    const { showToast } = tab.useToast()
    tab.useCanvasNoticeBridge(showToast)
    if (mode === 'keyboard') tab.useKeyboardShortcuts()
    if (mode === 'autosave') tab.useAutosave()
    if (mode === 'palette') return <tab.CommandPalette isOpen onClose={vi.fn()} />
    if (mode === 'snapshot') return <tab.SnapshotManager isOpen onClose={vi.fn()} />
    return null
  }
  return render(<tab.ToastProvider><Host /></tab.ToastProvider>)
}

function advanceAutosaveCycle() {
  act(() => { vi.advanceTimersByTime(30_000) })
  act(() => { vi.advanceTimersByTime(500) })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('identity fences answer the real Save entry points', () => {
  it('⌘S in the stale guest reaches the store action and shows the exact stale toast', async () => {
    const guest = await bootGuestUi()
    await signInThenOutInAnotherTab()
    expect(guest.scenarios.getIdentityWriteBlockReason(), 'precondition: this guest registry missed the boundary').toBe('stale')
    const save = vi.spyOn(guest.store.getState(), 'saveSnapshot')
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    mountHost(guest, 'keyboard')

    const key = new KeyboardEvent('keydown', { key: 's', metaKey: true, cancelable: true })
    act(() => { window.dispatchEvent(key) })

    expect(key.defaultPrevented).toBe(true)
    expect(save).toHaveBeenCalledOnce()
    expect(save.mock.results[0].value).toBe(false)
    expect(screen.getByRole('alert')).toHaveTextContent(STALE)
    expect(Object.keys(localStorage).filter((key) => key.startsWith('canvas-snapshot-'))).toEqual([])
  })

  it('palette Save Snapshot in the stale guest reaches the store action and shows the same toast', async () => {
    const guest = await bootGuestUi()
    await signInThenOutInAnotherTab()
    const save = vi.spyOn(guest.store.getState(), 'saveSnapshot')
    mountHost(guest, 'palette')
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Save Snapshot/ }))

    expect(save).toHaveBeenCalledOnce()
    expect(save.mock.results[0].value).toBe(false)
    expect(screen.getByRole('alert')).toHaveTextContent(STALE)
  })

  it('SnapshotManager says stale only for a missed identity boundary', async () => {
    const guest = await bootGuestUi()
    await signInThenOutInAnotherTab()
    mountHost(guest, 'snapshot')
    fireEvent.click(screen.getByRole('button', { name: '💾 Save Current Canvas' }))
    expect(screen.getByRole('alert')).toHaveTextContent(STALE)
    expect(screen.getByRole('alert')).not.toHaveTextContent(UNREADABLE)
  })

  it('SnapshotManager says unreadable when storage refuses the epoch read', async () => {
    const guest = await bootGuestUi()
    mountHost(guest, 'snapshot')
    const getItem = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === EPOCH_KEY) throw new DOMException('Storage refused the read', 'SecurityError')
      return getItem.call(this, key)
    })
    expect(guest.scenarios.getIdentityWriteBlockReason(), 'precondition: this is a read refusal, with no other tab').toBe('unreadable')

    fireEvent.click(screen.getByRole('button', { name: '💾 Save Current Canvas' }))

    expect(screen.getByRole('alert')).toHaveTextContent(UNREADABLE)
    expect(screen.getByRole('alert')).not.toHaveTextContent(STALE)
  })

  it('⌘S also reports unreadable storage without claiming another tab changed identity', async () => {
    const guest = await bootGuestUi()
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    mountHost(guest, 'keyboard')
    const getItem = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === EPOCH_KEY) throw new DOMException('Storage refused the read', 'SecurityError')
      return getItem.call(this, key)
    })

    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true })) })

    expect(screen.getByRole('alert')).toHaveTextContent(UNREADABLE)
    expect(screen.getByRole('alert')).not.toHaveTextContent(STALE)
  })
})

describe('autosave discloses a fence once per tab per fenced era', () => {
  it('a refused permission read is one unreadable era even when an extra notice read would succeed once', async () => {
    localStorage.setItem(EPOCH_KEY, 'unchanged-guest-era')
    const guest = await bootGuestUi()
    mountHost(guest, 'keyboard')
    const getItem = Storage.prototype.getItem
    let attempt = 0
    let readsThisAttempt = 0
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key !== EPOCH_KEY) return getItem.call(this, key)
      readsThisAttempt += 1
      // BOTH writer permission reads refuse. An unnecessary notice-only read would be readable for the first
      // attempt and refused for the second, while the shared epoch itself has never changed.
      if (readsThisAttempt === 1 || attempt === 2) {
        throw new DOMException('Storage intermittently refused the read', 'SecurityError')
      }
      return getItem.call(this, key)
    })
    const events: string[] = []
    const onToast = (event: Event) => { events.push((event as CustomEvent).detail.message) }
    window.addEventListener('topbar:show-toast', onToast)
    try {
      const data = {
        scenarioId: A_ID,
        nodes: guest.store.getState().nodes,
        edges: [],
        timestamp: Date.now(),
      }
      for (attempt = 1; attempt <= 2; attempt += 1) {
        readsThisAttempt = 0
        act(() => {
          expect(guest.scenarios.saveAutosave(data), `permission read ${attempt} refused: nothing can be written`).toBe(false)
        })
      }
      expect(getItem.call(localStorage, EPOCH_KEY), 'precondition: the actual epoch did not change').toBe('unchanged-guest-era')
      expect(events, 'a notice must use the permission decision, not a second storage read').toEqual([UNREADABLE])
      expect(screen.getByRole('alert')).toHaveTextContent(UNREADABLE)
      expect(localStorage.getItem(SLOT)).toBeNull()
      attempt = 2
      expect(guest.scenarios.epochThisTabMayWriteUnder(), 'the unreadable epoch still uses the null-compatible API').toBeNull()
      expect(guest.scenarios.getIdentityWriteBlockReason()).toBe('unreadable')
    } finally {
      window.removeEventListener('topbar:show-toast', onToast)
    }
  })

  it('two refused ticks and a hook remount show one toast; another identity era gets one new toast', async () => {
    const guest = await bootGuestUi()
    const other = await signInThenOutInAnotherTab()
    vi.useFakeTimers()
    const events: string[] = []
    const onToast = (event: Event) => { events.push((event as CustomEvent).detail.message) }
    window.addEventListener('topbar:show-toast', onToast)
    try {
      const first = mountHost(guest, 'autosave')
      advanceAutosaveCycle()
      expect(events, 'the first fenced autosave tick must disclose the refusal').toEqual([STALE])
      expect(screen.getByRole('alert')).toHaveTextContent(STALE)
      advanceAutosaveCycle()
      expect(events, 'autosave must not toast on every tick').toEqual([STALE])
      expect(localStorage.getItem(SLOT), 'a refused tick must never persist the private graph').toBeNull()

      first.unmount()
      mountHost(guest, 'autosave')
      advanceAutosaveCycle()
      expect(events, 'a hook remount is still the same tab and fenced era').toEqual([STALE])

      const firstEra = localStorage.getItem(EPOCH_KEY)
      act(() => {
        other.auth.clearUserScopedState('user-B')
        other.auth.clearUserScopedState(null)
      })
      expect(localStorage.getItem(EPOCH_KEY), 'precondition: another boundary made a new fenced era').not.toBe(firstEra)
      advanceAutosaveCycle()
      expect(events).toEqual([STALE, STALE])
      advanceAutosaveCycle()
      expect(events).toEqual([STALE, STALE])
    } finally {
      window.removeEventListener('topbar:show-toast', onToast)
    }
  })

  it('two unreadable autosave ticks show the unreadable toast once', async () => {
    const guest = await bootGuestUi()
    vi.useFakeTimers()
    const getItem = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === EPOCH_KEY) throw new DOMException('Storage refused the read', 'SecurityError')
      return getItem.call(this, key)
    })
    const events: string[] = []
    const onToast = (event: Event) => { events.push((event as CustomEvent).detail.message) }
    window.addEventListener('topbar:show-toast', onToast)
    try {
      mountHost(guest, 'autosave')
      advanceAutosaveCycle()
      advanceAutosaveCycle()
      expect(events).toEqual([UNREADABLE])
      expect(screen.getByRole('alert')).toHaveTextContent(UNREADABLE)
      expect(localStorage.getItem(SLOT)).toBeNull()
    } finally {
      window.removeEventListener('topbar:show-toast', onToast)
    }
  })
})
