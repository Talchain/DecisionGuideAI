/**
 * ⭐ A LINK OPENED LATER IN THE SAME TAB SWITCHES TO ITS SCENARIO (BLOCKER22, Acceptance #87 5986279838; DL 0df0e1).
 *
 * Served dade7fe8: changing the address to `#/scenario/<df14>` in a tab holding the J4 scenario kept J4 on screen and
 * never requested df14's graph. Round 2 answers Codex r1 (#2486): the switch is VERIFIED before the reload (unsaved work
 * declines it; A's flush must land; storage names B before the reload, whatever another tab left in the pointer), B's
 * readers are fenced while it is decided, and a declined switch puts the address back.
 *
 * DRIVEN against the real `useCanvasStore`, real `localStorage`, the real flush (`flushWorkToAutosave`, through the
 * provider `store.ts` registers) and the real cold-load writes. Only `window.location.reload` is replaced (jsdom cannot
 * reload); the stub records storage AT THE MOMENT of the reload. Bound by scenario id, slot bytes, node ids, address.
 *
 *   A = the scenario this tab holds · B = the link opened in the same tab
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, StrictMode, type ReactNode } from 'react'
import { renderHook, render, act, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation, useNavigate, type NavigateFunction } from 'react-router-dom'
import type { Node } from '@xyflow/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  MAIN_AUTOSAVE_SLOT,
  keyedAutosaveSlot,
  useInAppLinkSwitch,
  inAppSwitchFences,
  switchToLinkedScenario,
  __setReloadForTests,
  __resetColdLoadDeepLinkForTests,
} from '../coldLoadDeepLink'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
import { flushWorkToAutosave } from '../../persist/crashFlush'
import { projectAutosaveData, autosaveSourceFromStore } from '../../store/autosaveProjection'

const A = 'aaaaaaaa-1111-4111-8111-111111111111'
const B = 'bbbbbbbb-2222-4222-8222-222222222222'
const POINTER = 'olumi-canvas-current-scenario-id'
const PRISTINE = useCanvasStore.getState()

const goal = (id: string, label: string): Node =>
  ({ id, type: 'goal', position: { x: 0, y: 0 }, data: { label, kind: 'goal' } }) as unknown as Node

let clock = 1_000_000
function autosaveFromStore(): string {
  scenarios.saveAutosave(projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState()), (clock += 1000)))
  return localStorage.getItem(MAIN_AUTOSAVE_SLOT) as string
}
/** This tab holds A: its pointer, an autosave stamped A, and then a NEWER edit that only the store has. */
function holdA(): void {
  useCanvasStore.setState({ currentScenarioId: A, nodes: [goal('a_goal', 'A: grow revenue')], edges: [] })
  scenarios.setCurrentScenarioId(A)
  autosaveFromStore()
  useCanvasStore.setState({ nodes: [goal('a_goal', 'A: grow revenue'), goal('a_unsaved', 'A: newest edit')] })
}
const slotNodeIds = (raw: string | null) =>
  raw === null ? null : (JSON.parse(raw) as { nodes: Array<{ id: string }> }).nodes.map((n) => n.id).sort()
const storageSnapshot = () =>
  Object.fromEntries(Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) as string).sort().map((k) => [k, localStorage.getItem(k)]))
const onScreen = () => useCanvasStore.getState().nodes.map((n) => n.id).sort()

let reloads: Array<{ main: string | null; pointer: string | null; keyedA: string | null; storeId: string | null; storeNodes: string[] }> = []
let address = ''
function LocationProbe() {
  address = useLocation().pathname
  return null
}
const routerAt = (path: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(MemoryRouter, { initialEntries: [path] },
      createElement(Routes, null, createElement(Route, { path: '*', element: createElement('div', null, children, createElement(LocationProbe)) })))
  }
/**
 * The route comes from the ROUTER, as `CanvasMVP`'s `useParams` gives it, and the address changes the way a typed link
 * changes it (a navigation), so a declined switch's own navigation back is observable in `address`.
 */
