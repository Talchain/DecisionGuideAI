/**
 * CAN-F2g: a tab that never saw another tab's identity boundary must not save its model as the NEW identity's.
 *
 * J1 TC3-F2g / TC4-F2w (5 Oct, run 37314393647; the bisect reproduces it on pre-#2503 400a71f1 and on prod UI
 * 42f3c1ba). `saveAutosave` stamped the epoch read from SHARED localStorage at WRITE time. Tab 1's sign-out rotates
 * the epoch (`userScopedState.ts`), then a drag in tab 2, which still shows account A, wrote A's model stamped with
 * B's epoch, and B's routeless boot restored it as B's own. Snapshots stamp the same way (`persist.ts`).
 *
 * "A tab" here is a fresh module registry (`vi.resetModules()` + import), which is what a page load is: every module
 * instance in it, including the tab's captured epoch, belongs to that tab.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const EPOCH_KEY = 'olumi-canvas-identity-epoch'
const SLOT = 'olumi-canvas-autosave'
const A_ID = 'aaaaaaaa-0000-4000-8000-00000000000a'
const B_ID = 'bbbbbbbb-0000-4000-8000-00000000000b'
const graph = (scenarioId: string, label: string) =>
  ({
    scenarioId,
    nodes: [{ id: `${label}-n`, type: 'decision', position: { x: 1, y: 1 }, data: { label } }],
    edges: [],
    timestamp: Date.now(),
  }) as never

/** A page load: a fresh module registry, so the tab's captured state is its own. */
async function bootTab() {
  vi.resetModules()
  const scenarios = await import('../scenarios')
  const persist = await import('../../persist')
  const crash = await import('../../persist/crashFlush')
  const auth = await import('../../../lib/auth/userScopedState')
  return { scenarios, persist, crash, auth }
}
/** Another tab's identity boundary, as it reaches THIS tab: shared storage changes, this tab's memory does not. */
function anotherTabRotatesEpoch(next: string) {
  localStorage.setItem(EPOCH_KEY, next)
  localStorage.removeItem(SLOT) // that tab's sweep also cleared the slot
}
const snapshotKeys = () => Object.keys(localStorage).filter((k) => k.startsWith('canvas-snapshot-'))

