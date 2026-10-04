/**
 * ⭐ A COLD-LOAD DEEP LINK WINS OVER THE REMEMBERED SCENARIO, AND NEVER COSTS IT ITS LOCAL COPY (Canvas, DL 0df0e1).
 *
 * DRIVEN against the real `useCanvasStore`, real `localStorage`, the real autosave writer (`saveAutosave` ∘
 * `projectAutosaveData` ∘ `autosaveSourceFromStore`, as `store.ts` calls it) and the boot's own exported decisions
 * (`resolveBootLoadSource`, `bindRestoredScenarioId`). The boot effect itself is PROD-gated and never runs under vitest,
 * so `bootRestore()` below replays its autosave branch in the same order, and §6 scans the source for exactly that order
 * and nothing more. Every assertion binds a scenario by id and a slot by its bytes.
 *
 *   Z = the scenario this browser remembers · Y = the link opened · W = a third scenario
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Node } from '@xyflow/react'

import { createElement, StrictMode } from 'react'
import { render } from '@testing-library/react'
import {
  MAIN_AUTOSAVE_SLOT,
  planColdLoadDeepLink,
  useColdLoadDeepLinkGate,
  keyedAutosaveSlot,
  claimColdLoadDeepLink,
  coldLoadClaimedRoute,
  settleKeyedAutosaveCopy,
  refreshExistingCopy,
  coldLoadBlocksBootRestore,
  __resetColdLoadDeepLinkForTests,
} from '../coldLoadDeepLink'
import { resolveBootLoadSource, bindRestoredScenarioId } from '../../ReactFlowGraph'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import { projectAutosaveData, autosaveSourceFromStore } from '../../store/autosaveProjection'
import { clearUserScopedState, USER_SCOPED_STORAGE_PREFIXES } from '../../../lib/auth/userScopedState'

const Z = 'aaaaaaaa-1111-4111-8111-111111111111'
const Y = 'bbbbbbbb-2222-4222-8222-222222222222'
const W = 'cccccccc-3333-4333-8333-333333333333'
const POINTER = 'olumi-canvas-current-scenario-id'

const PRISTINE = useCanvasStore.getState()

const goal = (id: string, label: string): Node =>
  ({ id, type: 'goal', position: { x: 0, y: 0 }, data: { label, kind: 'goal' } }) as unknown as Node
const GRAPH = {
  [Z]: [goal('z_goal', 'Z: grow revenue'), goal('z_factor', 'Z: price')],
  [Y]: [goal('y_goal', 'Y: hire a team')],
} as Record<string, Node[]>

let clock = 1_000_000
/** The real writer, as the store calls it. A fresh timestamp each time (`saveAutosave` skips an identical payload). */
function autosaveFromStore(): string {
  scenarios.saveAutosave(projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState()), (clock += 1000)))
  return localStorage.getItem(MAIN_AUTOSAVE_SLOT) as string
}
/** A browser that worked on `id` in an earlier page: its pointer, and its autosave stamped with it. Returns the bytes. */
function rememberScenario(id: string): string {
  useCanvasStore.setState({ currentScenarioId: id, nodes: GRAPH[id], edges: [] })
  scenarios.setCurrentScenarioId(id)
  const raw = autosaveFromStore()
  newPage()
  return raw
}
/** A new page load: the store as module load seeds it (`currentScenarioId` from the pointer), nothing on the canvas. */
function newPage(): void {
  __resetColdLoadDeepLinkForTests()
  useCanvasStore.setState(PRISTINE, true)
  useCanvasStore.setState({ currentScenarioId: scenarios.getCurrentScenarioId(), nodes: [], edges: [] })
}
/** `ReactFlowGraph`'s PROD boot, autosave branch, in its own order (§6 pins that order in the source). */
function bootRestore(): string | null | 'not_autosave' {
  const currentId = scenarios.getCurrentScenarioId()
  const autosave = coldLoadBlocksBootRestore() ? null : scenarios.loadAutosave()
  const scenario = currentId ? scenarios.getScenario(currentId) : null
  const loadSource = resolveBootLoadSource(currentId, autosave, scenario)
  if (loadSource !== 'autosave' || !autosave) return 'not_autosave'
  // The effect passes the same three fields; the persisted record's edge type is the wider React Flow one.
  useCanvasStore.getState().hydrateGraphSlice({ nodes: autosave.nodes, edges: autosave.edges as never, goalConstraints: autosave.goalConstraints ?? null })
  const restoredBoundId = bindRestoredScenarioId(currentId, autosave)
  settleKeyedAutosaveCopy(restoredBoundId)
  return restoredBoundId
}
/** An OLDER state of the same scenario: the same stamp, a finite timestamp strictly earlier (an orderable copy). */
function olderStateOf(raw: string): string {
  const state = JSON.parse(raw) as { timestamp: number }
  return JSON.stringify({ ...state, timestamp: state.timestamp - 500 })
}
const storageSnapshot = () =>
  Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) as string).sort().map((k) => [k, localStorage.getItem(k)]))
const onCanvas = () => useCanvasStore.getState().nodes.map((n) => n.id).sort()
const keyedKeys = () =>
  Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k): k is string => !!k && k.startsWith(`${MAIN_AUTOSAVE_SLOT}:`))

beforeEach(() => {
  localStorage.clear()
  newPage()
})
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('§0 instrument', () => {
  it('MAIN_AUTOSAVE_SLOT is the key the REAL autosave writer writes, and a keyed slot is a different key', () => {
    useCanvasStore.setState({ currentScenarioId: Z, nodes: GRAPH[Z], edges: [] })
    const raw = autosaveFromStore()
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw).scenarioId).toBe(Z)
    expect(scenarios.loadAutosave()?.scenarioId).toBe(Z)
    expect(keyedAutosaveSlot(Z)).not.toBe(MAIN_AUTOSAVE_SLOT)
    expect(keyedAutosaveSlot(Z)).toBe(`olumi-canvas-autosave:${Z}`)
  })
})

