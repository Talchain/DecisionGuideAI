/**
 * ⭐⭐ A LAYOUT FAILURE MUST NOT LEAVE THE PRODUCT UNUSABLE.
 *
 * ── THE INCIDENT ────────────────────────────────────────────────────────────
 * A fresh user submits a fundraising brief. Olumi accepts it, drafts a model,
 * and the canvas is unusable: every node stacked at one point, the banner
 * "Layout failed. Try again.", zoom 328%.
 *
 * ── WHAT THIS SPEC PINS, AND WHAT IT DELIBERATELY DOES NOT ──────────────────
 * ⚠ IT DOES NOT PIN WHY ELK THREW. That cause is open and may stay open: bad
 * graph input was REFUTED by execution (elkjs replayed the exact shape —
 * duplicate ids, cycles, self-loops, disconnected subgraphs, NaN heights, zero
 * nodes — and resolved every one), and the measurement-timing theory was
 * refuted too (the dimension fallback cannot throw). Pinning a cause we cannot
 * name would be theatre.
 *
 * What turns an internal error into a BROKEN PRODUCT is three separable gaps,
 * and every one of them is fixable with the cause still unknown:
 *
 *   RC2 — the coordinate-fate gap. `applyDraftResult` seeds every draft node at
 *         `{x:0,y:0}` (its sole `position` write) and the catch in `applyLayout`
 *         touches NO coordinates. So any rejection leaves a perfect origin
 *         stack — not a degraded layout, an unreadable one.
 *   RC3 — the camera. With no successful layout the product's own fit never
 *         runs and the canvas keeps xyflow's bare mount `fitView`, which is
 *         bounded only by the instance's `maxZoom={4}`. Framing one ~300px node
 *         in a 1092×878 canvas gives ~331% — the witnessed 328%.
 *   RC4 — recovery is a trap. `handleLayoutWithRecovery` calls `succeed()` on
 *         ANY resolution, including one that laid nothing out, so the banner
 *         can clear while the stack remains.
 *
 * ── THE ARCHITECTURAL CHOICE, STATED SO IT IS REVIEWABLE ────────────────────
 * ⭐ The camera guards are NOT weakened. `useFitViewOnLayoutVersion` already
 * has a trigger for exactly the state we want after a failure — real positions,
 * nothing pending — and it gates on `isRestoredModelReady`, which refuses an
 * origin stack via `graphNeedsInitialLayout`. So the fix is to make the FAILURE
 * PATH produce a state the camera already knows how to handle, rather than to
 * loosen a guard whose own header records it answering a different question
 * from the one a `layoutVersion === 0` test appears to ask (trap 21). A smaller
 * change, and it cannot regress the restore path because it reuses it.
 *
 * ⚠ THE ASSERTIONS BIND THROUGH THE PRODUCT'S OWN PREDICATES, never a local
 * re-implementation of "is this a stack". `graphNeedsInitialLayout` is the
 * estate's declared authority on "are these positions meaningful"; a private
 * copy here would agree with itself while the product disagreed (trap 12).
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useCanvasStore } from '../store'
import { graphNeedsInitialLayout, STACKED_SPREAD_PX } from '../utils/graphNeedsInitialLayout'
import { placeNodesDeterministically } from '../utils/fallbackPlacement'
import { handleLayoutWithRecovery } from '../layout/handleLayoutWithRecovery'
import { useLayoutProgressStore } from '../layoutProgressStore'

function nodeAt(id: string, x: number, y: number, type = 'factor', extra?: Record<string, unknown>) {
  return {
    id,
    type,
    position: { x, y },
    data: { label: id, kind: type, ...(extra ?? {}) },
  } as never
}

/** The drafted shape exactly as `applyDraftResult` leaves it: every node at the origin. */
function originStack(n: number) {
  return Array.from({ length: n }, (_, i) => nodeAt(`n${i}`, 0, 0))
}

afterEach(() => {
  vi.doUnmock('../utils/layout')
  vi.resetModules()
})

