/**
 * Science-icon provenance honesty — journey-walk 2026-08-03 gap #3, third
 * contradicting surface.
 *
 * THE WITNESSED CONTRADICTION (journey-walk-2026-08-03.md §1b item 5, UI
 * 43fd19e1): after the user "checked" Content Marketing Investment, the
 * sidebar pill said "checked by you" while clicking the canvas node surfaced
 * "Olumi estimated this value. May not match reality." — two surfaces, one
 * factor, opposite provenance claims.
 *
 * THE MECHANISM AT THE BYTES: `useScienceIcons.ts` gates the olumi-estimate
 * icon on `extractionType === 'inferred'` ALONE. The user-override write path
 * (`CalibrateDrillIn.commitValue` → `withObservedStateUpdate` spread) sets
 * `source: 'user_override'` but never touches `extractionType`, so a factor
 * the user has explicitly overridden keeps claiming "Olumi estimated this
 * value". The sidebar's claim derives from the canonical reviewed-source
 * predicate (`isReviewedSource`); the icon must consult the SAME predicate so
 * the two surfaces cannot disagree — never a second hand-kept source list
 * (trap 12).
 *
 * RED-first at pristine 43fd19e1: the user-override case still shows the
 * icon, so the first test fails.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { useScienceIcons } from '../useScienceIcons'
import { useCanvasStore } from '../../store'

function seedFactor(observedState: Record<string, unknown>): void {
  useCanvasStore.setState({
    nodes: [
      {
        id: 'f1',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: { kind: 'factor', label: 'Content Marketing Investment', observedState },
      } as Node,
    ],
    edges: [],
    ceeAnalysisReady: null,
  })
}

describe('useScienceIcons — "Olumi estimated this value" never renders on a user-owned value', () => {
  beforeEach(() => {
    seedFactor({})
  })

  it('the walk shape: extractionType inferred + source user_override → NO olumi-estimate icon', () => {
    seedFactor({
      value: 0.6,
      raw_value: 0.6,
      source: 'user_override',
      extractionType: 'inferred',
    })
    const { result } = renderHook(() => useScienceIcons('f1', 'factor'))
    expect(result.current.find(i => i.id === 'olumi-estimate')).toBeUndefined()
  })

  it('user_confirmed keeps the icon off too (Confirm-as-is is user ownership)', () => {
    seedFactor({
      value: 0,
      source: 'user_confirmed',
      extractionType: 'inferred',
    })
    const { result } = renderHook(() => useScienceIcons('f1', 'factor'))
    expect(result.current.find(i => i.id === 'olumi-estimate')).toBeUndefined()
  })

  it('positive control (trap 13): an untouched inferred estimate still shows the icon', () => {
    seedFactor({
      value: 0.4,
      source: 'cee_inference',
      extractionType: 'inferred',
    })
    const { result } = renderHook(() => useScienceIcons('f1', 'factor'))
    const icon = result.current.find(i => i.id === 'olumi-estimate')
    expect(icon).toBeDefined()
    expect(icon?.tooltip).toBe('Olumi estimated this value. May not match reality.')
  })
})
