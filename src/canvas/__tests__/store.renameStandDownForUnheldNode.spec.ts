/**
 * ⭐⭐ A RENAME OF A NODE THE SERVER HAS NEVER SEEN IS NOT AN UNCERTAINTY — IT IS
 * A CERTAINTY, AND THE PRODUCT WAS REPORTING IT AS THE FORMER.
 *
 * THE DEFECT. `HeroSection.tsx:85` and `YourDecisionSection.tsx:69` both
 * `addNode` and then immediately `updateNodeLabel(created.id, …)` — that is how
 * naming a new goal, option or risk works in the pre-analysis panel, and
 * `VITE_FEATURE_PRE_ANALYSIS_V3 = "1"` (`netlify.toml:179`) makes it the
 * DEPLOYED posture. `updateNodeLabel` is the one chokepoint every rename
 * crosses, so each of those gestures captured a `structural_rename` intent and
 * put it on the wire.
 *
 * CEE cannot hold that node TODAY. It reloads its OWN persisted graph; the
 * debounced `direct_graph_edit` notification CEE classifies `ack_and_commit`
 * writes no graph; and the one carrier that could tell CEE about a
 * client-created node — `structural_add` — has NO UI EMITTER yet (see the
 * CONTINGENCY block below, which is load-bearing and not background). So the
 * receipt was always
 * `readStructuralRenameReceipt → 'unproven'`, which is CORRECT and must stay —
 * an absent node is a different event, not a refutation — but `unproven` sets
 * `notice = 'unconfirmed_server'`, and that injects a synthetic assistant
 * message into the conversation:
 *
 *   "I couldn't confirm that new name reached the saved model…"
 *
 * Net effect: naming a new option on an ordinary happy path put a "couldn't
 * confirm" message in the user's chat and burned a turn, every time. The
 * product was expressing doubt about the one thing it could have been certain
 * of.
 *
 * ⚠ THE CURE IS AT THE CAPTURE, NOT AT THE RECEIPT. Changing `unproven` to
 * `refuted` would be a lie (the bytes support neither verdict) and would arm the
 * revert against the user's own typing. Suppressing the notice at the receipt
 * would leave the turn burned and the queue churning. There is nothing to send,
 * so the honest move is to send nothing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠⚠ CONTINGENCY — THIS PREMISE EXPIRES, AND THE FIRST DRAFT OF THIS HEADER
 * ERASED THE TRIPWIRE BY GETTING IT WRONG.
 *
 * It asserted that `structural_add` "DOES NOT EXIST IN THIS REPO (swept `rg -a`:
 * zero occurrences, against a contrast control of `structural_rename` in nine
 * files)". BOTH ARMS OF THAT SWEEP WERE FALSE. Re-measured with `rg -a` at
 * `origin/staging` @ `ee76d07a`, 1 Sep 2026, with a fabricated-symbol contrast
 * control in the SAME run:
 *
 *     structural_add                      6 occurrences in  1 file
 *                                           (3 token-exact; the other 3 are
 *                                            `structural_add_edge`)
 *     structural_rename                  45 occurrences in 16 files
 *     structural_zzz_fabricated_control   0 occurrences in  0 files
 *
 * `structural_add` IS a live `V5_EVENT_KINDS` member and CEE DECLARES IT
 * 'mutating' AT STAGING `4f0bd774` — A WRITER EXISTS
 * (`systemEventParity.test.ts:265`). Only the UI EMITTER is missing, and it is
 * missing on purpose: `knownDeferred` (`systemEventParity.test.ts:271`) holds it
 * for its own product lane.
 *
 * ⭐⭐ SO EVERY TEST BELOW IS CONDITIONAL ON THAT LANE NOT HAVING SHIPPED. Once a
 * UI `structural_add` emitter lands, a client-created node CAN be genuinely
 * server-held while still absent from `lastAuthoritativeGraph` until the next
 * authoritative graph arrives — and in that window this stand-down suppresses a
 * LEGITIMATE rename, re-opening the data-loss class #1108 closed. These tests
 * would all still be green. REVISIT WHEN THE EMITTER SHIPS; the mechanical
 * trigger is `structural_add` leaving `knownDeferred`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ THE SIGNAL, AND WHY IT IS DERIVED RATHER THAN INVENTED.
 *
 * `lastAuthoritativeGraph.nodeIds` (`store.ts:685`) is the estate's EXISTING
 * record of "elements CEE has acknowledged". All four production writers say so
 * in terms, and they were read rather than assumed:
 *
 *   · `store.ts:6672` (cold load)  — "the persisted graph IS CEE's view of this
 *     scenario, so everything in it is an element CEE has acknowledged"
 *   · `applyDraftResult.ts:288`    — "a fresh draft IS an authoritative CEE graph"
 *   · `mergeAppliedGraph.ts:601`   — "the receipt is proof that CEE has seen
 *     exactly these elements"
 *   · `mergeServerGraph.ts:445`    — "The server graph IS CEE's view of this
 *     scenario, so everything in it is an element CEE has acknowledged"
 *
 * It is ALREADY the authority for exactly this class of question: the reconciler
 * "only removes elements CEE has previously acknowledged". This lane subscribes
 * to that existing authority rather than minting a second one. (The field-name
 * grep finds only ONE of the four writers — the honest manifest comes from the
 * setter, `store.ts:5552`, plus the cold-load assignment at `store.ts:6680`.)
 *
 * ⭐⭐ THAT ARGUMENT IS TRUE AND IT IS NOT WHAT MAKES THIS SAFE. The two readers
 * need the record tight in OPPOSITE directions:
 *
 *   · the reconciler reads MEMBERSHIP to AUTHORISE A DELETION — an under-broad
 *     record removes less, so it is FAIL-SAFE, which is why it can afford
 *     `authoritative?.nodeIds ?? []` (`mergeAppliedGraph.ts:478`);
 *   · this reader reads NON-MEMBERSHIP to SUPPRESS A SEND — an under-broad
 *     record silently drops a real rename, so it is HARMED, and the very same
 *     `?? []` would be a data-loss defect.
 *
 * This is THE FIRST CONSUMER REQUIRING COMPLETENESS. What carries it is
 * WIRE-GRAPH COMPLETENESS, read at the bytes of all four writers: each replaces
 * the record wholesale with the FULL graph just observed and none is
 * incremental (`mergeAppliedGraph.ts:606`, `mergeServerGraph.ts:461`,
 * `applyDraftResult.ts:293`, `store.ts:6680`). A record that EXISTS is complete
 * for the graph it saw. If a writer ever becomes a delta, THIS reader breaks and
 * the reconciler does not.
 *
 * ⚠ AND THE ALTERNATIVE WAS REJECTED AT THE BYTES, not on taste. `createNodeId`
 * returns `String(nextNodeId)` — a bare integer counter with nothing to
 * distinguish a client id from a server one, so an id-SHAPE predicate would be
 * exactly the invention this lane was forbidden to make. `reseedIds` advances
 * that counter past the maximum loaded id without rewriting any id, which is
 * what makes the record stay valid across a restore AND makes a fresh id
 * provably unable to collide with a server-held one.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ POSITIVE KNOWLEDGE ONLY — the direction this predicate must fail in.
 *
 * `lastAuthoritativeGraph === null` means NO authoritative graph has been seen.
 * That is an absence of evidence, not evidence of absence, and it is NOT treated
 * as "the server does not hold this node". Standing down there would suppress
 * the disclosure UI #1108 shipped to close a data-loss P0. So the stand-down
 * fires only on POSITIVE evidence: a record exists AND this id is not in it.
 *
 * The two directions are pinned together in this one file deliberately. One
 * predicate guarding two opposite harms — a gap that drops a real disclosure,
 * and a lie that invents doubt — is this estate's dominant defect, and a corpus
 * pointed in one direction would certify either half while the other rotted.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Node } from '@xyflow/react'

import { useCanvasStore } from '../store'
import { captureStructuralRename } from '../mutations/structuralRename'

/** A node the loaded scenario carried — CEE demonstrably holds it. */
const SERVER_HELD_ID = 'fac_price'
/** Its same-labelled sibling, also server-held. Only an id can discriminate. */
const SERVER_HELD_SIBLING_ID = 'fac_sibling'
/** A node `addNode` minted this session. CEE has never heard of it. */
const CLIENT_MADE_ID = '7'
/**
 * A SECOND client-made node, and it exists for the mutant pair rather than for
 * coverage. With only one unheld node in the fixture, every "loosen the guard
 * for a DIFFERENT node" mutant is equivalent by construction — the other nodes
 * are all server-held, so the stand-down never fires for them and the mutation
 * changes nothing observable. That is the FALSE SURVIVOR shape. Two independent
 * unheld nodes make the discriminating half of the pair real: exempting this one
 * must leave every assertion about {@link CLIENT_MADE_ID} green while reddening
 * the assertion about this one.
 */