describe('RC2 — a failed layout leaves a readable arrangement, not an origin stack', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
  })

  it('the precondition holds: a fresh draft IS an origin stack before layout runs', () => {
    // PINNED IN-TEST. Without this the assertions below could pass against a
    // fixture that was never stacked, agreeing for the wrong reason (trap 13b).
    expect(graphNeedsInitialLayout(originStack(5))).toBe(true)
  })

  it('after `applyLayout` rejects, the graph is no longer a stack', async () => {
    vi.doMock('../utils/layout', () => ({
      layoutGraph: vi.fn(async () => {
        throw new Error('ELK exploded')
      }),
    }))
    vi.resetModules()
    const { useCanvasStore: store } = await import('../store')
    store.getState().resetCanvas()
    store.setState({ nodes: originStack(6), edges: [], pendingLayout: true })

    await expect(store.getState().applyLayout()).rejects.toThrow(/ELK exploded/)

    const after = store.getState().nodes
    expect(after).toHaveLength(6)
    // THE PROPERTY, through the product's own authority — not a local rule.
    expect(graphNeedsInitialLayout(after)).toBe(false)
    // …and the failure is still a failure: it must still reject, and still
    // clear pendingLayout so the measurement effect cannot spin.
    expect(store.getState().pendingLayout).toBe(false)
    expect(store.getState().layoutInProgress).toBe(false)
  })

  it('does NOT bump layoutVersion — a fallback is not a layout, and saying so would be a lie', async () => {
    vi.doMock('../utils/layout', () => ({
      layoutGraph: vi.fn(async () => {
        throw new Error('ELK exploded')
      }),
    }))
    vi.resetModules()
    const { useCanvasStore: store } = await import('../store')
    store.getState().resetCanvas()
    store.setState({ nodes: originStack(4), edges: [] })
    const v0 = store.getState().layoutVersion

    await expect(store.getState().applyLayout()).rejects.toThrow()
    expect(store.getState().layoutVersion).toBe(v0)
  })
})

describe('placeNodesDeterministically — the fallback contract', () => {
  it('breaks the stack: the result defeats `graphNeedsInitialLayout`', () => {
    const placed = placeNodesDeterministically(originStack(7))
    expect(graphNeedsInitialLayout(placed)).toBe(false)
  })

  it('is DETERMINISTIC — the same input twice gives byte-identical positions', () => {
    const a = placeNodesDeterministically(originStack(9)).map((n) => n.position)
    const b = placeNodesDeterministically(originStack(9)).map((n) => n.position)
    expect(a).toEqual(b)
  })

  it('⭐ is deterministic ACROSS INSERTION ORDER, not merely reproducible', () => {
    // ⚠ THE TEST ABOVE CANNOT SEE THIS AND NEVER COULD. It re-runs the SAME
    // array twice, so it proves reproducibility and is structurally blind to
    // order-dependence. Measured before the sort existed: the same node set fed
    // forward and reversed moved EVERY id — `a` went {0,0} → {344,176}. Array
    // order is a property of how the nodes were assembled, not of the graph, so
    // a user reloading into a different order would see the rescue rearrange
    // itself for no reason they could observe.
    const forward = originStack(6)
    const reversed = [...forward].reverse()
    const byId = (out: ReturnType<typeof placeNodesDeterministically>) =>
      Object.fromEntries(out.map((n) => [n.id, n.position]))
    expect(byId(placeNodesDeterministically(forward)))
      .toEqual(byId(placeNodesDeterministically(reversed)))
  })

  it('⭐ does NOT re-create a pile when two nodes share an id', () => {
    // ⚠ THE DEFECT THIS PR WOULD OTHERWISE HAVE SHIPPED WITH ITS OWN DETECTOR.
    // `utils/layout.ts` in this same change set detects duplicate ids and
    // records that the store keeps BOTH — and the first version of this
    // placement keyed its position map on `node.id`, so both copies got the
    // same slot and landed on one point. The property test above uses unique
    // ids and cannot see it. Keyed by node IDENTITY now, so duplicates occupy
    // distinct slots.
    const dupA = nodeAt('dup', 0, 0)
    const dupB = nodeAt('dup', 0, 0)
    const placed = placeNodesDeterministically([dupA, dupB, nodeAt('other', 0, 0)])
    expect(placed).toHaveLength(3)
    const positions = placed.map((n) => `${n.position.x},${n.position.y}`)
    expect(new Set(positions).size, `duplicates piled: ${positions.join(' | ')}`).toBe(3)
  })

  it('separates every pair by at least the stack threshold on some axis', () => {
    const placed = placeNodesDeterministically(originStack(8))
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const dx = Math.abs(placed[i]!.position.x - placed[j]!.position.x)
        const dy = Math.abs(placed[i]!.position.y - placed[j]!.position.y)
        expect(
          Math.max(dx, dy),
          `nodes ${placed[i]!.id} and ${placed[j]!.id} are not separated`,
        ).toBeGreaterThanOrEqual(STACKED_SPREAD_PX)
      }
    }
  })

  it('LEAVES LOCKED NODES ALONE — the same rule the real write-back applies', () => {
    // A user who pinned a node keeps it pinned, failure or not. Mirrors
    // `layout.ts`'s own `data.locked === true` exemption rather than inventing
    // a second rule for the same question.
    const nodes = [
      nodeAt('free', 0, 0),
      nodeAt('pinned', 17, 23, 'factor', { locked: true }),
      nodeAt('free2', 0, 0),
    ]
    const placed = placeNodesDeterministically(nodes)
    const pinned = placed.find((n) => n.id === 'pinned')!
    expect(pinned.position).toEqual({ x: 17, y: 23 })
  })

  it('is a no-op on a graph that is already laid out', () => {
    // Never move a graph that does not need moving — a fallback that fires on a
    // healthy arrangement would be a regression dressed as a repair.
    const laid = [nodeAt('a', 0, 0), nodeAt('b', 400, 0), nodeAt('c', 800, 220)]
    expect(graphNeedsInitialLayout(laid)).toBe(false) // precondition, pinned
    expect(placeNodesDeterministically(laid)).toEqual(laid)
  })
})

