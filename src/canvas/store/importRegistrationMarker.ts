/**
 * Import-registration marker — interim 2.467 (P0 trust).
 *
 * Records which graph identities entered the canvas via a local IMPORT and have
 * therefore never been seen by the server, in the SAME STORAGE SCOPE as the
 * artefact they defend.
 * `store.importPendingServerRegistration` is DERIVED from this at every
 * graph-replacement site; it is never mirrored across a hand-maintained list of
 * "release sites".
 *
 * WHY DERIVED, AND WHY sessionStorage (both learned from an adversarial review
 * of the first cut of this mitigation):
 *
 *  1. The first cut used an in-memory boolean cleared at six named sites, on
 *     the stated premise that those sites replace the canvas "with a
 *     server-known graph". TWO OF THEM DO NOT. `hydrateGraphSlice`'s live
 *     callers pass the **localStorage autosave** (ReactFlowGraph's init
 *     effect), and `loadScenario` reads `scenarios.getScenario` — also
 *     localStorage. `useAutosave` debounces 500 ms on a graph-hash dirty
 *     check, so ~0.5 s after an import the IMPORTED graph is in localStorage;
 *     a reload re-installs it through `hydrateGraphSlice` with the same
 *     `scenario_id`, the boolean cleared, and one Rerun re-attached
 *     "Analysis reflects the current model." to CEE's pre-import graph — the
 *     witnessed FAIL frame, restored. **A marker that dies with the page cannot
 *     defend a graph that survives the page.**
 *
 *  1b. That governing sentence applies ONE LEVEL UP, and the second cut of this
 *     module got it wrong too. `sessionStorage` dies with the TAB — but the
 *     autosave it defends is `localStorage`, which does not. A fresh tab boots
 *     the imported graph from that autosave (same `currentScenarioId`), finds
 *     no marker, derives `false`, and one Rerun restores the identical FAIL
 *     frame. The marker therefore lives in `localStorage`: **the same storage
 *     scope as the artefact it defends.** Any future change to where the
 *     imported graph is persisted must move this marker with it.
 *
 *  2. Deriving the flag from the graph being installed removes the defect
 *     CLASS rather than one instance. A hand-maintained release list is the
 *     dominant defect here: three sites in the first cut had no test, and a
 *     mutation run proved two of them could be deleted silently. With
 *     derivation there is ONE rule to read at the sites where the installed
 *     graph VARIES — `hydrateGraphSlice`, `loadScenario`, `undoDraft`.
 *     (Derivation proves agreement, never completeness — so every replacement
 *     site still carries its own test and its own mutant.)
 *
 *     ⚠ A new graph-replacement site that forgets to set this field does NOT
 *     "inherit a safe default": Zustand's partial `set` RETAINS the current
 *     value, so it keeps whatever the previous graph left behind — over-holding
 *     if it was true, and serving the P0 if it was false. There is no safe
 *     default here; a new site must set the field explicitly.
 *
 * Identity is STRUCTURAL (node ids + edge endpoint pairs) via the established
 * `identityFromCanvasGraph` helper — deliberately NOT a second graph-hash
 * notion, and deliberately position- and label-independent: layout moves
 * positions after a hydrate, and a relabel leaves the graph just as
 * unregistered as it was. Both make the marker MATCH more often, i.e. hold the
 * cannot-confirm posture for longer — the fail-safe direction.
 *
 * TWO DISCLOSED WEAKNESSES — both fail to the PRE-MITIGATION posture, i.e. to
 * the P0, and neither is defended here because defending them is the 2.467
 * registration train's job:
 *
 *  - **Storage unavailable** (private browsing, storage disabled, quota
 *    exceeded, corrupt record): `readMarkers` returns `[]` and `writeMarkers`
 *    silently drops the write, so the hold never arms and the false
 *    affirmative is reachable exactly as it was before this mitigation. It
 *    fails SILENTLY and deliberately — throwing inside a store action would
 *    break the import itself — but silent-and-unprotected is a real gap, not a
 *    graceful degradation.
 *  - **`MAX_IDENTITIES` eviction**: the record keeps the most recent 50
 *    identities and silently evicts the oldest. A session that imports more
 *    than 50 distinct graphs loses the hold on the earliest ones.
 *
 * Superseded by the atomic import→reset→registration train (ROADMAP 2.467):
 * when a real registration handshake exists, the server's own acknowledgement
 * replaces this marker. Delete the module then.
 */
