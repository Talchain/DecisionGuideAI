/**
 * GOAL-REACH guided path, chat chip row (P02; contract with CHAT-STABLE 8 Oct): CEE's `guided_sizing.links[].press`
 * ARE this reply's suggested_actions (same id). DGAI builds no press: it shows those chips first, in CEE's `order`,
 * outside the 3-chip cap, under CEE's own progress line, and only for the current model revision. Bound by chip id.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

import { SuggestedChips } from '../zones/SuggestedChips'
import type { ActionChip } from '../types'
import { readGuidedSizing, guidedSizingForModel } from '../../../v5/readGuidedSizing'

const pressId = (n: number) => `agent-size-link:e_${n}`
const press = (n: number): ActionChip => ({ id: pressId(n), label: `Size link ${n}`, intent: 'secondary', message: `Size link ${n}.` })
const other = (n: number): ActionChip => ({ id: `other-${n}`, label: `Other ${n}`, intent: 'secondary', message: `Other ${n}.` })
const PROGRESS = '2 more to go; with 1 left, Olumi can show a range.'
const wire = {
  guided_sizing: {
    v: 1, total: 2, graph_hash: 'aaaabbbbccccdddd', run_key: 'run_1', progress_line: PROGRESS,
    links: [2, 1].map((n) => ({ from: `f${n}`, to: `t${n}`, from_label: `F${n}`, to_label: `T${n}`, order: n,
      press: { id: pressId(n), parameters: { from: `f${n}`, to: `t${n}` } } })),
  },
}
// Wire order puts CEE's order-2 press first and three other chips ahead of order 1 (so the cap would have cut it).
const CHIPS = [press(2), other(1), other(2), other(3), press(1)]
const ids = () => Array.from(screen.getByTestId('suggested-chips').querySelectorAll('[data-testid^="suggested-chip-"]'))
  .map((el) => el.getAttribute('data-testid')!.slice('suggested-chip-'.length))
const mount = (hash: string | null, chips = CHIPS, onChipClick = vi.fn().mockResolvedValue(undefined)) =>
  ({ onChipClick, ...render(<SuggestedChips chips={chips} onChipClick={onChipClick}
    guidedSizing={guidedSizingForModel(readGuidedSizing(wire), hash)} />) })

describe('P02 guided sizing in the chat chip row', () => {
  it('the presses render first, in CEE’s order, and neither is cut by the 3-chip cap', () => {
    mount('aaaabbbbccccdddd')
    expect(ids()).toEqual([pressId(1), pressId(2), 'other-1', 'other-2', 'other-3'])
  })

  it('CEE’s progress line shows verbatim above the row', () => {
    mount('aaaabbbbccccdddd')
    expect(screen.getByTestId('guided-sizing-progress').textContent).toBe(PROGRESS)
  })

  it('CONTROL: a list for another model revision → the row is exactly today’s (wire order, cap 3, no progress line)', () => {
    mount('ffffeeeeddddcccc')
    expect(ids()).toEqual([pressId(2), 'other-1', 'other-2'])
    expect(screen.queryByTestId('guided-sizing-progress')).toBeNull()
  })

  it('pressing a guided chip sends that chip, by id, with CEE’s own press parameters', () => {
    const { onChipClick } = mount('aaaabbbbccccdddd')
    fireEvent.click(screen.getByTestId(`suggested-chip-${pressId(1)}`))
    expect(onChipClick).toHaveBeenCalledTimes(1)
    expect(onChipClick.mock.calls[0][0]).toMatchObject({ id: pressId(1), parameters: { from: 'f1', to: 't1' } })
  })

  it('CONTROL (identity, not label): a chip worded like a press but with another id is not guided', () => {
    const impostor: ActionChip = { ...press(1), id: 'other-impostor' }
    mount('aaaabbbbccccdddd', [other(1), other(2), other(3), impostor])
    expect(ids()).toEqual(['other-1', 'other-2', 'other-3'])
    expect(screen.queryByTestId('guided-sizing-progress')).toBeNull()
  })
})
