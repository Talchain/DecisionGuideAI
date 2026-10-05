/**
 * ⭐ GAP-3: THE PRE-THIN PURGE (DL ruling after Acceptance's #2511 witness W1, #87 5997867420; HIGH).
 *
 * #2511 stopped a signed-in page writing or reading a local model. It did not delete the copies written BEFORE it
 * shipped: Acceptance found 21 `olumi-canvas-autosave*` keys holding whole models in a signed-in browser after #2511.
 * No signed-in reader returns them (`loadAutosave`, `loadVersions`, `listSnapshots`, `loadSnapshot` and the scenario
 * list's graph are all empty on a thin page), so the only reader left is a later GUEST page in the same browser.
 * Before the first identity boundary there is no epoch (`scenarios.IDENTITY_EPOCH_KEY`), so every one of those slots
 * counts as the guest's own: a session that ends without a sign-out (a refresh token that fails while the browser is
 * closed runs no boundary) hands A's model to whoever opens Olumi next as a guest.
 *
 * So the first time a page is signed in, the copies a signed-in page can no longer read are removed, ONCE PER IDENTITY
 * EPOCH: a second load under the same epoch does nothing, and the next boundary (which writes a fresh epoch) re-arms it
 * for whoever signs in after. Called only from `isThinClientSession()`, at the moment it first answers true.
 *
 * WHAT IS NOT REMOVED, and why each one stays:
 *   · run history (`olumi-canvas-run-history`): the signed-in Results/Compare archive, read and written on thin pages
 *     (`handleOpenCompare` needs two local runs). Removing it would delete signed-in work. Sign-out sweeps it.
 *   · the pointer (`olumi-canvas-current-scenario-id`) and the guest-copy keys (`lib/pendingGuestCopy.ts`): ids only,
 *     and the inputs `GuestCopyOnSignIn` reads to copy a guest's decision into the new account (CEE #2493).
 *   · the layout (`olumi-thin-layout:*`): positions by node id, the one thing a signed-in browser keeps.
 *     Sign-out removes it (`userScopedState.USER_SCOPED_STORAGE_PREFIXES`).
 *   · `canvas-storage` (`persist.saveState`): written by DEV builds only (`ReactFlowGraph`'s persistence subscriber
 *     returns under `import.meta.env.PROD`), and a production canvas boot returns before `loadState`, so no deployed
 *     guest page reads it. Its one deployed reader is the SIGNED-IN draft-import offer (`lib/loginDraftImport.ts`,
 *     behind `requireLogin`), whose draft exists only in this browser: removing it could lose work, and protects no one
 *     (Codex, #2525 r1).
 *   · a scenario-list entry's id, name and other metadata: only its graph is emptied, exactly as a thin write
 *     (`scenarios.saveScenarios`) already stores it.
 *
 * Every key here is a literal, not an import, so the boot predicate pulls in no store: each is pinned to its writer's
 * own constant or writer by `__tests__/thinClient.preThinPurge.spec.ts`.
 */
import { buildPersistedGraph } from '../utils/persistedGraph'

/** The epoch this browser was last purged under. Never removed by a boundary: the epoch moving is what re-arms it. */
export const PRE_THIN_PURGE_MARKER_KEY = 'olumi-thin-purged-epoch.v1'
/** = `scenarios.IDENTITY_EPOCH_KEY`. */
export const PRE_THIN_PURGE_EPOCH_KEY = 'olumi-canvas-identity-epoch'
/** The marker's value before the first identity boundary, when there is no epoch. */
const NO_EPOCH_YET = 'before-first-boundary'

/**
 * Whole-model copies a thin page never reads and a later guest page restores: the main autosave slot
 * (`scenarios.saveAutosave`) and the local version list (`versionStorage.VERSIONS_STORAGE_KEY`).
 */
export const PRE_THIN_MODEL_KEYS = ['olumi-canvas-autosave', 'olumi-canvas-model-versions-v1'] as const
/** One key per scenario or snapshot: a cold-load deep link's preserved slots (`scenarios.keyedAutosaveKey`), and
 * manual snapshots with their `-name` keys (`persist.saveSnapshot`). */
