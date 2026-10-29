/**
 * A PROGRAM'S CANVAS IS CEE'S PROJECTED GRAPH (UI thin layer, step 1; inventory 29 Oct, rows 1-2, 5-8, 10-11, 16, 21, 33).
 * On a model-program scenario the store's cards and links are exactly the graph CEE sends, under CEE's own ids: the read
 * (`mergeServerGraphOnHydrate`, gated by the read's own `living_model.model_program`) and a program core turn's receipt
 * (`applyProgramGraph`, the one program writer). Only each card's layout and view fields are kept. No link is given a default
 * weight, direction, belief or function; no link is matched by its pair or renamed; nothing CEE no longer sends survives.
 *
 * The graph is the qualitative journey's real saved read (staging, 29 Oct 2026; 15 cards, 17 links, two of them joining
 * `ads_before_fix` to `marketing_disruption`, the second stating neither a strength nor a direction). That capture keeps
 * the graph's nodes and edges only; the program marker CEE's read carries (`living_model.model_program: 'v1'`) is put
 * back here, and leaving it off is each contrast: a read that is not a program keeps today's rules.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import { applyProgramGraph, reconcileAppliedGraph } from '../mergeAppliedGraph'
import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import { __resetPendingFactorEditsForTest, markFactorEditInFlight } from '../../conversation/pendingFactorEdit'
import { __resetPendingEdgeEditsForTest, markEdgeEditInFlight } from '../../conversation/pendingEdgeEdit'
import { __resetProgramScenariosForTest } from '../../nodes/shared/savedModelProgram'
import SERVED from './fixtures/served-qualitative-parallel-links.a3c24d98.read.json'
// The capacity journey's first program draft, served byte-unchanged (acceptance run 26 Oct): rich cards and links
// (raw provenance objects, a coefficient id, value bases, observed states, interventions).
import CAPACITY_TURN from '../../conversation/__tests__/fixtures/served-acceptance-capacity-draft-turn-20261026.json'

type WireEdge = { id: string; from: string; to: string }
type CanvasEdge = { id: string; source: string; target: string; data: Record<string, unknown> }
type CanvasNode = { id: string; position: { x: number; y: number }; data: Record<string, unknown> }

const FIRST = 'ads_before_fix__marketing_disruption'
const SECOND = 'ads_before_fix__marketing_disruption__2'
const WIRE_EDGES = SERVED.graph.edges as WireEdge[]
const CEE_NODE_IDS = SERVED.graph.nodes.map((n) => n.id).sort()
const CEE_EDGE_IDS = WIRE_EDGES.map((e) => e.id).sort()

/** The saved read with its program marker; without it, the same graph is not a program. */
const programRead = () => ({ ...structuredClone(SERVED.graph), living_model: { model_program: 'v1' } })
const plainRead = () => structuredClone(SERVED.graph)
/** A program core turn's receipt: the saved model's cards and links, as `coreTurnToClientBody` hands them on. */
const programTurn = () => ({ nodes: structuredClone(SERVED.graph.nodes), edges: structuredClone(SERVED.graph.edges) })

const edges = () => useCanvasStore.getState().edges as unknown as CanvasEdge[]
const nodes = () => useCanvasStore.getState().nodes as unknown as CanvasNode[]
const edgeById = (id: string) => edges().find((e) => e.id === id)
const pairIds = () => edges().filter((e) => e.source === 'ads_before_fix' && e.target === 'marketing_disruption').map((e) => e.id).sort()
const nodeIds = () => nodes().map((n) => n.id).sort()
const edgeIds = () => edges().map((e) => e.id).sort()
const cards = () => SERVED.graph.nodes.map((n, i) => ({ id: n.id, type: n.kind, position: { x: 200 * i, y: 40 }, data: { kind: n.kind, label: n.label } }))

