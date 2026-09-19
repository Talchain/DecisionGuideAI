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
 * ⛔ IT NEVER WRITES. `skipAutosave` and `skipHistory` are both set, so a
 * fixture can never reach a real scenario's persisted state. That is the one
 * hazard a seeded route carries and it is closed by construction, not by
 * convention.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { applyDraftResult } from '../canvas/utils/applyDraftResult'
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
    label: "Fundraising — the founder's board, 19 Sep 2026 (13 nodes, 23 edges)",
    graph: realDraftFundraising,
  },
}

export default function CanvasFixture(): JSX.Element {
  const { name } = useParams<{ name: string }>()
  const [applied, setApplied] = useState<{ nodeCount: number; edgeCount: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fixture = useMemo(() => (name ? FIXTURES[name] : undefined), [name])

  // ⛔ SECOND GATE. The route registration is the first; this one is about the
  // surface itself and survives a route table edited by someone not thinking
  // about this file.
  const blockedInProduction = import.meta.env.PROD && !import.meta.env.VITE_ENABLE_DEV_ROUTES

  useEffect(() => {
    if (blockedInProduction || !fixture) return
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
        {error ? ` · ⛔ ${error}` : ''}
      </div>
      <CanvasMVP />
    </div>
  )
}