let go: NavigateFunction = () => undefined
function Harness() {
  const location = useLocation()
  go = useNavigate()
  address = location.pathname
  const route = /^\/scenario\/([^/]+)$/.exec(location.pathname)?.[1]
  useInAppLinkSwitch(route ? decodeURIComponent(route) : undefined)
  return null
}
const pathOf = (route: string | undefined) => (route ? `/scenario/${route}` : '/canvas')
function mount(route: string | undefined) {
  render(createElement(MemoryRouter, { initialEntries: [pathOf(route)] }, createElement(Harness)))
  return { rerender: ({ r }: { r: string | undefined }) => act(() => { go(pathOf(r)) }) }
}

beforeEach(() => {
  localStorage.clear()
  __resetColdLoadDeepLinkForTests()
  useCanvasStore.setState(PRISTINE, true)
  reloads = []
  address = ''
  __setReloadForTests(() => {
    const st = useCanvasStore.getState()
    reloads.push({
      main: localStorage.getItem(MAIN_AUTOSAVE_SLOT),
      pointer: localStorage.getItem(POINTER),
      keyedA: localStorage.getItem(keyedAutosaveSlot(A)),
      storeId: st.currentScenarioId ?? null,
      storeNodes: st.nodes.map((n) => n.id),
    })
  })
})
afterEach(() => {
  cleanup()
  __setReloadForTests(null)
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('⭐ the same tab opens B while holding A: storage names B BEFORE the reload', () => {
  it('⭐ A is preserved under its own key WITH its newest edit, the pointer is B, the main slot empty, the store empty under B; one reload', () => {
    holdA()
    const { rerender } = mount(A)
    rerender({ r: B })
    expect(reloads).toHaveLength(1)
    const at = reloads[0]
    expect(slotNodeIds(at.keyedA)).toEqual(['a_goal', 'a_unsaved'])
    expect(JSON.parse(at.keyedA as string).scenarioId).toBe(A)
    expect(at.pointer).toBe(B)
    expect(at.main).toBeNull()
    expect(at.storeId).toBe(B)
    expect(at.storeNodes).toEqual([])
    expect(inAppSwitchFences(B)).toBe(true) // B's readers stay down until the page goes
  })

  it('⭐ …and when B has its own preserved copy, the main slot holds B\'s copy at the reload', () => {
    useCanvasStore.setState({ currentScenarioId: B, nodes: [goal('b_goal', 'B: hire a team')], edges: [] })
    const bCopy = autosaveFromStore()
    localStorage.setItem(keyedAutosaveSlot(B), bCopy)
    localStorage.removeItem(MAIN_AUTOSAVE_SLOT)
    holdA()
    const { rerender } = mount(A)
    rerender({ r: B })
    expect(reloads).toHaveLength(1)
    expect(reloads[0].main).toBe(bCopy)
    expect(slotNodeIds(reloads[0].keyedA)).toEqual(['a_goal', 'a_unsaved'])
  })

  it('⭐ the reload\'s own close flush cannot write A under B (the store holds nothing of A)', () => {
    holdA()
    const { rerender } = mount(A)
    rerender({ r: B })
    const before = storageSnapshot()
    flushWorkToAutosave() // what `pagehide` / `beforeunload` run as the page goes
    expect(storageSnapshot()).toEqual(before)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBeNull()
  })

  it('⭐ another tab already left the pointer on B: A\'s newest work is still preserved under A, never restored as B', () => {
    holdA()
    localStorage.setItem(POINTER, B) // another tab opened B
    const { rerender } = mount(A)
    rerender({ r: B })
    expect(reloads).toHaveLength(1)
    expect(slotNodeIds(reloads[0].keyedA)).toEqual(['a_goal', 'a_unsaved'])
    expect(reloads[0].main).toBeNull() // nothing of A left where B's boot reads
    expect(reloads[0].pointer).toBe(B)
  })

  it('browser Back to A in the same tab is a switch too', () => {
    holdA()
    const { rerender } = mount(A)
    rerender({ r: B })
    // (the reload is stubbed, so the page stays: it now holds B, with B's work on screen)
    useCanvasStore.setState({ nodes: [goal('b_goal', 'B: hire a team')] })
    rerender({ r: A })
    expect(reloads).toHaveLength(2)
  })
})

describe('⭐ a switch that cannot be made safely is DECLINED: no reload, storage as it was, the address back on A', () => {
  it('⭐ unsaved work the page would warn about (its own beforeunload guard) declines it', () => {
    holdA()
    const guard = (e: Event) => e.preventDefault()
    window.addEventListener('beforeunload', guard)
    try {
      const { rerender } = mount(A)
      const before = storageSnapshot()
      rerender({ r: B })
      expect(reloads).toHaveLength(0)
      expect(storageSnapshot()).toEqual(before)
      expect(address).toBe(`/scenario/${A}`)
      expect(onScreen()).toEqual(['a_goal', 'a_unsaved'])
    } finally {
      window.removeEventListener('beforeunload', guard)
    }
  })

  it('⭐ A\'s flush did not land (storage refused the write): declined, A\'s newest edit is still on screen', () => {
    holdA()
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === MAIN_AUTOSAVE_SLOT) throw new DOMException('quota', 'QuotaExceededError')
      return realSet.call(this, k, v)
    })
    const { rerender } = mount(A)
    rerender({ r: B })
    expect(reloads).toHaveLength(0)
    expect(localStorage.getItem(POINTER)).toBe(A)
    expect(address).toBe(`/scenario/${A}`)
    expect(onScreen()).toEqual(['a_goal', 'a_unsaved'])
  })

  it('A emptied on screen (the flush never writes an empty graph): declined, not preserved as the old graph', () => {
    holdA()
    useCanvasStore.setState({ nodes: [], edges: [] })
    expect(switchToLinkedScenario(B, A)).toBe('declined:not_preserved')
    expect(reloads).toHaveLength(0)
  })

  it('the pointer cannot be written: declined, the pointer back on A and the main slot A\'s newest work', () => {
    holdA()
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === POINTER && v === B) throw new DOMException('denied', 'SecurityError')
      return realSet.call(this, k, v)
    })
    expect(switchToLinkedScenario(B, A)).toBe('declined:storage')
    expect(localStorage.getItem(POINTER)).toBe(A)
    // The main slot is still A's newest work (the switch's own flush wrote it, with its own timestamp), and no copy of
    // it was left behind as the only place it lives.
    const main = localStorage.getItem(MAIN_AUTOSAVE_SLOT)
    expect(JSON.parse(main as string).scenarioId).toBe(A)
    expect(slotNodeIds(main)).toEqual(['a_goal', 'a_unsaved'])
    expect(reloads).toHaveLength(0)
    expect(onScreen()).toEqual(['a_goal', 'a_unsaved'])
  })

  it('a declined switch lifts the fence: its own navigation back to A reaches the route', () => {
    holdA()
    const guard = (e: Event) => e.preventDefault()
    window.addEventListener('beforeunload', guard)
    try {
      const { rerender } = mount(A)
      rerender({ r: B })
      // The declined switch's own replace back to A reached the route, and that lifted the fence.
      expect(address).toBe(`/scenario/${A}`)
      expect(inAppSwitchFences(B)).toBe(false)
      expect(reloads).toHaveLength(0)
    } finally {
      window.removeEventListener('beforeunload', guard)
    }
  })
})

