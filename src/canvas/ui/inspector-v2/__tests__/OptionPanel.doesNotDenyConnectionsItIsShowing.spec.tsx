/**
 * ⛔⛔ THE OPTION PANEL SAID "No connections yet." WHILE LISTING SIX OF THEM.
 *
 * ── WITNESSED, NOT IMAGINED ──────────────────────────────────────────────
 * Deployed `b31517a1`, guest, saved example *Customer Data Platform Selection*.
 * Double-click `Adopt RudderStack` to open the inspector. It renders
 * "What this option changes" with six factors, an Impact of 55%, and then —
 * a few centimetres below — a Connections group reading **"No connections yet."**
 *
 * The persisted graph at that moment: `opt_rudderstack` holds **5 edges** (one
 * inbound from `dec_cdp`, four outbound to factors) and **6 interventions**.
 *
 * ── THE LIST WAS RIGHT; THE DENIAL WAS WRONG ─────────────────────────────
 * `outboundConnections` is CORRECTLY narrow, and its own comment says so: it
 * drops the decision parent (an implicit organisational link) and every factor
 * already rendered as an `InterventionRow` (redundant display). For an ordinary
 * fully-connected option that set is empty — and the group then printed the flat
 * denial as though the option had nothing attached to it at all.
 *
 * ⭐ THE RULING THIS BREAKS IS CARRIED BY THE STRING ITSELF.
 * `EMPTY_STATES.noConnectionsFlat`'s docblock: *"rendered by panels that were
 * simultaneously showing connections the user could see on the canvas. Now one
 * constant, and every panel that shows it must first prove there is genuinely
 * nothing to show."* This panel proved only that there was nothing MORE to show.
 * `DecisionPanel` was repaired for the same class (review D3 — *"it was
 * outbound-only"*); this is the sibling that repair did not reach.
 *
 * ⚠ THE GROUP IS OMITTED, NOT EMPTIED. `PanelGroup` renders its label
 * unconditionally, so suppressing only the sentence would leave a bare
 * "Connections" heading over nothing — a rendering fault wearing the costume of
 * honesty. Both cases are pinned below, because a fix that silenced the denial
 * in BOTH directions would delete a true statement along with the false one.
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
const OPTION_ID = 'opt_rudderstack'
const DECISION_ID = 'dec_cdp'
const FACTOR_ID = 'fac_annual_cost'

function optionNode(interventions: Record<string, unknown>) {
  return {
    id: OPTION_ID,
    type: 'option',
    position: { x: 0, y: 0 },
    data: { kind: 'option', label: 'Adopt RudderStack', provenance: 'ai_inferred', interventions },
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
  const utils = render(<InspectorModal nodeId={OPTION_ID} edgeId={null} onClose={vi.fn()} />)
  const dialog = utils.container.querySelector(NODE_INSPECTOR)
  expect(dialog, 'PRECONDITION: the node inspector dialog must be mounted').not.toBeNull()
  return dialog as HTMLElement
}

describe('OptionPanel — it does not deny connections it is showing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('⛔ an option whose connections are ALL shown above renders no flat denial', () => {
    // The live shape: an inbound decision edge, an outbound factor edge, and the
    // same factor carried as an intervention — so `outboundConnections` is
    // legitimately empty while the option is plainly connected.
    seed(
      [
        optionNode({ [FACTOR_ID]: 0.8 }),
        { id: DECISION_ID, type: 'decision', position: { x: 0, y: 0 }, data: { kind: 'decision', label: 'CDP choice' } },
        { id: FACTOR_ID, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Annual Platform Cost' } },
      ],
      [
        { id: 'e1', source: DECISION_ID, target: OPTION_ID, data: {} },
        { id: 'e2', source: OPTION_ID, target: FACTOR_ID, data: {} },
      ],
    )
    const dialog = openInspector()

    // PRECONDITION: the inspector really opened on this option, so a missing
    // denial cannot be the dialog simply not being there.
    expect(
      within(dialog).getAllByText('Adopt RudderStack').length,
      'PRECONDITION: the inspector opened on the seeded option',
    ).toBeGreaterThan(0)

    expect(within(dialog).queryByText(EMPTY_STATES.noConnectionsFlat)).toBeNull()
    expect(dialog.querySelector('[data-panel-group="connections"]')).toBeNull()
  })

  /**
   * ⚠ THE CONTRAST, AND IT IS WHAT STOPS THE FIX BEING "DELETE THE SENTENCE".
   * An option with no edges at all HAS nothing to show, so the denial is TRUE
   * and must still render. A fix that suppressed it in both directions would
   * pass the test above and lose a true statement; this one REDs it.
   */
  it('CONTRAST — an option with genuinely no edges still says so', () => {
    seed([optionNode({})], [])
    const dialog = openInspector()

    expect(
      within(dialog).getAllByText('Adopt RudderStack').length,
      'PRECONDITION: the inspector opened on the seeded option',
    ).toBeGreaterThan(0)

    expect(within(dialog).getByText(EMPTY_STATES.noConnectionsFlat)).toBeTruthy()
    expect(dialog.querySelector('[data-panel-group="connections"]')).not.toBeNull()
  })
})
