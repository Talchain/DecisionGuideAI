// e2e/core/lib/bundleCrawl.ts
// =============================================================================
// The deployed-bundle crawl, and the guards that decide whether it may be
// believed. Extracted from harness.ts 2026-08-29 so the guards can be exercised
// against a synthetic asset graph: the crawl's failure mode is a TRANSIENT
// dropped fetch, which cannot be provoked on demand over a live network, and a
// guard nobody has watched turn red is not yet a guard.
//
// This module imports no browser tooling on purpose — it is unit-testable.
// =============================================================================

// ⚠ MATCHES `assets/x.js` WITH OR WITHOUT A LEADING SLASH, and `./x.js`.
// The deployed entry chunk references siblings as "assets/AppPoC-….js" — NO leading slash.
// A leading-slash-only pattern crawls 1 chunk of 83 and reports a confident false absence.
// The golden-journey harness carries a comment warning about exactly this; I copied the comment
// and reimplemented the bug. A WARNING IS NOT A GUARD — the positive control is.
export const ASSET_RE = /["'(]([^"'()\s]*[A-Za-z0-9._-]+\.js)["')]/g

export const toAssetPath = (p: string): string | null => {
  if (p.startsWith('http')) { try { return new URL(p).pathname } catch { return null } }
  if (p.startsWith('/')) return p
  if (p.startsWith('./')) return `/assets/${p.slice(2)}`
  if (p.includes('assets/')) return `/${p.replace(/^\.?\//, '')}`
  return `/assets/${p}`
}

// ---------------------------------------------------------------------------
// Crawl integrity — measured 2026-08-29, after E5 failed with a control that was
// neither stale nor mis-globbed.
// ---------------------------------------------------------------------------
// E5 failed reporting `"v5_handler_facts" appears in none of the 75 chunks crawled
// (of 75 discovered)`. The deployed build was 5c449852; a crawl of that same build
// discovers 83 chunks and the control fires. The gap is the whole finding:
//
//   • `v5_handler_facts` has exactly ONE runtime occurrence in the entire codebase
//     — `.from('v5_handler_facts')` at src/services/analysisRunHistoryService.ts:95.
//     Every other src/ occurrence is inside a COMMENT and is stripped at build. So
//     the control lives in exactly ONE chunk of 83: ReactFlowGraph-*.js, at 1.88 MB
//     the LARGEST chunk in the bundle, reached at depth 3.
//   • The old loop swallowed every fetch failure (`if (!r.ok) continue` / `catch
//     { continue }`). A chunk that fails to load is never parsed, so its children
//     are never enqueued and its whole subtree vanishes from discovery.
//   • Simulated over the real 83-chunk graph: dropping ReactFlowGraph-*.js yields
//     EXACTLY 75 discovered chunks. It is the ONLY chunk in the graph whose loss
//     yields 75, and it is the ONLY chunk carrying the control. `fetched ===
//     discovered === 75` also proves the queue DRAINED rather than hitting the
//     deadline — the signature of a pruned subtree, not of a timeout.
//
// So the instrument was right that it was blind, and wrong about why: it blamed the
// control while the actual fault was a silently-dropped fetch. Hence the split below
// between an answer and the absence of one:
//
//   404/410  — a DEFINITIVE answer: this asset does not exist, so it hides nothing.
//              Expected and benign: ASSET_RE is deliberately loose and manufactures
//              phantoms. Measured on 5c449852 it yields three — `/assets/e=this.js`
//              (a pure regex artefact) plus elk's two undeployed worker paths.
//   throw/5xx/429 — NOT an answer. The chunk may exist and may carry anything,
//              including the control. Retried, and if still unresolved it is FATAL,
//              because a subtree pruned by a dropped fetch reads exactly like a
//              subtree that was never there.
//
// This is the estate's could-not-measure rule at chunk grain: an unreadable result
// is a hard error, never a pass.

export type ChunkOutcome =
  | { kind: 'ok'; body: string }
  | { kind: 'absent'; status: number }
  | { kind: 'indeterminate'; reason: string }

export type ChunkFetcher = (path: string) => Promise<ChunkOutcome>

export interface BundleCrawl {
  bodies: Map<string, string>
  discovered: string[]
  attempted: number
  absent: Array<{ path: string; status: number }>
  indeterminate: Array<{ path: string; reason: string }>
  queueDrained: boolean
  hitMaxChunks: boolean
}

