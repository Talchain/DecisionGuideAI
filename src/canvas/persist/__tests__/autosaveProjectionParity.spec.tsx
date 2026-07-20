/**
 * Autosave payload parity — the crash flush must not DEGRADE the autosave it
 * exists to back up.
 *
 * `saveAutosave` is a whole-object `JSON.stringify` → `setItem` REPLACE, not a
 * merge. So any writer that assembles a payload with fewer fields than the 30s
 * timer does not merely "save less" — it DELETES the missing fields from the
 * last good autosave.
 *
 * The field that made this BITE in production is `ceeAnalysisReady`
 * (RecoveryBanner.tsx:69 restores it): five of the seven writers omitted it, so
 * every draft-apply, patch-apply, merge and draft-undo stripped the readiness
 * payload from whatever the timer had saved.
 *
 * `selectedGoalNode` — the field the original #399 report focused on — is a
 * weaker case, and this spec deliberately does NOT overstate it: the field is
 * not declared on `CanvasState` at all (useAutosave reads it through a
 * pre-existing wide-tsc error, and only RecoveryBanner ever writes it back), so
 * in a normal session it is `undefined` and the key is simply absent. It is
 * pinned here because the crash flush must stay at PARITY with the timer
 * whatever the field's fate — not because a live session loses a goal id.
 *
 * The field set here is DERIVED, never hand-listed:
 *  - `AutosaveProjectionSource` has all-REQUIRED fields, so the fixture below
 *    fails to compile if a field is added to the projection and not to it;
 *  - the parity assertion compares the two paths' emitted key sets against each
 *    other, so neither can quietly shed a field the other keeps.
 * Hand-listing the fields here would recreate the exact defect under test.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import { useAutosave } from '../../hooks/useAutosave'
import { flushWorkToAutosave } from '../crashFlush'
import { loadAutosave, clearAutosave } from '../../store/scenarios'
import {
  projectAutosaveData,
  autosaveSourceFromStore,
  type AutosaveProjectionSource,
} from '../../store/autosaveProjection'

const nodes = [
  { id: 'g1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Grow ARR' } },
  { id: 'g2', type: 'goal', position: { x: 10, y: 0 }, data: { kind: 'goal', label: 'Cut churn' } },
] as unknown as Node[]

const analysisReady = {
  options: [],
  goal_node_id: 'g1',
} as unknown as AutosaveProjectionSource['ceeAnalysisReady']

/**
 * Seed every autosave-relevant store field with a DISTINCTIVE value, so a
 * dropped field shows up as a missing key rather than as a coincidental match
 * against a default.
 *
 * Two goal nodes deliberately: RecoveryBanner auto-selects a goal only when
 * exactly ONE exists, so with two, a dropped `selectedGoalNode` has no
 * fallback to recover it.
 *
 * `selectedGoalNode` is seeded through `setState` because the store does not
 * declare it (see the header) — this reproduces the post-recovery shape, the
 * only state in which the field is actually populated.
 */
function seedStore(): void {
  useCanvasStore.setState({
    nodes,
    edges: [],
    currentScenarioId: 'scenario-42',
    ceeAnalysisReady: analysisReady as never,
  })
  // Seeded separately and untyped BECAUSE `selectedGoalNode` is not a member of
  // CanvasState — exactly how RecoveryBanner.tsx:70 writes it. Putting it in
  // the literal above is an excess-property error; that error IS the finding.
  useCanvasStore.setState({ selectedGoalNode: 'g2' } as never)
}

describe('autosave payload parity — crash flush vs periodic timer', () => {
  beforeEach(() => {
    clearAutosave()
    localStorage.clear()
    seedStore()
  })

  afterEach(() => {
    vi.useRealTimers()
    clearAutosave()
  })

  it('the crash flush persists the SAME field set as the periodic autosave', () => {
    // --- periodic path: render the real hook and let its timers fire ---
    vi.useFakeTimers()
    renderHook(() => useAutosave())
    vi.advanceTimersByTime(30_000) // interval
    vi.advanceTimersByTime(600) // debounce
    const periodic = loadAutosave()
    expect(periodic).not.toBeNull()

    clearAutosave()
    localStorage.clear()
    vi.useRealTimers()

    // --- crash path: the provider the store registered at module init ---
    expect(flushWorkToAutosave()).toBe(true)
    const crash = loadAutosave()
    expect(crash).not.toBeNull()

    // Derived comparison — no hand-listed field names.
    expect(new Set(Object.keys(crash!))).toEqual(new Set(Object.keys(periodic!)))
  })

  it('the crash flush preserves selectedGoalNode (the #399 field drop)', () => {
    expect(flushWorkToAutosave()).toBe(true)
    expect(loadAutosave()?.selectedGoalNode).toBe('g2')
  })

  it('the crash flush preserves ceeAnalysisReady', () => {
    expect(flushWorkToAutosave()).toBe(true)
    expect(loadAutosave()?.ceeAnalysisReady).toMatchObject({ goal_node_id: 'g1' })
  })

  it('a crash flush does not shrink an autosave the timer already wrote', () => {
    // The real-world sequence: timer writes a complete snapshot, then the app
    // crashes and the boundary flushes. The flush must not remove fields.
    vi.useFakeTimers()
    renderHook(() => useAutosave())
    vi.advanceTimersByTime(30_000)
    vi.advanceTimersByTime(600)
    const before = loadAutosave()
    expect(before?.selectedGoalNode).toBe('g2')
    vi.useRealTimers()

    expect(flushWorkToAutosave()).toBe(true)
    const after = loadAutosave()
    for (const key of Object.keys(before!)) {
      expect(after).toHaveProperty(key)
    }
  })
})

describe('projectAutosaveData — every source field reaches the payload', () => {
  /**
   * All-required interface ⇒ this literal is a compile-time exhaustiveness
   * check. Adding a field to AutosaveProjectionSource breaks the build here
   * until it is given a value, and the loop below then proves it is projected.
   */
  const fullSource: AutosaveProjectionSource = {
    nodes,
    edges: [],
    scenarioId: 'scenario-42',
    ceeAnalysisReady: analysisReady,
    selectedGoalNode: 'g2',
  }

  it('projects every field of a fully-populated source', () => {
    const projected = projectAutosaveData(fullSource, 1234)
    for (const key of Object.keys(fullSource)) {
      expect(projected[key as keyof typeof projected]).toBeDefined()
    }
    expect(projected.timestamp).toBe(1234)
  })

  it('autosaveSourceFromStore carries the store fields through unchanged', () => {
    seedStore()
    const projected = projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState()))
    expect(projected.scenarioId).toBe('scenario-42')
    expect(projected.selectedGoalNode).toBe('g2')
    expect(projected.ceeAnalysisReady).toMatchObject({ goal_node_id: 'g1' })
    expect(projected.nodes).toHaveLength(2)
  })

  it('overrides replace only what they name', () => {
    seedStore()
    const source = autosaveSourceFromStore(useCanvasStore.getState(), { nodes: [] })
    expect(source.nodes).toHaveLength(0)
    // Everything else survives the override.
    expect(source.selectedGoalNode).toBe('g2')
    expect(source.scenarioId).toBe('scenario-42')
  })
})