/** A canvas with nothing between the user and CEE unless a case says so. */
function seed(canvasNodes: unknown[], canvasEdges: unknown[], extra: Record<string, unknown> = {}): void {
  useCanvasStore.setState({
    currentScenarioId: SERVED.scenario_id,
    nodes: structuredClone(canvasNodes) as never,
    edges: structuredClone(canvasEdges) as never,
    importPendingServerRegistration: false,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    history: { past: [], future: [] },
    pendingEmittedEdits: 0,
    pendingStructuralDeletes: [],
    pendingStructuralRenames: [],
    pendingStructuralAdds: [],
    pendingStructuralAddEdges: [],
    structuralRenameLifecycle: [],
    structuralAddLifecycle: [],
    ...extra,
  } as never)
}

/** The canvas the legacy appliers leave: every link defaulted, and the first parallel link under the mapper's own id. */
const legacyCanvasEdges = (localIdFor: string, localId: string) =>
  WIRE_EDGES.map((e, i) => {
    const mapped = mapDraftEdgeToCanvas(e, i)
    return e.id === localIdFor ? { ...mapped, id: localId } : mapped
  })

beforeEach(() => {
  useCanvasStore.getState().reset()
  __resetPendingFactorEditsForTest()
  __resetPendingEdgeEditsForTest()
  __resetProgramScenariosForTest()
})

describe('(a) two parallel links between the same two cards survive a reopen and a program core-turn receipt', () => {
  it('both keep CEE\'s own ids through the read and the receipt, and the receipt moves neither', () => {
    seed(cards(), legacyCanvasEdges(FIRST, 'e-12'))
    expect(mergeServerGraphOnHydrate(programRead())).toMatchObject({ accepted: true })
    expect(pairIds()).toEqual([FIRST, SECOND])
    const first = edgeById(FIRST)
    const second = edgeById(SECOND)

    expect(applyProgramGraph(programTurn())).toEqual({ changed: false })
    expect(pairIds()).toEqual([FIRST, SECOND])
    expect(edgeById(FIRST)).toBe(first)
    expect(edgeById(SECOND)).toBe(second)
  })

  it('contrast: a read that is not a program keeps today\'s pair rule, so the local id stands for the first link', () => {
    seed(cards(), legacyCanvasEdges(FIRST, 'e-12'))
    mergeServerGraphOnHydrate(plainRead())
    expect(pairIds()).toEqual([SECOND, 'e-12'].sort())
  })
})

describe('(b) a program link with no strength or direction is stored with neither', () => {
  const STATED_NOTHING = ['weight', 'direction', 'weightSource', 'directionSource', 'beliefStrength', 'functionType', 'kind']

  it('after a read on an empty canvas: never 0.5, never positive', () => {
    seed([], [])
    mergeServerGraphOnHydrate(programRead())
    const bare = edgeById(SECOND)!.data
    for (const key of STATED_NOTHING) expect(bare, key).not.toHaveProperty(key)
    // Its sibling states a direction and no strength: the direction is CEE's, and no weight is made up for it.
    expect(edgeById(FIRST)!.data).toMatchObject({ direction: 'positive', directionSource: 'cee' })
    expect(edgeById(FIRST)!.data).not.toHaveProperty('weight')
  })

  it('after a program core-turn receipt onto the legacy canvas: the defaults it held are gone', () => {
    seed(cards(), legacyCanvasEdges('none', 'none'))
    expect(edgeById(SECOND)!.data).toMatchObject({ weight: 0.5, direction: 'positive' })
    applyProgramGraph(programTurn())
    const bare = edgeById(SECOND)!.data
    for (const key of STATED_NOTHING) expect(bare, key).not.toHaveProperty(key)
  })

  it('contrast: a read that is not a program still maps today\'s defaults', () => {
    seed([], [])
    mergeServerGraphOnHydrate(plainRead())
    expect(edgeById(SECOND)!.data).toMatchObject({ weight: 0.5, direction: 'positive' })
  })
})