/**
 * Breadth-first crawl of the deployed asset graph.
 *
 * `fetchChunk` is injected so the integrity guards can be exercised against a
 * synthetic graph. A crawl that depends on live network flakiness cannot be shown
 * to bite, and a guard nobody has watched turn red is not yet a guard.
 */
export async function crawlBundle(
  rootHtml: string,
  fetchChunk: ChunkFetcher,
  opts: { maxChunks?: number; deadlineAt?: number; retries?: number } = {},
): Promise<BundleCrawl> {
  const maxChunks = opts.maxChunks ?? 400
  const retries = opts.retries ?? 2
  const deadlineAt = opts.deadlineAt ?? Number.POSITIVE_INFINITY

  const seen = new Set<string>()
  const queue: string[] = []
  const add = (p: string) => {
    const path = toAssetPath(p)
    if (path && path.endsWith('.js') && !seen.has(path)) { seen.add(path); queue.push(path) }
  }
  for (const m of rootHtml.matchAll(ASSET_RE)) add(m[1])

  const bodies = new Map<string, string>()
  const absent: Array<{ path: string; status: number }> = []
  const indeterminate: Array<{ path: string; reason: string }> = []
  let attempted = 0
  let hitMaxChunks = false

  while (queue.length && Date.now() < deadlineAt) {
    if (attempted >= maxChunks) { hitMaxChunks = true; break }
    const path = queue.shift() as string
    attempted++

    let outcome: ChunkOutcome = { kind: 'indeterminate', reason: 'never attempted' }
    for (let attempt = 0; attempt <= retries; attempt++) {
      try { outcome = await fetchChunk(path) } catch (e) {
        outcome = { kind: 'indeterminate', reason: (e as Error)?.message ?? String(e) }
      }
      if (outcome.kind !== 'indeterminate') break
    }

    if (outcome.kind === 'ok') {
      bodies.set(path, outcome.body)
      for (const m of outcome.body.matchAll(ASSET_RE)) add(m[1])
    } else if (outcome.kind === 'absent') {
      absent.push({ path, status: outcome.status })
    } else {
      indeterminate.push({ path, reason: outcome.reason })
    }
  }

  return {
    bodies, discovered: [...seen], attempted, absent, indeterminate,
    queueDrained: queue.length === 0, hitMaxChunks,
  }
}

/**
 * The live fetcher. The ONLY place the answer/no-answer split is decided.
 *
 * 404/410 is the server stating the asset does not exist — a phantom minted by the
 * deliberately-loose ASSET_RE, and it can hide nothing. Every other non-OK (5xx,
 * 429, a proxy hiccup) and every throw is the absence of an answer about a chunk
 * that may well exist and may carry the control.
 */
export const makeHttpChunkFetcher = (origin: string): ChunkFetcher => async (path) => {
  try {
    const r = await fetch(`${origin}${path}`, { cache: 'no-store' })
    if (r.status === 404 || r.status === 410) return { kind: 'absent', status: r.status }
    if (!r.ok) return { kind: 'indeterminate', reason: `HTTP ${r.status}` }
    return { kind: 'ok', body: await r.text() }
  } catch (e) {
    return { kind: 'indeterminate', reason: (e as Error)?.message ?? String(e) }
  }
}

/**
 * The controls. MULTIPLE, deliberately: a single-occurrence needle is one refactor
 * away from silence, which is precisely how E5 came to report blindness.
 *
 * `minChunks` are floors with headroom, not mirrors of a measurement. Measured on
 * 5c449852: v5_handler_facts=1, run_analysis=5, scenarios=15. A floor that trips
 * says the BUNDLE moved and the control needs re-pinning — and says so in those
 * words, so the next rename fails loud instead of vaguely.
 */
export const BUNDLE_CONTROLS: ReadonlyArray<{ term: string; minChunks: number; why: string }> = [
  { term: 'v5_handler_facts', minChunks: 1, why: 'the persisted-run table name; one call site, deep in the graph — proves the crawl DESCENDED' },
  { term: 'run_analysis', minChunks: 3, why: 'the fact_type discriminator; several chunks — proves breadth, not just one lucky hit' },
  { term: 'scenarios', minChunks: 8, why: 'the scenario route/BFF segment; broadly spelled — a floor here catches a half-crawl' },
]

/**
 * The CONTRAST control. Absence is proven only when the target reads zero AND a
 * term expected to be present reads non-zero IN THE SAME SWEEP — and a matcher that
 * matches everything is caught only by a term that must match nothing.
 */