describe('RC3 — the camera can aim at a fallback-placed graph', () => {
  beforeEach(() => {
    useCanvasStore.getState().resetCanvas()
  })

  it('after a failure the restore trigger becomes eligible — no camera guard is weakened', async () => {
    // ⭐ THE BINDING THAT MATTERS. `isRestoredModelReady` is private to the
    // hook, so this asserts the three store facts it reads, each named:
    // not pending, not in progress, and NOT a stack. If any one of them stayed
    // false the product's fit would never run and the bare mount fitView —
    // bounded only by `maxZoom={4}` — would frame the graph at up to 400%.
    vi.doMock('../utils/layout', () => ({
      layoutGraph: vi.fn(async () => {
        throw new Error('ELK exploded')
      }),
    }))
    vi.resetModules()
    const { useCanvasStore: store } = await import('../store')
    store.getState().resetCanvas()
    store.setState({ nodes: originStack(5), edges: [], pendingLayout: true })

    await expect(store.getState().applyLayout()).rejects.toThrow()

    const s = store.getState()
    expect(s.pendingLayout, 'camera refuses while a layout is pending').toBe(false)
    expect(s.layoutInProgress, 'camera refuses while a layout is running').toBe(false)
    expect(graphNeedsInitialLayout(s.nodes), 'camera refuses an origin stack').toBe(false)
  })
})

/**
 * ⭐⭐ THE PRODUCER REALLY EMITS `{laidOut:false}` — the half a fixture cannot prove.
 *
 * ⚠ THE TESTS IN THE NEXT BLOCK ARE WRAPPER-CONTRACT TESTS AND NOTHING MORE.
 * They hand `handleLayoutWithRecovery` a self-authored `async () => ({laidOut:
 * false})`, which proves the wrapper reacts correctly and proves NOTHING about
 * whether any real caller ever produces that value. An independent review
 * measured exactly that gap: no production code returned it, `applyLayout`
 * resolved `undefined` on its supersession path, `undefined` counts as success
 * by design — and the banner cleared over a perfect origin stack
 * (`stillStacked=true banner=idle`). Trap 16-inverse: the code path was live
 * and the data could not reach it. A fixture you wrote yourself is not evidence
 * about the producer.
 *
 * This block closes it by driving the REAL `applyLayout` into the real
 * supersession state, through the production call shape.
 */