describe('(c) a card and a link CEE no longer sends disappear after the next read', () => {
  const DROPPED_CARD = 'boss_backlash'
  const DROPPED_LINK = 'delay_update__marketing_disruption'
  const nextRead = (program: boolean) => {
    const g = program ? programRead() : plainRead()
    return {
      ...g,
      nodes: g.nodes.filter((n) => n.id !== DROPPED_CARD),
      edges: g.edges.filter((e) => e.id !== DROPPED_LINK && e.from !== DROPPED_CARD),
    }
  }

  it('gone from the store even with an edit queued: no local copy outranks the saved model', () => {
    seed([], [])
    mergeServerGraphOnHydrate(programRead())
    useCanvasStore.setState({ pendingEmittedEdits: 1 } as never)
    const res = mergeServerGraphOnHydrate(nextRead(true))
    expect(res).toMatchObject({ accepted: true })
    expect(nodeIds()).not.toContain(DROPPED_CARD)
    expect(edgeById(DROPPED_LINK)).toBeUndefined()
    expect(edges().some((e) => e.source === DROPPED_CARD)).toBe(false)
    expect(nodeIds()).toEqual(CEE_NODE_IDS.filter((id) => id !== DROPPED_CARD))
  })

  it('contrast: a read that is not a program keeps today\'s licence and removes nothing while the edit is queued', () => {
    seed([], [])
    mergeServerGraphOnHydrate(plainRead())
    useCanvasStore.setState({ pendingEmittedEdits: 1 } as never)
    mergeServerGraphOnHydrate(nextRead(false))
    expect(nodeIds()).toContain(DROPPED_CARD)
    expect(edgeById(DROPPED_LINK)).toBeDefined()
  })
})

describe('(d) the store\'s ids are CEE\'s ids', () => {
  it('a program core-turn receipt onto a canvas holding a local id and a card CEE never acknowledged', () => {
    const stray = { id: 'stray_card', type: 'factor', position: { x: 0, y: 900 }, data: { kind: 'factor', label: 'Kept locally' } }
    seed([...cards(), stray], legacyCanvasEdges('repair_time__sync_readiness', 'e-3'))
    const layoutBefore = new Map(nodes().map((n) => [n.id, n.position]))
    applyProgramGraph(programTurn())
    expect(nodeIds()).toEqual(CEE_NODE_IDS)
    expect(edgeIds()).toEqual(CEE_EDGE_IDS)
    // Layout is the canvas's: every card CEE still sends stays where it was.
    for (const n of nodes()) expect(n.position).toEqual(layoutBefore.get(n.id))
  })

  it('contrast: the same receipt as a core turn that is not a program keeps today\'s rules (the local id and the stray card)', () => {
    const stray = { id: 'stray_card', type: 'factor', position: { x: 0, y: 900 }, data: { kind: 'factor', label: 'Kept locally' } }
    seed([...cards(), stray], legacyCanvasEdges('repair_time__sync_readiness', 'e-3'))
    reconcileAppliedGraph(programTurn() as never, { restoreReplace: true, constraintsComplete: true })
    expect(nodeIds()).toContain('stray_card')
    expect(edgeIds()).toContain('e-3')
  })
})

/** A card the person has just added, its add still queued (a fresh scenario has no saved hash to send it against). */
const LOCAL_CARD = { id: 'local_card', type: 'factor', position: { x: 40, y: 40 }, data: { kind: 'factor', label: 'Supplier lead time' } }
const QUEUED_ADD = { id: 'add-1', nodeId: LOCAL_CARD.id, nodeKind: 'factor', label: 'Supplier lead time', baseGraphHash: null }

