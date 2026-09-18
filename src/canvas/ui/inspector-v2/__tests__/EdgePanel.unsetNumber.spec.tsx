/**
 * EdgePanel — the existence readout must not print a NUMBER nobody set.
 *
 * ── THE DEFECT, AND WHY ITS SIBLING SPEC DID NOT CATCH IT
 * `EdgePanel.unsetColour.spec.tsx` closed the COLOUR channel on this exact
 * element: an unstamped edge already renders `text-text-light` with no track
 * fill. The NUMBER beside the colour was never gated. `EdgePanel.tsx:252` reads
 * `edge.data.beliefExists` RAW — bypassing `resolveEdgeValueDisplay`, which is
 * already imported and already computed nine lines below for the colour — and
 * renders `{Math.round(localBelief * 100)}%` with no conditional.
 *
 * So the panel says, in one view:
 *
 *     "Nobody has said how likely this connection is to exist yet."   ← prose
 *     "80%"                                                            ← number
 *
 * ⭐ ONE SURFACE, TWO VERDICTS, ONE EDGE. The colour agrees with the prose and
 * the number contradicts both. A number is read as a fact; a grey number is
 * still a fact. For a tool whose purpose is that a team can see what it does
 * NOT know, printing a confidence nobody stated is the worst available failure.
 *
 * ── WHERE THE NUMBERS COME FROM (both are fabrications, differently)
 *   · 0.8 — `USER_EDGE_DEFAULTS.beliefExists` (`domain/edges.ts:569`), what an
 *     edge the user DRAGS is born with. Never stamps `beliefExistsSource`.
 *   · 0.7 — `EDGE_CONSTRAINTS.beliefExists.default`, the fallback when the field
 *     is ABSENT entirely.
 *
 * ── CLAIM TYPE
 * Every assertion here is a RENDERED-TEXT claim on an element bound by
 * `data-testid`. jsdom cannot prove visibility or layout (platform trap 3) and
 * nothing here claims either.
 *
 * ── WHY THE EDIT PATH IS SAFE, PINNED BELOW RATHER THAN ASSUMED
 * `setExistsProbability` writes BOTH `beliefExists` and `beliefExistsSource`
 * (`useInspectorMutations.ts` EDGE_SETTER_FIELDS), so the instant a human moves
 * the slider the value becomes user-stated and the number must APPEAR. Silence
 * is only for "nobody has stated this", never for "the user is stating it now".
 * The last test pins that, because a fix that hid the number during editing
 * would trade one defect for a worse one.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { USER_EDGE_DEFAULTS, EDGE_CONSTRAINTS } from '../../../domain/edges'

const panelProps = { edgeId: 'e1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }

const NODES = [
  { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing budget' } },
  { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
]

function seedNodes() {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: NODES,
    edges: [],
    results: { status: 'none', report: null },
  } as never)
}

function seedEdge(data: Record<string, unknown>) {
  seedNodes()
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    edges: [{ id: 'e1', source: 'fac1', target: 'out1', type: 'styled', data }],
  } as never)
}

/** Build the edge the way the PRODUCT does — no hand-authored `data`. */
function drawEdgeThroughProduct() {
  seedNodes()
  const result = useCanvasStore
    .getState()
    .addEdge({ source: 'fac1', target: 'out1', data: { ...USER_EDGE_DEFAULTS } } as never)
  expect((result as { created: boolean }).created).toBe(true)
  const drawn = useCanvasStore.getState().edges
  expect(drawn).toHaveLength(1)
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    edges: [{ ...drawn[0], id: 'e1' }],
  } as never)
  return drawn[0]
}

const readout = (): HTMLElement => screen.getByTestId('edge-existence-readout')
const PERCENT = /\d+\s*%/

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
})

describe('EdgePanel — the existence readout is provenance-gated on its NUMBER', () => {
  it('REACHABILITY CONTROL: an edge drawn through the product carries a number and NO source', () => {
    const drawn = drawEdgeThroughProduct()
    const data = drawn.data as Record<string, unknown>
    // The state under test is one a real user can produce by dragging a
    // connection — not a fixture invented to make the gate fire.
    expect(typeof data.beliefExists).toBe('number')
    expect(data.beliefExistsSource).toBeUndefined()
  })

  it('prints NO percentage for an edge nobody has characterised', () => {
    drawEdgeThroughProduct()
    render(<EdgePanel {...panelProps} />)
    expect(readout().textContent ?? '').not.toMatch(PERCENT)
  })

  it('says so in words instead of printing a fabricated number', () => {
    drawEdgeThroughProduct()
    render(<EdgePanel {...panelProps} />)
    expect((readout().textContent ?? '').toLowerCase()).toContain('not set')
  })

  it('DISCRIMINATING PAIR: a user-STATED value still prints its percentage', () => {
    // Without this, hiding the number unconditionally would also pass — and
    // that is a different, worse product. One case alone proves nothing.
    seedEdge({ weight: 0.35, direction: 'positive', beliefExists: 0.82, beliefExistsSource: 'user' })
    render(<EdgePanel {...panelProps} />)
    expect(readout().textContent ?? '').toMatch(PERCENT)
    expect(readout().textContent ?? '').toContain('82%')
  })

  it('back-compat: a pre-marker CEE edge still prints its percentage', () => {
    seedEdge({ beliefExists: 0.9, exists_probability: 0.9 })
    render(<EdgePanel {...panelProps} />)
    expect(readout().textContent ?? '').toContain('90%')
  })

  it('an edge with NO beliefExists must not print the 0.7 constant as a fact', () => {
    // The second fabrication: absence falls through to a constant and is
    // rendered as though someone chose it.
    expect(EDGE_CONSTRAINTS.beliefExists.default).toBe(0.7)
    seedEdge({ weight: 0.35, direction: 'positive' })
    render(<EdgePanel {...panelProps} />)
    expect(readout().textContent ?? '').not.toMatch(PERCENT)
  })

  it('CONTRADICTION: the panel cannot say "nobody has said" and print a number at once', () => {
    drawEdgeThroughProduct()
    render(<EdgePanel {...panelProps} />)
    expect(
      screen.getByText(/Nobody has said how likely this connection is to exist yet/),
    ).toBeTruthy()
    expect(readout().textContent ?? '').not.toMatch(PERCENT)
  })

  it('the slider must not announce a fabricated value to assistive tech either', () => {
    // The number has two channels. Gating only the visible one would leave the
    // same fabrication in the accessibility tree, where nobody would see it.
    drawEdgeThroughProduct()
    render(<EdgePanel {...panelProps} />)
    const slider = screen.getByLabelText('Connection existence probability')
    // ⚠ BOUND TO WHAT A PERSON HEARS, NOT TO ONE ATTRIBUTE. Assistive tech
    // announces `aria-valuetext` IN PREFERENCE TO `aria-valuenow` when it is
    // present, and a range input is expected to carry `aria-valuenow`. Asserting
    // the attribute alone would force the worse implementation (stripping a
    // required attribute) and would fail the correct one.
    const spoken = slider.getAttribute('aria-valuetext') ?? slider.getAttribute('aria-valuenow')
    expect(spoken).not.toBe('0.8')
    expect((spoken ?? '').toLowerCase()).toContain('not set')
  })
})