describe('§1 DL row 1: the supersede (route Y, pointer Z, autosave Z)', () => {
  it('⭐ pointer Y, store Y, Z\'s slot kept byte for byte under its own id, and the main slot never Z\'s under Y', () => {
    const zRaw = rememberScenario(Z)
    expect(useCanvasStore.getState().currentScenarioId, 'precondition: the store seeds Z').toBe(Z)

    expect(claimColdLoadDeepLink(Y)).toBe('applied')

    expect(localStorage.getItem(POINTER)).toBe(Y)
    expect(useCanvasStore.getState().currentScenarioId).toBe(Y)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBeNull()
    expect(coldLoadClaimedRoute()).toBe(Y)
  })

  it('⭐ the next autosave is stamped Y: the stamp is again a copy of the pointer', () => {
    rememberScenario(Z)
    claimColdLoadDeepLink(Y)
    useCanvasStore.setState({ nodes: GRAPH[Y], edges: [] }) // Y's model arrives (the server read)
    expect(JSON.parse(autosaveFromStore()).scenarioId).toBe(Y)
    expect(localStorage.getItem(POINTER)).toBe(Y)
  })

  it('the route\'s own preserved copy, when it has one, becomes the main slot (and is kept until restored)', () => {
    const zRaw = rememberScenario(Z)
    claimColdLoadDeepLink(Y)
    useCanvasStore.setState({ nodes: GRAPH[Y], edges: [] })
    const yRaw = autosaveFromStore()
    newPage()

    expect(claimColdLoadDeepLink(Z)).toBe('applied')
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(zRaw)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
    expect(localStorage.getItem(keyedAutosaveSlot(Y))).toBe(yRaw)
  })
})

describe('§1b DL row (a): idempotent, and written only at commit (Codex round 1: render ownership)', () => {
  it('⭐ a second run on the same cold load changes nothing: byte-identical storage, no second preserve, no :<Y> self-copy', () => {
    const zRaw = rememberScenario(Z)
    expect(claimColdLoadDeepLink(Y)).toBe('applied')
    const once = storageSnapshot()

    expect(claimColdLoadDeepLink(Y)).toBe('not_first') // a repeat in the same page
    __resetColdLoadDeepLinkForTests()
    expect(claimColdLoadDeepLink(Y)).toBe('declined') // and the writes themselves: pointer already Y → nothing to do
    expect(storageSnapshot()).toEqual(once)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
    expect(localStorage.getItem(keyedAutosaveSlot(Y))).toBeNull()
    expect(useCanvasStore.getState().currentScenarioId).toBe(Y)
  })

  it('⭐ the gate decides with a PURE read: an abandoned render writes nothing, and the page is not yet settled', () => {
    rememberScenario(Z)
    const before = storageSnapshot()
    expect(planColdLoadDeepLink(Y)).toEqual({ kind: 'supersede', route: Y })
    expect(planColdLoadDeepLink(W)).toEqual({ kind: 'supersede', route: W })
    expect(storageSnapshot()).toEqual(before)
    expect(useCanvasStore.getState().currentScenarioId).toBe(Z)
    // A replacement route that commits first is the one decided.
    expect(claimColdLoadDeepLink(W)).toBe('applied')
    expect(localStorage.getItem(POINTER)).toBe(W)
  })

  it('⭐ under StrictMode, the gate applies once at commit, and the body\'s every render holds the route\'s scenario', () => {
    const zRaw = rememberScenario(Z)
    const seen: Array<string | null> = []
    function Body(): null {
      seen.push(useCanvasStore((st) => st.currentScenarioId))
      return null
    }
    function Route(): ReturnType<typeof createElement> | null {
      return useColdLoadDeepLinkGate(Y) ? createElement(Body) : null
    }
    render(createElement(StrictMode, null, createElement(Route)))
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.every((id) => id === Y)).toBe(true)
    expect(localStorage.getItem(POINTER)).toBe(Y)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
    expect(localStorage.getItem(keyedAutosaveSlot(Y))).toBeNull()
    expect(claimColdLoadDeepLink(W)).toBe('not_first')
  })

  it('CONTROL: with nothing due, the gate renders the body on its very first render', () => {
    rememberScenario(Y)
    const ready: boolean[] = []
    function Route(): null {
      ready.push(useColdLoadDeepLinkGate(Y))
      return null
    }
    render(createElement(Route))
    expect(ready[0]).toBe(true)
    expect(claimColdLoadDeepLink(W)).toBe('not_first') // the mount still settled the page
  })
})

describe('§2 DL row 2: the door — a routeless cold load after the supersede', () => {
  it('⭐ restores Y\'s graph under id Y, never Y\'s graph under id Z', () => {
    rememberScenario(Z)
    claimColdLoadDeepLink(Y)
    useCanvasStore.setState({ nodes: GRAPH[Y], edges: [] })
    autosaveFromStore()

    newPage()
    expect(claimColdLoadDeepLink(undefined)).toBe('declined') // `/canvas`: no link
    expect(bootRestore()).toBe(Y)
    expect(useCanvasStore.getState().currentScenarioId).toBe(Y)
    expect(onCanvas()).toEqual(['y_goal'])
    expect(localStorage.getItem(POINTER)).toBe(Y)
  })
})

describe('§3 DL row 3: #2383\'s fresh guest — nothing remembered, nothing written', () => {
  it('declines, and the pointer stays unwritten', () => {
    expect(claimColdLoadDeepLink(Y)).toBe('declined')
    expect(localStorage.getItem(POINTER)).toBeNull()
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBeNull()
    expect(keyedKeys()).toEqual([])
    expect(useCanvasStore.getState().currentScenarioId).toBeNull()
  })
})

describe('§4 DL row 4: the round trip Z → Y → Z', () => {
  function toYAndBackToZ(): { zRaw: string; yRaw: string } {
    const zRaw = rememberScenario(Z)
    claimColdLoadDeepLink(Y)
    useCanvasStore.setState({ nodes: GRAPH[Y], edges: [] })
    const yRaw = autosaveFromStore()
    newPage()
    expect(claimColdLoadDeepLink(Z)).toBe('applied')
    return { zRaw, yRaw }
  }

  it('⭐ Z comes back as Z, from its own bytes; Y is kept; Z\'s copy is retired only once it is on screen', () => {
    const { zRaw, yRaw } = toYAndBackToZ()
    expect(localStorage.getItem(keyedAutosaveSlot(Z)), 'kept until the restore has run').toBe(zRaw)

    expect(bootRestore()).toBe(Z)
    expect(useCanvasStore.getState().currentScenarioId).toBe(Z)
    expect(onCanvas()).toEqual(['z_factor', 'z_goal'])
    expect(localStorage.getItem(POINTER)).toBe(Z)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(zRaw)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBeNull()
    expect(localStorage.getItem(keyedAutosaveSlot(Y))).toBe(yRaw)
  })

  it('⭐ a restore that fails keeps Z\'s copy', () => {
    const { zRaw } = toYAndBackToZ()
    vi.spyOn(useCanvasStore.getState(), 'hydrateGraphSlice').mockImplementation(() => {
      throw new Error('restore failed')
    })
    expect(() => bootRestore()).toThrow('restore failed')
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
  })

  it('a copy is never retired by a restore that did not take it (the main slot holds other bytes)', () => {
    const { zRaw } = toYAndBackToZ()
    localStorage.setItem(MAIN_AUTOSAVE_SLOT, '{"other":true}')
    expect(settleKeyedAutosaveCopy(Z)).toBe(false)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
    expect(settleKeyedAutosaveCopy(null)).toBe(false)
  })
})

