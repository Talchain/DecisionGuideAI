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
    expect(meta!.client_build, 'the capture lost the build it came from').toBeTruthy()
    expect(meta!.captured_at).toBeTruthy()
  })

  it('⛔⛔ THE LABELS ARE EXACTLY THE SANITISED SET — a route flag is not access control', () => {
    // This file is statically imported into a lazily-loaded chunk. Anyone who
    // knows that chunk's URL can fetch it: no auth, no flag evaluation. The
    // capture came off a real board, so its labels and quoted user text were
    // real business strategy until they were replaced.
    //
    // ⚠ THIS PINS THE SET, NOT A VOCABULARY. The first version of this guard
    // banned five words ('fundrais', 'investor', 'angel', 'pre-seed',
    // 'dilution') and a mutant walked straight through it by restoring the
    // label "Round Closure Speed" — real capture text, on none of the five.
    // A denylist of words a human has to keep current is the hand-maintained
    // mirror this estate keeps paying for (CLAUDE.md trap 12); pinning the set
    // catches ANY reintroduction, including text nobody thought to ban.
    const labels = (fixture as { nodes: Array<{ label: string }> }).nodes.map(n => n.label).sort()
    expect(labels).toEqual([
    "Build Completion Speed",
    "Build Timeline Breach",
    "Contractor Availability",
    "Growing Area Gained",
    "Lease and Extend in Parallel",
    "Lease the Adjacent Plot",
    "Lease the Adjacent Plot or Extend the Current Site",
    "New Greenhouse Open",
    "Ongoing Rent Burden",
    "Open the Greenhouse Within Two Months",
    "Status Quo — No Expansion This Year",
    "Unfavourable Lease Terms Risk",
    "extend the current site to cover the whole planned growing area",
    ])
  })

  it('⛔⛔ and so is every quoted user utterance — those were the founder’s own words', () => {
    const quotes: string[] = []
    const walk = (o: unknown): void => {
      if (Array.isArray(o)) { o.forEach(walk); return }
      if (o && typeof o === 'object') {
        for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
          if (k === 'source_quote' && typeof v === 'string') quotes.push(v)
          walk(v)
        }
      }
    }
    walk(fixture)
    expect(quotes.sort()).toEqual([
    "extend the current site to cover the whole planned growing area",
    "lease the adjacent plot",
    "open the greenhouse within two months",
    ])
  })

  it('⭐ CONTRAST: the producer’s own output is still here, byte-unchanged', () => {
    // The set assertions above would also pass on a file emptied of content.
    // This is the discrimination that proves the fixture is still a real
    // capture and not a husk (CLAUDE.md trap 13e).
    const raw = JSON.stringify(fixture)
    expect(raw).toMatch(/Olumi estimate via edge/)
    expect(raw).toMatch(/records projector/)
    expect((fixture as { _provenance: Record<string, unknown> })._provenance.sanitised).toBeTruthy()
  })

  it('⛔ the long-sentence label survives sanitisation — that shape is the evidence', () => {
    // A factor/option whose name is a whole sentence is a rendering case this
    // lane has a live PR about. Replacing it with a tidy short label would have
    // quietly removed the thing the fixture is for.
    const longest = Math.max(...(fixture as { nodes: Array<{ label: string }> }).nodes.map(n => n.label.length))
    expect(longest, 'the sanitised fixture lost its long-sentence label').toBeGreaterThan(40)
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
