/**
 * The two capabilities #777 could not rehome, rehomed (18 Aug 2026).
 *
 * REHOME → DELETE step 2. `useModelEditAuthority` now carries
 * `proposeOptionIntervention` and `proposeFactorConfirmation`, and this spec
 * pins what a USER gets from them on the canonical surface — through the
 * mounted consumer, against the REAL store, never against the hook in isolation
 * (preamble P2).
 *
 * WHAT EACH PIN EXISTS TO CATCH:
 *
 *  1. THE STAMP. Confirm must write `user_confirmed`, NEVER `user`. `'user'`
 *     classifies as the `edited` kind, so the pill said "User edited" for a
 *     gesture in which the user changed no number. The assertion is written
 *     BOTH ways — the literal expected AND the literal forbidden — because a
 *     `toBeTruthy()` on the source would pass on the very value being fixed.
 *
 *  2. NO WIRE CLAIM. Neither operation has a value-bearing carrier, so neither
 *     may emit a turn. A local commit that sent a system event would be
 *     claiming a server saw a value it never received.
 *
 *  3. THE PREDICATE AGREEMENT. The Confirm chip is offered by exactly the
 *     predicate that counts the factor as unverified, so confirming must make
 *     the chip GO AWAY. A button that survives its own success is how the badge
 *     and the affordance start disagreeing about one row.
 *
 *  4. NO RAW IDS, AT THE SEAM ONE PAST THE PROJECTION (preamble P1). The
 *     projection drops an intervention whose factor is not in the model; this
 *     spec drives a store that CONTAINS such an entry through the real render
 *     and asserts the id appears nowhere in the detail region's text — the v1
 *     rows fell back to `factorId` in exactly this case.
 *
 *  5. FAIL CLOSED. An unparseable draft, a value with no factor, a confirmation
 *     over an absent value: nothing may be written anywhere. A dropped edit is
 *     a visible "nothing happened"; a half-committed one is a split-brain.
 *
 * Assertions bind by IDENTITY (testids carrying the element id), never by a
 * value predicate another element could satisfy (trap 19).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

const sendSystemEvent = vi.fn()

// Trap 12: spread the real module rather than hand-listing its exports.
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useOptionalConversationContext: () => ({ sendSystemEvent }),
  }
})

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { useCanvasStore } from '../../store'

const FACTOR_ID = 'fac_monthly_eng_cost'
const FACTOR_LABEL = 'Monthly Engineering Cost'
const EMPTY_FACTOR_ID = 'fac_never_estimated'
const GHOST_FACTOR_ID = 'fac_deleted_last_week'
const OPTION_ID = 'opt_premium'
const GOAL_ID = 'goal_arr'
const EDGE_ID = 'e_cost_to_goal'
const CAP = 30000

/** An AI estimate nobody has ratified — the row the Confirm chip is FOR. */
function unconfirmedFactor(): Node {
  return {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: FACTOR_LABEL,
      kind: 'factor',
      category: 'observable',
      observedState: {
        value: 30000 / CAP,
        raw_value: 30000,
        cap: CAP,
        unit: '£',
        source: 'cee_inference',
      },
    },
  } as unknown as Node
}

/** A factor with NO value. There is nothing here to ratify. */
function valuelessFactor(): Node {
  return {
    id: EMPTY_FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: 'Churn rate', kind: 'factor', category: 'observable' },
  } as unknown as Node
}

/**
 * ⚠ THIS OPTION CARRIES AN INTERVENTION FOR A FACTOR THAT IS NOT IN THE MODEL.
 * That is not a contrived shape: a factor removed after an option was drafted
 * leaves exactly this. The v1 rows rendered `GHOST_FACTOR_ID` as the element's
 * NAME.
 */
function optionNode(): Node {
  return {
    id: OPTION_ID,
    type: 'option',
    position: { x: 0, y: 0 },
    data: {
      label: 'Premium-first',
      kind: 'option',
      interventions: { [FACTOR_ID]: 0.6, [GHOST_FACTOR_ID]: 0.9 },
    },
  } as unknown as Node
}

function goalNode(): Node {
  return {
    id: GOAL_ID,
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { label: 'Hit ARR target', kind: 'goal' },
  } as unknown as Node
}

function stampedEdge(): Edge {
  return {
    id: EDGE_ID,
    source: FACTOR_ID,
    target: GOAL_ID,
    data: {
      label: 'Cost affects target',
      weight: 0.4,
      direction: 'positive',
      weightSource: 'user',
      directionSource: 'user',
    },
  } as unknown as Edge
}

function allNodes(): Node[] {
  return [goalNode(), optionNode(), unconfirmedFactor(), valuelessFactor()]
}

function seedStore() {
  useCanvasStore.setState({ nodes: allNodes(), edges: [stampedEdge()] } as never, false)
}

function storedNode(id: string): Record<string, unknown> {
  const n = useCanvasStore.getState().nodes.find(x => x.id === id)
  return (n?.data ?? {}) as Record<string, unknown>
}