describe('§5 DL row 5: a preserved copy never lands in another scenario', () => {
  it('⭐ with Z\'s copy kept, a link to W restores nothing of Z, and Z\'s copy is untouched', () => {
    const zRaw = rememberScenario(Z)
    claimColdLoadDeepLink(Y)
    useCanvasStore.setState({ nodes: GRAPH[Y], edges: [] })
    const yRaw = autosaveFromStore()
    newPage()

    expect(claimColdLoadDeepLink(W)).toBe('applied')
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBeNull()
    expect(bootRestore()).toBe('not_autosave')
    expect(useCanvasStore.getState().currentScenarioId).toBe(W)
    expect(onCanvas()).toEqual([])
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
    expect(localStorage.getItem(keyedAutosaveSlot(Y))).toBe(yRaw)
    expect(settleKeyedAutosaveCopy(W)).toBe(false)
  })
})

describe('§5b DL row: a DELETED scenario\'s preserved copy never comes back', () => {
  it('⭐ deleting Z removes its preserved copy, so a later link to Z restores nothing of Z', () => {
    rememberScenario(Z)
    claimColdLoadDeepLink(Y)
    useCanvasStore.setState({ nodes: GRAPH[Y], edges: [] })
    const yRaw = autosaveFromStore()
    expect(localStorage.getItem(keyedAutosaveSlot(Z)), 'precondition: Z was preserved').not.toBeNull()

    scenarios.deleteScenario(Z) // the one delete both paths reach (`useScenario.deleteScenario` calls it)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBeNull()
    expect(localStorage.getItem(keyedAutosaveSlot(Y)), 'CONTROL: another scenario\'s copy is not touched').toBeNull()
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT), 'CONTROL: the live slot (Y\'s) is not touched').toBe(yRaw)

    newPage()
    claimColdLoadDeepLink(Z)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBeNull()
    expect(bootRestore()).toBe('not_autosave')
    expect(onCanvas()).toEqual([])
    expect(onCanvas().some((id) => id.startsWith('z_'))).toBe(false)
  })

  it('CONTROL: deleting a scenario leaves every other preserved copy alone', () => {
    const zRaw = rememberScenario(Z)
    claimColdLoadDeepLink(Y)
    scenarios.deleteScenario(W)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
  })
})

describe('CONTROLS: everything else is exactly as before', () => {
  it('the remembered scenario IS the link: nothing written', () => {
    const yRaw = rememberScenario(Y)
    expect(claimColdLoadDeepLink(Y)).toBe('declined')
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(yRaw)
    expect(localStorage.getItem(POINTER)).toBe(Y)
    expect(keyedKeys()).toEqual([])
  })

  it('a later canvas mount in the same page (in-app navigation) never supersedes', () => {
    const zRaw = rememberScenario(Z)
    expect(claimColdLoadDeepLink(undefined)).toBe('declined')
    expect(claimColdLoadDeepLink(Y)).toBe('not_first')
    expect(localStorage.getItem(POINTER)).toBe(Z)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(zRaw)
    expect(useCanvasStore.getState().currentScenarioId).toBe(Z)
    expect(keyedKeys()).toEqual([])
  })

  it('a canvas already on screen is never replaced', () => {
    const zRaw = rememberScenario(Z)
    useCanvasStore.setState({ nodes: GRAPH[Z], edges: [] })
    expect(claimColdLoadDeepLink(Y)).toBe('declined')
    expect(localStorage.getItem(POINTER)).toBe(Z)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(zRaw)
    expect(keyedKeys()).toEqual([])
  })

  it('an id CEE cannot address is never claimed', () => {
    rememberScenario(Z)
    expect(claimColdLoadDeepLink('local-draft-1')).toBe('declined')
    expect(localStorage.getItem(POINTER)).toBe(Z)
    expect(keyedKeys()).toEqual([])
  })

  it('a browser that remembers Z only by the autosave\'s own stamp (pointer missing) is superseded the same way', () => {
    const zRaw = rememberScenario(Z)
    localStorage.removeItem(POINTER)
    newPage()
    expect(claimColdLoadDeepLink(Y)).toBe('applied')
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
    expect(localStorage.getItem(POINTER)).toBe(Y)
  })
})

