/**
 * useStageAwarePlaceholder — composer placeholder derives from the composed
 * trust semantic (CEE freshness verdict + local dirty overlay), NOT the
 * graph-hash stale path deleted on 2026-07-16.
 *
 * Regression for the review finding: after a graph edit the composer kept
 * claiming "Ask about the latest analysis…" (because the deleted guard's
 * analysisState stayed 'current' — _internal.graphHash was never written),
 * contradicting the Results surface's cannot-confirm state. It must never
 * claim "latest" unless the verdict is confirmed-fresh.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const selectionRef: { value: { id: string; label: string; kind: 'node' | 'edge' } | null } = { value: null }
// ⚠ SPREAD THE REAL MODULE: a `vi.mock` factory REPLACES it, so any export added
// later is silently absent and this file dies at collection. That fired on
// `useSelectionCarriage`; `importOriginal` means the override below only has to
// name what is genuinely being stubbed.
vi.mock('../useSelectionContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../useSelectionContext')>()),
  useSelectionContext: () => selectionRef.value,
}))

import { useStageAwarePlaceholder } from '../useStageAwarePlaceholder'
import { useCanvasStore } from '../../store'

const node = (id: string) => ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id } })
const placeholder = () => renderHook(() => useStageAwarePlaceholder()).result.current

beforeEach(() => {
  selectionRef.value = null
  useCanvasStore.setState({
    nodes: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results: { status: 'idle' } as any,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
  })
})

const complete = () => useCanvasStore.setState({ results: { status: 'complete' } as never })
const setFresh = () => useCanvasStore.getState().setAnalysisFreshness({ freshness: 'fresh', freshness_reason: 'graph_hash_match' })

describe('useStageAwarePlaceholder', () => {
  /*
   * ⚠ PREMISE INVERTED — and the reason this was missed is the lesson. The
   * change's own corpus was scoped to `src/canvas/conversation/**`, while this
   * SECOND consumer lives in `src/canvas/hooks/__tests__/`. A suite that cannot
   * see a directory returns the same clean green as one that looked and found
   * nothing. Caught by CI, not by the sweep.
   */
  it('no model → "Describe your decision or challenge…"', () => {
    expect(placeholder()).toBe('Describe your decision or challenge…')
  })

  it('model exists, no analysis → "Ask about this model…"', () => {
    useCanvasStore.setState({ nodes: [node('a')] as never })
    expect(placeholder()).toBe('Ask about this model…')
  })

  /**
   * ⚠ PIN FLIPPED, DELIBERATELY (L-17, 16 Aug 2026). This used to assert
   * `'Ask about Switch jobs?…'` — a selection-derived placeholder.
   *
   * That behaviour was the defect. A placeholder is an ATTRIBUTE, not content:
   * the composer's VALUE stayed empty, so the sentence the product appeared to
   * have written for the user could not be sent. Measured again on 16 Aug at UI
   * `f15bccaf`: "composer VALUE empty ... Grey, non-submittable, exactly as
   * filed."
   *
   * The selection now carries a REAL, submittable control (`SelectionPill`:
   * a clickable pill plus a chip, both dispatching one selection-grounded
   * turn), so the placeholder returns to the neutral prompt and stops
   * impersonating content it never held. The affordance is pinned by
   * `SelectionPill.askAffordance.spec.tsx`; this test pins that the composer
   * no longer claims it.
   *
   * The assertion is NEGATIVE as well as positive on purpose: asserting only
   * the new string would still pass if the label leaked back in some other
   * form.
   */
  it('a selection does NOT write a fake sentence into the composer (L-17)', () => {
    useCanvasStore.setState({ nodes: [node('a')] as never })
    complete(); setFresh()
    selectionRef.value = { id: 'g', label: 'Switch jobs?', kind: 'node' }
    const p = placeholder()
    expect(p).not.toContain('Switch jobs?')
    // The selection no longer outranks the freshness verdict either — the
    // composer says the true thing about the analysis instead.
    expect(p).toBe('Ask about the latest analysis…')
  })

  it('confirmed-fresh analysis → "Ask about the latest analysis…"', () => {
    complete(); setFresh()
    expect(placeholder()).toBe('Ask about the latest analysis…')
  })

  it('CEE stale verdict → "Model changed. Ask or rerun…"', () => {
    complete()
    useCanvasStore.getState().setAnalysisFreshness({ freshness: 'stale', freshness_reason: 'graph_changed' })
    expect(placeholder()).toBe('Model changed. Ask or rerun…')
  })

  it('REGRESSION: fresh analysis edited locally (cannot-confirm) → "Model changed…", NEVER "latest"', () => {
    complete(); setFresh()
    useCanvasStore.getState().markAnalysisFreshnessDirty()
    const p = placeholder()
    expect(p).toBe('Model changed. Ask or rerun…')
    expect(p).not.toMatch(/latest/i)
  })

  it('CEE-sourced unknown (cannot-confirm) → neutral "Ask about this analysis…", never "latest"', () => {
    complete()
    useCanvasStore.getState().setAnalysisFreshness({ freshness: 'unknown', freshness_reason: 'no_hash' })
    const p = placeholder()
    expect(p).toBe('Ask about this analysis…')
    expect(p).not.toMatch(/latest/i)
  })
})
