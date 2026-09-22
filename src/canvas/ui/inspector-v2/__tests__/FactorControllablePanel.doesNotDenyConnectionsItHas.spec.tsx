/**
 * ⛔⛔ THE THIRD AND LAST SIBLING OF THE L-40 FLAT DENIAL.
 *
 * `EMPTY_STATES.noConnectionsFlat` — *"No connections yet."* — carries its own
 * ruling: **"every panel that shows it must first prove there is genuinely
 * nothing to show."** It has now been repaired twice, each time on the sibling
 * the previous repair did not reach:
 *
 *   · `DecisionPanel`  — review D3, *"it was outbound-only"*
 *   · `OptionPanel`    — #1853, merged and witnessed on deployed `6c7d8abd`
 *   · `FactorControllablePanel` — this file
 *
 * ── THE MECHANISM HERE ───────────────────────────────────────────────────
 * The denial is gated on `setByOptions.length === 0 && influences.length === 0`,
 * and neither list can see an INBOUND edge from a non-option:
 *   · `influences` filters `e.source === nodeId` — outbound only
 *   · `setByOptions` is intervention-derived, keyed on options
 * A `factor → factor` link into this node therefore falls through both, and the
 * panel denies a connection the canvas plainly draws.
 *
 * ⚠ LATENT, AND SAID SO RATHER THAN DRESSED UP. Measured on the deployed model
 * (`6c7d8abd`, saved example, all eight factors): **zero** have no outbound edge
 * while carrying an inbound non-option one, so this state is not reachable on
 * that board. It is reachable the moment anyone draws a factor→factor link into
 * a leaf factor. This is the pattern being closed, not a witnessed incident —
 * and the distinction is recorded because overclaiming it would be the same
 * dishonesty the string itself guards against.
 *
 * ⚠ ONLY THE DENIAL IS GATED, NOT THE GROUP — and that is the difference from
 * #1853. There the whole group was omitted because it had nothing else in it;
 * here the group carries the "set by" and influence rows, so omitting it would
 * take live content with it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, within } from '@testing-library/react'

import { InspectorModal } from '../../../components/InspectorModal'
import { useCanvasStore } from '../../../store'
import { EMPTY_STATES } from '../inspectorStrings'

// importOriginal-spread, NOT a hand-listed factory: `vi.mock` REPLACES the
// module, so a bare `{ useViewport }` factory silently removes every other
// @xyflow/react export the subtree imports (CLAUDE.md trap 12).
vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

const NODE_INSPECTOR = 'div[role="dialog"][aria-label="Node inspector"]'
const FACTOR_ID = 'fac_leaf'
const UPSTREAM_ID = 'fac_upstream'

function factorNode(id: string, label: string) {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { kind: 'factor', label, category: 'controllable', observedState: { value: 0.5, source: 'cee_inference' } },
  }
}

function seed(nodes: unknown[], edges: unknown[]) {
  useCanvasStore.setState({
    nodes: nodes as never[],
    edges: edges as never[],
    results: { status: 'idle', report: null },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: { x: 0, y: 0 } },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

/** Mounts the DEPLOYED inspector chain and PROVES IT OPENED before returning. */
function openInspector() {
  const utils = render(<InspectorModal nodeId={FACTOR_ID} edgeId={null} onClose={vi.fn()} />)
  const dialog = utils.container.querySelector(NODE_INSPECTOR)
  expect(dialog, 'PRECONDITION: the node inspector dialog must be mounted').not.toBeNull()
  return dialog as HTMLElement
}

describe('FactorControllablePanel — it does not deny a connection it has', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('⛔ a factor whose only edge is INBOUND from another factor renders no flat denial', () => {
    seed(
      [factorNode(FACTOR_ID, 'Leaf Factor'), factorNode(UPSTREAM_ID, 'Upstream Factor')],
      [{ id: 'e1', source: UPSTREAM_ID, target: FACTOR_ID, data: {} }],
    )
    const dialog = openInspector()

    // PRECONDITION: the inspector really opened on this factor, so a missing
    // denial cannot be the dialog simply not being there.
    expect(
      within(dialog).getAllByText('Leaf Factor').length,
      'PRECONDITION: the inspector opened on the seeded factor',
    ).toBeGreaterThan(0)

    expect(within(dialog).queryByText(EMPTY_STATES.noConnectionsFlat)).toBeNull()
  })

  /**
   * ⚠ THE CONTRAST, AND IT IS WHAT STOPS THE FIX BEING "DELETE THE SENTENCE".
   * A factor with no edges at all HAS nothing to show, so the denial is TRUE and
   * must still render. A fix that suppressed it in both directions would pass
   * the test above and lose a true statement; this one REDs it.
   */
  it('CONTRAST — a factor with genuinely no edges still says so', () => {
    seed([factorNode(FACTOR_ID, 'Leaf Factor')], [])
    const dialog = openInspector()

    expect(
      within(dialog).getAllByText('Leaf Factor').length,
      'PRECONDITION: the inspector opened on the seeded factor',
    ).toBeGreaterThan(0)

    expect(within(dialog).getByText(EMPTY_STATES.noConnectionsFlat)).toBeTruthy()
  })
})