describe('FAIL CLOSED: a write that does not hold leaves today\'s behaviour', () => {
  const failSetItemFor = (key: string) => {
    const real = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === key) throw new DOMException('quota', 'QuotaExceededError')
      return real.call(this, k, v)
    })
  }

  it('the preserve does not fit: declined, pointer and main slot and store untouched', () => {
    const zRaw = rememberScenario(Z)
    failSetItemFor(keyedAutosaveSlot(Z))
    expect(claimColdLoadDeepLink(Y)).toBe('declined')
    expect(localStorage.getItem(POINTER)).toBe(Z)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(zRaw)
    expect(useCanvasStore.getState().currentScenarioId).toBe(Z)
  })

  // DL row (b). The preserve is ROLLED BACK: a copy left behind could go stale (Z worked on and left in-app) and come
  // back later through a link to Z.
  it('the pointer does not take: declined; main slot, store and keyed slots exactly as before (the preserve rolled back)', () => {
    const zRaw = rememberScenario(Z)
    localStorage.setItem(keyedAutosaveSlot(Z), olderStateOf(zRaw))
    const before = storageSnapshot()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    failSetItemFor(POINTER)
    expect(claimColdLoadDeepLink(Y)).toBe('declined')
    expect(storageSnapshot()).toEqual(before)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(zRaw)
    expect(useCanvasStore.getState().currentScenarioId).toBe(Z)
  })

  it('…and with no earlier copy, the rolled-back preserve leaves no keyed slot at all', () => {
    rememberScenario(Z)
    const before = storageSnapshot()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    failSetItemFor(POINTER)
    expect(claimColdLoadDeepLink(Y)).toBe('declined')
    expect(storageSnapshot()).toEqual(before)
    expect(keyedKeys()).toEqual([])
  })

  function backToZFromAPageThatRemembersY(): { zRaw: string; yRaw: string } {
    const zRaw = rememberScenario(Z)
    claimColdLoadDeepLink(Y)
    useCanvasStore.setState({ nodes: GRAPH[Y], edges: [] })
    const yRaw = autosaveFromStore()
    newPage()
    return { zRaw, yRaw }
  }

  it('Z\'s own copy does not fit back: the WHOLE claim declines (pointer, main slot and keyed slots as before), so it is retried', () => {
    const { zRaw, yRaw } = backToZFromAPageThatRemembersY()
    const before = storageSnapshot()
    failSetItemFor(MAIN_AUTOSAVE_SLOT)
    expect(claimColdLoadDeepLink(Z)).toBe('declined')
    vi.restoreAllMocks()
    expect(storageSnapshot()).toEqual(before)
    expect(localStorage.getItem(POINTER)).toBe(Y)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(yRaw)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
    expect(useCanvasStore.getState().currentScenarioId).toBe(Y)
  })

  it('…and if the pointer cannot be put back either, the route is adopted over an EMPTY slot (never Y\'s graph under Z), both copies kept', () => {
    const { zRaw, yRaw } = backToZFromAPageThatRemembersY()
    const real = Storage.prototype.setItem
    let pointerWrites = 0
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === MAIN_AUTOSAVE_SLOT) throw new DOMException('quota', 'QuotaExceededError')
      if (k === POINTER && ++pointerWrites > 1) throw new DOMException('quota', 'QuotaExceededError')
      return real.call(this, k, v)
    })
    expect(claimColdLoadDeepLink(Z)).toBe('applied')
    vi.restoreAllMocks()
    expect(localStorage.getItem(POINTER)).toBe(Z)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBeNull()
    expect(useCanvasStore.getState().currentScenarioId).toBe(Z)
    expect(localStorage.getItem(keyedAutosaveSlot(Y))).toBe(yRaw)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
  })

  it('a failed promotion puts an ABSENT original pointer back as absent (never the remembered stamp)', () => {
    const { zRaw, yRaw } = backToZFromAPageThatRemembersY()
    localStorage.removeItem(POINTER) // Y is remembered by its slot's own stamp only
    newPage()
    failSetItemFor(MAIN_AUTOSAVE_SLOT)
    expect(claimColdLoadDeepLink(Z)).toBe('declined')
    vi.restoreAllMocks()
    expect(localStorage.getItem(POINTER)).toBeNull()
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(yRaw)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
    expect(localStorage.getItem(keyedAutosaveSlot(Y))).toBeNull()
  })

  it('a copy that could not be promoted is never stranded: the next cold load of that route promotes it', () => {
    const { zRaw } = backToZFromAPageThatRemembersY()
    // The state the previous row leaves: pointer Z, empty main slot, Z's copy waiting.
    localStorage.setItem(POINTER, Z)
    localStorage.removeItem(MAIN_AUTOSAVE_SLOT)
    newPage()
    expect(planColdLoadDeepLink(Z)).toEqual({ kind: 'promote', route: Z })
    expect(claimColdLoadDeepLink(Z)).toBe('applied')
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(zRaw)
    expect(bootRestore()).toBe(Z)
    expect(onCanvas()).toEqual(['z_factor', 'z_goal'])
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBeNull()
  })

  it('the ORIGINAL pointer comes back exactly: absent stays absent (never replaced by the stamp)', () => {
    const zRaw = rememberScenario(Z)
    localStorage.removeItem(POINTER)
    newPage()
    const before = storageSnapshot()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    failSetItemFor(POINTER)
    expect(claimColdLoadDeepLink(Y)).toBe('declined')
    vi.restoreAllMocks()
    expect(localStorage.getItem(POINTER)).toBeNull()
    expect(storageSnapshot()).toEqual(before)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(zRaw)
  })

  it('a rollback that cannot complete KEEPS the copy: recovery evidence is never deleted on a failure', () => {
    const zRaw = rememberScenario(Z)
    localStorage.setItem(keyedAutosaveSlot(Z), olderStateOf(zRaw))
    const real = Storage.prototype.setItem
    let keyedWrites = 0
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === POINTER) throw new DOMException('quota', 'QuotaExceededError')
      if (k === keyedAutosaveSlot(Z) && ++keyedWrites > 1) throw new DOMException('quota', 'QuotaExceededError')
      return real.call(this, k, v)
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(claimColdLoadDeepLink(Y)).toBe('declined')
    vi.restoreAllMocks()
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw) // the newer duplicate stays; nothing deleted
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(zRaw)
    expect(localStorage.getItem(POINTER)).toBe(Z)
  })
})

describe('NEVER THROWS INTO THE ROUTE\'S RENDER', () => {
  it('storage that refuses every call: the claim declines, and nothing escapes', () => {
    rememberScenario(Z)
    for (const m of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, m).mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError')
      })
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => claimColdLoadDeepLink(Y)).not.toThrow()
    expect(useCanvasStore.getState().currentScenarioId).toBe(Z)
  })

  it('storage that refuses to empty the main slot after the pointer took: no throw, the pointer is undone, and Z\'s graph is never left under pointer Y', () => {
    const zRaw = rememberScenario(Z)
    const realRemove = Storage.prototype.removeItem
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, k: string) {
      if (k === MAIN_AUTOSAVE_SLOT) throw new DOMException('denied', 'SecurityError')
      return realRemove.call(this, k)
    })
    let result: string | undefined
    expect(() => { result = claimColdLoadDeepLink(Y) }).not.toThrow()
    vi.restoreAllMocks()
    expect(result).toBe('declined')
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(zRaw)
    expect(localStorage.getItem(POINTER)).toBe(Z)
    expect(useCanvasStore.getState().currentScenarioId).toBe(Z)
    expect(keyedKeys()).toEqual([])
  })
})

