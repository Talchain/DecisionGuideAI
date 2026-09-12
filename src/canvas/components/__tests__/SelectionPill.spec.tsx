/**
 * SelectionPill — render verification. (StaleAnalysisBadge retired, Wave F-B.)
 *
 * Closes verification gap #2 from the integration sign-off:
 *
 *   - Selecting a node shows the SelectionPill above the strip.
 *   - Stale analysis state shows the StaleAnalysisBadge above the strip.
 *   - The Rerun button calls the EXISTING analysis route (`useV2Run`),
 *     not a second analysis path.
 *
 * Both components are pure render-stage primitives — no internal state —
 * so a focused unit test that toggles their hook inputs is sufficient.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mutable hook mocks the tests reconfigure.
const selectionState: { value: { id: string; label: string; kind: 'node' | 'edge' } | null } = { value: null }

/**
 * ⚠ SPREAD THE REAL MODULE — a `vi.mock` factory REPLACES it, so any export
 * added later is silently absent and the suite dies at collection with a
 * "No export is defined on the mock" that reads like a source bug. That is the
 * hand-maintained-mirror defect this estate keeps paying for, and it fired here
 * the moment `useSelectionCarriage` was added. `importOriginal` means the list
 * below only has to name what is genuinely being STUBBED.
 */
const carriageState: { value: { kind: string; selectedCount?: number; cap?: number } } = {
  value: { kind: 'none' },
}

vi.mock('../../hooks/useSelectionContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../hooks/useSelectionContext')>()),
  useSelectionContext: () => selectionState.value,
  useSelectionCarriage: () => carriageState.value,
}))
import { SelectionPill } from '../SelectionPill'
import { describeSelectionCarriage } from '../../conversation/selectedElementRefs'

describe('SelectionPill — gap #2', () => {
  it('renders nothing when no element is selected', () => {
    selectionState.value = null
    carriageState.value = { kind: 'none' }
    const { container } = render(<SelectionPill />)
    expect(container.firstChild).toBeNull()
  })

  it('renders "Selected: <label>" when a single node is selected', () => {
    carriageState.value = { kind: 'carried' }
    selectionState.value = { id: 'goal-1', label: 'Should I switch jobs?', kind: 'node' }
    render(<SelectionPill />)
    const pill = screen.getByTestId('ai-panel-selection-pill')
    expect(pill).toBeInTheDocument()
    expect(pill).toHaveTextContent('Selected:')
    expect(pill).toHaveTextContent('Should I switch jobs?')
  })

  it('renders "source → target" label when an edge is selected', () => {
    carriageState.value = { kind: 'carried' }
    selectionState.value = { id: 'e1', label: 'salary → satisfaction', kind: 'edge' }
    render(<SelectionPill />)
    expect(screen.getByText('salary → satisfaction')).toBeInTheDocument()
  })
})

// Wave F-B: the StaleAnalysisBadge describe block was removed with the
// component — it was the third stale surface in one dock and its Rerun
// bypassed the canonical runner. The freshness strip owns stale + Rerun
// (AnalysisFreshnessNotice.rerun.spec.tsx).

/**
 * ⭐ THE WITHHELD COPY IS USER-VISIBLE AND HAD NO RENDERING PIN.
 *
 * Measured at `3267d178` with a contrast control: both withheld sentences
 * appeared in ZERO specs, while the contrast `ai-panel-selection-pill` read 2
 * spec files and a fabricated string read 0. So deleting the withheld render
 * block left the whole suite GREEN. These tests are that pin.
 *
 * ⚠ THE CARRIAGE FIXTURE IS THE PRODUCER'S OWN OUTPUT, NOT A HAND-WRITTEN
 * ONE. A self-authored `{ kind: 'withheld_over_cap' }` literal would only prove
 * the component renders for a state nothing can produce (trap 16's inverse: a
 * fixture you wrote yourself is not evidence about the wire). Each test derives
 * its carriage from the real `describeSelectionCarriage` and ASSERTS THAT
 * PRECONDITION before rendering, so the copy is bound to a state the store can
 * actually reach.
 */
describe('SelectionPill — a WITHHELD selection is spoken, not swallowed', () => {
  it('renders the over-cap sentence when the selection exceeds the contract cap', () => {
    // 21 selected — one past MAX_SELECTED_ELEMENTS.
    const ids = Array.from({ length: 21 }, (_, i) => `n${i}`)
    const carriage = describeSelectionCarriage({
      selection: { nodeIds: new Set(ids), edgeIds: new Set<string>() },
      nodes: ids.map((id) => ({ id, type: 'factor', data: { label: id } })),
      edges: [],
    })
    // PRECONDITION, pinned in-test: the producer really does reach this state.
    expect(carriage).toEqual({ kind: 'withheld_over_cap', selectedCount: 21, cap: 20 })

    selectionState.value = null
    carriageState.value = carriage
    render(<SelectionPill />)

    // Bound by IDENTITY: the exact sentence, on the pill's own testid, tagged
    // with the branch that produced it.
    const pill = screen.getByTestId('ai-panel-selection-pill')
    expect(pill).toHaveAttribute('data-selection-carriage', 'withheld_over_cap')
    expect(
      screen.getByText('21 selected \u2014 too many to ask about. Narrow it to 20 or fewer.'),
    ).toBeInTheDocument()
  })

  it('renders the unresolvable sentence when a selection resolves to nothing truthful', () => {
    // Two KINDLESS nodes: under the cap, and every ref is dropped as untruthful.
    // Note this is also a MULTI-element selection that RENDERS — the case the
    // file header used to deny.
    const carriage = describeSelectionCarriage({
      selection: { nodeIds: new Set(['a', 'b']), edgeIds: new Set<string>() },
      nodes: [
        { id: 'a', data: { label: 'Alpha' } },
        { id: 'b', data: { label: 'Beta' } },
      ],
      edges: [],
    })
    expect(carriage).toEqual({ kind: 'withheld_unresolvable', selectedCount: 2 })

    selectionState.value = null
    carriageState.value = carriage
    render(<SelectionPill />)

    const pill = screen.getByTestId('ai-panel-selection-pill')
    expect(pill).toHaveAttribute('data-selection-carriage', 'withheld_unresolvable')
    expect(
      screen.getByText(
        'That selection is no longer in the model, so a question won\u2019t carry it.',
      ),
    ).toBeInTheDocument()
  })

  /**
   * The opposite-direction twin. Without it the two tests above are equally
   * satisfied by a component that renders a notice unconditionally, and the
   * whole point is that CARRIAGE — not selected count — decides.
   */
  it('stays silent on a CARRIED selection the pill cannot name', () => {
    const carriage = describeSelectionCarriage({
      selection: { nodeIds: new Set(['solo']), edgeIds: new Set<string>() },
      nodes: [{ id: 'solo', type: 'factor', data: {} }],
      edges: [],
    })
    // Exactly ONE element selected and carried on the wire, but with no label,
    // so `useSelectionContext` returns null and nothing renders.
    expect(carriage).toEqual({ kind: 'carried', refs: [{ id: 'solo', kind: 'factor' }] })

    selectionState.value = null
    carriageState.value = carriage
    const { container } = render(<SelectionPill />)
    expect(container.firstChild).toBeNull()
  })
})
