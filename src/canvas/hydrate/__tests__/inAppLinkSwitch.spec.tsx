/**
 * ⭐ A LINK OPENED LATER IN THE SAME TAB SWITCHES TO ITS SCENARIO (BLOCKER22, Acceptance #87 5986279838; DL 0df0e1).
 *
 * Served dade7fe8: changing the address to `#/scenario/<df14>` in a tab holding the J4 scenario kept J4 on screen and
 * never requested df14's graph. `useInAppLinkSwitch` flushes the held scenario's work and reloads, so the reload is the
 * cold load of the new route that `coldLoadDeepLink.spec.ts` already drives.
 *
 * DRIVEN against the real `useCanvasStore`, real `localStorage` and the real flush (`flushWorkToAutosave`, through the
 * provider `store.ts` registers at module init). Only `window.location.reload` is replaced (jsdom cannot reload); the
 * stub records the main slot AT THE MOMENT of the reload, so the flush-before-reload order is measured, not assumed.
 * Every assertion binds a scenario by id and a slot by its bytes or node ids.
 *
 *   A = the scenario this tab holds · B = the link opened in the same tab
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createElement, StrictMode } from 'react'
import { renderHook } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  MAIN_AUTOSAVE_SLOT,
  keyedAutosaveSlot,
  claimColdLoadDeepLink,
  useInAppLinkSwitch,
  __setReloadForTests,
  __resetColdLoadDeepLinkForTests,
} from '../coldLoadDeepLink'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'
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

let reloads: Array<{ main: string | null }> = []
beforeEach(() => {
  localStorage.clear()
  __resetColdLoadDeepLinkForTests()
  useCanvasStore.setState(PRISTINE, true)
  reloads = []
  __setReloadForTests(() => { reloads.push({ main: localStorage.getItem(MAIN_AUTOSAVE_SLOT) }) })
})
afterEach(() => {
  __setReloadForTests(null)
  localStorage.clear()
})

const mount = (route: string | undefined) =>
  renderHook(({ r }: { r: string | undefined }) => useInAppLinkSwitch(r), { initialProps: { r: route } })

describe('⭐ the same tab opens B while holding A', () => {
  it('⭐ A\'s newest work is flushed to its autosave, THEN the page reloads, once', () => {
    holdA()
    const { rerender } = mount(A)
    expect(reloads).toHaveLength(0)
    rerender({ r: B })
    expect(reloads).toHaveLength(1)
    // At the moment of the reload the main slot is A's, and carries the edit only the store had.
    const atReload = reloads[0].main
    expect(JSON.parse(atReload as string).scenarioId).toBe(A)
    expect(slotNodeIds(atReload)).toEqual(['a_goal', 'a_unsaved'])
  })

  it('⭐ the reload is a cold load of B: A is preserved under its own key with its newest work, B is current', () => {
    holdA()
    const { rerender } = mount(A)
    rerender({ r: B })
    const flushedA = reloads[0].main
    // The new page: module load seeds the store from the pointer, nothing on the canvas; the gate claims the route.
    __resetColdLoadDeepLinkForTests()
    useCanvasStore.setState(PRISTINE, true)
    useCanvasStore.setState({ currentScenarioId: scenarios.getCurrentScenarioId(), nodes: [], edges: [] })
    expect(claimColdLoadDeepLink(B)).toBe('applied')
    expect(localStorage.getItem(keyedAutosaveSlot(A))).toBe(flushedA)
    expect(slotNodeIds(localStorage.getItem(keyedAutosaveSlot(A)))).toEqual(['a_goal', 'a_unsaved'])
    expect(localStorage.getItem(POINTER)).toBe(B)
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBeNull()
    expect(useCanvasStore.getState().currentScenarioId).toBe(B)
  })

  it('⭐ …and when B has its own preserved copy, the reload brings B\'s copy back to the main slot', () => {
    // B was worked on earlier in this browser and superseded: its copy waits under its key.
    useCanvasStore.setState({ currentScenarioId: B, nodes: [goal('b_goal', 'B: hire a team')], edges: [] })
    const bCopy = autosaveFromStore()
    localStorage.setItem(keyedAutosaveSlot(B), bCopy)
    localStorage.removeItem(MAIN_AUTOSAVE_SLOT)
    holdA()
    const { rerender } = mount(A)
    rerender({ r: B })
    __resetColdLoadDeepLinkForTests()
    useCanvasStore.setState(PRISTINE, true)
    useCanvasStore.setState({ currentScenarioId: scenarios.getCurrentScenarioId(), nodes: [], edges: [] })
    expect(claimColdLoadDeepLink(B)).toBe('applied')
    expect(localStorage.getItem(MAIN_AUTOSAVE_SLOT)).toBe(bCopy)
    expect(slotNodeIds(localStorage.getItem(keyedAutosaveSlot(A)))).toEqual(['a_goal', 'a_unsaved'])
  })

  it('back to A in the same tab (browser Back) is a switch too', () => {
    holdA()
    const { rerender } = mount(A)
    rerender({ r: B })
    useCanvasStore.setState({ currentScenarioId: B })
    rerender({ r: A })
    expect(reloads).toHaveLength(2)
  })
})

describe('NOT a switch: no reload, storage byte-identical', () => {
  it('the first mount (the gate decides that), also under StrictMode\'s double effects', () => {
    holdA()
    const before = storageSnapshot()
    renderHook(() => useInAppLinkSwitch(B), { wrapper: ({ children }) => createElement(StrictMode, null, children) })
    expect(reloads).toHaveLength(0)
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

describe('the served route mounts it', () => {
  it('`CanvasMVP` (the element of `/scenario/:id` and `/canvas`) calls it with the route, before the gate decides', () => {
    // The two routes are one component instance across a same-tab change of `:id` (React Router keeps the element), which
    // is exactly the navigation this hook exists for. Pinned in the source: the route component is not renderable alone.
    const src = readFileSync(join(__dirname, '../../../routes/CanvasMVP.tsx'), 'utf8')
    const body = src.slice(src.indexOf('export default function CanvasMVP()'))
    const call = body.indexOf('useInAppLinkSwitch(scenarioIdFromRoute)')
    const gate = body.indexOf('useColdLoadDeepLinkGate(scenarioIdFromRoute)')
    expect(call).toBeGreaterThan(0)
    expect(gate).toBeGreaterThan(call)
    expect(body.slice(0, call)).not.toMatch(/return\b/) // never behind an early return
  })
})