import { identityFromCanvasGraph } from '../utils/graphIdentity'

const STORAGE_KEY = 'olumi.import.pendingServerRegistration.v1'
/** Bounded so a session that imports repeatedly cannot grow the record without limit. */
const MAX_IDENTITIES = 50

type GraphNodes = ReadonlyArray<{ id?: unknown }> | undefined
type GraphEdges = ReadonlyArray<{ source?: unknown; target?: unknown }> | undefined

/**
 * Structural digest of a graph, or `null` when there is nothing to identify.
 *
 * An EMPTY graph returns null on purpose: `resetCanvas` and `reset` install one,
 * and an empty canvas carries no analysis that could be mis-affirmed. Without
 * this, importing an empty graph would make every later reset match the marker
 * and hold forever.
 */
export function graphImportDigest(nodes: GraphNodes, edges: GraphEdges): string | null {
  const identity = identityFromCanvasGraph(nodes, edges)
  if (identity.nodeIds.length === 0) return null
  // LOAD-BEARING SORT — pinned by its own test. A hydrate or a persistence
  // round-trip can reorder nodes/edges without changing the model; an
  // order-sensitive digest would then MISS the match and drop the hold, which
  // is the P0. Order-insensitivity is the whole reason the marker survives the
  // localStorage round-trip that blocker A turns on.
  const nodePart = [...identity.nodeIds].sort().join(',')
  const edgePart = [...identity.edgePairs].sort().join(',')
  return `n:${nodePart}|e:${edgePart}`
}

function readMarkers(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    // No sessionStorage (SSR, privacy mode) or corrupt record. Fail to the
    // pre-mitigation posture rather than throwing inside a store action.
    return []
  }
}

function writeMarkers(next: string[]): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next.slice(-MAX_IDENTITIES)))
  } catch {
    /* storage unavailable or full — see readMarkers */
  }
}

/** Record that this graph entered the canvas by import and is unregistered. */
export function markGraphImported(nodes: GraphNodes, edges: GraphEdges): void {
  const digest = graphImportDigest(nodes, edges)
  if (digest === null) return
  const markers = readMarkers()
  if (markers.includes(digest)) return
  writeMarkers([...markers, digest])
}

/**
 * THE derivation. True iff the graph being installed is one this session
 * imported and the server has never seen.
 */
export function isGraphPendingImportRegistration(nodes: GraphNodes, edges: GraphEdges): boolean {
  const digest = graphImportDigest(nodes, edges)
  if (digest === null) return false
  return readMarkers().includes(digest)
}

/**
 * THE RELEASE — ROADMAP 2.467's registration train.
 *
 * Called with the graph the SERVER has just acknowledged holding. The hold is
 * dropped for that structural identity and no other, so a session that imported
 * two graphs and registered one keeps holding the other.
 *
 * ⚠ CALL THIS ONLY ON A SERVER ACKNOWLEDGEMENT. The whole point of the marker
 *   is that a graph the server has never seen cannot be affirmed as current;
 *   releasing on anything weaker than "CEE told us it stored this" re-opens the
 *   P0. An unreadable answer, a transport failure and a 200 whose body did not
 *   carry the registration envelope are all NOT acknowledgements.
 *
 * ⚠ IDENTITY IS STRUCTURAL, so the graph passed here must be the one that was
 *   REGISTERED, not a later edit of it. Passing a mutated graph would release
 *   nothing (the digest would not match) — which fails in the SAFE direction
 *   (still holding), but silently, so callers snapshot before they send.
 *
 * Returns whether a marker was actually removed, so a caller can tell a real
 * release from a no-op instead of assuming one.
 */
export function releaseImportRegistration(nodes: GraphNodes, edges: GraphEdges): boolean {
  const digest = graphImportDigest(nodes, edges)
  if (digest === null) return false
  const markers = readMarkers()
  if (!markers.includes(digest)) return false
  writeMarkers(markers.filter((m) => m !== digest))
  return true
}

