/**
 * ⭐⭐ THE REAL CANVAS, A REAL GRAPH, AND NO PROVIDER CALL.
 *
 * THE CONSTRAINT THIS REMOVES, stated in the Canvas plan on 19 Sep 2026 and
 * measured at `719915a9`: *"No fixture or demo route mounts the real canvas
 * components. Seeing a node card or the inspector needs a real graph, hence a
 * draft, hence a paid call. So every merge today is DEPLOYED, not
 * USER-WITNESSED."*
 *
 * That is why the canvas lane has been shipping blind. Every guard it writes is
 * a jsdom render of one component; the journey the product is judged on —
 * faithful model → intended change saved → analysis displayed → result retained
 * on reopening — has had exactly one instrument, which is the founder opening a
 * board and looking at it. A capability nobody can witness without spending
 * money is a capability nobody witnesses.
 *
 * ⭐ THE FIXTURE IS A REAL CEE DRAFT, NOT A HAND-WRITTEN ONE. It is the exact
 * payload that was on the founder's screen on 19 Sep, lifted from his own debug
 * bundle. A fixture written from our own head encodes our model of the producer
 * rather than the producer (CLAUDE.md trap 16, whose sharpest line is *"a
 * fixture you wrote yourself is not evidence about the wire"*) — and this lane
 * has already been bitten by exactly that: an invariant written with the same
 * blind spot as the code it tested.
 *
 * ⚠ WHAT THIS IS NOT, AND THE LIMIT IS THE POINT. It proves what the canvas
 * does with a graph it has been GIVEN. It says nothing about drafting, about
 * CEE, or about analysis — those need the wire. Read it as a RENDER witness and
 * never as a journey witness (the status ladder: CODE EXISTS → TESTED →
 * DEPLOYED → MOUNTED → WIRE-WITNESSED → JOURNEY-WITNESSED; this reaches
 * MOUNTED, and no further).
 *
 * ⛔ GATED TWICE, and the gates answer different questions: the ROUTE is
 * registered only under `VITE_ENABLE_DEV_ROUTES`, and this component refuses to
 * render in production regardless of how it was reached. One is about the
 * router's shape, the other about this surface — a route table is edited by
 * people who are not thinking about this file.
 *
 * ⛔⛔ IT MUST NOT WRITE — AND THE FIRST VERSION OF THIS FILE CLAIMED THAT ON A
 * FALSE PREMISE. It said *"`skipAutosave` and `skipHistory` are both set, so a
 * fixture can never reach a real scenario's persisted state… closed by
 * construction, not by convention."* An independent review refuted it and was
 * right. `skipAutosave` is an argument to `applyDraftResult` ALONE — it
 * suppresses one immediate write. `ReactFlowGraph:1293` then mounts
 * `useAutosave()` with NO arguments, and its 30-second timer plus
 * `pagehide`/`beforeunload` flush stamp the payload with `currentScenarioId`.
 * A user who opened a real board and then came here could have this demo graph
 * written into their own crash-recovery slot. That is data loss, and the
 * docblock asserting it could not happen is exactly why nobody looked.
 *
 * ⭐ WHAT ACTUALLY CLOSES IT, in three parts, each with its own proof:
 *
 *  1. **Storage is suspended for the mounted lifetime** — at `Storage.prototype`,
 *     so all 15 `saveAutosave` call sites and the other 70-odd storage writers in
 *     `src/` are covered without a list anyone has to maintain. See
 *     `persist/persistenceSuspension.ts`.
 *  2. **The network path is closed by a DIFFERENT mechanism** —
 *     `currentScenarioId` is cleared, which is the condition
 *     `useServerGraphHydration:58` early-returns on. Named apart from (1)
 *     deliberately: they answer different questions and must not be read as one
 *     guarantee (trap 21).
 *  3. **The user's model is restored on exit** — graph and scenario id are
 *     snapshotted before the fixture is applied and put back on unmount, so
 *     navigating away in the same SPA session does not leave the demo in place.
 *
 * ⚠ ORDERING IS LOAD-BEARING. React runs a CHILD's effects before its parent's,
 * so suspending in this component's effect would fire AFTER `useAutosave`'s. The
 * canvas is therefore not rendered at all until the suspension is installed —
 * `CanvasMVP` is absent from the tree, not merely inert.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { applyDraftResult } from '../canvas/utils/applyDraftResult'
import { useCanvasStore } from '../canvas/store'
import { suspendPersistence, persistenceRefusals } from '../canvas/persist/persistenceSuspension'
import CanvasMVP from './CanvasMVP'
import realDraftFundraising from '../canvas/__fixtures__/realDraft.fundraising.json'

/**
 * The committed graphs, by route name.
 *
 * ⚠ ADD ONLY REAL CAPTURES. A name here is a promise that the shape came off
 * the wire; the moment one is hand-authored this route starts certifying our
 * own assumptions back to us, which is the failure it exists to end.
 */