describe('§7 OWNERSHIP (Codex round 1): a slot is preserved under its own stamp, never the pointer\'s', () => {
  it('⭐ pointer Z, main slot stamped Y, link Y: nothing of Y is filed under Z, and the slot stays as Y\'s own', () => {
    rememberScenario(Z)
    useCanvasStore.setState({ currentScenarioId: Y, nodes: GRAPH[Y], edges: [] })
    const yRaw = autosaveFromStore() // the pointer is still Z: a stale slot by the boot rule, but Y's graph
    newPage()
    expect(claimColdLoadDeepLink(Y)).toBe('applied')
    expect(keyedKeys()).toEqual([])
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(yRaw)
    expect(localStorage.getItem(POINTER)).toBe(Y)
    expect(bootRestore()).toBe(Y)
    expect(onCanvas()).toEqual(['y_goal'])
  })

  it('pointer Z, main slot stamped W, link Y: the slot is kept under W, never under Z', () => {
    rememberScenario(Z)
    useCanvasStore.setState({ currentScenarioId: W, nodes: GRAPH[Z], edges: [] })
    const wRaw = autosaveFromStore()
    newPage()
    expect(claimColdLoadDeepLink(Y)).toBe('applied')
    expect(localStorage.getItem(keyedAutosaveSlot(W))).toBe(wRaw)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBeNull()
  })

  it('a main slot that states no readable owner is ambiguous: nothing is superseded, nothing written', () => {
    for (const bytes of ['{"timestamp":1,"nodes":[],"edges":[]}', 'not json']) {
      localStorage.clear()
      localStorage.setItem(POINTER, Z)
      localStorage.setItem(MAIN_AUTOSAVE_SLOT, bytes)
      newPage()
      const before = storageSnapshot()
      expect(planColdLoadDeepLink(Y)).toBeNull()
      expect(claimColdLoadDeepLink(Y)).toBe('declined')
      expect(storageSnapshot()).toEqual(before)
    }
  })

  it('a preserved copy is promoted only when it parses and is stamped with the route: a foreign one is left alone', () => {
    rememberScenario(Z)
    const foreign = JSON.stringify({ timestamp: 5, scenarioId: W, nodes: [], edges: [] })
    localStorage.setItem(keyedAutosaveSlot(Y), foreign)
    expect(claimColdLoadDeepLink(Y)).toBe('applied')
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBeNull()
    expect(localStorage.getItem(keyedAutosaveSlot(Y))).toBe(foreign)
  })
})

describe('§8 FRESHNESS (Codex round 1): a copy retires once a newer state of its own scenario is on screen', () => {
  const slot = (id: string, timestamp: number, label: string) =>
    JSON.stringify({ timestamp, scenarioId: id, nodes: [goal(`${label}_n`, label)], edges: [] })

  it('⭐ the boot restored a NEWER slot stamped Z: Z\'s older copy is retired', () => {
    localStorage.setItem(keyedAutosaveSlot(Z), slot(Z, 100, 'old'))
    localStorage.setItem(MAIN_AUTOSAVE_SLOT, slot(Z, 200, 'new'))
    expect(settleKeyedAutosaveCopy(Z)).toBe(true)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBeNull()
  })

  it('CONTROL: an OLDER restored slot, or one stamped with another id, leaves the copy', () => {
    localStorage.setItem(keyedAutosaveSlot(Z), slot(Z, 200, 'copy'))
    localStorage.setItem(MAIN_AUTOSAVE_SLOT, slot(Z, 100, 'older'))
    expect(settleKeyedAutosaveCopy(Z)).toBe(false)
    localStorage.setItem(MAIN_AUTOSAVE_SLOT, slot(W, 300, 'other'))
    expect(settleKeyedAutosaveCopy(Z)).toBe(false)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(slot(Z, 200, 'copy'))
  })
})

describe('§9 SIGN-OUT (Codex round 1): the preserved copies are as private as the main slot', () => {
  it('⭐ clearUserScopedState removes every preserved copy, and a contrast key outside the prefix survives', () => {
    rememberScenario(Z)
    claimColdLoadDeepLink(Y)
    localStorage.setItem(keyedAutosaveSlot(W), 'w-copy')
    localStorage.setItem('olumi-canvas-autosave-v1', 'versioned-storage-contrast')
    expect(keyedKeys()).toEqual([keyedAutosaveSlot(Z), keyedAutosaveSlot(W)].sort())
    clearUserScopedState()
    expect(keyedKeys()).toEqual([])
    expect(localStorage.getItem('olumi-canvas-autosave-v1')).toBe('versioned-storage-contrast')
  })

  // Codex (scoped delta review): `clearAllScenarioStorage` removes the main slot, the scenarios list and the pointer
  // unguarded BEFORE the sweep, so each of those refusing used to stop it too.
  it.each([
    ['a preserved copy', keyedAutosaveSlot(Z)],
    ['the main slot', MAIN_AUTOSAVE_SLOT],
    ['the scenarios list', 'olumi-canvas-scenarios'],
    ['the pointer', POINTER],
  ])('⭐ (Codex round 3) %s cannot be removed: the sweep never stops, every other user-scoped key is still removed', (_what, refused) => {
    const planted = [
      'olumi-canvas-scenarios',
      keyedAutosaveSlot(W), 'olumi.dissent.v2.first', keyedAutosaveSlot(Z), keyedAutosaveSlot(Y), 'olumi.dissent.v2.last',
      MAIN_AUTOSAVE_SLOT, POINTER,
    ]
    for (const k of planted) localStorage.setItem(k, `value-of-${k}`)
    sessionStorage.setItem('olumi-cee-analysis-ready', 'ready')
    const realRemove = Storage.prototype.removeItem
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, k: string) {
      if (k === refused) throw new DOMException('denied', 'SecurityError')
      return realRemove.call(this, k)
    })
    expect(() => clearUserScopedState()).not.toThrow()
    vi.restoreAllMocks()
    expect(planted.filter((k) => localStorage.getItem(k) !== null)).toEqual([refused])
    expect(sessionStorage.getItem('olumi-cee-analysis-ready')).toBeNull()
  })

  it('the sweep\'s prefix is the key format\'s owner (`keyedAutosaveKey`), and it never matches the main slot', () => {
    const prefix = USER_SCOPED_STORAGE_PREFIXES.find((p) => keyedAutosaveSlot(Z).startsWith(p))
    expect(prefix).toBe('olumi-canvas-autosave:')
    expect(scenarios.keyedAutosaveKey('x').startsWith(prefix as string)).toBe(true)
    expect(MAIN_AUTOSAVE_SLOT.startsWith(prefix as string)).toBe(false)
  })
})