describe('review 1: CEE\'s program graph wins even when the canvas shares no card with it', () => {
  it('a read onto a canvas holding only a just-added local card puts exactly CEE\'s graph on it', () => {
    seed([LOCAL_CARD], [], { pendingStructuralAdds: [QUEUED_ADD] })
    expect(mergeServerGraphOnHydrate(programRead())).toMatchObject({ accepted: true, refusedReason: null })
    expect(nodeIds()).toEqual(CEE_NODE_IDS)
    expect(edgeIds()).toEqual(CEE_EDGE_IDS)
  })

  it('a program core-turn receipt onto that canvas puts exactly CEE\'s graph on it too', () => {
    seed([LOCAL_CARD], [], { pendingStructuralAdds: [QUEUED_ADD] })
    applyProgramGraph(programTurn())
    expect(nodeIds()).toEqual(CEE_NODE_IDS)
    expect(edgeIds()).toEqual(CEE_EDGE_IDS)
  })

  it('contrast: a read that is not a program keeps today\'s zero-overlap refusal', () => {
    seed([LOCAL_CARD], [], { pendingStructuralAdds: [QUEUED_ADD] })
    expect(mergeServerGraphOnHydrate(plainRead())).toMatchObject({ accepted: false, refusedReason: 'zeroOverlap' })
    expect(nodeIds()).toEqual([LOCAL_CARD.id])
  })
})

describe('round 3 (a): an empty program snapshot empties the canvas', () => {
  it('a program read with no cards and no links clears a canvas that held the model', () => {
    seed([], [])
    mergeServerGraphOnHydrate(programRead())
    expect(nodeIds()).toEqual(CEE_NODE_IDS)
    expect(mergeServerGraphOnHydrate({ nodes: [], edges: [], living_model: { model_program: 'v1' } })).toMatchObject({ accepted: true })
    expect(nodes()).toHaveLength(0)
    expect(edges()).toHaveLength(0)
  })

  it('contrast: an empty read that is not a program is still refused, and the canvas is kept', () => {
    seed([], [])
    mergeServerGraphOnHydrate(plainRead())
    expect(mergeServerGraphOnHydrate({ nodes: [], edges: [] })).toMatchObject({ accepted: false, refusedReason: 'emptyServerGraph' })
    expect(nodeIds()).toEqual(CEE_NODE_IDS)
  })
})

describe('review 2: every field CEE sends on a program card or link reaches the store as sent', () => {
  type Wire = Record<string, unknown> & { id: string }
  const CAPACITY = (CAPACITY_TURN as { body: { model: { graph: { nodes: Wire[]; edges: Wire[] } } } }).body.model.graph
  const GRAPHS: Array<[string, { nodes: Wire[]; edges: Wire[] }]> = [
    ['the qualitative read', SERVED.graph as never],
    ['the capacity draft', CAPACITY],
  ]

  function expectFullFidelity(graph: { nodes: Wire[]; edges: Wire[] }): void {
    for (const wire of graph.edges) {
      const stored = edgeById(wire.id)
      expect(stored, wire.id).toBeDefined()
      expect({ id: stored!.id, source: stored!.source, target: stored!.target }).toEqual({ id: wire.id, source: wire.from, target: wire.to })
      for (const [key, value] of Object.entries(wire)) {
        if (key === 'id' || key === 'from' || key === 'to') continue
        expect(stored!.data[key], `${wire.id}.${key}`).toEqual(value)
      }
    }
    for (const wire of graph.nodes) {
      const stored = nodes().find((n) => n.id === wire.id) as unknown as { type: string; data: Record<string, unknown> }
      expect(stored, wire.id).toBeDefined()
      expect(stored.type).toBe(wire.kind)
      for (const [key, value] of Object.entries(wire)) {
        if (key === 'id') continue
        // The canvas spells CEE's `observed_state` as `observedState` (DraftChat's mapping), the value unchanged.
        expect(stored.data[key === 'observed_state' ? 'observedState' : key], `${wire.id}.${key}`).toEqual(value)
      }
    }
  }

  for (const [name, graph] of GRAPHS) {
    it(`${name}: a read on an empty canvas`, () => {
      seed([], [])
      mergeServerGraphOnHydrate({ ...structuredClone(graph), living_model: { model_program: 'v1' } })
      expectFullFidelity(graph)
    })

    it(`${name}: a program core-turn receipt onto the canvas the legacy appliers left`, () => {
      const legacyCards = graph.nodes.map((n, i) => ({ id: n.id, type: n.kind, position: { x: 200 * i, y: 40 }, data: { kind: n.kind, label: n.label } }))
      seed(legacyCards, graph.edges.map((e, i) => mapDraftEdgeToCanvas(e, i)))
      applyProgramGraph(structuredClone(graph))
      expectFullFidelity(graph)
    })
  }
})