export const PRE_THIN_MODEL_PREFIXES = ['olumi-canvas-autosave:', 'canvas-snapshot-'] as const
/** The scenario list (`scenarios.STORAGE_KEY`): its entries stay, their graphs go. */
export const PRE_THIN_SCENARIO_LIST_KEY = 'olumi-canvas-scenarios'

export interface PreThinPurgeResult {
  /** False when this epoch was already purged, or browser storage could not be read. */
  readonly ran: boolean
  readonly removed: readonly string[]
  /** Scenario-list entries whose graph was emptied. */
  readonly strippedEntries: number
}

const NOT_RUN: PreThinPurgeResult = { ran: false, removed: [], strippedEntries: 0 }

function hasGraphContent(graph: unknown): boolean {
  if (!graph || typeof graph !== 'object') return false
  const { nodes, edges, goal_constraints: constraints } = graph as Record<string, unknown>
  return (Array.isArray(nodes) && nodes.length > 0)
    || (Array.isArray(edges) && edges.length > 0)
    || (Array.isArray(constraints) && constraints.length > 0)
}

/**
 * Empties every list entry's graph in place. `complete` is false only when the list could not be read or rewritten (the
 * next signed-in page retries); a list no reader can parse is left exactly as it is, and counts as done.
 */
function stripScenarioListGraphs(): { stripped: number; complete: boolean } {
  let raw: string | null
  try {
    raw = localStorage.getItem(PRE_THIN_SCENARIO_LIST_KEY)
  } catch {
    return { stripped: 0, complete: false }
  }
  if (!raw) return { stripped: 0, complete: true }
  let entries: unknown
  try {
    entries = JSON.parse(raw)
  } catch {
    return { stripped: 0, complete: true }
  }
  if (!Array.isArray(entries)) return { stripped: 0, complete: true }
  let stripped = 0
  const next = entries.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry
    const record = entry as Record<string, unknown>
    if (!hasGraphContent(record.graph)) return entry
    stripped += 1
    return { ...record, graph: buildPersistedGraph([], [], null) }
  })
  if (stripped === 0) return { stripped: 0, complete: true }
  try {
    localStorage.setItem(PRE_THIN_SCENARIO_LIST_KEY, JSON.stringify(next))
  } catch {
    return { stripped: 0, complete: false }
  }
  return { stripped, complete: true }
}

/**
 * Removes this browser's pre-thin model copies, once per identity epoch. The caller has already established that the
 * page is signed in. Never throws: each removal stands alone, so one refused removal leaves the others done. The marker
 * is written only after a COMPLETE run: a refused removal, a refused list rewrite or an interrupted run leaves it
 * unwritten, so the next signed-in page tries again (Codex, #2525 r1: a marker over a surviving copy would keep it for
 * that whole epoch).
 */
export function purgePreThinModelCopies(): PreThinPurgeResult {
  let epochMark: string
  try {
    if (typeof localStorage === 'undefined') return NOT_RUN
    const epoch = localStorage.getItem(PRE_THIN_PURGE_EPOCH_KEY)
    epochMark = epoch && epoch.length > 0 ? epoch : NO_EPOCH_YET
    if (localStorage.getItem(PRE_THIN_PURGE_MARKER_KEY) === epochMark) return NOT_RUN
  } catch {
    // Storage refused the read: whose epoch this is cannot be known, so nothing is touched.
    return NOT_RUN
  }

  // Enumerate first, then remove: a removal neither shifts the index nor stops the sweep.
  let complete = true
  const targets: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key === null) continue
      if ((PRE_THIN_MODEL_KEYS as readonly string[]).includes(key)
        || PRE_THIN_MODEL_PREFIXES.some((prefix) => key.startsWith(prefix))) targets.push(key)
    }
  } catch {
    complete = false // storage can be unavailable
  }

  const removed: string[] = []
  for (const key of targets) {
    try {
      localStorage.removeItem(key)
      removed.push(key)
    } catch {
      complete = false // the sweep goes on; the marker waits
    }
  }
  const list = stripScenarioListGraphs()
  if (!list.complete) complete = false

  if (complete) {
    try {
      localStorage.setItem(PRE_THIN_PURGE_MARKER_KEY, epochMark)
    } catch { /* the next signed-in page repeats the purge */ }
  }
  return { ran: true, removed, strippedEntries: list.stripped }
}
