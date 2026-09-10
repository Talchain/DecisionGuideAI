/**
 * ⭐⭐ "NOT SET" ANSWERS THE WRONG QUESTION FOR HALF THE ROWS THAT SHOW IT.
 *
 * Two opposite situations both render `primaryValue: null`, and the tab told
 * them apart nowhere:
 *
 *   nothing here at all  — nobody has looked. THE READER is the gap.
 *   unquantified prior   — Olumi read the brief, found no figure, and REFUSED
 *                          TO INVENT ONE. The gap is known and recorded.
 *
 * The second is a reasoning act by the producer, and it is exactly the kind of
 * thing this surface exists to show. CEE PR #1223 stopped substituting a
 * placeholder `0.5`; such a factor now arrives as `uniform(0,1)` carrying
 * `prior_is_unquantified` — *"the one range over the unit interval that asserts
 * nothing"* (`domain/nodes.ts`).
 *
 * ── MEASURED ON THE DEPLOYED BUILD ──────────────────────────────────────────
 * `14276d5b`, guest, completed run: **four of five factors** carried
 * `prior_is_unquantified: true`, and the word appears NOWHERE in the rendered
 * document. The canvas `FactorNode` and the `NodeInspector` both distinguish
 * this state; the surface built for READING your model did not.
 *
 * ── THE TWO RULES THIS FILE PINS ────────────────────────────────────────────
 * 1. **A RANGE IS NOT SELF-DESCRIBING.** `{range_min: 0, range_max: 1}` from a
 *    genuine external prior and the same pair from ignorance are BYTE-IDENTICAL
 *    and mean opposite things. Only the flag separates them. A predicate over
 *    the range would be right on this fixture and wrong on the estate's own
 *    corpus, which holds genuine unflagged `uniform(0,1)` priors.
 * 2. **A FACTOR THAT LATER GAINED A VALUE IS NOT "UNQUANTIFIED"**, whatever its
 *    prior still says. The flag describes the PRIOR; the sentence describes the
 *    ROW. Both limbs come from `FactorNode.tsx`'s own decision —
 *    `isUnquantifiedPrior(prior) && !hasAnyStatedValue(data)` — rather than a
 *    second answer to one question (trap 12).
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../store', () => ({ useCanvasStore: (sel: (s: unknown) => unknown) => sel({ nodes: [] }) }))

import { ModelDetailRegion } from '../ModelDetailRegion'
import { toRowDetail } from '../adapters'
import type { ModelRow } from '../types'

const IGNORANCE = { distribution: 'uniform', range_min: 0, range_max: 1, prior_is_unquantified: true }
/** ⚠ BYTE-IDENTICAL to the above except for the flag. That is the whole point. */
const GENUINE = { distribution: 'uniform', range_min: 0, range_max: 1 }

const factor = (over: Record<string, unknown>) => ({
  id: 'f1',
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { label: 'Data Team Capacity', ...over },
})

const row = (primaryValue: string | null): ModelRow => ({
  id: 'f1',
  kind: 'factor',
  group: 'factors',
  label: 'Data Team Capacity',
  primaryValue,
  attention: primaryValue === null ? ['no-value'] : [],
  editable: true,
})

const detailFor = (node: unknown) => toRowDetail({ nodes: [node], edges: [] } as never, 'f1')

const renderFor = (node: unknown, primaryValue: string | null) => {
  const detail = detailFor(node)
  if (detail === null) throw new Error('projection returned null — the fixture is wrong')
  return render(<ModelDetailRegion row={row(primaryValue)} detail={detail} tier="plain" />)
}