/**
 * ⭐ THE ACKNOWLEDGEMENT RECORD — POSITIVE evidence, and the polarity is the point.
 *
 * The pending-marker above answers "did this session import a graph the server
 * has not seen?". Absence of that marker was being read as "registered", which
 * is FALSE for the one case that matters: this module's own header records that
 * on private browsing, disabled storage, a corrupt record, quota exhaustion, or
 * eviction past MAX_IDENTITIES, `writeMarkers` silently drops the write. The
 * pending marker then never exists, and a hold derived from its absence
 * silently LIFTS — letting a graph CEE has never seen reach Run. That is the
 * pre-mitigation P0, reached through the mitigation.
 *
 * This record answers the other question — "has the server told us it holds
 * this exact graph?" — and it is the one a hold may safely be released on,
 * because losing it fails CLOSED: no record ⇒ no acknowledgement ⇒ still held.
 * The worst case is re-holding a graph that WAS registered, which costs the
 * user a redundant registration and never a false affirmation.
 *
 * Two records rather than one negated record, deliberately: "not pending" and
 * "acknowledged" are DIFFERENT QUESTIONS, and collapsing them into one boolean
 * is exactly how the release above came to mean something it could not support.
 */
const ACK_STORAGE_KEY = 'olumi.import.serverAcknowledged.v1'

function readAcks(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(ACK_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    // Unreadable storage yields NO acknowledgements, so every caller keeps
    // holding. This catch is the fail-closed direction, not a degradation.
    return []
  }
}

/**
 * Record that CEE acknowledged holding this exact graph.
 *
 * ⚠ Same rule as `releaseImportRegistration`: call ONLY on a real server
 *   acknowledgement. A 200 without the registration envelope, a transport
 *   failure and an unreadable body are all NOT acknowledgements.
 */
/**
 * ⭐ THE ACKNOWLEDGEMENT IDENTITY — SCENARIO + ANALYTICAL MODEL, not topology.
 *
 * ⚠ `graphImportDigest` IS THE WRONG KEY HERE AND USING IT WAS A REAL DEFECT.
 *   It carries only sorted node ids and edge endpoint pairs — no scenario, no
 *   values, no direction. Two independently reproduced admissions followed:
 *
 *     · Graph A (edge weight 0.2) is registered. While the adapter awaits its
 *       receipt the store is replaced by B — same scenario, same ids, same
 *       endpoints, weight 0.9 — and B stays pending. A's receipt resolves.
 *       One request happened, B is still 0.9, and B reads as ACKNOWLEDGED.
 *       A late callback confirmed a model the server never saw.
 *     · A is acknowledged normally, then the same topology is armed under a
 *       DIFFERENT scenario. That scenario's hold is already released without
 *       any receipt of its own.
 *
 *   Both are wrong-model / wrong-scenario admissions, and neither is a marker
 *   count problem — the key simply did not identify what was acknowledged.
 *
 * So the key is `scenarioId` plus an ANALYTICAL digest: the values a run
 * actually consumes (weight, direction, belief, node value), not just shape.
 * Layout, ordering and cosmetic fields stay excluded, so a re-layout or a
 * persistence round-trip still matches — the property the sorted digest was
 * chosen for in the first place.
 */
function analyticalDigest(
  scenarioId: string | null,
  nodes: GraphNodes,
  edges: GraphEdges,
): string | null {
  const topology = graphImportDigest(nodes, edges)
  if (topology === null) return null
  if (typeof scenarioId !== 'string' || scenarioId.length === 0) return null
  const readNum = (v: unknown): string => (typeof v === 'number' ? String(v) : '~')
  const nodeVals = (nodes ?? [])
    .map((n) => {
      const d = (n as { id?: unknown; data?: Record<string, unknown> }) ?? {}
      const data = d.data ?? {}
      return `${String(d.id)}=${readNum(data.value)}`
    })
    .sort()
    .join(',')
  const edgeVals = (edges ?? [])
    .map((e) => {
      const x = (e as { source?: unknown; target?: unknown; data?: Record<string, unknown> }) ?? {}
      const data = x.data ?? {}
      const dir = typeof data.direction === 'string' ? data.direction : '~'
      const belief = readNum(data.beliefExists ?? data.belief ?? data.confidence)
      return `${String(x.source)}->${String(x.target)}:w=${readNum(data.weight)}:d=${dir}:b=${belief}`
    })
    .sort()
    .join(',')
  return `s:${scenarioId}|${topology}|nv:${nodeVals}|ev:${edgeVals}`
}