describe('RC4 — the PRODUCER reports a layout that did not happen', () => {
  it('a superseded applyLayout resolves {laidOut:false}, and the banner survives', async () => {
    vi.doMock('../utils/layout', () => ({
      layoutGraph: vi.fn(async (nodes: unknown) => {
        // Supersede mid-await: exactly what a second draft/patch does while a
        // layout is in flight. This is the state the post-await commit guard
        // exists for, and the one that used to resolve `undefined`.
        const { useCanvasStore: s2 } = await import('../store')
        s2.setState({ layoutRequestId: s2.getState().layoutRequestId + 1 })
        return { nodes, layoutNodeWidth: 320 }
      }),
    }))
    vi.resetModules()
    const { useCanvasStore: store } = await import('../store')
    const { handleLayoutWithRecovery: recover } = await import('../layout/handleLayoutWithRecovery')
    const { useLayoutProgressStore: progress } = await import('../layoutProgressStore')
    store.getState().resetCanvas()
    store.setState({ nodes: originStack(5), edges: [], pendingLayout: true })
    const rid = store.getState().layoutRequestId

    // PRECONDITION PINNED: the graph really is a stack before we start.
    expect(graphNeedsInitialLayout(store.getState().nodes)).toBe(true)

    const result = await store.getState().applyLayout({ requestId: rid })
    // THE PRODUCER'S OWN REPORT — the assertion the fixture could never make.
    expect(result).toEqual({ laidOut: false })

    // …and end to end through the wrapper: the banner must NOT clear over it.
    progress.getState().fail('Layout failed. Try again.', () => {})
    recover(() => store.getState().applyLayout({ requestId: store.getState().layoutRequestId - 1 }))
    await new Promise((r) => setTimeout(r, 0))
    expect(progress.getState().status).toBe('error')
    // The stack is still a stack — which is why clearing would have been a lie.
    expect(graphNeedsInitialLayout(store.getState().nodes)).toBe(true)
  })

  it('DISCRIMINATING TWIN — an un-superseded applyLayout resolves {laidOut:true}', async () => {
    // Without this pair the test above would pass on a function that returned
    // `{laidOut:false}` unconditionally.
    vi.doMock('../utils/layout', () => ({
      layoutGraph: vi.fn(async (nodes: { id: string }[]) => ({
        nodes: nodes.map((n, i) => ({ ...n, position: { x: i * 400, y: 0 } })),
        layoutNodeWidth: 320,
      })),
    }))
    vi.resetModules()
    const { useCanvasStore: store } = await import('../store')
    store.getState().resetCanvas()
    store.setState({ nodes: originStack(4), edges: [], pendingLayout: true })
    const result = await store.getState().applyLayout({ requestId: store.getState().layoutRequestId })
    expect(result).toEqual({ laidOut: true })
  })

  it('the pre-await supersession guard reports it too', async () => {
    vi.resetModules()
    const { useCanvasStore: store } = await import('../store')
    store.getState().resetCanvas()
    store.setState({ nodes: originStack(3), edges: [] })
    // A requestId that no longer matches — dropped before any work is done.
    const stale = store.getState().layoutRequestId - 1
    await expect(store.getState().applyLayout({ requestId: stale })).resolves.toEqual({
      laidOut: false,
    })
  })
})

describe('RC4 — the recovery WRAPPER reacts correctly (contract only, see above)', () => {
  beforeEach(() => {
    useLayoutProgressStore.setState({ status: 'idle', message: null, canRetry: false, retry: null })
  })

  it('a layout fn that RESOLVES WITHOUT LAYING OUT does not clear the banner', async () => {
    // The store's own post-await commit guard returns early when a newer
    // request superseded this one — a RESOLVE that laid nothing out. Treating
    // every resolution as success is how the banner clears over a stack.
    useLayoutProgressStore.getState().fail('Layout failed. Try again.', () => {})
    handleLayoutWithRecovery(async () => ({ laidOut: false }))
    await new Promise((r) => setTimeout(r, 0))
    expect(useLayoutProgressStore.getState().status).toBe('error')
  })

  it('a layout fn that DID lay out clears the banner', async () => {
    // The discriminating twin: same call shape, opposite report, opposite
    // outcome. Either test alone would pass on a function that ignored the
    // report entirely.
    useLayoutProgressStore.getState().fail('Layout failed. Try again.', () => {})
    handleLayoutWithRecovery(async () => ({ laidOut: true }))
    await new Promise((r) => setTimeout(r, 0))
    expect(useLayoutProgressStore.getState().status).toBe('idle')
  })

  it('a legacy void-returning layout fn still counts as success (no silent behaviour change)', async () => {
    useLayoutProgressStore.getState().fail('Layout failed. Try again.', () => {})
    handleLayoutWithRecovery(async () => {})
    await new Promise((r) => setTimeout(r, 0))
    expect(useLayoutProgressStore.getState().status).toBe('idle')
  })
})

