/**
 * Tests for the measure-then-layout gate.
 *
 * Pure logic the ReactFlowGraph effect uses to decide whether to invoke
 * applyLayout immediately, start the bounded fallback, or stay idle.
 */

import { describe, it, expect } from 'vitest'
import { evaluateMeasurementGate, allUnlockedNodesMeasured } from '../measureLayoutGate'
import type { Node } from '@xyflow/react'

function n(id: string, locked = false): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: id, kind: 'factor', ...(locked ? { locked: true } : {}) },
  }
}

describe('evaluateMeasurementGate', () => {
  it('returns "idle" when pendingLayout is false', () => {
    expect(
      evaluateMeasurementGate({
        pendingLayout: false,
        layoutInProgress: false,
        nodesInitialized: true,
        storeNodes: [n('a')],
        allUnlockedNodesMeasured: true,
      }),
    ).toBe('idle')
  })

  it('returns "blocked" when layoutInProgress is true (re-entry guard)', () => {
    expect(
      evaluateMeasurementGate({
        pendingLayout: true,
        layoutInProgress: true,
        nodesInitialized: true,
        storeNodes: [n('a')],
        allUnlockedNodesMeasured: true,
      }),
    ).toBe('blocked')
  })

  it('returns "run-now" when measurement is complete', () => {
    expect(
      evaluateMeasurementGate({
        pendingLayout: true,
        layoutInProgress: false,
        nodesInitialized: true,
        storeNodes: [n('a')],
        allUnlockedNodesMeasured: true,
      }),
    ).toBe('run-now')
  })

  it('returns "wait-with-fallback" when nodesInitialized is false', () => {
    expect(
      evaluateMeasurementGate({
        pendingLayout: true,
        layoutInProgress: false,
        nodesInitialized: false,
        storeNodes: [n('a')],
        allUnlockedNodesMeasured: true,
      }),
    ).toBe('wait-with-fallback')
  })

  it('returns "wait-with-fallback" when at least one unlocked node is unmeasured', () => {
    expect(
      evaluateMeasurementGate({
        pendingLayout: true,
        layoutInProgress: false,
        nodesInitialized: true,
        storeNodes: [n('a'), n('b')],
        allUnlockedNodesMeasured: false,
      }),
    ).toBe('wait-with-fallback')
  })
})

describe('allUnlockedNodesMeasured', () => {
  it('returns true when every unlocked node has measured.width and .height > 0', () => {
    const lookup = new Map([
      ['a', { measured: { width: 320, height: 100 } }],
      ['b', { measured: { width: 200, height: 80 } }],
    ])
    expect(allUnlockedNodesMeasured([n('a'), n('b')], lookup)).toBe(true)
  })

  it('returns false when any node lookup entry is missing', () => {
    const lookup = new Map([['a', { measured: { width: 320, height: 100 } }]])
    expect(allUnlockedNodesMeasured([n('a'), n('b')], lookup)).toBe(false)
  })

  it('returns false when measured is missing on a node', () => {
    const lookup = new Map([
      ['a', { measured: { width: 320, height: 100 } }],
      ['b', undefined],
    ])
    expect(allUnlockedNodesMeasured([n('a'), n('b')], lookup)).toBe(false)
  })

  it('returns false when width is 0', () => {
    const lookup = new Map([['a', { measured: { width: 0, height: 100 } }]])
    expect(allUnlockedNodesMeasured([n('a')], lookup)).toBe(false)
  })

  it('returns false when height is 0', () => {
    const lookup = new Map([['a', { measured: { width: 320, height: 0 } }]])
    expect(allUnlockedNodesMeasured([n('a')], lookup)).toBe(false)
  })

  it('skips locked nodes — they need not be measured', () => {
    const lookup = new Map([
      ['a', { measured: { width: 320, height: 100 } }],
    ])
    expect(allUnlockedNodesMeasured([n('a'), n('b', true)], lookup)).toBe(true)
  })

  it('returns true for an empty graph (vacuously)', () => {
    expect(allUnlockedNodesMeasured([], new Map())).toBe(true)
  })
})

describe('evaluateMeasurementGate — composed scenarios', () => {
  it('4-of-5 measured + 1 unmeasured → wait-with-fallback', () => {
    const lookup = new Map([
      ['a', { measured: { width: 320, height: 100 } }],
      ['b', { measured: { width: 320, height: 100 } }],
      ['c', { measured: { width: 320, height: 100 } }],
      ['d', { measured: { width: 320, height: 100 } }],
    ])
    const measured = allUnlockedNodesMeasured(
      [n('a'), n('b'), n('c'), n('d'), n('e')],
      lookup,
    )
    expect(measured).toBe(false)

    const decision = evaluateMeasurementGate({
      pendingLayout: true,
      layoutInProgress: false,
      nodesInitialized: true,
      storeNodes: [n('a'), n('b'), n('c'), n('d'), n('e')],
      allUnlockedNodesMeasured: measured,
    })
    expect(decision).toBe('wait-with-fallback')
  })

  it('all measured + initialised → run-now', () => {
    const lookup = new Map([
      ['a', { measured: { width: 320, height: 100 } }],
      ['b', { measured: { width: 320, height: 100 } }],
    ])
    const measured = allUnlockedNodesMeasured([n('a'), n('b')], lookup)
    expect(
      evaluateMeasurementGate({
        pendingLayout: true,
        layoutInProgress: false,
        nodesInitialized: true,
        storeNodes: [n('a'), n('b')],
        allUnlockedNodesMeasured: measured,
      }),
    ).toBe('run-now')
  })
})