/**
 * Do these two graphs represent the SAME analytical model? Scenario-free, so a
 * caller can ask the question about a snapshot without also asserting where it
 * lived. Used to stop an in-flight receipt confirming a replacement.
 */
export function isSameAnalyticalModel(
  aNodes: GraphNodes,
  aEdges: GraphEdges,
  bNodes: GraphNodes,
  bEdges: GraphEdges,
): boolean {
  const a = analyticalDigest('x', aNodes, aEdges)
  const b = analyticalDigest('x', bNodes, bEdges)
  return a !== null && a === b
}

/**
 * ⭐ IN-MEMORY AUTHORITY, WITH PERSISTENCE AS A CACHE — and the order matters.
 *
 * A prior cut recorded the acknowledgement ONLY in localStorage. Rejecting just
 * that one `setItem` with QuotaExceededError, while the real parser accepted a
 * genuine versioned 200, left the current model HELD after a successful server
 * acknowledgement — the product refusing to analyse a graph CEE demonstrably
 * holds. Persistence is an optimisation for the next page load; it is not the
 * authority for the model on screen right now.
 */
const memoryAcks = new Set<string>()

/**
 * ⚠ THE SUBSET THAT COULD NOT BE PERSISTED — and the distinction is the whole
 *   correctness argument, not bookkeeping.
 *
 * A plain in-memory cache is WRONG in one direction: once persistence has
 * SUCCEEDED, storage is the authority, and a record later removed or evicted
 * must re-hold. A cache that outlived that removal would silently keep
 * releasing a model whose acknowledgement is gone — the fail-open this whole
 * change exists to close, reintroduced one layer up.
 *
 * But memory MUST win when persistence never happened, or a quota refusal would
 * re-hold a model the server has just acknowledged.
 *
 * So: trust storage when the write landed; trust memory only for the keys whose
 * write did NOT land. Two different situations, two different answers.
 */
const unpersistedAcks = new Set<string>()

export function markGraphServerAcknowledged(
  scenarioId: string | null,
  nodes: GraphNodes,
  edges: GraphEdges,
): void {
  const key = analyticalDigest(scenarioId, nodes, edges)
  if (key === null) return
  // Memory FIRST, so a storage refusal cannot cost the current release.
  memoryAcks.add(key)
  const acks = readAcks()
  if (acks.includes(key)) {
    unpersistedAcks.delete(key)
    return
  }
  try {
    globalThis.localStorage?.setItem(
      ACK_STORAGE_KEY,
      JSON.stringify([...acks, key].slice(-MAX_IDENTITIES)),
    )
    // Landed: storage is now the authority for this key.
    unpersistedAcks.delete(key)
  } catch {
    // Did NOT land. Memory is the only authority for this key, and must stay
    // so — otherwise a quota refusal re-holds a model CEE just acknowledged.
    unpersistedAcks.add(key)
  }
}

/** Positive evidence that the server holds THIS scenario's current model. */
export function isGraphServerAcknowledged(
  scenarioId: string | null,
  nodes: GraphNodes,
  edges: GraphEdges,
): boolean {
  const key = analyticalDigest(scenarioId, nodes, edges)
  if (key === null) return false
  // Storage is the authority whenever the write landed, so a record that is
  // later removed or evicted correctly re-holds. Memory answers only for the
  // keys storage refused.
  return readAcks().includes(key) || unpersistedAcks.has(key)
}

/** Test/teardown helper — a real session drops the record when the tab closes. */
export function clearImportRegistrationMarkers(): void {
  memoryAcks.clear()
  unpersistedAcks.clear()
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY)
    globalThis.localStorage?.removeItem(ACK_STORAGE_KEY)
  } catch {
    /* see readMarkers */
  }
}

/** Diagnostics only (debug bundle / tests). Never user copy. */
export function __readImportRegistrationMarkers(): string[] {
  return readMarkers()
}
