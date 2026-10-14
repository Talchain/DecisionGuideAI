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
  }) as import('../scenarios').AutosaveData

/** A page load: a fresh module registry, so the tab's captured state is its own. */
async function bootTab() {
  vi.resetModules()
  const scenarios = await import('../scenarios')
  const persist = await import('../../persist')
  const crash = await import('../../persist/crashFlush')
  const auth = await import('../../../lib/auth/userScopedState')
  const { useCanvasStore: store } = await import('../../store')
  return { scenarios, persist, crash, auth, store }
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

  // ── S-G port onto current staging (7 Oct): the thin latch (#2511) already removes the model copy for a page that was
  // ever signed in, so the fence's live job is the GUEST page. These two rows bind both halves.

  it('⭐ S-G row 2, real calls: a guest tab under another tab\'s sign-in then sign-out writes NOTHING for the next guest', async () => {
    const guestTab = await bootTab() // a guest page, no boundary has happened in this browser yet
    const tab1 = await bootTab()
    tab1.auth.adoptIdentityEpochAtSignIn() // A signs in in tab 1: a first sign-in, not a boundary (AuthContext)
    tab1.auth.clearUserScopedState(null) // A signs out in tab 1: the boundary

    expect(guestTab.scenarios.saveAutosave(graph(A_ID, 'before sign-in')), 'the stale guest tab reported a write').toBe(false)
    const nextGuest = await bootTab()
    expect(nextGuest.scenarios.loadAutosave()?.scenarioId ?? null, 'the next guest restored the previous person\'s model').toBeNull()
  })

  it('⭐ DL Save probe: the stale guest\'s real store Save cannot publish A or clear the CURRENT guest\'s autosave', async () => {
    const staleGuest = await bootTab()
    staleGuest.store.setState({
      currentScenarioId: A_ID,
      nodes: [{ id: 'a-n', type: 'decision', position: { x: 1, y: 1 }, data: { label: 'A private' } }],
      edges: [],
      isDirty: true,
    })

    const tab1 = await bootTab()
    tab1.auth.adoptIdentityEpochAtSignIn() // first sign-in, as in S-G row 2
    tab1.auth.clearUserScopedState(null) // real sign-out boundary in the OTHER registry

    const currentGuest = await bootTab()
    expect(currentGuest.scenarios.saveAutosave(graph(B_ID, 'b')), 'precondition: the CURRENT owner can autosave').toBe(true)
    const currentAutosave = localStorage.getItem(SLOT)
    expect(JSON.parse(currentAutosave!).identityEpoch, 'precondition: this slot belongs to the CURRENT epoch').toBe(localStorage.getItem(EPOCH_KEY))

    const savedId = staleGuest.store.getState().saveCurrentScenario('A private')
    expect.soft(savedId, 'a fenced Save must return null').toBeNull()
    expect.soft(staleGuest.store.getState().isDirty, 'fenced Save must not claim the unsaved canvas is saved').toBe(true)
    expect.soft(localStorage.getItem(SLOT), 'stale Save cleared the CURRENT owner\'s autosave').toBe(currentAutosave)

    const nextGuest = await bootTab()
    const records = nextGuest.scenarios.loadScenarios()
    expect.soft(records.some((record) => record.id === A_ID), 'the next guest lists A\'s scenario ID').toBe(false)
    expect.soft(records.some((record) => record.graph.nodes.some((node) => node.id === 'a-n')), 'the next guest lists A\'s node ID').toBe(false)
    const pointer = nextGuest.scenarios.getCurrentScenarioId()
    expect.soft(pointer, 'the next guest\'s current pointer is A').not.toBe(A_ID)

    // Drive the same storage readers as resolveBootLoadSource: pointer record and autosave.
    // Both possible sources must exclude A by identity; the store's boot seed must exclude A too.
    const pointerRecord = pointer ? nextGuest.scenarios.getScenario(pointer) : undefined
    const bootAutosave = nextGuest.scenarios.loadAutosave()
    expect.soft(pointerRecord?.id ?? null, 'the pointer boot source loads A').not.toBe(A_ID)
    expect.soft(pointerRecord?.graph.nodes.some((node) => node.id === 'a-n') ?? false, 'the pointer boot source loads A\'s node').toBe(false)
    expect.soft(bootAutosave?.scenarioId ?? null, 'the autosave boot source loads A').not.toBe(A_ID)
    expect.soft(bootAutosave?.nodes.some((node) => node.id === 'a-n') ?? false, 'the autosave boot source loads A\'s node').toBe(false)
    expect.soft(nextGuest.store.getState().currentScenarioId, 'the fresh store boots with A\'s identity').not.toBe(A_ID)
    expect.soft(bootAutosave?.scenarioId, 'the CURRENT owner\'s autosave must still boot').toBe(B_ID)
  })

  it('THIN CURRENT: a signed-in thin page holding the current epoch saves metadata and pointer', async () => {
    localStorage.setItem(EPOCH_KEY, 'epoch-A')
    localStorage.setItem('sb-testproject-auth-token', '{"access_token":"t","user":{"id":"u"}}')
    const thinTab = await bootTab()
    thinTab.store.setState({
      currentScenarioId: A_ID,
      nodes: [{ id: 'a-n', type: 'decision', position: { x: 1, y: 1 }, data: { label: 'A private' } }],
      edges: [],
      isDirty: true,
    })
    expect(thinTab.store.getState().saveCurrentScenario('A thin'), 'the fence blocked a current signed-in Save').toBe(A_ID)
    expect(thinTab.store.getState().isDirty).toBe(false)
    expect(thinTab.scenarios.getCurrentScenarioId()).toBe(A_ID)
    const records = JSON.parse(localStorage.getItem('olumi-canvas-scenarios') ?? '[]')
    expect(records.find((record: { id: string }) => record.id === A_ID)?.graph.nodes, 'thin Save persisted model nodes').toEqual([])
    expect(localStorage.getItem(SLOT), 'thin Save persisted an autosave model').toBeNull()
  })

  it('THIN STALE: a guest latches thin from another tab\'s token, then stale Save preserves the current owner', async () => {
    const staleGuest = await bootTab()
    staleGuest.store.setState({ currentScenarioId: A_ID, nodes: graph(A_ID, 'A private').nodes, edges: [], isDirty: true })
    const thin = await import('../../thinClient/thinClient')
    localStorage.setItem('sb-testproject-auth-token', '{"access_token":"t","user":{"id":"u"}}')
    expect(thin.isThinClientSession(), 'the guest observes the other tab\'s stored session').toBe(true)
    thin.__latchThinClientForTests() // the production latch is disabled under MODE=test
    const other = await bootTab()
    other.auth.clearUserScopedState(null)
    localStorage.removeItem('sb-testproject-auth-token')
    expect(thin.isThinClientSession(), 'the stale guest remains thin after sign-out').toBe(true)
    const currentGuest = await bootTab()
    currentGuest.scenarios.createScenario({ id: B_ID, name: 'CURRENT owner', nodes: graph(B_ID, 'b').nodes, edges: [] })
    expect(currentGuest.scenarios.saveAutosave(graph(B_ID, 'b'))).toBe(true)
    const currentList = localStorage.getItem('olumi-canvas-scenarios')
    const currentAutosave = localStorage.getItem(SLOT)

    expect.soft(staleGuest.store.getState().saveCurrentScenario('A private')).toBeNull()
    expect.soft(staleGuest.store.getState().isDirty).toBe(true)
    expect.soft(localStorage.getItem('olumi-canvas-scenarios'), 'stale thin Save wrote the list').toBe(currentList)
    expect.soft(staleGuest.scenarios.getCurrentScenarioId(), 'stale thin Save moved the pointer').toBe(B_ID)
    expect.soft(localStorage.getItem(SLOT), 'stale thin Save cleared the owner\'s autosave').toBe(currentAutosave)
  })

  const localWriters = ['saveScenarios', 'setCurrentScenarioId', 'clearAutosave', 'clearCurrentScenarioId', 'deleteScenario'] as const
  it.each(localWriters.flatMap((writer) => [
    { writer, mode: 'guest' }, { writer, mode: 'thin' },
  ]))(
    'shared writer $writer: a stale $mode cannot replace or remove the CURRENT owner\'s persisted records',
    async ({ writer, mode }) => {
      localStorage.setItem(EPOCH_KEY, 'epoch-A')
      const staleGuest = await bootTab()
      if (mode === 'thin') (await import('../../thinClient/thinClient')).__latchThinClientForTests()
      anotherTabRotatesEpoch('epoch-B')
      const currentGuest = await bootTab()
      const currentRecord = currentGuest.scenarios.createScenario({
        id: B_ID,
        name: 'CURRENT owner',
        nodes: [{ id: 'b-n', type: 'decision', position: { x: 1, y: 1 }, data: { label: 'CURRENT owner' } }],
        edges: [],
      })
      expect(currentGuest.scenarios.saveAutosave(graph(B_ID, 'b'))).toBe(true)
      const currentList = localStorage.getItem('olumi-canvas-scenarios')
      const currentAutosave = localStorage.getItem(SLOT)
      const keyedSlot = currentGuest.scenarios.keyedAutosaveKey(B_ID)
      localStorage.setItem(keyedSlot, currentAutosave!)

      if (writer === 'saveScenarios') {
        staleGuest.scenarios.saveScenarios([{
          ...currentRecord,
          id: A_ID,
          graph: { nodes: [{ id: 'a-n', type: 'decision', position: { x: 1, y: 1 }, data: { label: 'A private' } }], edges: [] },
        }])
      } else if (writer === 'setCurrentScenarioId') {
        staleGuest.scenarios.setCurrentScenarioId(A_ID)
      } else if (writer === 'clearAutosave') {
        staleGuest.scenarios.clearAutosave()
      } else if (writer === 'clearCurrentScenarioId') {
        staleGuest.scenarios.clearCurrentScenarioId()
      } else {
        staleGuest.scenarios.deleteScenario(B_ID)
      }

      expect.soft(localStorage.getItem('olumi-canvas-scenarios'), `${writer} changed the CURRENT owner's list`).toBe(currentList)
      expect.soft(localStorage.getItem('olumi-canvas-current-scenario-id'), `${writer} changed the CURRENT owner's pointer`).toBe(B_ID)
      expect.soft(localStorage.getItem(SLOT), `${writer} cleared the CURRENT owner's autosave`).toBe(currentAutosave)
      expect.soft(localStorage.getItem(keyedSlot), `${writer} cleared the CURRENT owner's keyed autosave`).toBe(currentAutosave)
    },
  )

  it('existing-record Save: a stale guest cannot update the CURRENT owner\'s saved graph or clear its autosave', async () => {
    localStorage.setItem(EPOCH_KEY, 'epoch-A')
    const staleGuest = await bootTab()
    staleGuest.store.setState({
      // This ID already has a record when Save runs, exercising updateScenario rather than createScenario.
      currentScenarioId: B_ID,
      nodes: [{ id: 'a-n', type: 'decision', position: { x: 1, y: 1 }, data: { label: 'A private' } }],
      edges: [],
      isDirty: true,
    })
    anotherTabRotatesEpoch('epoch-B')
    const currentGuest = await bootTab()
    currentGuest.scenarios.createScenario({
      id: B_ID,
      name: 'CURRENT owner',
      nodes: [{ id: 'b-n', type: 'decision', position: { x: 1, y: 1 }, data: { label: 'CURRENT owner' } }],
      edges: [],
    })
    expect(currentGuest.scenarios.saveAutosave(graph(B_ID, 'b'))).toBe(true)
    const currentList = localStorage.getItem('olumi-canvas-scenarios')
    const currentAutosave = localStorage.getItem(SLOT)

    expect.soft(staleGuest.store.getState().saveCurrentScenario('A private')).toBeNull()
    expect.soft(staleGuest.store.getState().isDirty).toBe(true)
    expect.soft(staleGuest.store.getState().isSaving).toBe(false)
    expect.soft(localStorage.getItem('olumi-canvas-scenarios'), 'existing-record Save overwrote the CURRENT owner\'s graph').toBe(currentList)
    expect.soft(localStorage.getItem(SLOT), 'existing-record Save cleared the CURRENT owner\'s autosave').toBe(currentAutosave)
  })

  it('unreadable Save: the real store returns null, keeps dirty work, and says storage refused the read', async () => {
    const tab = await bootTab()
    tab.store.setState({
      currentScenarioId: A_ID,
      nodes: [{ id: 'a-n', type: 'decision', position: { x: 1, y: 1 }, data: { label: 'A private' } }],
      edges: [],
      isDirty: true,
    })
    const messages: string[] = []
    const listener = (event: Event) => {
      messages.push((event as CustomEvent).detail?.message)
      event.preventDefault()
    }
    window.addEventListener('topbar:show-toast', listener)
    const realGet = Storage.prototype.getItem
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === EPOCH_KEY) throw new DOMException('Read refused', 'SecurityError')
      return realGet.call(this, key)
    })
    try {
      expect.soft(tab.store.getState().saveCurrentScenario('A private')).toBeNull()
      expect.soft(tab.store.getState().isDirty).toBe(true)
      expect.soft(tab.store.getState().isSaving).toBe(false)
      expect.soft(messages).toEqual(['This browser is not letting Olumi save right now, so this change was not saved.'])
      expect.soft(localStorage.getItem('olumi-canvas-scenarios')).toBeNull()
      expect.soft(localStorage.getItem('olumi-canvas-current-scenario-id')).toBeNull()
    } finally {
      spy.mockRestore()
      window.removeEventListener('topbar:show-toast', listener)
    }
  })

  it('BOOT RECOVERY: a transient unreadable boot adopts the unchanged epoch and saves without a stale notice', async () => {
    localStorage.setItem(EPOCH_KEY, 'unchanged-boot-era')
    const realGet = Storage.prototype.getItem
    let refused = false
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === EPOCH_KEY && !refused) {
        refused = true
        throw new DOMException('Transient boot refusal', 'SecurityError')
      }
      return realGet.call(this, key)
    })
    const tab = await bootTab()
    const messages: string[] = []
    const listener = (event: Event) => { messages.push((event as CustomEvent).detail.message) }
    window.addEventListener('topbar:show-toast', listener)
    try {
      expect.soft(tab.scenarios.getIdentityWriteBlockReason()).toBeNull()
      expect.soft(tab.scenarios.saveAutosave(graph(A_ID, 'own work'))).toBe(true)
      expect.soft(JSON.parse(localStorage.getItem(SLOT) ?? 'null')?.identityEpoch).toBe('unchanged-boot-era')
      expect.soft(messages, 'recovered storage must not claim an identity boundary').toEqual([])
    } finally {
      window.removeEventListener('topbar:show-toast', listener)
    }
  })

  it('BOOT UNKNOWN: recovery without any readable boot epoch remains unreadable, never stale', async () => {
    localStorage.setItem(EPOCH_KEY, 'unknown-boot-era')
    const realGet = Storage.prototype.getItem
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === EPOCH_KEY) throw new DOMException('Boot reads refused', 'SecurityError')
      return realGet.call(this, key)
    })
    const tab = await bootTab()
    spy.mockRestore()
    expect(tab.scenarios.getIdentityWriteBlockReason()).toBe('unreadable')
    expect(tab.scenarios.saveAutosave(graph(A_ID, 'unverified work'))).toBe(false)
    expect(localStorage.getItem(SLOT)).toBeNull()
  })

  it('BOOT CHANGED control: a recovered boot witness cannot adopt a later identity epoch', async () => {
    localStorage.setItem(EPOCH_KEY, 'boot-era-A')
    const realGet = Storage.prototype.getItem
    let refused = false
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (key === EPOCH_KEY && !refused) {
        refused = true
        throw new DOMException('Transient boot refusal', 'SecurityError')
      }
      return realGet.call(this, key)
    })
    vi.resetModules()
    const pending = await import('../scenarios')
    anotherTabRotatesEpoch('current-era-B')
    const current = await bootTab()
    expect(current.scenarios.saveAutosave(graph(B_ID, 'current work'))).toBe(true)
    const currentAutosave = localStorage.getItem(SLOT)

    expect(pending.getIdentityWriteBlockReason()).toBe('stale')
    expect(pending.saveAutosave(graph(A_ID, 'old work'))).toBe(false)
    expect(localStorage.getItem(SLOT)).toBe(currentAutosave)
  })

  it('⭐ THIN UNCHANGED: a signed-in (thin) page under a rotated epoch still writes its layout and reports it, never the model', async () => {
    localStorage.setItem(EPOCH_KEY, 'epoch-A')
    localStorage.setItem('sb-testproject-auth-token', '{"access_token":"t","user":{"id":"u"}}')
    const thinTab = await bootTab()
    anotherTabRotatesEpoch('epoch-B')

    expect(thinTab.scenarios.saveAutosave(graph(A_ID, 'A thin')), 'the fence changed what a thin page reports').toBe(true)
    expect(localStorage.getItem(`olumi-thin-layout:${A_ID}`), 'the thin page lost its layout write').not.toBeNull()
    expect(localStorage.getItem(SLOT), 'a thin page wrote a model copy').toBeNull()
  })
})