describe('round 3 (c): a card CEE removes is gone, whatever local state there was', () => {
  const FIGURE_CARD = 'repair_time'
  const ADDED_CARD = 'boss_backlash'
  const LINKED = 'sync_readiness'
  /** CEE's next graph: without the two cards, and without any link touching them. */
  const without = <G extends { nodes: Array<{ id: string }>; edges: Array<{ from: string; to: string }> }>(g: G): G => ({
    ...g,
    nodes: g.nodes.filter((n) => n.id !== FIGURE_CARD && n.id !== ADDED_CARD),
    edges: g.edges.filter((e) => ![FIGURE_CARD, ADDED_CARD].includes(e.from) && ![FIGURE_CARD, ADDED_CARD].includes(e.to)),
  })
  /** Every kind of local state the canvas can hold about those cards, and a local card and link of the person's own. */
  function holdLocalState(): void {
    useCanvasStore.setState((s) => ({
      nodes: [
        ...s.nodes.map((n) => n.id === FIGURE_CARD ? { ...n, data: { ...n.data, observedState: { value: 42 } } } : n),
        LOCAL_CARD,
      ],
      edges: [...s.edges, { id: 'local_link', source: LOCAL_CARD.id, target: LINKED, type: 'styled', data: { weight: 0.3 } }],
      pendingStructuralAdds: [QUEUED_ADD],
      // An add an earlier attempt left unconfirmed, and one on the wire whose link the drainer has already taken.
      structuralAddLifecycle: [
        { intent: { ...QUEUED_ADD, id: 'add-0', nodeId: ADDED_CARD }, scenarioId: SERVED.scenario_id, status: 'unconfirmed' },
        { intent: { ...QUEUED_ADD, id: 'add-2' }, scenarioId: SERVED.scenario_id, status: 'in_flight' },
      ],
      pendingStructuralAddEdges: [],
      pendingEmittedEdits: 1,
    }) as never)
    markFactorEditInFlight(FIGURE_CARD, 42)
    useCanvasStore.setState((s) => ({ edges: s.edges.map((e) => e.id === FIRST ? { ...e, data: { ...e.data, weight: 0.7 } } : e) }) as never)
    markEdgeEditInFlight(FIRST, 0.7, edgeById(FIRST)!.data)
  }
  const gone = () => {
    expect(nodeIds()).toEqual(CEE_NODE_IDS.filter((id) => id !== FIGURE_CARD && id !== ADDED_CARD))
    expect(edges().some((e) => [FIGURE_CARD, ADDED_CARD, LOCAL_CARD.id].includes(e.source) || [FIGURE_CARD, ADDED_CARD].includes(e.target))).toBe(false)
    expect(edgeById('local_link')).toBeUndefined()
    // A link CEE still sends is CEE's, whole: the pending strength is shown by the delivery hold, never kept here.
    expect(edgeById(FIRST)!.data).not.toHaveProperty('weight')
  }

  it('after the next read', () => {
    seed([], [])
    mergeServerGraphOnHydrate(programRead())
    holdLocalState()
    mergeServerGraphOnHydrate(without(programRead()))
    gone()
  })

  it('after the next program core-turn receipt', () => {
    seed([], [])
    mergeServerGraphOnHydrate(programRead())
    holdLocalState()
    applyProgramGraph(without(programTurn()))
    gone()
  })
})
