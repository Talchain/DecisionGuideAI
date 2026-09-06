/**
 * The composer selection chip — what the user is told, and when.
 *
 * ⭐ THE CLAIM UNDER TEST IS AN HONESTY CLAIM, not a rendering one: the chip
 * may say "Asking about X" ONLY when the turn will actually carry X, must stay
 * silent when there is genuinely nothing to say, and must SPEAK UP when a
 * selection exists but is being withheld — because silence in that third case
 * is a false statement by omission.
 *
 * Cases bind by identity (the exact label, the exact testid), never by a
 * predicate another element could satisfy.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const clearSelection = vi.fn()

// The store is driven per-test by mutating this object. `useCanvasStore` is
// called with a selector, exactly as the component does.
let storeState: Record<string, unknown> = {}

vi.mock('../../store', () => ({
  useCanvasStore: Object.assign((selector: (s: any) => any) => selector(storeState), {
    getState: () => storeState,
    setState: vi.fn(),
    subscribe: vi.fn(),
  }),
}))

import { ComposerSelectionChip } from '../ComposerSelectionChip'

const TEST_ID = 'ai-input-bar-floating'
const CHIP = `${TEST_ID}-selection-chip`
const CLEAR = `${TEST_ID}-selection-clear`

const OPTION_A = { id: 'n-a', type: 'option', data: { label: 'Open a second roastery' } }
const OPTION_B = { id: 'n-b', type: 'option', data: { label: 'Stay single-site' } }

function setStore(partial: {
  nodeIds?: string[]
  edgeIds?: string[]
  nodes?: unknown[]
  edges?: unknown[]
}) {
  storeState = {
    selection: {
      nodeIds: new Set(partial.nodeIds ?? []),
      edgeIds: new Set(partial.edgeIds ?? []),
    },
    nodes: partial.nodes ?? [],
    edges: partial.edges ?? [],
    clearSelection,
  }
}

beforeEach(() => {
  clearSelection.mockClear()
  setStore({})
})

describe('ComposerSelectionChip', () => {
  it('renders NOTHING when nothing is selected — silence is the truth here', () => {
    setStore({ nodes: [OPTION_A] })
    render(<ComposerSelectionChip testId={TEST_ID} />)
    expect(screen.queryByTestId(CHIP)).toBeNull()
  })

  it('names the selected element, so the user need never type its title', () => {
    setStore({ nodeIds: ['n-a'], nodes: [OPTION_A, OPTION_B] })
    render(<ComposerSelectionChip testId={TEST_ID} />)
    const chip = screen.getByTestId(CHIP)
    expect(chip).toHaveAttribute('data-carriage', 'carried')
    expect(chip.textContent).toContain('Asking about')
    expect(chip.textContent).toContain('Open a second roastery')
    // Discriminating: the OTHER option must not appear — the chip names the
    // selection, not the model.
    expect(chip.textContent).not.toContain('Stay single-site')
  })

  it('counts the remainder rather than listing every selected element', () => {
    setStore({ nodeIds: ['n-a', 'n-b'], nodes: [OPTION_A, OPTION_B] })
    render(<ComposerSelectionChip testId={TEST_ID} />)
    const chip = screen.getByTestId(CHIP)
    expect(chip.textContent).toContain('Open a second roastery')
    expect(chip.textContent).toContain('and 1 more')
  })

  it('says "this element" for an unlabelled node — never invents a name or leaks a type', () => {
    setStore({ nodeIds: ['n-bare'], nodes: [{ id: 'n-bare', type: 'factor', data: {} }] })
    render(<ComposerSelectionChip testId={TEST_ID} />)
    const chip = screen.getByTestId(CHIP)
    expect(chip.textContent).toContain('this element')
    // The internal node type is ours, not the user's vocabulary.
    expect(chip.textContent).not.toContain('factor')
  })

  it('⭐ SPEAKS UP on an over-cap selection instead of going quiet', () => {
    const nodes = Array.from({ length: 21 }, (_, i) => ({
      id: `n-${i}`,
      type: 'factor',
      data: { label: `Factor ${i}` },
    }))
    setStore({ nodeIds: nodes.map((n) => n.id), nodes })
    render(<ComposerSelectionChip testId={TEST_ID} />)
    const chip = screen.getByTestId(CHIP)
    expect(chip).toHaveAttribute('data-carriage', 'withheld_over_cap')
    expect(chip.textContent).toContain('21 selected')
    expect(chip.textContent).toContain('20 or fewer')
    // The defect this closes: it must NOT claim an attachment.
    expect(chip.textContent).not.toContain('Asking about')
  })

  it('⭐ SPEAKS UP on a stale selection instead of claiming to carry it', () => {
    setStore({ nodeIds: ['n-deleted'], nodes: [OPTION_A] })
    render(<ComposerSelectionChip testId={TEST_ID} />)
    const chip = screen.getByTestId(CHIP)
    expect(chip).toHaveAttribute('data-carriage', 'withheld_unresolvable')
    expect(chip.textContent).toContain('no longer in the model')
    expect(chip.textContent).not.toContain('Asking about')
  })

  it('clears the selection from where the user is already looking', async () => {
    setStore({ nodeIds: ['n-a'], nodes: [OPTION_A] })
    render(<ComposerSelectionChip testId={TEST_ID} />)
    await userEvent.click(screen.getByTestId(CLEAR))
    expect(clearSelection).toHaveBeenCalledTimes(1)
  })

  it('announces politely, so a screen-reader user learns the turn changed target', () => {
    setStore({ nodeIds: ['n-a'], nodes: [OPTION_A] })
    render(<ComposerSelectionChip testId={TEST_ID} />)
    const chip = screen.getByTestId(CHIP)
    expect(chip).toHaveAttribute('role', 'status')
    expect(chip).toHaveAttribute('aria-live', 'polite')
  })

  it('answers to its HOST composer, so two mounted composers cannot share a testid', () => {
    setStore({ nodeIds: ['n-a'], nodes: [OPTION_A] })
    render(<ComposerSelectionChip testId="ai-input-bar-strip" />)
    expect(screen.getByTestId('ai-input-bar-strip-selection-chip')).toBeTruthy()
    expect(screen.queryByTestId(CHIP)).toBeNull()
  })
})