describe('RC6 — a SUCCESSFUL layout never leaves a node silently at the origin', () => {
  /**
   * A separate mechanism from the failure path above, and cheaper: the
   * write-back is a Map keyed by id, so a node the engine did not return simply
   * keeps the `{0,0}` it was drafted with — on a layout that reported success,
   * with no throw and no banner. Nothing tells the user, and nothing tells us.
   */
  it('places an unreturned node visibly instead of leaving it at {0,0}, and says so', async () => {
    // ⚠ ELK IS MOCKED TO DROP A NODE ON PURPOSE. An earlier version of this
    // test hoped a disconnected node would be dropped naturally; ELK placed it,
    // so the rescue branch never ran and the test passed without exercising
    // anything. Both of its arms asserted the same thing — a test shaped like a
    // discrimination that made none. The engine's return is the input to the
    // write-back, so mocking it is the honest way to reach the branch.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.doMock('elkjs/lib/elk.bundled.js', () => ({
      default: class {
        async layout(graph: { children?: { id: string }[] }) {
          // Return every child EXCEPT `orphan`, laid out normally.
          return {
            ...graph,
            children: (graph.children ?? [])
              .filter((c) => c.id !== 'orphan')
              .map((c, i) => ({ ...c, x: i * 400, y: 0 })),
            edges: [],
          }
        }
      },
    }))
    vi.resetModules()
    const { layoutGraph } = await import('../utils/layout')

    const { nodes: out } = await layoutGraph(
      [nodeAt('a', 0, 0, 'decision'), nodeAt('b', 0, 0, 'option'), nodeAt('orphan', 0, 0, 'factor')] as never,
      [{ id: 'e1', source: 'a', target: 'b' }] as never,
      {},
    )

    const orphan = out.find((n) => n.id === 'orphan')!
    const a = out.find((n) => n.id === 'a')!
    // THE PROPERTY: the dropped node is NOT left where it was drafted.
    expect(orphan.position).not.toEqual({ x: 0, y: 0 })
    // DISCRIMINATING TWIN: nodes the engine DID return keep the ENGINE's own
    // geometry, so the rescue cannot be moving everything indiscriminately.
    // Asserted as the relative spacing the mock produced (400px), because
    // `applyGlobalTranslation` shifts the whole graph by a margin afterwards —
    // pinning an absolute coordinate here would bind to that margin instead of
    // to the engine's layout, and would break the day the margin changes.
    const b = out.find((n) => n.id === 'b')!
    // DISCRIMINATING TWIN: the rescue moves the DROPPED node and nothing else.
    // `a` and `b` came back from the engine and keep the layout path's own
    // geometry, so neither may share the rescue row. Without this pair the test
    // would pass just as happily if the write-back relocated every node.
    // (Bound to relative geometry, not absolute coordinates:
    // `applyGlobalTranslation` shifts the whole graph afterwards, so an
    // absolute pin here would bind to that margin instead of to the layout.)
    expect(a.position.y).not.toBe(orphan.position.y)
    expect(b.position.y).not.toBe(orphan.position.y)
    expect(orphan.position.y).toBeGreaterThan(a.position.y)
    expect(orphan.position.y).toBeGreaterThan(b.position.y)
    // …and it is REPORTED, by name. A silent rescue is still a silent defect.
    const reported = warn.mock.calls.some((c) =>
      String(c[1] ?? '').includes('"unplaced_node_ids":["orphan"]'),
    )
    expect(reported, 'the unplaced node must be named in the warning').toBe(true)
    warn.mockRestore()
    vi.doUnmock('elkjs/lib/elk.bundled.js')
  })

  it('reports duplicate ids rather than letting them collapse onto one point in silence', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.resetModules()
    const { layoutGraph } = await import('../utils/layout')
    await layoutGraph(
      [nodeAt('dup', 0, 0, 'decision'), nodeAt('dup', 0, 0, 'option'), nodeAt('c', 0, 0, 'goal')] as never,
      [] as never,
      {},
    )
    const reported = warn.mock.calls.some((c) => String(c[1] ?? '').includes('"duplicate_node_ids":["dup"]'))
    expect(reported, 'a duplicate id must be reported by name').toBe(true)
    warn.mockRestore()
  })
})