describe('§10 TRANSACTIONS (Codex round 2): a read-back that fails once, a rollback that fails, an emergency that fails', () => {
  /** getItem(key) throws exactly once, the first time it is read after `armed()` turns true. */
  function throwOnceOnRead(key: string, armed: () => boolean): void {
    const real = Storage.prototype.getItem
    let thrown = false
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, k: string) {
      if (!thrown && k === key && armed()) {
        thrown = true
        throw new DOMException('denied', 'SecurityError')
      }
      return real.call(this, k)
    })
  }
  function watchWrites(): { removed: Set<string>; set: Set<string> } {
    const removed = new Set<string>()
    const set = new Set<string>()
    const realRemove = Storage.prototype.removeItem
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, k: string) {
      removed.add(k)
      return realRemove.call(this, k)
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      set.add(k)
      return realSet.call(this, k, v)
    })
    return { removed, set }
  }

  it('⭐ the main slot\'s removal took but its read-back failed: Z\'s graph is put BACK before its copy is undone (never lost)', () => {
    const zRaw = rememberScenario(Z)
    const w = watchWrites()
    throwOnceOnRead(MAIN_AUTOSAVE_SLOT, () => w.removed.has(MAIN_AUTOSAVE_SLOT))
    expect(claimColdLoadDeepLink(Y)).toBe('declined')
    vi.restoreAllMocks()
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(zRaw)
    expect(localStorage.getItem(POINTER)).toBe(Z)
    expect(keyedKeys()).toEqual([])
    expect(coldLoadBlocksBootRestore()).toBe(false)
  })

  it('⭐ the pointer comes back but the main slot cannot: it is EMPTIED, the copy (Z\'s only graph) is kept, and a reload brings Z back', () => {
    const zRaw = rememberScenario(Z)
    const w = watchWrites()
    vi.restoreAllMocks()
    const realSet = Storage.prototype.setItem
    const realRemove = Storage.prototype.removeItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === MAIN_AUTOSAVE_SLOT) throw new DOMException('quota', 'QuotaExceededError')
      return realSet.call(this, k, v)
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, k: string) {
      w.removed.add(k)
      return realRemove.call(this, k)
    })
    throwOnceOnRead(MAIN_AUTOSAVE_SLOT, () => w.removed.has(MAIN_AUTOSAVE_SLOT))
    expect(claimColdLoadDeepLink(Y)).toBe('declined')
    vi.restoreAllMocks()
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBeNull()
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
    expect(localStorage.getItem(POINTER)).toBe(Z)
    // Storage names ONE scenario (Z, nothing in the main slot), so nothing needs blocking, on this page or the next.
    expect(coldLoadBlocksBootRestore()).toBe(false)
    newPage()
    expect(claimColdLoadDeepLink(undefined)).toBe('applied') // the routeless reload promotes the copy
    expect(bootRestore()).toBe(Z)
    expect(onCanvas()).toEqual(['z_factor', 'z_goal'])
    expect(keyedKeys()).toEqual([])
  })

  it('⭐ (Codex round 3) a promotion that cannot be undone over a page that remembers Y: the main slot is EMPTIED, never Z\'s graph under pointer Y across a reload', () => {
    const zRaw = rememberScenario(Z)
    claimColdLoadDeepLink(Y)
    useCanvasStore.setState({ nodes: GRAPH[Y], edges: [] })
    const yRaw = autosaveFromStore()
    newPage() // pointer Y, main slot Y's, Z's copy waiting
    const realSet = Storage.prototype.setItem
    const realGet = Storage.prototype.getItem
    let mainWrites = 0
    let thrown = false
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === MAIN_AUTOSAVE_SLOT && ++mainWrites > 1) throw new DOMException('quota', 'QuotaExceededError')
      return realSet.call(this, k, v)
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, k: string) {
      if (!thrown && k === MAIN_AUTOSAVE_SLOT && mainWrites === 1) {
        thrown = true
        throw new DOMException('denied', 'SecurityError')
      }
      return realGet.call(this, k)
    })
    expect(claimColdLoadDeepLink(Z)).toBe('declined')
    vi.restoreAllMocks()
    expect(thrown).toBe(true)
    expect(localStorage.getItem(POINTER)).toBe(Y)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBeNull()
    expect(localStorage.getItem(keyedAutosaveSlot(Y))).toBe(yRaw)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
    expect(coldLoadBlocksBootRestore()).toBe(false)
    // The reload (the page flag is gone) restores Y's own graph under Y, and Z's copy still waits for Z's link.
    newPage()
    expect(claimColdLoadDeepLink(undefined)).toBe('applied')
    expect(bootRestore()).toBe(Y)
    expect(onCanvas()).toEqual(['y_goal'])
    expect(keyedKeys()).toEqual([keyedAutosaveSlot(Z)])
  })

  it('the final check cannot read the pointer back: fail closed, storage is put back exactly (Z, its graph, no copy)', () => {
    const zRaw = rememberScenario(Z)
    const w = watchWrites()
    throwOnceOnRead(POINTER, () => w.removed.has(MAIN_AUTOSAVE_SLOT))
    expect(claimColdLoadDeepLink(Y)).toBe('declined')
    vi.restoreAllMocks()
    expect(useCanvasStore.getState().currentScenarioId).not.toBe(Y)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(zRaw)
    expect(localStorage.getItem(POINTER)).toBe(Z)
    expect(keyedKeys()).toEqual([])
    expect(coldLoadBlocksBootRestore()).toBe(false)
  })

  it('⭐ a promotion that took but read back badly: never Z\'s graph under pointer Y, and Y\'s copy is not removed', () => {
    const zRaw = rememberScenario(Z)
    claimColdLoadDeepLink(Y)
    useCanvasStore.setState({ nodes: GRAPH[Y], edges: [] })
    const yRaw = autosaveFromStore()
    newPage()
    const w = watchWrites()
    throwOnceOnRead(MAIN_AUTOSAVE_SLOT, () => w.set.has(MAIN_AUTOSAVE_SLOT))
    expect(claimColdLoadDeepLink(Z)).toBe('declined')
    vi.restoreAllMocks()
    expect(localStorage.getItem(POINTER)).toBe(Y)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(yRaw)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
    expect(localStorage.getItem(keyedAutosaveSlot(Y))).toBeNull()
  })

  it('⭐ the pointer took but read back badly and cannot be put back: storage converges on the route (main emptied, Z kept in its copy)', () => {
    const zRaw = rememberScenario(Z)
    const w = watchWrites()
    vi.restoreAllMocks()
    const real = Storage.prototype.setItem
    let pointerWrites = 0
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === POINTER && ++pointerWrites > 1) throw new DOMException('quota', 'QuotaExceededError')
      w.set.add(k)
      return real.call(this, k, v)
    })
    throwOnceOnRead(POINTER, () => pointerWrites === 1)
    expect(claimColdLoadDeepLink(Y)).toBe('applied')
    vi.restoreAllMocks()
    expect(localStorage.getItem(POINTER)).toBe(Y)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBeNull()
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
    expect(useCanvasStore.getState().currentScenarioId).toBe(Y)
  })

  it('⭐ nothing can be put back AND the main slot cannot be emptied: declined, and this page restores NO autosave at boot', () => {
    const zRaw = rememberScenario(Z)
    claimColdLoadDeepLink(Y)
    useCanvasStore.setState({ nodes: GRAPH[Y], edges: [] })
    autosaveFromStore()
    newPage()
    const realSet = Storage.prototype.setItem
    const realRemove = Storage.prototype.removeItem
    let pointerWrites = 0
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === MAIN_AUTOSAVE_SLOT) throw new DOMException('quota', 'QuotaExceededError')
      if (k === POINTER && ++pointerWrites > 1) throw new DOMException('quota', 'QuotaExceededError')
      return realSet.call(this, k, v)
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(function (this: Storage, k: string) {
      if (k === MAIN_AUTOSAVE_SLOT) throw new DOMException('denied', 'SecurityError')
      return realRemove.call(this, k)
    })
    expect(claimColdLoadDeepLink(Z)).toBe('declined')
    vi.restoreAllMocks()
    expect(coldLoadBlocksBootRestore()).toBe(true)
    expect(bootRestore()).toBe('not_autosave') // the mismatched slot is never bound to anything
    expect(onCanvas()).toEqual([])
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
  })
})