describe('CAN-F2g: a stale tab cannot save the previous identity\'s model as the new identity\'s', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('⭐ F2g: after another tab\'s sign-out, this tab\'s drag writes NOTHING under the new epoch', async () => {
    localStorage.setItem(EPOCH_KEY, 'epoch-A')
    const tab2 = await bootTab() // tab 2 loaded while A was signed in
    anotherTabRotatesEpoch('epoch-B') // tab 1 signs out; B signs in

    const written = tab2.scenarios.saveAutosave(graph(A_ID, 'A private')) // tab 2 still shows A; a drag

    expect(written, 'a skipped write must report that nothing was written').toBe(false)
    const raw = JSON.parse(localStorage.getItem(SLOT) ?? 'null') as { scenarioId?: string; identityEpoch?: string } | null
    expect(
      raw,
      `A's model was saved into the slot B will boot from (stamped ${raw?.identityEpoch ?? '∅'}, scenario ${raw?.scenarioId ?? '∅'})`,
    ).toBeNull()
  })

  it('⭐ F2w: B\'s routeless boot after that stale write shows NONE of A', async () => {
    localStorage.setItem(EPOCH_KEY, 'epoch-A')
    const tab2 = await bootTab()
    anotherTabRotatesEpoch('epoch-B')
    tab2.scenarios.saveAutosave(graph(A_ID, 'A private'))

    const tabB = await bootTab() // account B opens /canvas (no route) in the same browser
    const restored = tabB.scenarios.loadAutosave()
    expect(restored?.scenarioId ?? null, 'B\'s boot restored A\'s model as its own').toBeNull()
  })

  it('F2g, first boundary: a tab that loaded before ANY epoch existed is stale once another tab sets one', async () => {
    const tab2 = await bootTab() // no epoch key yet (no boundary has ever happened in this browser)
    anotherTabRotatesEpoch('epoch-B')

    tab2.scenarios.saveAutosave(graph(A_ID, 'A private'))

    expect(localStorage.getItem(SLOT), 'a pre-boundary tab saved its model under the first epoch').toBeNull()
  })

  it('snapshot sibling: a stale tab\'s snapshot is not saved under the new epoch either', async () => {
    localStorage.setItem(EPOCH_KEY, 'epoch-A')
    const tab2 = await bootTab()
    anotherTabRotatesEpoch('epoch-B')

    tab2.persist.saveSnapshot({ nodes: [{ id: 'a-n', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A private' } }] as never, edges: [] })

    const tabB = await bootTab()
    expect(tabB.persist.listSnapshots(), 'B lists a snapshot of A\'s model').toEqual([])
    expect(snapshotKeys(), 'a stale tab wrote a snapshot key at all').toEqual([])
  })

  it('TWIN (must stay green): THIS tab\'s own sign-out adopts the new epoch, so its next work IS saved and restored', async () => {
    localStorage.setItem(EPOCH_KEY, 'epoch-A')
    const tab1 = await bootTab()
    const { clearUserScopedState } = await import('../../../lib/auth/userScopedState') // same registry as tab1
    clearUserScopedState() // the real boundary: rotates the epoch in THIS tab

    tab1.scenarios.saveAutosave(graph(B_ID, 'B own'))

    const raw = JSON.parse(localStorage.getItem(SLOT) ?? 'null') as { scenarioId?: string; identityEpoch?: string } | null
    expect(raw?.scenarioId, 'the fence blocked the tab that crossed the boundary itself').toBe(B_ID)
    expect(raw?.identityEpoch).toBe(localStorage.getItem(EPOCH_KEY))
    const reload = await bootTab()
    expect(reload.scenarios.loadAutosave()?.scenarioId, 'B\'s own work did not survive B\'s reload').toBe(B_ID)
  })

  it('TWIN (must stay green): a browser with no epoch at all still autosaves (no boundary has happened)', async () => {
    const tab = await bootTab()
    tab.scenarios.saveAutosave(graph(A_ID, 'guest work'))
    const reload = await bootTab()
    expect(reload.scenarios.loadAutosave()?.scenarioId).toBe(A_ID)
  })

  it('⭐ TWIN (Review Desk): BOTH tabs run the sign-out sweep, and tab 1 still saves its new account\'s work', async () => {
    // gotrue relays SIGNED_OUT across tabs, so the second tab runs its own sweep for the SAME boundary.
    localStorage.setItem(EPOCH_KEY, 'epoch-A')
    const tab2 = await bootTab() // both tabs loaded while A was signed in
    const tab1 = await bootTab()
    tab1.auth.clearUserScopedState(null) // tab 1 signs out (every sign-out path passes null: clearAuthStates, adopt(null))
    const afterTab1 = localStorage.getItem(EPOCH_KEY)
    expect(afterTab1, 'precondition: tab 1 rotated the epoch').not.toBe('epoch-A')
    tab2.auth.clearUserScopedState(null) // tab 2 hears SIGNED_OUT and sweeps too (AuthContext adopt(null))

    expect(localStorage.getItem(EPOCH_KEY), 'the second sweep minted another epoch, stranding tab 1').toBe(afterTab1)
    // tab 1 signs in as B (not a boundary there: its owner is already null) and works
    expect(tab1.scenarios.saveAutosave(graph(B_ID, 'B own')), 'tab 1 is locked out of saving B\'s work').toBe(true)
    const raw = JSON.parse(localStorage.getItem(SLOT) ?? 'null') as { scenarioId?: string; identityEpoch?: string } | null
    expect(raw?.scenarioId).toBe(B_ID)
    expect(raw?.identityEpoch).toBe(afterTab1)
    expect(
      tab1.persist.saveSnapshot({ nodes: [{ id: 'b-n', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'B own' } }] as never, edges: [] }),
      'tab 1 is locked out of B\'s snapshots',
    ).toBe(true)
    expect(tab1.persist.listSnapshots()).toHaveLength(1)
  })

  it('crash flush tells the truth: a stale tab\'s flush reports that it wrote nothing', async () => {
    localStorage.setItem(EPOCH_KEY, 'epoch-A')
    const tab2 = await bootTab()
    tab2.crash.registerCrashSnapshotProvider(() => ({
      nodes: [{ id: 'a-n', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'A private' } }],
      edges: [],
      scenarioId: A_ID,
    }) as never)
    expect(tab2.crash.flushWorkToAutosave(), 'precondition: an own tab\'s flush writes').toBe(true)
    localStorage.removeItem(SLOT)
    anotherTabRotatesEpoch('epoch-B')

    expect(tab2.crash.flushWorkToAutosave(), '"Reloading will restore your latest work" would be shown for a write that never happened').toBe(false)
    expect(localStorage.getItem(SLOT)).toBeNull()
  })

  it('⭐ a tab that missed A→B and then crosses A→C does NOT join B\'s era: B\'s surviving records are never C\'s', async () => {
    localStorage.setItem(EPOCH_KEY, 'epoch-A')
    const stale = await bootTab() // still on A; it misses the next transition
    const other = await bootTab()
    other.auth.clearUserScopedState('user-B') // A→B in another tab
    const eraB = localStorage.getItem(EPOCH_KEY)
    expect(other.scenarios.saveAutosave(graph(B_ID, 'B work')), 'precondition: B works in its era').toBe(true)

    // this tab now crosses A→C itself, and the sweep's removal of B's slot is REFUSED (the supported degradation)
    const realRemove = Storage.prototype.removeItem
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, k: string) {
      if (k === SLOT) return undefined
      return realRemove.call(this, k)
    })
    stale.auth.clearUserScopedState('user-C')
    spy.mockRestore()

    expect(localStorage.getItem(SLOT), 'precondition: B\'s slot survived the refused removal').not.toBeNull()
    expect(localStorage.getItem(EPOCH_KEY), 'this tab joined B\'s era for C').not.toBe(eraB)
    const tabC = await bootTab()
    expect(tabC.scenarios.loadAutosave()?.scenarioId ?? null, 'C restores B\'s model').toBeNull()
  })

  it('⭐ real-auth: a tab that signed out and signs back in can save, even after another tab\'s null-session boot rotated', async () => {
    localStorage.setItem(EPOCH_KEY, 'epoch-A')
    const tab1 = await bootTab()
    tab1.auth.clearUserScopedState(null) // tab 1 signs A out
    const tab3 = await bootTab() // a new tab opens signed out: real-auth sweeps on its null session (AuthContext:377)
    tab3.auth.clearUserScopedState(null)

    tab1.auth.adoptIdentityEpochAtSignIn() // A signs back in in tab 1: not a boundary there (AuthContext:388)
    expect(tab1.scenarios.saveAutosave(graph(A_ID, 'A again')), 'tab 1 is locked out until a reload').toBe(true)
  })
})
