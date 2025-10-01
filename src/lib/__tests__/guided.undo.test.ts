import { describe, it, expect } from 'vitest'
import { createUndoStack, getSuggestions, type SimpleState } from '../../lib/guided'

describe('Guided Mode v1 - undo stack and suggestions', () => {
  it('undo stack push/pop restores previous snapshot; empty pop is a no-op', () => {
    const undo = createUndoStack<SimpleState>()
    const s1: SimpleState = { seed: '1', budget: '10', model: '', simplify: false }
    const s2: SimpleState = { seed: '1', budget: '10', model: 'local-sim', simplify: true }

    expect(undo.size).toBe(0)
    expect(undo.pop()).toBeUndefined()

    undo.push(s1)
    undo.push(s2)
    expect(undo.size).toBe(2)

    const got2 = undo.pop()
    expect(got2).toEqual(s2)
    const got1 = undo.pop()
    expect(got1).toEqual(s1)
    expect(undo.pop()).toBeUndefined()
    expect(undo.size).toBe(0)
  })

  it('suggestions apply deterministically and can be undone by restoring previous snapshot', () => {
    const s0: SimpleState = { seed: 'abc', budget: '5', model: '', simplify: false }
    const undo = createUndoStack<SimpleState>()
    const suggs = getSuggestions(s0)
    expect(suggs.length).toBeGreaterThanOrEqual(1)
    const applyToggle = suggs[0]

    // Apply suggestion 0 (toggle simplify)
    undo.push(s0)
    const s1 = applyToggle.apply(s0)
    expect(s1.simplify).toBe(true)

    // Undo by restoring last snapshot
    const prev = undo.pop()
    expect(prev).toEqual(s0)
  })
})