const CLIENT_MADE_2_ID = '8'

const PREVIOUS = 'Price'
const NEW = 'List price'
const TURN_HASH = 'cfded3af0aa14ebd'

/**
 * The state a RESTORED scenario actually lands in — and note the difference from
 * `store.restoredGraphRename.spec.ts`, which seeds `lastAuthoritativeGraph:
 * null`. `loadScenario` (`store.ts:6675`) seeds it via `identityFromCanvasGraph`
 * from the loaded nodes, so the realistic restored fixture HAS the record. Both
 * shapes are exercised below; a fixture that omitted the record would prove
 * nothing about the predicate that reads it.
 */
function seedRestoredWithAuthoritativeRecord(overrides: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    currentScenarioId: 's1',
    lastServerGraphHash: null,
    pendingStructuralRenames: [],
    _externalMutationActive: 0,
    lastAuthoritativeGraph: {
      nodeIds: [SERVER_HELD_ID, SERVER_HELD_SIBLING_ID],
      edgePairs: [],
    },
    nodes: [
      { id: SERVER_HELD_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: PREVIOUS, kind: 'factor' } },
      { id: SERVER_HELD_SIBLING_ID, type: 'factor', position: { x: 9, y: 0 }, data: { label: PREVIOUS, kind: 'factor' } },
      // Minted after the authoritative graph was recorded — the pre-analysis
      // `addNode` → `updateNodeLabel` shape, with its placeholder label.
      { id: CLIENT_MADE_ID, type: 'option', position: { x: 18, y: 0 }, data: { label: `Node ${CLIENT_MADE_ID}`, kind: 'option' } },
      { id: CLIENT_MADE_2_ID, type: 'risk', position: { x: 27, y: 0 }, data: { label: `Node ${CLIENT_MADE_2_ID}`, kind: 'risk' } },
    ] as unknown as Node[],
    edges: [],
    ...overrides,
  } as never)
}

