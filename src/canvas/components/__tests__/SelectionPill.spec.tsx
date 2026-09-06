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