describe('NOT a switch: no reload, no fence, storage byte-identical', () => {
  it('the first mount (the gate decides that), also under StrictMode\'s double effects', () => {
    holdA()
    const before = storageSnapshot()
    const Router = routerAt(`/scenario/${B}`)
    renderHook(() => useInAppLinkSwitch(B), {
      wrapper: ({ children }) => createElement(StrictMode, null, createElement(Router, null, children)),
    })
    expect(reloads).toHaveLength(0)
    expect(inAppSwitchFences(B)).toBe(false)
    expect(storageSnapshot()).toEqual(before)
  })

  it('a re-render on the same route', () => {
    holdA()
    const { rerender } = mount(A)
    const before = storageSnapshot()
    rerender({ r: A })
    expect(reloads).toHaveLength(0)
    expect(storageSnapshot()).toEqual(before)
  })

  it('the store already holds B (the app set it before navigating: createScenario, the guest copy\'s adoptScenario)', () => {
    holdA()
    const { rerender } = mount(A)
    useCanvasStore.setState({ currentScenarioId: B })
    const before = storageSnapshot()
    rerender({ r: B })
    expect(reloads).toHaveLength(0)
    expect(inAppSwitchFences(B)).toBe(false)
    expect(storageSnapshot()).toEqual(before)
  })

  it('a route that names no scenario (`/canvas`) or one CEE cannot address', () => {
    holdA()
    const { rerender } = mount(A)
    const before = storageSnapshot()
    rerender({ r: undefined })
    rerender({ r: 'not-a-scenario-id' })
    expect(reloads).toHaveLength(0)
    expect(storageSnapshot()).toEqual(before)
  })

  it('an unbound canvas (a guest\'s draft with no id): today\'s behaviour (#2383)', () => {
    useCanvasStore.setState({ currentScenarioId: null, nodes: [goal('draft_goal', 'Draft')], edges: [] })
    const { rerender } = mount(undefined)
    const before = storageSnapshot()
    rerender({ r: B })
    expect(reloads).toHaveLength(0)
    expect(storageSnapshot()).toEqual(before)
  })
})