let toasts: Array<{ message?: string; level?: string }>
let toastListener: (e: Event) => void

beforeEach(() => {
  seedRestoredWithAuthoritativeRecord()
  toasts = []
  toastListener = (e: Event) => {
    toasts.push((e as CustomEvent).detail ?? {})
  }
  window.addEventListener('topbar:show-toast', toastListener)
})

afterEach(() => {
  window.removeEventListener('topbar:show-toast', toastListener)
  vi.restoreAllMocks()
})

const labelOf = (id: string) =>
  (useCanvasStore.getState().nodes.find((n) => n.id === id)?.data as { label?: string } | undefined)
    ?.label

const queued = () => useCanvasStore.getState().pendingStructuralRenames

describe('DIRECTION 1 — a node the server is KNOWN NOT to hold: no capture, no notice, no turn', () => {
  it('naming a just-created node queues NOTHING — there is no server-side rename to confirm', () => {
    useCanvasStore.getState().updateNodeLabel(CLIENT_MADE_ID, NEW)

    // BOUND BY IDENTITY: nothing queued FOR THIS NODE. Asserting an empty queue
    // alone would also pass if some unrelated intent were dropped.
    expect(queued().filter((i) => i.nodeId === CLIENT_MADE_ID)).toHaveLength(0)
    expect(queued()).toHaveLength(0)
  })

  it('and says NOTHING — the deferred toast is the first half of the noise this closes', () => {
    useCanvasStore.getState().updateNodeLabel(CLIENT_MADE_ID, NEW)
    expect(toasts).toHaveLength(0)
  })

  it('the capture reports the reason rather than dropping silently', () => {
    const result = captureStructuralRename({
      nodesBefore: useCanvasStore.getState().nodes,
      nodeId: CLIENT_MADE_ID,
      label: NEW,
      baseGraphHash: TURN_HASH,
      externalMutationActive: false,
      authoritativeNodeIds: [SERVER_HELD_ID, SERVER_HELD_SIBLING_ID],
      makeId: () => 'id-1',
    })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe('node_not_server_held')
  })

  it('WITH A HASH IN HAND IT STILL STANDS DOWN — the hash was never the question', () => {
    // This is the DEPLOYED case the defect report names: `preAnalysisV3` runs
    // after a draft, so a real `graph_hash` is usually in hand. Before this fix
    // that meant a full send → `unproven` → "I couldn't confirm" → a burnt turn.
    seedRestoredWithAuthoritativeRecord({ lastServerGraphHash: TURN_HASH })
    useCanvasStore.getState().updateNodeLabel(CLIENT_MADE_ID, NEW)

    expect(queued()).toHaveLength(0)
    expect(toasts).toHaveLength(0)
  })

  it('the LOCAL rename still applies — the capability is untouched, only the wire claim is dropped', () => {
    useCanvasStore.getState().updateNodeLabel(CLIENT_MADE_ID, NEW)
    expect(labelOf(CLIENT_MADE_ID)).toBe(NEW)
  })

  it('a SECOND unheld node stands down on its own account, not by inheriting the first', () => {
    // Bound to this id specifically. Its twin above is untouched here, so a
    // guard exempting one unheld node cannot pass by way of the other — which
    // is what makes the "different node only" half of the mutant pair a real
    // discrimination rather than a false survivor.
    useCanvasStore.getState().updateNodeLabel(CLIENT_MADE_2_ID, 'Named risk')

    expect(queued().filter((i) => i.nodeId === CLIENT_MADE_2_ID)).toHaveLength(0)
    expect(labelOf(CLIENT_MADE_2_ID)).toBe('Named risk')
  })
})