describe('⭐ THE DISCRIMINATION — a flagged and an unflagged prior are the same bytes', () => {
  it('the two fixtures differ ONLY by the flag (precondition)', () => {
    // If this ever stops being true the pair below proves nothing: it would be
    // discriminating on the range, which is the predicate that must never be used.
    const { prior_is_unquantified: _flag, ...rest } = IGNORANCE
    expect(rest).toEqual(GENUINE)
  })

  it('⭐ the FLAGGED prior is reported', () => {
    expect(detailFor(factor({ prior: IGNORANCE }))?.priorIsExplicitlyUnquantified).toBe(true)
  })

  it('⭐ …and the UNFLAGGED one is NOT — the twin that makes the pair discriminating', () => {
    // One case alone would pass on a predicate that read the range.
    expect(detailFor(factor({ prior: GENUINE }))?.priorIsExplicitlyUnquantified).toBe(false)
  })

  it('a factor with NO prior at all is not reported', () => {
    expect(detailFor(factor({}))?.priorIsExplicitlyUnquantified).toBe(false)
  })
})

describe('⛔ A FACTOR THAT GAINED A VALUE IS NOT "UNQUANTIFIED"', () => {
  /**
   * ⚠ THE SECOND LIMB, AND THE ONE A SINGLE-LIMB IMPLEMENTATION WOULD MISS.
   * The flag describes the PRIOR and survives on the node after a user types a
   * number. Reading it alone would tell a reader Olumi assumed nothing about a
   * factor whose value is sitting on screen above the sentence.
   */
  it('a stated `value` suppresses it', () => {
    const n = factor({ prior: IGNORANCE, observedState: { value: 0.49, source: 'user' } })
    expect(detailFor(n)?.priorIsExplicitlyUnquantified).toBe(false)
  })

  it('a stated `raw_value` suppresses it', () => {
    const n = factor({ prior: IGNORANCE, observedState: { raw_value: 49, source: 'user' } })
    expect(detailFor(n)?.priorIsExplicitlyUnquantified).toBe(false)
  })

  it('a CEE `display_value` suppresses it too — all three carriers', () => {
    const n = factor({ prior: IGNORANCE, observedState: { display_value: '0.25 to 0.75' } })
    expect(detailFor(n)?.priorIsExplicitlyUnquantified).toBe(false)
  })
})

describe('⛔ SCOPED TO FACTORS', () => {
  it('a non-factor node carrying the flag is not reported', () => {
    const opt = { id: 'f1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'A', prior: IGNORANCE } }
    expect(detailFor(opt)?.priorIsExplicitlyUnquantified).toBe(false)
  })

  it('an edge carries no prior, so the question does not arise', () => {
    const detail = toRowDetail(
      {
        nodes: [factor({ prior: IGNORANCE }), { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'B' } }],
        edges: [{ id: 'e1', source: 'f1', target: 'f2', data: {} }],
      } as never,
      'e1',
    )
    expect(detail?.priorIsExplicitlyUnquantified).toBe(false)
  })
})

describe('what the reader is told', () => {
  it('⭐ says the producer declined to assume, beside "Not set"', () => {
    renderFor(factor({ prior: IGNORANCE }), null)
    // ⚠ "Not set" STAYS and stays first — the value really is not set. The new
    // line says WHY, which is a different claim.
    expect(screen.getByTestId('model-detail-v2-primary')).toHaveTextContent('Not set')
    expect(screen.getByTestId('model-detail-v2-unquantified')).toBeInTheDocument()
  })

  it('⛔ says NOTHING when the prior is unflagged — the render twin', () => {
    renderFor(factor({ prior: GENUINE }), null)
    expect(screen.getByTestId('model-detail-v2-primary')).toHaveTextContent('Not set')
    expect(screen.queryByTestId('model-detail-v2-unquantified')).toBeNull()
  })

  it('⛔ the copy claims only what the flag licenses', () => {
    /**
     * ⚠ `prior_is_unquantified` says the producer recorded ignorance instead of
     * a figure. It does NOT license a claim about the BRIEF — this surface
     * cannot see one — and it must not imply the user failed to supply
     * something. Both would be inventions on top of a fact.
     */
    renderFor(factor({ prior: IGNORANCE }), null)
    const text = screen.getByTestId('model-detail-v2-unquantified').textContent ?? ''
    for (const forbidden of ['brief', 'you did not', 'you have not', 'missing', 'failed']) {
      expect(text.toLowerCase()).not.toContain(forbidden)
    }
    expect(text).toContain('Olumi')
  })
})
