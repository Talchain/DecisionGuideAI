// tests/ci-guards/core-bundle-crawl-integrity.spec.ts
// =============================================================================
// The Core E2E bundle crawl must distinguish A BLIND CRAWL from A STALE CONTROL.
// =============================================================================
//
// WHY THIS EXISTS. On 2026-08-29 E5 failed with:
//
//   BUNDLE CRAWL POSITIVE CONTROL DID NOT FIRE: "v5_handler_facts" appears in
//   none of the 75 chunks crawled (of 75 discovered).
//
// Neither the control nor the regex was at fault. Measured against the deployed
// build (5c449852, the same build E5 ran against):
//
//   • a sound crawl discovers 83 chunks and the control fires in exactly ONE
//     of them — ReactFlowGraph-*.js, 1.88 MB, the largest chunk in the bundle;
//   • `v5_handler_facts` has ONE runtime occurrence in the whole codebase
//     (`.from('v5_handler_facts')`, src/services/analysisRunHistoryService.ts:95).
//     Every other src/ occurrence is a COMMENT, stripped at build;
//   • simulating the loss of each chunk in turn over the real graph, dropping
//     ReactFlowGraph-*.js yields EXACTLY 75 discovered — the ONLY chunk in the
//     graph whose loss yields 75, and the ONLY one carrying the control;
//   • `fetched === discovered === 75` proves the queue DRAINED, so this was a
//     pruned subtree and not a deadline.
//
// The old loop swallowed fetch failures (`if (!r.ok) continue` / `catch
// { continue }`). An unread chunk is never parsed, so its children are never
// enqueued: one dropped fetch deleted 8 chunks from discovery AND the sole
// control-bearing chunk, and the instrument reported blindness.
//
// The load-bearing test here is the DISCRIMINATING PAIR: the same missing
// control, reached two ways, must produce two DIFFERENT and correctly-named
// errors. A single passing case would not show that — only the pair does.

import { describe, it, expect } from 'vitest'
import {
  crawlBundle, assertCrawlIntegrity, assertControlsFired,
  BUNDLE_CONTRAST, makeHttpChunkFetcher, type ChunkFetcher, type ChunkOutcome,
} from '../../e2e/core/lib/bundleCrawl'

// --- a synthetic graph with the real one's SHAPE -----------------------------
// index -> AppPoC -> ReactFlowGraph(control, depth 3) + leaves. The control sits
// behind two hops exactly as it does in the deployed bundle, so pruning bites.

const ROOT_HTML = '<script src="/assets/index.js"></script>'
const CONTROL_CHUNK = '/assets/ReactFlowGraph.js'

function graph(over: Record<string, string> = {}): Record<string, string> {
  const leaves: Record<string, string> = {}
  // 8 leaves behind the control chunk; each spells `scenarios` so that losing the
  // control chunk also drops the `scenarios` floor — as it does in the real bundle.
  for (let i = 0; i < 8; i++) leaves[`/assets/leaf${i}.js`] = `x("scenarios");y${i}`
  return {
    '/assets/index.js': 'import"assets/AppPoC.js";const s="scenarios"',
    '/assets/AppPoC.js':
      `import"assets/ReactFlowGraph.js";import"assets/store.js";` +
      `const u="https://etmmuzwxtcjipwphdola.supabase.co";const k="sb_publishable_AbCdEf012345";` +
      `const s="scenarios";const r="run_analysis"`,
    '/assets/store.js': 'const r="run_analysis";const s="scenarios"',
    [CONTROL_CHUNK]:
      Object.keys(leaves).map((l) => `import"assets${l.replace('/assets', '')}"`).join(';') +
      `;await La.from("v5_handler_facts").select("id");const r="run_analysis";const s="scenarios"`,
    ...leaves,
    ...over,
  }
}