function storedSource(id: string): unknown {
  return (storedNode(id).observedState as Record<string, unknown> | undefined)?.source
}

/** The node's `data` OBJECT. A sanctioned write replaces it; a no-op does not. */
function nodeRef(id: string): unknown {
  return useCanvasStore.getState().nodes.find(x => x.id === id)?.data
}

function storedInterventions(id: string): Record<string, unknown> {
  return (storedNode(id).interventions ?? {}) as Record<string, unknown>
}

/**
 * ⚠ RENDERS FROM THE STORE, NOT FROM THE FIXTURE BUILDERS.
 *
 * The panel takes its nodes as PROPS, and `ModelTabBody` — its only mount site
 * — sources those props from the canvas store. A helper that re-invoked
 * `allNodes()` would hand the surface pristine fixture data on every render, so
 * NO write could ever be visible to a re-render. That is exactly the trap this
 * spec caught on its first run: the "chip goes away" pin failed against
 * CORRECT code, because the second render was showing the original estimate.
 * A fixture you wrote yourself is not evidence about the mounted surface
 * (trap 16, inverse form).
 */
function renderPanel() {
  const { nodes, edges } = useCanvasStore.getState()
  render(
    <ModelTabV2Panel
      nodes={nodes as Node[]}
      edges={edges as Edge[]}
      goalThreshold={null}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  seedStore()
})
afterEach(() => cleanup())

// ─────────────────────────────────────────────────────────────────────────────
// Factor confirmation — the rehomed Confirm ✓
// ─────────────────────────────────────────────────────────────────────────────

describe('Confirm ✓ — rehomed onto the canonical outline', () => {
  it('is offered on the unratified estimate, and on NO other row', () => {
    renderPanel()
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}-confirm-as-is`)).toBeInTheDocument()
    // Bound by identity: each of these is a specific row, not "some other row".
    expect(screen.queryByTestId(`model-row-v2-${GOAL_ID}-confirm-as-is`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`model-row-v2-${OPTION_ID}-confirm-as-is`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`model-row-v2-${EDGE_ID}-confirm-as-is`)).not.toBeInTheDocument()
  })

  it('is NOT offered where there is no value to ratify (P8 — never ask what you cannot accept)', () => {
    renderPanel()
    // The row exists; only its Confirm affordance is absent. Asserting the row
    // is present first stops this passing because the row itself vanished.
    expect(screen.getByTestId(`model-row-v2-${EMPTY_FACTOR_ID}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`model-row-v2-${EMPTY_FACTOR_ID}-confirm-as-is`)).not.toBeInTheDocument()
  })

  it('stamps user_confirmed — and specifically NOT user', () => {
    renderPanel()
    expect(storedSource(FACTOR_ID)).toBe('cee_inference')

    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}-confirm-as-is`))

    expect(storedSource(FACTOR_ID)).toBe('user_confirmed')
    // ⚠ THE FORBIDDEN LITERAL, ASSERTED EXPLICITLY. Without this line a mutant
    // restoring `'user'` would still have to fail the line above — but this
    // states the defect being fixed, so a future widening of the expectation
    // cannot quietly re-admit it.
    expect(storedSource(FACTOR_ID)).not.toBe('user')
  })

  it('does not invent an extractionType — confirming a number says nothing about how it was extracted', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}-confirm-as-is`))
    const obs = storedNode(FACTOR_ID).observedState as Record<string, unknown>
    expect(obs.extractionType).toBeUndefined()
  })

  it('leaves the VALUE untouched — a confirmation changes provenance, not the number', () => {
    renderPanel()
    const before = (storedNode(FACTOR_ID).observedState as Record<string, unknown>).raw_value
    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}-confirm-as-is`))
    const after = (storedNode(FACTOR_ID).observedState as Record<string, unknown>).raw_value
    expect(after).toBe(before)
    expect(after).toBe(30000)
  })

  it('sends NO turn — there is no value-bearing carrier for a confirmation', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}-confirm-as-is`))
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('the chip goes away once confirmed — the affordance and the verify count share ONE predicate', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}-confirm-as-is`))
    // Re-render from the now-updated store, exactly as the tab does.
    cleanup()
    renderPanel()
    expect(screen.getByTestId(`model-row-v2-${FACTOR_ID}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`model-row-v2-${FACTOR_ID}-confirm-as-is`)).not.toBeInTheDocument()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Option intervention targets — rehomed into the detail region
// ─────────────────────────────────────────────────────────────────────────────

function selectOption() {
  fireEvent.click(screen.getByTestId(`model-row-v2-${OPTION_ID}`))
}