describe('the served route mounts it, and B\'s readers honour the fence', () => {
  const src = (rel: string) => readFileSync(join(__dirname, rel), 'utf8')

  it('`CanvasMVP` (the element of `/scenario/:id` and `/canvas`) calls it with the route, before the gate decides', () => {
    const file = src('../../../routes/CanvasMVP.tsx')
    const body = file.slice(file.indexOf('export default function CanvasMVP()'))
    const call = body.indexOf('useInAppLinkSwitch(scenarioIdFromRoute)')
    const gate = body.indexOf('useColdLoadDeepLinkGate(scenarioIdFromRoute)')
    expect(call).toBeGreaterThan(0)
    expect(gate).toBeGreaterThan(call)
    expect(body.slice(0, call)).not.toMatch(/return\b/) // never behind an early return
  })

  it('the Supabase load effect stands down for a fenced route before it loads', () => {
    const file = src('../../../routes/CanvasMVP.tsx')
    const load = file.indexOf('loadSupabaseScenario(id)')
    const effect = file.lastIndexOf('useEffect(() => {', load)
    const fence = file.indexOf('if (inAppSwitchFences(scenarioIdFromRoute)) return', effect)
    expect(effect).toBeGreaterThan(0)
    expect(fence).toBeGreaterThan(effect)
    expect(fence).toBeLessThan(load)
  })

  it('the CEE read and the route adoption stand down for a fenced route', () => {
    const file = src('../../hooks/useServerGraphHydration.ts')
    expect(file.match(/if \(inAppSwitchFences\(scenarioIdFromRoute\)\) return/g)?.length).toBe(2)
    const read = file.indexOf('beginBootGraphRead(scenarioId)')
    const readFence = file.lastIndexOf('if (inAppSwitchFences(scenarioIdFromRoute)) return', read)
    const adopt = file.indexOf('routeAdoptedScenarioId = scenarioIdFromRoute as string')
    const adoptFence = file.lastIndexOf('if (inAppSwitchFences(scenarioIdFromRoute)) return', adopt)
    expect(readFence).toBeGreaterThan(adopt) // the read's own fence, after the adoption effect
    expect(adoptFence).toBeGreaterThan(0)
    expect(adoptFence).toBeLessThan(adopt)
  })
})