export const BUNDLE_CONTRAST = 'olumi_contrast_sentinel_never_present_in_any_bundle'

export interface ControlReport { term: string; chunks: string[] }

/**
 * Integrity FIRST, controls SECOND — and that order is the fix.
 *
 * Asking "did the control fire?" before "was the crawl complete?" is what produced
 * a blindness verdict for a dropped fetch. A control can only be judged stale once
 * the crawl that failed to find it is known to have been sound.
 */
export function assertCrawlIntegrity(crawl: BundleCrawl): void {
  if (crawl.indeterminate.length > 0) {
    const named = crawl.indeterminate.map((f) => `${f.path} (${f.reason})`).join('; ')
    throw new Error(
      `[core] BUNDLE CRAWL INCOMPLETE — ${crawl.indeterminate.length} chunk(s) could not be read ` +
      `after retries: ${named}. This is NOT a stale control and NOT an absence: an unread chunk is ` +
      `never parsed, so every chunk it alone references is never discovered, and a pruned subtree is ` +
      `indistinguishable from a subtree that was never there. NO presence or absence claim may be ` +
      `made from this crawl. (Measured 2026-08-29: losing one 1.88 MB chunk this way took discovery ` +
      `from 83 to 75 and silently removed the only chunk carrying the positive control.)`,
    )
  }
  if (!crawl.queueDrained) {
    throw new Error(
      `[core] BUNDLE CRAWL CUT SHORT: ${crawl.attempted} chunks attempted, ${crawl.discovered.length} ` +
      `discovered, and the queue had NOT drained` +
      `${crawl.hitMaxChunks ? ' (hit the maxChunks cap)' : ' (hit the time deadline)'}. A crawl that ` +
      `stopped early has seen an unknown fraction of the bundle, so no absence claim may be made.`,
    )
  }
  if (crawl.discovered.length <= 1) {
    throw new Error(
      `[core] BUNDLE CRAWL DISCOVERED ${crawl.discovered.length} CHUNK(S): the asset regex is matching ` +
      `nothing beyond the entry, which is the leading-slash bug this crawl was written to survive. ` +
      `Discovered: ${crawl.discovered.join(', ') || '(none)'}.`,
    )
  }
}

/**
 * Controls, judged only AFTER integrity. Every failure here names itself as a STALE
 * CONTROL rather than as blindness, because integrity has already been established.
 */
export function assertControlsFired(crawl: BundleCrawl): ControlReport[] {
  const bodies = [...crawl.bodies.entries()]

  const contrastHits = bodies.filter(([, b]) => b.includes(BUNDLE_CONTRAST)).map(([p]) => p)
  if (contrastHits.length > 0) {
    throw new Error(
      `[core] BUNDLE CRAWL CONTRAST CONTROL FIRED in ${contrastHits.join(', ')}: the sweep matched a ` +
      `sentinel that cannot exist in any build, so it is not discriminating and its positive hits ` +
      `prove nothing.`,
    )
  }

  const reports: ControlReport[] = []
  const stale: string[] = []
  for (const c of BUNDLE_CONTROLS) {
    const chunks = bodies.filter(([, b]) => b.includes(c.term)).map(([p]) => p)
    reports.push({ term: c.term, chunks })
    if (chunks.length < c.minChunks) {
      stale.push(`"${c.term}" in ${chunks.length} chunk(s), floor ${c.minChunks} — ${c.why}`)
    }
  }

  if (stale.length > 0) {
    throw new Error(
      `[core] BUNDLE CRAWL CONTROL IS STALE, NOT BLIND. The crawl was COMPLETE — ` +
      `${crawl.attempted} chunks attempted, ${crawl.discovered.length} discovered, ` +
      `${crawl.bodies.size} read, 0 unreadable, queue drained` +
      `${crawl.absent.length ? `, ${crawl.absent.length} definitively absent (${crawl.absent.map((a) => `${a.path} ${a.status}`).join(', ')})` : ''}` +
      ` — and yet these controls did not reach their floor:\n  ${stale.join('\n  ')}\n` +
      `A complete crawl that cannot find its own control means the BUNDLE MOVED, not that the crawler ` +
      `is broken. Re-derive each term against the deployed bundle and re-pin BUNDLE_CONTROLS in this ` +
      `file. Do NOT lower a floor to make this pass without first confirming the term is genuinely ` +
      `still spelled in the build.`,
    )
  }
  return reports
}

