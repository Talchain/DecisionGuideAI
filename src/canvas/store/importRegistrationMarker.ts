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

/** Test/teardown helper — a real session drops the record when the tab closes. */
export function clearImportRegistrationMarkers(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    /* see readMarkers */
  }
}

/** Diagnostics only (debug bundle / tests). Never user copy. */
export function __readImportRegistrationMarkers(): string[] {
  return readMarkers()
}