/** A fetcher over a fixed graph. `fail` maps a path to a fixed outcome. */
function fetcherFor(
  bodies: Record<string, string>,
  fail: Record<string, ChunkOutcome> = {},
  failTimes: Record<string, number> = {},
): ChunkFetcher {
  const seen: Record<string, number> = {}
  return async (path) => {
    if (fail[path]) {
      const budget = failTimes[path]
      if (budget === undefined) return fail[path]
      seen[path] = (seen[path] ?? 0) + 1
      if (seen[path] <= budget) return fail[path]
    }
    const body = bodies[path]
    if (body === undefined) return { kind: 'absent', status: 404 }
    return { kind: 'ok', body }
  }
}

const crawl = (f: ChunkFetcher) => crawlBundle(ROOT_HTML, f, { retries: 2 })

describe('core bundle crawl — integrity before controls', () => {
  it('BASELINE: a sound crawl reaches every chunk and every control fires', async () => {
    const c = await crawl(fetcherFor(graph()))
    expect(c.discovered.length, 'the whole synthetic graph should be discovered').toBe(12)
    expect(c.indeterminate, 'nothing should be unreadable').toEqual([])
    expect(c.queueDrained).toBe(true)
    expect(() => assertCrawlIntegrity(c)).not.toThrow()
    const reports = assertControlsFired(c)
    expect(reports.find((r) => r.term === 'v5_handler_facts')?.chunks).toEqual([CONTROL_CHUNK])
  })

  // ---- THE DISCRIMINATING PAIR --------------------------------------------
  // Same observable symptom (no `v5_handler_facts` anywhere in what was read),
  // two causes, two errors. This is the defect the fix exists to remove.

  it('CAUSE 1 — an unreadable chunk is INCOMPLETE, and is named (the real E5 failure)', async () => {
    const c = await crawl(fetcherFor(graph(), {
      [CONTROL_CHUNK]: { kind: 'indeterminate', reason: 'socket hang up' },
    }))

    // the subtree is pruned exactly as it was in the live failure
    expect(c.discovered.length, 'losing one chunk must prune its 8 children too').toBe(4)
    expect(c.bodies.has(CONTROL_CHUNK)).toBe(false)

    let err: Error | undefined
    try { assertCrawlIntegrity(c) } catch (e) { err = e as Error }
    expect(err, 'an unreadable chunk MUST be fatal, not swallowed').toBeDefined()
    expect(err!.message).toContain('BUNDLE CRAWL INCOMPLETE')
    expect(err!.message, 'the failing chunk must be NAMED').toContain(CONTROL_CHUNK)
    expect(err!.message).toContain('socket hang up')
    expect(err!.message, 'must NOT blame the control').not.toContain('STALE')
  })

  it('CAUSE 2 — a complete crawl that cannot find the term says STALE, not blind', async () => {
    // Every chunk readable; the term is simply no longer spelled anywhere.
    const g = graph()
    g[CONTROL_CHUNK] = g[CONTROL_CHUNK].replace('v5_handler_facts', 'renamed_by_a_migration')
    const c = await crawl(fetcherFor(g))

    expect(c.indeterminate, 'the crawl itself is sound').toEqual([])
    expect(c.discovered.length).toBe(12)
    expect(() => assertCrawlIntegrity(c), 'integrity must PASS here').not.toThrow()

    let err: Error | undefined
    try { assertControlsFired(c) } catch (e) { err = e as Error }
    expect(err).toBeDefined()
    expect(err!.message).toContain('CONTROL IS STALE, NOT BLIND')
    expect(err!.message).toContain('v5_handler_facts')
    expect(err!.message, 'it must say the crawl was complete').toContain('0 unreadable')
    expect(err!.message, 'and tell the operator what to do').toContain('re-pin BUNDLE_CONTROLS')
  })

  // ---- the remaining guards ------------------------------------------------

  it('a TRANSIENT failure is retried, so flake does not become a hard red', async () => {
    const c = await crawl(fetcherFor(
      graph(),
      { [CONTROL_CHUNK]: { kind: 'indeterminate', reason: 'ECONNRESET' } },
      { [CONTROL_CHUNK]: 2 }, // fails twice, succeeds on the third attempt
    ))
    expect(c.indeterminate).toEqual([])
    expect(c.discovered.length).toBe(12)
    expect(() => assertControlsFired(c)).not.toThrow()
  })

  it('a definitive 404 is BENIGN — the loose regex mints phantoms by design', async () => {
    // `/assets/e=this.js` is a real artefact of ASSET_RE on the deployed bundle.
    const g = graph()
    g['/assets/index.js'] += ';q("assets/e=this.js")'
    const c = await crawl(fetcherFor(g))
    expect(c.absent.map((a) => a.path)).toContain('/assets/e=this.js')
    expect(() => assertCrawlIntegrity(c), 'a 404 hides nothing and must not fail the crawl').not.toThrow()
  })

  it('a 5xx is NOT benign — it is an absence of an answer', async () => {
    const c = await crawl(fetcherFor(graph(), {
      [CONTROL_CHUNK]: { kind: 'indeterminate', reason: 'HTTP 503' },
    }))
    expect(() => assertCrawlIntegrity(c)).toThrow(/BUNDLE CRAWL INCOMPLETE/)
  })

  it('the CONTRAST control bites: a matcher that matches everything is caught', async () => {
    const g = graph()
    g['/assets/store.js'] += `;const sentinel="${BUNDLE_CONTRAST}"`
    const c = await crawl(fetcherFor(g))
    expect(() => assertControlsFired(c)).toThrow(/CONTRAST CONTROL FIRED/)
  })

  it('discovering only the entry is the leading-slash bug, and is fatal', async () => {
    const c = await crawlBundle('<script src="/assets/only.js"></script>',
      fetcherFor({ '/assets/only.js': 'no references here' }), { retries: 0 })
    expect(c.discovered.length).toBe(1)
    expect(() => assertCrawlIntegrity(c)).toThrow(/DISCOVERED 1 CHUNK/)
  })

  it('a crawl cut short by the cap cannot support an absence claim', async () => {
    const c = await crawlBundle(ROOT_HTML, fetcherFor(graph()), { maxChunks: 3, retries: 0 })
    expect(c.queueDrained).toBe(false)
    expect(() => assertCrawlIntegrity(c)).toThrow(/CUT SHORT[\s\S]*maxChunks cap/)
  })

  // ---- the live fetcher's classification ----------------------------------
  // Found by a SURVIVING MUTANT: flipping the 404 branch in makeHttpChunkFetcher
  // left all ten tests above green, because they inject a fake fetcher. The
  // answer/no-answer split is the load-bearing decision of this whole module and
  // it was uncovered. These four pin it at the only place it is made.

  it('makeHttpChunkFetcher classifies an answer apart from the absence of one', async () => {
    const orig = globalThis.fetch
    const respond = (r: Partial<Response> | Error) => {
      globalThis.fetch = (async () => {
        if (r instanceof Error) throw r
        return r as Response
      }) as typeof fetch
    }
    try {
      const f = makeHttpChunkFetcher('https://example.test')

      respond({ status: 404, ok: false })
      expect(await f('/assets/phantom.js'), '404 is a definitive answer: benign')
        .toEqual({ kind: 'absent', status: 404 })

      respond({ status: 503, ok: false })
      expect((await f('/assets/x.js')).kind, '5xx is NOT an answer: fatal')
        .toBe('indeterminate')

      respond(new Error('socket hang up'))
      expect((await f('/assets/x.js')), 'a throw is NOT an answer: fatal')
        .toEqual({ kind: 'indeterminate', reason: 'socket hang up' })

      respond({ status: 200, ok: true, text: async () => 'body' } as unknown as Response)
      expect(await f('/assets/x.js')).toEqual({ kind: 'ok', body: 'body' })
    } finally {
      globalThis.fetch = orig
    }
  })

  it('a floor catches a HALF-crawl that a non-zero control would bless', async () => {
    // Every chunk readable and `v5_handler_facts` present — but the `scenarios`
    // breadth collapses. A single non-zero control would call this healthy.
    const g = graph()
    for (let i = 0; i < 8; i++) g[`/assets/leaf${i}.js`] = `y${i}`
    const c = await crawl(fetcherFor(g))
    expect(() => assertCrawlIntegrity(c)).not.toThrow()
    expect(() => assertControlsFired(c)).toThrow(/CONTROL IS STALE[\s\S]*scenarios/)
  })
})
