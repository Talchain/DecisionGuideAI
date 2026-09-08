/**
 * Relationship strength on the Model tab v2 — THE PER-EDGE GATE AND THE WRITE.
 *
 * `proposeEdgeStrength` is the first operation on this surface whose affordance
 * is decided PER ROW rather than per kind, so the thing to pin is not "does the
 * editor work" but "is it offered exactly where the write reaches the server".
 * Every claim below is therefore a DISCRIMINATING PAIR: one edge that qualifies
 * and one that does not, differing in the single field that decides it.
 *
 * ⭐ WHY A PAIR AND NOT A SINGLE TEST. A single "the editor opens" test passes if
 * the gate is `true` for every edge, and a single "it stays disabled" test passes
 * if the gate is `false` for every edge. Either mutation ships F6 — an affordance
 * that writes locally while looking server-backed, or a capability that is dark.
 * Only the pair can tell a gate that DISCRIMINATES from one that is stuck, which
 * is CLAUDE.md trap 20's heuristic applied before the fact: an instrument that
 * returns the same answer for every input is reporting on itself.
 *
 * THE THREE FIXTURES, and the one field that separates each from its twin:
 *
 *   · `SERVER_STATED_EDGE`    — carries `serverStrength`, recorded at ingestion
 *     by `domain/edges.readServerStatedStrength`. `expected` is assertable, so
 *     the edit reaches CEE. Direction is STATED (`directionSource`), so the row
 *     reads "… positive effect" and the editor is a SIGNED control.
 *   · `LOCAL_ONLY_EDGE`       — identical in every displayed respect, and NO
 *     `serverStrength`. Its weight is stamped `'user'`, so it DISPLAYS a value
 *     and the contrast is genuinely about assertability rather than about a row
 *     with nothing on it. `buildEdgeStrengthEditEvent` refuses it, the edit would
 *     land local-only, and the affordance must stay shut. THIS IS THE F6 CASE.
 *   · `MAGNITUDE_ONLY_EDGE`   — `serverStrength` present (so it qualifies) but
 *     NOTHING states a direction on the canvas edge, so the row reads "…, direction
 *     not stated" and the editor is a MAGNITUDE control. This is the fixture that
 *     discriminates `directionStated`, and it is reachable: `serverStrength` and
 *     the stamped `direction` marker are written by different rules.
 *
 * The store is REAL — `setStrength` reads the edge back out of it — and the
 * conversation context is mocked at the module seam, exactly as
 * `ModelTabV2Panel.spec.tsx` does. Assertions bind by IDENTITY (testids and
 * payload endpoints carrying the element id), never by a value predicate another
 * row could satisfy (trap 19): all three edges deliberately share a target, so a
 * test that found its edge "by the number 0.4" would find the wrong one.
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
import { openOutlineGroups } from './openOutlineGroups'

const GOAL_ID = 'goal_arr'
const FACTOR_STATED = 'fac_price'
const FACTOR_LOCAL = 'fac_churn'
const FACTOR_MAGNITUDE = 'fac_capacity'

const SERVER_STATED_EDGE = 'e_server_stated'
const LOCAL_ONLY_EDGE = 'e_local_only'
const MAGNITUDE_ONLY_EDGE = 'e_magnitude_only'

/** The signed mean the server last stated for `SERVER_STATED_EDGE`. */
const SERVER_MEAN = 0.4
/** The magnitude the server last stated for `MAGNITUDE_ONLY_EDGE`. */
const SERVER_MAGNITUDE = 0.6