const FIXTURES: Record<string, { label: string; graph: unknown }> = {
  fundraising: {
    label: 'A real CEE draft, 19 Sep 2026 — labels sanitised (13 nodes, 23 edges)',
    graph: realDraftFundraising,
  },
}

export default function CanvasFixture(): JSX.Element {
  const { name } = useParams<{ name: string }>()
  const [applied, setApplied] = useState<{ nodeCount: number; edgeCount: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // ⛔ THE CANVAS DOES NOT RENDER UNTIL THIS IS TRUE. See the ordering note in
  // the docblock: a child's effects run before its parent's, so gating the
  // MOUNT is the only way to get the suspension in first.
  const [isolated, setIsolated] = useState(false)
  const [refused, setRefused] = useState(0)

  const fixture = useMemo(() => (name ? FIXTURES[name] : undefined), [name])

  // ⛔ SECOND GATE. The route registration is the first; this one is about the
  // surface itself and survives a route table edited by someone not thinking
  // about this file.
  const blockedInProduction = import.meta.env.PROD && !import.meta.env.VITE_ENABLE_DEV_ROUTES

  useEffect(() => {
    if (blockedInProduction || !fixture) return

    // (1) STORAGE. Installed before anything else touches the store, and before
    // the canvas exists in the tree at all.
    const resumePersistence = suspendPersistence('canvas fixture')

    // (3) THE USER'S MODEL. Snapshotted BEFORE the fixture is applied.
    const before = useCanvasStore.getState()
    const restoreModel = {
      nodes: before.nodes,
      edges: before.edges,
      currentScenarioId: before.currentScenarioId,
    }

    // (2) NETWORK. `useServerGraphHydration:58` returns immediately on a null
    // scenario id, so clearing it is what stops this route reaching the server —
    // and it also means nothing downstream has a real scenario to stamp.
    useCanvasStore.setState({ currentScenarioId: null })

    try {
      // ⚠ THE REAL INGEST PATH, DELIBERATELY. Seeding the store directly would
      // bypass `mapDraftNodeToCanvas`/`mapDraftEdgeToCanvas` — the very
      // translation most of this lane's defects have lived in — and would
      // render a graph no producer can actually produce.
      const result = applyDraftResult(fixture.graph as never, { skipHistory: true, skipAutosave: true })
      setApplied(result)
      if (result.nodeCount === 0) {
        // A silent zero is how this estate loses a whole measurement. Say it.
        setError('the fixture applied ZERO nodes — the draft shape no longer matches the ingest')
      }
    } catch (err) {
      setError(String(err))
    }

    setIsolated(true)

    // The banner shows this so the isolation is VISIBLE. A fixture session that
    // reports zero refusals once the autosave timer has run is telling you the
    // guard is not installed — not that the canvas is quiet (trap 13).
    const meter = setInterval(() => setRefused(persistenceRefusals().length), 1000)

    return () => {
      clearInterval(meter)
      useCanvasStore.setState(restoreModel)
      resumePersistence()
      setIsolated(false)
    }
  }, [fixture, blockedInProduction])

  if (blockedInProduction) {
    return <div style={{ padding: 24 }}>Not available.</div>
  }

  if (!fixture) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Canvas fixtures</h1>
        <p>No fixture named <code>{name}</code>. Available:</p>
        <ul>
          {Object.entries(FIXTURES).map(([key, f]) => (
            <li key={key}><a href={`#/dev/canvas-fixture/${key}`}>{key}</a> — {f.label}</li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* ⭐ THE BANNER IS NOT DECORATION. A seeded board that looks like a real
          one is how a fixture screenshot ends up in a status report as
          evidence about the product. It names the fixture and the counts, so a
          capture taken here can never be mistaken for a live session. */}
      <div
        data-testid="canvas-fixture-banner"
        style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          zIndex: 4000, background: '#7c2d12', color: 'white', borderRadius: 8,
          padding: '6px 14px', fontFamily: 'system-ui', fontSize: 13,
          boxShadow: '0 2px 8px rgba(0,0,0,.25)', pointerEvents: 'none',
        }}
      >
        FIXTURE — {fixture.label}
        {applied ? ` · applied ${applied.nodeCount} nodes / ${applied.edgeCount} edges` : ' · applying…'}
        {` · storage suspended, ${refused} write${refused === 1 ? '' : 's'} refused`}
        {error ? ` · ⛔ ${error}` : ''}
      </div>
      {isolated ? <CanvasMVP /> : <div style={{ padding: 24 }} data-testid="canvas-fixture-isolating">Isolating this session…</div>}
    </div>
  )
}