describe('§11 FRESHNESS (Codex round 2): a copy is never older than its scenario\'s own newer work', () => {
  const slot = (id: string, timestamp: number, label: string) =>
    JSON.stringify({ timestamp, scenarioId: id, nodes: [goal(`${label}_n`, label)], edges: [] })

  it('⭐ a NEWER preserved copy is never overwritten by an older main slot', () => {
    localStorage.setItem(POINTER, Z)
    localStorage.setItem(MAIN_AUTOSAVE_SLOT, slot(Z, 100, 'older'))
    localStorage.setItem(keyedAutosaveSlot(Z), slot(Z, 200, 'newer'))
    newPage()
    expect(claimColdLoadDeepLink(Y)).toBe('applied')
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(slot(Z, 200, 'newer'))
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBeNull()
  })

  it('⭐ re-entering Z in the page and leaving it again refreshes Z\'s copy, so a later link promotes the newer work', () => {
    rememberScenario(Z)
    expect(claimColdLoadDeepLink(Y)).toBe('applied') // Z preserved; the page now watches copies
    // In-page: back into Z (an in-app load), moved on, autosaved; then off to W.
    useCanvasStore.setState({ currentScenarioId: Z, nodes: [goal('z_goal', 'Z: grow revenue (moved)')], edges: [] })
    const zNewer = autosaveFromStore()
    useCanvasStore.setState({ currentScenarioId: W, nodes: [], edges: [] })
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zNewer)
    // The main slot moves on to W; later, a cold link to Z promotes the newer copy.
    useCanvasStore.setState({ nodes: GRAPH[Z], edges: [] })
    autosaveFromStore()
    newPage()
    expect(claimColdLoadDeepLink(Z)).toBe('applied')
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(zNewer)
  })

  it('CONTROL: leaving a scenario that has no copy creates none, and an older main slot never refreshes a copy', () => {
    rememberScenario(Z)
    claimColdLoadDeepLink(Y)
    useCanvasStore.setState({ currentScenarioId: W, nodes: [], edges: [] }) // leave Y: Y has no copy
    expect(localStorage.getItem(keyedAutosaveSlot(Y))).toBeNull()
    localStorage.setItem(keyedAutosaveSlot(Z), slot(Z, 500, 'copy'))
    localStorage.setItem(MAIN_AUTOSAVE_SLOT, slot(Z, 400, 'older'))
    expect(refreshExistingCopy(Z)).toBe(false)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(slot(Z, 500, 'copy'))
  })
})

describe('§12 RECOVERY ENTRY (Codex round 2): a waiting copy is found without a remembered scenario, and without a route', () => {
  it('⭐ after "Start fresh" (nothing remembered), a link to Z promotes Z\'s waiting copy', () => {
    const zRaw = rememberScenario(Z)
    claimColdLoadDeepLink(Y)
    localStorage.removeItem(POINTER) // Start fresh: pointer and main slot cleared
    localStorage.removeItem(MAIN_AUTOSAVE_SLOT)
    newPage()
    expect(planColdLoadDeepLink(Z)).toEqual({ kind: 'promote', route: Z })
    expect(claimColdLoadDeepLink(Z)).toBe('applied')
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(zRaw)
    expect(localStorage.getItem(POINTER)).toBe(Z)
    expect(bootRestore()).toBe(Z)
    expect(onCanvas()).toEqual(['z_factor', 'z_goal'])
  })

  it('⭐ a routeless load (`/canvas`) of the remembered Z with an empty main slot promotes Z\'s waiting copy', () => {
    const zRaw = rememberScenario(Z)
    claimColdLoadDeepLink(Y)
    localStorage.setItem(POINTER, Z)
    localStorage.removeItem(MAIN_AUTOSAVE_SLOT)
    newPage()
    expect(claimColdLoadDeepLink(undefined)).toBe('applied')
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(zRaw)
    expect(bootRestore()).toBe(Z)
  })

  it('CONTROL: a routeless load with nothing waiting writes nothing; an unaddressable route never targets the remembered one', () => {
    const zRaw = rememberScenario(Z)
    const before = storageSnapshot()
    expect(planColdLoadDeepLink(undefined)).toBeNull()
    expect(planColdLoadDeepLink('local-draft-1')).toBeNull()
    expect(claimColdLoadDeepLink(undefined)).toBe('declined')
    expect(storageSnapshot()).toEqual(before)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(zRaw)
  })
})

