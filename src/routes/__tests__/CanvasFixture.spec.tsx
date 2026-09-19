/**
 * ⭐⭐ THE FIXTURE MUST APPLY A REAL GRAPH, AND MUST NEVER WRITE ONE.
 *
 * Two claims, and the second is the hazard a seeded route carries: a fixture
 * that reached a real scenario's persisted state would corrupt a user's model
 * with a demo. It is closed by construction (`skipAutosave` + `skipHistory`)
 * and pinned here so a later edit cannot quietly open it.
 *
 * ⚠ THE PRECONDITION EVERY ASSERTION RESTS ON is that the fixture still MAPS.
 * `applyDraftResult` returns `{nodeCount: 0}` for a shape it does not
 * recognise, and a route that renders an empty canvas looks exactly like a
 * route that renders a healthy one — this estate's most expensive shape
 * (CLAUDE.md trap 13). So the count is asserted by NUMBER, against the capture.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { applyDraftResult } from '../../canvas/utils/applyDraftResult'
import { useCanvasStore } from '../../canvas/store'
import fixture from '../../canvas/__fixtures__/realDraft.fundraising.json'

describe('the committed draft fixture is a real, mappable CEE graph', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('⭐ PRECONDITION: it still maps — 13 nodes and 23 edges, by number', () => {
    // From the founder's own bundle, 19 Sep 2026. If CEE's draft shape moves,
    // this reds here rather than silently rendering an empty board.
    const result = applyDraftResult(fixture as never, { skipHistory: true, skipAutosave: true })
    expect(result.nodeCount, 'the fixture mapped to ZERO nodes — the draft shape has moved').toBe(13)
    expect(result.edgeCount).toBe(23)
  })

  it('every kind the canvas renders is present, so one render exercises them all', () => {
    applyDraftResult(fixture as never, { skipHistory: true, skipAutosave: true })
    const kinds = new Set(
      useCanvasStore.getState().nodes.map(n => (n.type ?? (n.data as { kind?: string } | undefined)?.kind)),
    )
    // A fixture missing a kind is a fixture that cannot witness that card.
    for (const k of ['decision', 'option', 'factor', 'outcome', 'risk', 'goal']) {
      expect(kinds.has(k), `the fixture has no ${k} node — that card cannot be witnessed here`).toBe(true)
    }
  })

  it('⛔ it carries its own provenance, so nobody can mistake it for hand-written', () => {
    const meta = (fixture as { _provenance?: Record<string, unknown> })._provenance
    expect(meta, 'the fixture lost its provenance block').toBeTruthy()
    expect(String(meta!.source)).toMatch(/olumi-debug/)
    expect(meta!.client_build).toBeTruthy()
  })

  it('⛔ REAL EDGES, not a star — the layout is only exercised by real topology', () => {
    applyDraftResult(fixture as never, { skipHistory: true, skipAutosave: true })
    const edges = useCanvasStore.getState().edges
    const sources = new Set(edges.map(e => e.source))
    const targets = new Set(edges.map(e => e.target))
    // A fixture where everything hangs off one node lays out trivially and
    // would certify a layout that cannot handle a real graph.
    expect(sources.size).toBeGreaterThan(3)
    expect(targets.size).toBeGreaterThan(3)
    // And every endpoint resolves — the property whose ABSENCE was the leading
    // (and refuted) theory for the layout failure.
    const ids = new Set(useCanvasStore.getState().nodes.map(n => n.id))
    const dangling = edges.filter(e => !ids.has(e.source) || !ids.has(e.target))
    expect(dangling, 'the fixture has dangling edges').toHaveLength(0)
  })
})
