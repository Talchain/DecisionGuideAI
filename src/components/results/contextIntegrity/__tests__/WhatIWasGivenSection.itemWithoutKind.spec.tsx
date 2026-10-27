/**
 * A not_modelled item WITHOUT `kind` (DL ruling, option 2, 27 Oct 2026).
 *
 * On a model-program read CEE builds "What I was given" from the canonical
 * model, not from the old regex scan, so its items carry no `kind`. Nothing on
 * screen reads `kind` — the section groups by `verdict` — so an absent `kind`
 * is accepted. A PRESENT `kind` this repo does not know is still refused, and
 * refusing one item still refuses the whole manifest (a short list is a lie).
 *
 * Every manifest goes through the REAL boundary parser, never a hand-built
 * object, and rows are found by identity (char offset + literal).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'

import { WhatIWasGivenSection } from '../WhatIWasGivenSection'
import { useCanvasStore } from '@/canvas/store'
import { useContextIntegrityStore } from '@/canvas/stores/contextIntegrityStore'
import { parseNotModelled } from '@/adapters/cee/notModelled'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

const SCENARIO_ID = '33333333-3333-4333-8333-333333333333'
// Synthetic brief, never journey text.
const BRIEF = 'We run 14 crews and want to reach 20 within the year.'
const KEPT = '14 crews'
const NOT_YET = 'reach 20'
const KEPT_AT = BRIEF.indexOf(KEPT)
const NOT_YET_AT = BRIEF.indexOf(NOT_YET)

function manifestWith(items: readonly Record<string, unknown>[]) {
  const inModel = items.filter((i) => i.verdict === 'in_model').length
  return {
    schema: 'not_modelled.v1',
    status: 'derived',
    quantities: {
      total: items.length,
      in_model: inModel,
      prose_only: 0,
      absent: items.length - inModel,
      truncated: false,
      items,
    },
    declared_exclusions: { status: 'none_reported', items: [] },
    inferred_factors: { status: 'derived', items: [] },
    not_tracked: [],
  }
}

const NO_KIND_ITEMS = [
  { literal: KEPT, char_offset: KEPT_AT, verdict: 'in_model', matched_node_id: 'fac_crews' },
  { literal: NOT_YET, char_offset: NOT_YET_AT, verdict: 'absent', matched_node_id: null },
]

beforeEach(() => {
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: SCENARIO_ID } as never)
})
afterEach(() => {
  useContextIntegrityStore.getState().reset()
  useCanvasStore.setState({ currentScenarioId: null } as never)
  cleanup()
})

describe('an item without kind (model-program read)', () => {
  it('anti-vacuity: the quotes really sit at the offsets asserted below', () => {
    expect(KEPT_AT).toBeGreaterThanOrEqual(0)
    expect(NOT_YET_AT).toBeGreaterThan(KEPT_AT)
    expect(NO_KIND_ITEMS.every((i) => !('kind' in i))).toBe(true)
  })

  it('is kept by the parser, with no kind invented', () => {
    const parsed = parseNotModelled(manifestWith(NO_KIND_ITEMS))
    expect(parsed).not.toBeNull()
    const items = parsed!.quantities!.items
    expect(items.map((i) => [i.charOffset, i.literal, i.verdict])).toEqual([
      [KEPT_AT, KEPT, 'in_model'],
      [NOT_YET_AT, NOT_YET, 'absent'],
    ])
    expect(items.every((i) => !('kind' in i))).toBe(true)
  })

  it('renders each item under its verdict', () => {
    useContextIntegrityStore.getState().setContextIntegrity({
      scenarioId: SCENARIO_ID,
      briefText: BRIEF,
      manifest: parseNotModelled(manifestWith(NO_KIND_ITEMS)),
    })
    render(<WhatIWasGivenSection />)
    fireEvent.click(screen.getByTestId('what-i-was-given-toggle'))

    const used = screen.getByTestId('what-i-was-given-used')
    const notYet = screen.getByTestId('what-i-was-given-notyet')
    expect(used.querySelector(`[data-char-offset="${KEPT_AT}"]`)?.textContent).toContain(KEPT)
    expect(notYet.querySelector(`[data-char-offset="${NOT_YET_AT}"]`)?.textContent).toContain(NOT_YET)
    // Each in its own group only.
    expect(notYet.querySelector(`[data-char-offset="${KEPT_AT}"]`)).toBeNull()
    expect(used.querySelector(`[data-char-offset="${NOT_YET_AT}"]`)).toBeNull()
  })
})

describe('the count names what was counted (C2 on #3864)', () => {
  const show = (items: readonly Record<string, unknown>[]) => {
    useContextIntegrityStore.getState().setContextIntegrity({
      scenarioId: SCENARIO_ID, briefText: BRIEF, manifest: parseNotModelled(manifestWith(items)),
    })
    render(<WhatIWasGivenSection />)
  }
  it('a program read counts sentences, and a sentence still asked is not fully in the model yet', () => {
    show(NO_KIND_ITEMS)
    expect(screen.getByText("1 of 2 sentences with figures I found in your brief isn't fully in the model yet")).toBeTruthy()
    expect(screen.queryByText(/figures I found in your brief (isn't|aren't) in the model/)).toBeNull()
  })
  it('CONTRAST: items with a kind are still counted as figures', () => {
    show(NO_KIND_ITEMS.map((i) => ({ ...i, kind: 'count' })))
    expect(screen.getByText("1 of 2 figures I found in your brief isn't in the model yet")).toBeTruthy()
  })
})

describe('a present kind is still checked, as before', () => {
  it.each([
    ['an unknown kind string', 'ratio'],
    ['a null kind', null],
    ['a non-string kind', 3],
  ])('one item with %s still drops the whole manifest', (_why, kind) => {
    const items = [NO_KIND_ITEMS[0], { ...NO_KIND_ITEMS[1], kind }]
    expect(parseNotModelled(manifestWith(items))).toBeNull()
  })

  it('an item with a valid kind is unchanged, kind and all', () => {
    const item = { literal: KEPT, kind: 'count', char_offset: KEPT_AT, verdict: 'in_model', matched_node_id: 'fac_crews' }
    const parsed = parseNotModelled(manifestWith([item]))
    expect(parsed!.quantities!.items).toEqual([
      { literal: KEPT, kind: 'count', charOffset: KEPT_AT, verdict: 'in_model', matchedNodeId: 'fac_crews' },
    ])
  })
})