describe('§13 ORDERING (Codex round 3): a copy is replaced or retired only by a PROVABLY newer state of its scenario', () => {
  const slot = (id: string, timestamp: number, label: string) =>
    JSON.stringify({ timestamp, scenarioId: id, nodes: [goal(`${label}_n`, label)], edges: [] })
  function remember(main: string, copy: string): Record<string, string | null> {
    localStorage.setItem(POINTER, Z)
    localStorage.setItem(MAIN_AUTOSAVE_SLOT, main)
    localStorage.setItem(keyedAutosaveSlot(Z), copy)
    newPage()
    return storageSnapshot()
  }

  it('⭐ a main slot with NO timestamp never overwrites Z\'s valid copy: the claim declines and storage is untouched', () => {
    const before = remember(JSON.stringify({ scenarioId: Z }), slot(Z, 200, 'only'))
    expect(claimColdLoadDeepLink(Y)).toBe('declined')
    expect(storageSnapshot()).toEqual(before)
    expect(useCanvasStore.getState().currentScenarioId).toBe(Z)
  })

  it('EQUAL timestamps with different bytes cannot be ordered: declined, both kept', () => {
    const before = remember(slot(Z, 200, 'main'), slot(Z, 200, 'copy'))
    expect(claimColdLoadDeepLink(Y)).toBe('declined')
    expect(storageSnapshot()).toEqual(before)
  })

  it('another scenario\'s bytes under Z\'s key are never overwritten, even by a later Z', () => {
    const before = remember(slot(Z, 300, 'z'), slot(W, 100, 'w'))
    expect(claimColdLoadDeepLink(Y)).toBe('declined')
    expect(storageSnapshot()).toEqual(before)
  })

  it('CONTROL: a STRICTLY newer main slot replaces the older copy, and the link wins', () => {
    remember(slot(Z, 300, 'newer'), slot(Z, 200, 'older'))
    expect(claimColdLoadDeepLink(Y)).toBe('applied')
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(slot(Z, 300, 'newer'))
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBeNull()
    expect(localStorage.getItem(POINTER)).toBe(Y)
  })

  it('CONTROL: a copy byte-identical to the main slot is no obstacle: the link wins and the copy stays', () => {
    remember(slot(Z, 200, 'same'), slot(Z, 200, 'same'))
    expect(claimColdLoadDeepLink(Y)).toBe('applied')
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(slot(Z, 200, 'same'))
  })

  it('the retire and the refresh never act on an equal timestamp with different bytes: the copy is kept', () => {
    localStorage.setItem(keyedAutosaveSlot(Z), slot(Z, 200, 'copy'))
    localStorage.setItem(MAIN_AUTOSAVE_SLOT, slot(Z, 200, 'main'))
    expect(settleKeyedAutosaveCopy(Z)).toBe(false)
    expect(refreshExistingCopy(Z)).toBe(false)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(slot(Z, 200, 'copy'))
  })
})

describe('§6 the steps the drive cannot execute (SOURCE scans, and only these)', () => {
  const src = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8')

  it('the PROD boot branch hydrates, binds by the load-source pointer, THEN retires the copy, in that order', () => {
    const rfg = src('canvas/ReactFlowGraph.tsx')
    const anchor = rfg.indexOf("if (loadSource === 'autosave' && autosave) {")
    expect(anchor).toBeGreaterThan(-1)
    const decide = rfg.lastIndexOf('const loadSource = resolveBootLoadSource(currentId, autosave, scenario)', anchor)
    expect(decide).toBeGreaterThan(rfg.lastIndexOf('const currentId = scenarios.getCurrentScenarioId()', anchor))
    expect(rfg.lastIndexOf('const autosave = coldLoadBlocksBootRestore() ? null : scenarios.loadAutosave()', anchor)).toBeGreaterThan(-1)
    const hydrate = rfg.indexOf('useCanvasStore.getState().hydrateGraphSlice({', anchor)
    const bind = rfg.indexOf('const restoredBoundId = bindRestoredScenarioId(currentId, autosave)', anchor)
    const settle = rfg.indexOf('settleKeyedAutosaveCopy(restoredBoundId)', anchor)
    expect(hydrate).toBeGreaterThan(anchor)
    expect(bind).toBeGreaterThan(hydrate)
    expect(settle).toBeGreaterThan(bind)
    // …all inside that branch: before the `else if (loadSource === 'scenario'` that closes it.
    expect(settle).toBeLessThan(rfg.indexOf("} else if (loadSource === 'scenario' && currentId) {", anchor))
  })

  it('CanvasMVP is a gate around its body: the body (useScenario, the hydration hook, every reader) mounts only when ready', () => {
    const mvp = src('routes/CanvasMVP.tsx')
    const outer = mvp.slice(mvp.indexOf('export default function CanvasMVP()'), mvp.indexOf('function CanvasMVPBody()'))
    expect(outer).toMatch(/return useColdLoadDeepLinkGate\(scenarioIdFromRoute\) \? <CanvasMVPBody \/> : null/)
    expect(outer).not.toMatch(/useScenario\(|currentScenarioId|useServerGraphHydration/)
    const body = mvp.slice(mvp.indexOf('function CanvasMVPBody()'))
    expect(body).toMatch(/\} = useScenario\(\)/)
    expect(body).toMatch(/useServerGraphHydration\(scenarioIdFromRoute/)
  })

  it('the gate WRITES only at commit: the plan is reads only, and the claim runs inside the layout effect', () => {
    const mod = src('canvas/hydrate/coldLoadDeepLink.ts')
    const plan = mod.slice(mod.indexOf('export function planColdLoadDeepLink('), mod.indexOf('/** Apply `plan`'))
    expect(plan.length).toBeGreaterThan(200)
    expect(plan).not.toMatch(/write\(|setItem|removeItem|setState|setCurrentScenarioId/)
    const gate = mod.slice(mod.indexOf('export function useColdLoadDeepLinkGate('), mod.indexOf('/** The route this page'))
    const effect = gate.slice(gate.indexOf('useLayoutEffect('))
    expect(gate.indexOf('claimColdLoadDeepLink(')).toBeGreaterThan(gate.indexOf('useLayoutEffect('))
    expect(effect).toMatch(/claimColdLoadDeepLink\(route, !ready\)/)
  })
})