function factorNode(id: string, label: string): Node {
  return {
    id,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label,
      kind: 'factor',
      category: 'observable',
      observedState: { value: 0.5, raw_value: 50, cap: 100, unit: '%', source: 'cee_inference' },
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

/**
 * QUALIFIES. `serverStrength` is the tuple ingestion recorded, and it is the ONLY
 * thing here that makes `expected` assertable — `weightSource: 'cee'` does not,
 * deliberately (see `edgeServerStatedStrength.ts`'s writer enumeration: two live
 * client paths stamp `'cee'` on a number the server's graph does not hold).
 */
function serverStatedEdge(): Edge {
  return {
    id: SERVER_STATED_EDGE,
    source: FACTOR_STATED,
    target: GOAL_ID,
    data: {
      label: 'Price affects ARR',
      weight: Math.abs(SERVER_MEAN),
      weightSource: 'cee',
      direction: 'positive',
      directionSource: 'cee',
      serverStrength: { mean: SERVER_MEAN, effect_direction: 'positive' },
    },
  } as unknown as Edge
}

/**
 * DOES NOT QUALIFY — THE F6 CASE. Displayed identically to its twin above (a
 * stamped weight, a stamped direction, so the row renders a real band label) and
 * carrying NO `serverStrength`. Nothing here proves what the server holds, so
 * `expected` cannot be asserted and the edit would land local-only.
 */
function localOnlyEdge(): Edge {
  return {
    id: LOCAL_ONLY_EDGE,
    source: FACTOR_LOCAL,
    target: GOAL_ID,
    data: {
      label: 'Churn affects ARR',
      weight: Math.abs(SERVER_MEAN),
      weightSource: 'user',
      direction: 'positive',
      directionSource: 'user',
    },
  } as unknown as Edge
}

/**
 * QUALIFIES, WITH NO STATED DIRECTION. `serverStrength` makes `expected`
 * assertable; the absence of `direction`/`directionSource`/`effect_direction`
 * makes `resolveEdgeDirectionDisplay` refuse, so the row says so and the editor
 * must not mint a sign.
 */
function magnitudeOnlyEdge(): Edge {
  return {
    id: MAGNITUDE_ONLY_EDGE,
    source: FACTOR_MAGNITUDE,
    target: GOAL_ID,
    data: {
      label: 'Capacity affects ARR',
      weight: SERVER_MAGNITUDE,
      weightSource: 'cee',
      serverStrength: { mean: SERVER_MAGNITUDE, effect_direction: 'positive' },
    },
  } as unknown as Edge
}

function allNodes(): Node[] {
  return [
    goalNode(),
    factorNode(FACTOR_STATED, 'Price'),
    factorNode(FACTOR_LOCAL, 'Churn'),
    factorNode(FACTOR_MAGNITUDE, 'Capacity'),
  ]
}

function allEdges(): Edge[] {
  return [serverStatedEdge(), localOnlyEdge(), magnitudeOnlyEdge()]
}

function seedStore() {
  useCanvasStore.setState({ nodes: allNodes(), edges: allEdges() } as never, false)
}

/** The edge as the STORE holds it — what a reload would rebuild the row from. */
function storedEdgeData(id: string): Record<string, unknown> {
  const e = useCanvasStore.getState().edges.find(x => x.id === id)
  return (e?.data ?? {}) as Record<string, unknown>
}

/** Every `edge_strength_edit` payload sent, bound to its edge by ENDPOINTS. */
function strengthEditsFor(source: string): Record<string, unknown>[] {
  return sendSystemEvent.mock.calls
    .map(c => c[0] as { type?: string; payload?: Record<string, unknown> })
    .filter(e => e?.type === 'edge_strength_edit' && e.payload?.from === source)
    .map(e => e.payload as Record<string, unknown>)
}

function renderPanel() {
  render(<ModelTabV2Panel nodes={allNodes()} edges={allEdges()} goalThreshold={null} />)
  openOutlineGroups()
}

/** Drive one row's three-beat to PROPOSED: click the value, type, Enter. */
function propose(rowId: string, raw: string) {
  fireEvent.click(screen.getByTestId(`model-row-v2-${rowId}-value`))
  const input = screen.getByTestId(`model-row-v2-${rowId}-value-input`)
  fireEvent.change(input, { target: { value: raw } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

/** …and confirm it. */
function commit(rowId: string, raw: string) {
  propose(rowId, raw)
  fireEvent.click(screen.getByTestId(`model-row-v2-${rowId}-confirm`))
}

beforeEach(() => {
  vi.clearAllMocks()
  seedStore()
})

afterEach(() => cleanup())

// ─────────────────────────────────────────────────────────────────────────────
// 1. The gate — a discriminating pair, differing only in `serverStrength`
// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ the strength editor is offered PER EDGE, where the write reaches the server', () => {
  it('the edge whose strength the SERVER stated renders an ENABLED editor', () => {
    renderPanel()
    const value = screen.getByTestId(`model-row-v2-${SERVER_STATED_EDGE}-value`)
    expect(value.tagName).toBe('BUTTON')
    expect(value).toBeEnabled()
  })

  it('⭐ THE F6 CASE: the edge with NO server statement stays static text', () => {
    renderPanel()
    const value = screen.getByTestId(`model-row-v2-${LOCAL_ONLY_EDGE}-value`)
    // A span, not a disabled button: this row's affordance is unchanged from
    // before edge strength had a carrier at all.
    expect(value.tagName).toBe('SPAN')
    expect(value).not.toHaveAttribute('role', 'button')
  })

  it('⭐ THE F6 CASE, DRIVEN: clicking it opens no editor, writes nothing, sends nothing', () => {
    renderPanel()
    const before = { ...storedEdgeData(LOCAL_ONLY_EDGE) }
    fireEvent.click(screen.getByTestId(`model-row-v2-${LOCAL_ONLY_EDGE}-value`))
    expect(
      screen.queryByTestId(`model-row-v2-${LOCAL_ONLY_EDGE}-value-input`),
    ).not.toBeInTheDocument()
    expect(storedEdgeData(LOCAL_ONLY_EDGE)).toEqual(before)
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('the two rows are otherwise alike — the contrast is assertability, not display', () => {
    renderPanel()
    // Both render a real band label. If the non-qualifying row simply showed
    // nothing, the pair above would be discriminating on "has a value" and would
    // say nothing at all about the gate under test.
    const stated = screen.getByTestId(`model-row-v2-${SERVER_STATED_EDGE}-value`).textContent ?? ''
    const local = screen.getByTestId(`model-row-v2-${LOCAL_ONLY_EDGE}-value`).textContent ?? ''
    expect(stated).toMatch(/positive effect/)
    expect(local).toMatch(/positive effect/)
    expect(local).not.toMatch(/Not set/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. The write — it reaches the server, and it survives a reload
// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ a confirmed strength edit is dispatched as `edge_strength_edit`', () => {
  it('the editor opens on the number the row is already showing', () => {
    renderPanel()
    fireEvent.click(screen.getByTestId(`model-row-v2-${SERVER_STATED_EDGE}-value`))
    const input = screen.getByTestId(
      `model-row-v2-${SERVER_STATED_EDGE}-value-input`,
    ) as HTMLInputElement
    expect(input.value).toBe(String(SERVER_MEAN))
  })

  it('proposing writes nothing and sends nothing — the middle beat is intent only', () => {
    renderPanel()
    const before = { ...storedEdgeData(SERVER_STATED_EDGE) }
    propose(SERVER_STATED_EDGE, '0.8')
    expect(screen.getByTestId(`model-row-v2-${SERVER_STATED_EDGE}-confirm`)).toBeInTheDocument()
    expect(storedEdgeData(SERVER_STATED_EDGE)).toEqual(before)
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('⭐ Confirm sends the edit, with `expected` describing what the SERVER holds', () => {
    renderPanel()
    commit(SERVER_STATED_EDGE, '0.8')

    const sent = strengthEditsFor(FACTOR_STATED)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toEqual({
      from: FACTOR_STATED,
      to: GOAL_ID,
      magnitude: 0.8,
      direction_intent: 'positive',
      // NOT the number just typed, and not a UI default: the tuple ingestion
      // recorded. CEE compares this with a bare `!==`, so a fabricated value
      // here earns the user a conflict for an edit that was fine.
      expected: { mean: SERVER_MEAN, effect_direction: 'positive' },
      intent: 'set',
    })
  })

  it('⭐ and the local model carries it, so a reload rebuilds the row from the new value', () => {
    renderPanel()
    commit(SERVER_STATED_EDGE, '0.8')
    const data = storedEdgeData(SERVER_STATED_EDGE)
    expect(data.weight).toBe(0.8)
    expect(data.weightSource).toBe('user')
    // `serverStrength` is deliberately NOT moved by a local edit — it is what
    // makes the NEXT edit assertable.
    expect(data.serverStrength).toEqual({ mean: SERVER_MEAN, effect_direction: 'positive' })
  })

  it('only the edge that was edited is touched — the other two are byte-identical', () => {
    renderPanel()
    const localBefore = { ...storedEdgeData(LOCAL_ONLY_EDGE) }
    const magnitudeBefore = { ...storedEdgeData(MAGNITUDE_ONLY_EDGE) }
    commit(SERVER_STATED_EDGE, '0.8')
    expect(storedEdgeData(LOCAL_ONLY_EDGE)).toEqual(localBefore)
    expect(storedEdgeData(MAGNITUDE_ONLY_EDGE)).toEqual(magnitudeBefore)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. `directionStated` — the second discriminating pair
// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ a magnitude never mints a direction — `directionStated` comes from the EDGE', () => {
  it('the row with no stated direction says so, and seeds a bare MAGNITUDE', () => {
    renderPanel()
    const cell = screen.getByTestId(`model-row-v2-${MAGNITUDE_ONLY_EDGE}-value`)
    expect(cell.textContent).toMatch(/direction not stated/)
    fireEvent.click(cell)
    const input = screen.getByTestId(
      `model-row-v2-${MAGNITUDE_ONLY_EDGE}-value-input`,
    ) as HTMLInputElement
    // Unsigned: the label and the seed are one derivation, so a control that
    // opened on a signed number would be saying something the row does not.
    expect(input.value).toBe(String(SERVER_MAGNITUDE))
  })

  it('⭐ committing it sends `direction_intent: preserve` and leaves the direction ABSENT', () => {
    renderPanel()
    commit(MAGNITUDE_ONLY_EDGE, '0.9')

    const sent = strengthEditsFor(FACTOR_MAGNITUDE)
    expect(sent).toHaveLength(1)
    expect(sent[0].direction_intent).toBe('preserve')
    expect(sent[0].magnitude).toBe(0.9)

    const data = storedEdgeData(MAGNITUDE_ONLY_EDGE)
    expect(data.weight).toBe(0.9)
    // The keys must be ABSENT, not `undefined`: the store merges
    // `{...old, ...new}`, so an explicit `undefined` would overwrite a real
    // direction on some other edge shaped like this one.
    expect('direction' in data).toBe(false)
    expect('directionSource' in data).toBe(false)
  })

  it('⭐⭐ A SIGN TYPED INTO A MAGNITUDE ROW STATES NOTHING — no direction is minted', () => {
    renderPanel()
    // The contract's own prohibition, driven: "a MAGNITUDE CANNOT CARRY A SIGN".
    // A caller reading `directionStated` off `num < 0` would write
    // `direction: 'negative'` here and hand the edge a claim nobody made.
    commit(MAGNITUDE_ONLY_EDGE, '-0.9')

    const sent = strengthEditsFor(FACTOR_MAGNITUDE)
    expect(sent).toHaveLength(1)
    expect(sent[0].direction_intent).toBe('preserve')
    expect(sent[0].magnitude).toBe(0.9)

    const data = storedEdgeData(MAGNITUDE_ONLY_EDGE)
    expect('direction' in data).toBe(false)
    expect('directionSource' in data).toBe(false)
  })

  it('⭐ THE OPPOSITE ARM: where a direction IS stated, the sign is honoured and stamped', () => {
    renderPanel()
    commit(SERVER_STATED_EDGE, '-0.8')

    const sent = strengthEditsFor(FACTOR_STATED)
    expect(sent).toHaveLength(1)
    expect(sent[0].direction_intent).toBe('negative')
    expect(sent[0].magnitude).toBe(0.8)

    const data = storedEdgeData(SERVER_STATED_EDGE)
    expect(data.direction).toBe('negative')
    expect(data.directionSource).toBe('user')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Fail closed — the affordance may not outrun the carrier
// ─────────────────────────────────────────────────────────────────────────────

describe('⭐ a value the wire cannot carry changes NOTHING — no local write behind a server control', () => {
  it('a magnitude outside the contract’s [0, 1] is refused, and the model is untouched', () => {
    renderPanel()
    const before = { ...storedEdgeData(SERVER_STATED_EDGE) }
    // `magnitude: z.number().finite().min(0).max(1)`. The canvas weight domain is
    // declared OPEN, so 1.5 is representable here and must be refused rather than
    // clamped — a clamped 1.5 → 1 sends a number the user never stated.
    commit(SERVER_STATED_EDGE, '1.5')

    expect(strengthEditsFor(FACTOR_STATED)).toHaveLength(0)
    // ⭐ AND NOTHING LANDED LOCALLY. This is the half that separates this seam
    // from `setStrength`'s own behaviour, which writes locally and discloses the
    // gap — correct for the inspector's slider, F6 on a surface that only offers
    // the control where the write reaches the server.
    expect(storedEdgeData(SERVER_STATED_EDGE)).toEqual(before)
  })

  it('POSITIVE CONTROL: the same row accepts a value INSIDE the domain', () => {
    // Without this, the refusal above would also pass on a row that had been
    // wired to nothing at all (trap 13 — an absence proved by a dead control).
    renderPanel()
    commit(SERVER_STATED_EDGE, '0.9')
    expect(strengthEditsFor(FACTOR_STATED)).toHaveLength(1)
    expect(storedEdgeData(SERVER_STATED_EDGE).weight).toBe(0.9)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. The factor path is unchanged
// ─────────────────────────────────────────────────────────────────────────────

describe('the factor transaction is untouched by the edge one', () => {
  it('POSITIVE CONTROL: a factor row still commits `factor_value_edit`', () => {
    renderPanel()
    commit(FACTOR_STATED, '70')
    const kinds = sendSystemEvent.mock.calls.map(c => (c[0] as { type?: string })?.type)
    expect(kinds).toEqual(['factor_value_edit'])
  })
})
