/**
 * T2b: resolve the seed the ENGINE reports it used — the receipt.
 *
 * Receipts fail closed (T2): no real value → null, never a fabricated 0. This
 * is the WRITE-path twin of hydrateAnalysis.ts:111-115 and must stay in step
 * with it, because that function PREFERS the value this one persists
 * (`provenance?.seed_used ?? ...`). Any fabrication here is laundered into a
 * real-looking receipt on the next page load.
 *
 * The pattern this replaces fabricated a 0 three ways:
 *   const seedUsed = successResult.meta?.seed_used
 *     ? (parseInt(successResult.meta.seed_used, 10) || 0)   // 'abc' → NaN → 0
 *     : (seed ?? 0)                                          // no echo → unconfirmed
 * plus a truthiness gate that made a numeric engine seed of 0 fall through to
 * the requested seed.
 *
 * Note this deliberately does NOT fall back to the seed we REQUESTED. The
 * requested seed is a different fact ("what we asked for"); reporting it as
 * seed_used claims the engine confirmed something it never said. Callers that
 * need a run identity (e.g. the graph hash) use the requested seed explicitly.
 *
 * WHY ITS OWN MODULE (2026-07-25): it lived inside `useV2Run.ts`, a large hook
 * module that a dozen specs replace wholesale with a hand-listed `vi.mock`
 * factory. The moment a second caller (`buildMethodCard`) imported this
 * function from there, every one of those mocks threw at render — the
 * hand-maintained-mirror defect, arriving on schedule. A pure leaf module is
 * importable from anywhere, drags no store/adapter graph into the importer's
 * chunk, and cannot be blanked by someone else's mock of a different module.
 * `useV2Run` re-exports it, so existing importers are untouched and there is
 * still exactly ONE implementation.
 */
export function resolveSeedUsed(metaSeedUsed: unknown): number | null {
  if (metaSeedUsed == null) return null
  const parsed = Number.parseInt(String(metaSeedUsed), 10)
  return Number.isFinite(parsed) ? parsed : null
}