describe('What this would change — the rehomed intervention targets', () => {
  it('names the factor in plain English, and never shows its id', () => {
    renderPanel()
    selectOption()
    const row = screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}`)
    expect(row).toHaveTextContent(FACTOR_LABEL)
    // The id may legitimately appear as a testid attribute; the assertion is
    // about what the user READS.
    expect(row.textContent ?? '').not.toContain(FACTOR_ID)
  })

  it('DROPS an intervention whose factor is not in the model — no raw id reaches the user (P1)', () => {
    renderPanel()
    selectOption()
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${GHOST_FACTOR_ID}`),
    ).not.toBeInTheDocument()
    // One seam past the projection: the whole rendered detail region.
    const detail = screen.getByTestId('model-detail-v2')
    expect(detail.textContent ?? '').not.toContain(GHOST_FACTOR_ID)
    // POSITIVE CONTROL — the ghost really IS in the store being rendered, so the
    // absence above is the projection's doing and not an empty fixture.
    expect(Object.keys(storedInterventions(OPTION_ID))).toContain(GHOST_FACTOR_ID)
  })

  it('commits a new target through the authority, into the OPTION that owns it', () => {
    renderPanel()
    selectOption()
    const beforeRef = nodeRef(OPTION_ID)
    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-value`))
    const input = screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-input`)
    fireEvent.change(input, { target: { value: '0.42' } })
    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-save`))

    expect(storedInterventions(OPTION_ID)[FACTOR_ID]).toBe(0.42)
    // POSITIVE CONTROL for the identity instrument used by the no-op test
    // below: a REAL change DOES replace the node's data object. Without this,
    // `toBe(before)` there could pass because the setter never replaces it.
    expect(nodeRef(OPTION_ID)).not.toBe(beforeRef)
    // The ghost entry is untouched: the write is a targeted set, not a rewrite
    // of the map, so an entry the surface cannot render is not silently dropped
    // from the user's model either.
    expect(storedInterventions(OPTION_ID)[GHOST_FACTOR_ID]).toBe(0.9)
  })

  it('sends NO turn — an intervention target has no value-bearing carrier', () => {
    renderPanel()
    selectOption()
    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-value`))
    fireEvent.change(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-input`), {
      target: { value: '0.42' },
    })
    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-save`))
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('FAILS CLOSED on an unparseable draft — nothing written, the editor stays open', () => {
    renderPanel()
    selectOption()
    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-value`))
    fireEvent.change(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-input`), {
      target: { value: 'soon' },
    })
    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-save`))

    expect(storedInterventions(OPTION_ID)[FACTOR_ID]).toBe(0.6)
    expect(
      screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-input`),
    ).toBeInTheDocument()
  })

  it('⭐ re-typing the SAME number in another form is not a change — no write, no notification', () => {
    renderPanel()
    selectOption()
    const before = nodeRef(OPTION_ID)
    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-value`))
    // 0.6 stored; `6e-1` is the same number in a different lexical form. The v1
    // rows suppressed this through `InlineEdit.hasChanged`, which compares
    // PARSED NUMBERS for exactly this case.
    fireEvent.change(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-input`), {
      target: { value: '6e-1' },
    })
    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-save`))

    /*
     * ⚠ THE ASSERTION IS OBJECT IDENTITY, NOT THE VALUE — and it had to be.
     *
     * The first cut asserted `interventions[FACTOR_ID] === 0.6`, and a mutant
     * that DELETED this guard SURVIVED it: writing 0.6 over 0.6 leaves the value
     * identical, so a value assertion cannot tell "no write happened" from "a
     * pointless write happened". That is trap 19 in its purest form — a test
     * passing on a state another path also produces.
     *
     * The sanctioned setter replaces the node's `data` object, so reference
     * equality is what actually distinguishes them. Proven: with the guard
     * removed this line goes RED while the value assertion stays green.
     */
    expect(nodeRef(OPTION_ID)).toBe(before)
    expect(storedInterventions(OPTION_ID)[FACTOR_ID]).toBe(0.6)
    expect(sendSystemEvent).not.toHaveBeenCalled()
    // The editor closes: the user's intent was honoured, there was simply
    // nothing to record. Leaving it open would read as a rejected edit.
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR_ID}-input`),
    ).not.toBeInTheDocument()
  })

  it('Cancel abandons the draft and writes nothing', () => {
    renderPanel()
    selectOption()
    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-value`))
    fireEvent.change(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-input`), {
      target: { value: '0.99' },
    })
    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-cancel`))

    expect(storedInterventions(OPTION_ID)[FACTOR_ID]).toBe(0.6)
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR_ID}-input`),
    ).not.toBeInTheDocument()
  })

  it('an open draft is abandoned when a different element is selected', () => {
    renderPanel()
    selectOption()
    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-value`))
    fireEvent.change(screen.getByTestId(`model-detail-v2-intervention-${FACTOR_ID}-input`), {
      target: { value: '0.99' },
    })
    // Move to another row, then come back.
    fireEvent.click(screen.getByTestId(`model-row-v2-${FACTOR_ID}`))
    selectOption()
    expect(
      screen.queryByTestId(`model-detail-v2-intervention-${FACTOR_ID}-input`),
    ).not.toBeInTheDocument()
    expect(storedInterventions(OPTION_ID)[FACTOR_ID]).toBe(0.6)
  })
})
