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
  supersedeRememberedScenario,
  keyedAutosaveSlot,
  claimColdLoadDeepLink,
  coldLoadClaimedRoute,
  settleKeyedAutosaveCopy,
  __resetColdLoadDeepLinkForTests,
} from '../coldLoadDeepLink'
import { resolveBootLoadSource, bindRestoredScenarioId } from '../../ReactFlowGraph'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import { projectAutosaveData, autosaveSourceFromStore } from '../../store/autosaveProjection'

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
  const autosave = scenarios.loadAutosave()
  const scenario = currentId ? scenarios.getScenario(currentId) : null
  const loadSource = resolveBootLoadSource(currentId, autosave, scenario)
  if (loadSource !== 'autosave' || !autosave) return 'not_autosave'
  useCanvasStore.getState().hydrateGraphSlice({ nodes: autosave.nodes, edges: autosave.edges, goalConstraints: autosave.goalConstraints ?? null })
  const restoredBoundId = bindRestoredScenarioId(currentId, autosave)
  settleKeyedAutosaveCopy(restoredBoundId)
  return restoredBoundId
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

describe('§1b DL row (a): idempotent — the supersede writes during the route\'s render', () => {
  it('⭐ a second run on the same cold load changes nothing: byte-identical storage, no second preserve, no :<Y> self-copy', () => {
    const zRaw = rememberScenario(Z)
    expect(claimColdLoadDeepLink(Y)).toBe('applied')
    const once = storageSnapshot()

    expect(claimColdLoadDeepLink(Y)).toBe('not_first') // a re-render before commit
    expect(supersedeRememberedScenario(Y)).toBe('declined') // and the writes themselves: pointer already Y → no-op
    expect(storageSnapshot()).toEqual(once)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
    expect(localStorage.getItem(keyedAutosaveSlot(Y))).toBeNull()
    expect(useCanvasStore.getState().currentScenarioId).toBe(Y)
  })

  it('⭐ under StrictMode\'s double render, the route component\'s claim applies once', () => {
    const zRaw = rememberScenario(Z)
    const results: string[] = []
    function Route(): null {
      results.push(claimColdLoadDeepLink(Y))
      return null
    }
    render(createElement(StrictMode, null, createElement(Route)))
    expect(results[0]).toBe('applied')
    expect(results.slice(1).every((r) => r === 'not_first')).toBe(true)
    expect(results.length).toBeGreaterThan(1) // StrictMode did render twice: the instrument saw the repeat
    expect(localStorage.getItem(POINTER)).toBe(Y)
    expect(localStorage.getItem(keyedAutosaveSlot(Z))).toBe(zRaw)
    expect(localStorage.getItem(keyedAutosaveSlot(Y))).toBeNull()
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
    localStorage.setItem(keyedAutosaveSlot(Z), 'an-older-copy-of-z')
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

  it('Y\'s own copy does not fit back: the main slot is emptied, never left holding Z under pointer Y', () => {
    rememberScenario(Z)
    claimColdLoadDeepLink(Y)
    useCanvasStore.setState({ nodes: GRAPH[Y], edges: [] })
    const yRaw = autosaveFromStore()
    // Back to Z in a page that remembers Y, with Y's copy present and the main slot refusing writes.
    newPage()
    localStorage.setItem(keyedAutosaveSlot(Z), 'z-copy')
    failSetItemFor(MAIN_AUTOSAVE_SLOT)
    expect(claimColdLoadDeepLink(Z)).toBe('applied')
    expect(localStorage.getItem(POINTER)).toBe(Z)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBeNull()
    expect(localStorage.getItem(keyedAutosaveSlot(Y))).toBe(yRaw)
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
    expect(rfg.lastIndexOf('const autosave = scenarios.loadAutosave()', anchor)).toBeGreaterThan(-1)
    const hydrate = rfg.indexOf('useCanvasStore.getState().hydrateGraphSlice({', anchor)
    const bind = rfg.indexOf('const restoredBoundId = bindRestoredScenarioId(currentId, autosave)', anchor)
    const settle = rfg.indexOf('settleKeyedAutosaveCopy(restoredBoundId)', anchor)
    expect(hydrate).toBeGreaterThan(anchor)
    expect(bind).toBeGreaterThan(hydrate)
    expect(settle).toBeGreaterThan(bind)
    // …all inside that branch: before the `else if (loadSource === 'scenario'` that closes it.
    expect(settle).toBeLessThan(rfg.indexOf("} else if (loadSource === 'scenario' && currentId) {", anchor))
  })

  it('CanvasMVP claims the link before useScenario() and before any read of the scenario id', () => {
    const mvp = src('routes/CanvasMVP.tsx')
    const params = mvp.indexOf('const { id: scenarioIdFromRoute } = useParams')
    const claim = mvp.indexOf('claimColdLoadDeepLink(scenarioIdFromRoute)')
    expect(params).toBeGreaterThan(-1)
    expect(claim).toBeGreaterThan(params)
    expect(claim).toBeLessThan(mvp.indexOf('} = useScenario()'))
    expect(claim).toBeLessThan(mvp.indexOf('useServerGraphHydration(scenarioIdFromRoute'))
    const firstIdRead = mvp.search(/\bcurrentScenarioId\b/)
    expect(firstIdRead === -1 || claim < firstIdRead).toBe(true)
  })
})