/**
 * ⭐⭐ THE RESCUE MUST NOT MAKE THE FAILURE HARDER TO OBSERVE.
 *
 * ⚠ THIS IS THE QUESTION THE FIX ITSELF CREATES. The witnessed defect is
 * INTERMITTENT — an independent journey drive on the same base produced a
 * perfectly healthy canvas (16 nodes, 16 unique positions, 0 at the origin) —
 * and the underlying error has never been captured. A rescue that quietly makes
 * the screen look fine would turn an elusive failure into an invisible one.
 *
 * Two signals, tested separately because they serve different readers: the USER
 * still gets the banner, and an OPERATOR gets a durable count.
 */
describe('a survived failure is still a reported failure', () => {
  it('the failure still REJECTS, so the banner path is still reached', async () => {
    // The banner is driven by `handleLayoutWithRecovery`'s catch, which only
    // runs if `applyLayout` still rejects. Swallowing the error to "fix" the
    // canvas would clear the banner and hide the defect — pinned here so a
    // later tidy-up cannot make the rescue silent.
    vi.doMock('../utils/layout', () => ({
      layoutGraph: vi.fn(async () => {
        throw new Error('ELK exploded')
      }),
    }))
    vi.resetModules()
    const { useCanvasStore: store } = await import('../store')
    store.getState().resetCanvas()
    store.setState({ nodes: originStack(5), edges: [] })
    await expect(store.getState().applyLayout()).rejects.toThrow(/ELK exploded/)
  })

  it('emits a DURABLE operator signal naming the node count and whether it rescued', async () => {
    const trackEvent = vi.fn()
    vi.doMock('../../lib/posthog', () => ({ trackEvent, default: {} }))
    vi.doMock('../utils/layout', () => ({
      layoutGraph: vi.fn(async () => {
        throw new Error('ELK exploded')
      }),
    }))
    vi.resetModules()
    const { useCanvasStore: store } = await import('../store')
    store.getState().resetCanvas()
    store.setState({ nodes: originStack(6), edges: [] })
    await expect(store.getState().applyLayout()).rejects.toThrow()

    expect(trackEvent).toHaveBeenCalledWith('canvas_layout_fallback_applied', {
      node_count: 6,
      rescued: true,
    })
    vi.doUnmock('../../lib/posthog')
  })

  it('reports rescued=false when the graph did NOT need rescuing', async () => {
    // ⭐ THE DISCRIMINATING TWIN. Without it the event would prove only that the
    // catch ran; this proves the flag reports whether coordinates actually
    // MOVED. A graph already laid out fails layout without being re-placed.
    const trackEvent = vi.fn()
    vi.doMock('../../lib/posthog', () => ({ trackEvent, default: {} }))
    vi.doMock('../utils/layout', () => ({
      layoutGraph: vi.fn(async () => {
        throw new Error('ELK exploded')
      }),
    }))
    vi.resetModules()
    const { useCanvasStore: store } = await import('../store')
    store.getState().resetCanvas()
    const laidOut = [nodeAt('a', 0, 0), nodeAt('b', 500, 0), nodeAt('c', 1000, 300)]
    store.setState({ nodes: laidOut, edges: [] })
    await expect(store.getState().applyLayout()).rejects.toThrow()

    expect(trackEvent).toHaveBeenCalledWith('canvas_layout_fallback_applied', {
      node_count: 3,
      rescued: false,
    })
    vi.doUnmock('../../lib/posthog')
  })
})