describe('DIRECTION 2 — a node the server DOES hold still defers and still discloses (#1108 must not regress)', () => {
  it('a rename on a restored graph with no hash is QUEUED, deferred, never dropped', () => {
    useCanvasStore.getState().updateNodeLabel(SERVER_HELD_ID, NEW)

    const forThisNode = queued().filter((i) => i.nodeId === SERVER_HELD_ID)
    expect(forThisNode).toHaveLength(1)
    expect(forThisNode[0]!.expectedLabel).toBe(PREVIOUS)
    expect(forThisNode[0]!.label).toBe(NEW)
    expect(forThisNode[0]!.baseGraphHash).toBeNull()
  })

  it('and the user is TOLD — the disclosure #1108 exists for is intact', () => {
    useCanvasStore.getState().updateNodeLabel(SERVER_HELD_ID, NEW)

    expect(toasts).toHaveLength(1)
    const message = toasts[0]!.message ?? ''
    expect(message).toMatch(/not .*saved|isn't saved|not yet saved/i)
    expect(message).toMatch(/reload/i)
  })

  it('IDENTITY — the stand-down discriminates by node id, not by label or by count', () => {
    // Both server-held nodes carry the SAME label as each other, and the
    // client-made node carries a different one. A predicate keyed on anything
    // but the id would mis-sort these three.
    useCanvasStore.getState().updateNodeLabel(SERVER_HELD_ID, NEW)
    useCanvasStore.getState().updateNodeLabel(CLIENT_MADE_ID, 'Named option')

    expect(queued().map((i) => i.nodeId)).toEqual([SERVER_HELD_ID])
    // The sibling was never touched and must not have been swept up.
    expect(labelOf(SERVER_HELD_SIBLING_ID)).toBe(PREVIOUS)
    // Both local writes landed regardless of what went on the wire.
    expect(labelOf(SERVER_HELD_ID)).toBe(NEW)
    expect(labelOf(CLIENT_MADE_ID)).toBe('Named option')
  })
})

describe('DIRECTION 3 — no authoritative record is an ABSENCE OF EVIDENCE, never a stand-down', () => {
  it('with lastAuthoritativeGraph null the rename is still queued and still disclosed', () => {
    // This is `store.restoredGraphRename.spec.ts`'s fixture, and the reason this
    // case is pinned HERE too: the cheapest wrong implementation of this lane is
    // `!nodeIds.includes(id)` over a null-coalesced empty array, which would
    // silently stand down EVERY rename in this state and delete the #1108
    // disclosure wholesale. That mutant must be red, and this is what reds it.
    seedRestoredWithAuthoritativeRecord({ lastAuthoritativeGraph: null })
    useCanvasStore.getState().updateNodeLabel(SERVER_HELD_ID, NEW)

    expect(queued().filter((i) => i.nodeId === SERVER_HELD_ID)).toHaveLength(1)
    expect(toasts).toHaveLength(1)
  })

  it('and even a node minted this session is queued when there is no record to contradict it', () => {
    // Deliberately NOT the tidy answer. We hold no evidence either way, so the
    // product keeps its existing behaviour rather than guessing — the same rule
    // `readStructuralRenameReceipt` applies to an absent node.
    seedRestoredWithAuthoritativeRecord({ lastAuthoritativeGraph: null })
    useCanvasStore.getState().updateNodeLabel(CLIENT_MADE_ID, NEW)

    expect(queued().filter((i) => i.nodeId === CLIENT_MADE_ID)).toHaveLength(1)
  })

  it('NULL RECORD *WITH* A HASH IN HAND still sends — the residual case, pinned not merely disclosed', () => {
    // ⭐ THE ARM BOTH TESTS ABOVE MISS. Each seeds `lastAuthoritativeGraph: null`
    // on a fixture whose `lastServerGraphHash` is ALSO null, so neither can tell
    // "we stand down on a null record" apart from "we stand down when there is
    // no hash to send with". This seeds a null record and a REAL hash — the one
    // combination where the two inputs disagree: CEE has stamped a graph this
    // session, yet no authoritative graph has been recorded.
    //
    // The decision here was DISCLOSED in prose and rested on nothing. It is
    // deliberate and it is unchanged: a client-made node in this state STILL
    // SENDS, because a null record is an absence of evidence and the hash says
    // nothing about MEMBERSHIP. Pinned so that a future change has to argue with
    // a red test rather than with a paragraph.
    seedRestoredWithAuthoritativeRecord({
      lastAuthoritativeGraph: null,
      lastServerGraphHash: TURN_HASH,
    })
    useCanvasStore.getState().updateNodeLabel(CLIENT_MADE_ID, NEW)

    // Bound by id: its unheld twin must not be able to satisfy this.
    const forNode = queued().filter((i) => i.nodeId === CLIENT_MADE_ID)
    expect(forNode).toHaveLength(1)
    expect(queued().filter((i) => i.nodeId === CLIENT_MADE_2_ID)).toHaveLength(0)
    // And the precondition is pinned in-test: the capture must be seeing the
    // hash, or this would pass for the wrong reason.
    expect(forNode[0]?.baseGraphHash).toBe(TURN_HASH)
  })

  it('an EMPTY record is a real record — the server holds nothing, so nothing stands', () => {
    // `{ nodeIds: [] }` is positive evidence (a server graph was read and it was
    // empty); `null` is the absence of any. The two must not collapse.
    seedRestoredWithAuthoritativeRecord({
      lastAuthoritativeGraph: { nodeIds: [], edgePairs: [] },
    })
    useCanvasStore.getState().updateNodeLabel(SERVER_HELD_ID, NEW)

    expect(queued()).toHaveLength(0)
    expect(toasts).toHaveLength(0)
  })
})

describe('the stand-down must not swallow the reasons that already existed', () => {
  it('a PRODUCER write still queues nothing and still says nothing', () => {
    useCanvasStore.setState({ _externalMutationActive: 1 } as never)
    useCanvasStore.getState().updateNodeLabel(SERVER_HELD_ID, NEW)

    expect(queued()).toHaveLength(0)
    expect(toasts).toHaveLength(0)
    expect(labelOf(SERVER_HELD_ID)).toBe(NEW)
  })

  it('a no-op rename of a SERVER-HELD node still queues nothing', () => {
    useCanvasStore.getState().updateNodeLabel(SERVER_HELD_ID, PREVIOUS)
    expect(queued()).toHaveLength(0)
    expect(toasts).toHaveLength(0)
  })

  it('a rename of a node absent from the CANVAS is still node_not_found, not the new reason', () => {
    const result = captureStructuralRename({
      nodesBefore: useCanvasStore.getState().nodes,
      nodeId: 'nope_not_on_canvas',
      label: NEW,
      baseGraphHash: TURN_HASH,
      externalMutationActive: false,
      authoritativeNodeIds: [SERVER_HELD_ID],
      makeId: () => 'id-1',
    })
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.reason).toBe('node_not_found')
  })
})
