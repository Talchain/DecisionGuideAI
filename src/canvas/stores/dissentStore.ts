/**
 * dissentStore — the user's own words on why a coaching finding is wrong,
 * kept beyond the browser session.
 *
 * ⭐⭐ WHY THIS EXISTS. WITNESSED on deployed staging `811c93b1`: a reader
 * presses "I disagree" on a finding, types why, presses "Record this". It
 * renders beside the finding, lands in `sessionStorage` via `strengthenStore`,
 * and `localStorage` holds nothing. A tab-by-tab sweep found the text on the
 * Reasoning tab only. **The most human act this product supports — a person
 * telling the system it is wrong and saying why — survived nothing.**
 *
 * ── ⚠⚠ WHY IT IS A SEPARATE STORE AND NOT A FLAG ON `strengthenStore` ──────
 * The obvious move is to make `strengthenStore` durable. **Derived at
 * staging's bytes, that is out of scope and would ship a state machine nobody
 * on this surface drives.** `dispute()` has exactly ONE caller —
 * `StrengthenTheReasoning.tsx:378`, the Reasoning tab. The lifecycle statuses
 * beside it (`dismiss`, `markAllStale`, `restoreDismissed`) are written
 * exclusively by `StrengthenContainer.tsx` on the **Analysis tab, which Paul
 * has ruled out of scope**. Making those permanent would outlive every session
 * that produced them, on a surface this lane may not touch.
 *
 * So: the dissent becomes durable. The lifecycle stays exactly as it is.
 *
 * Each scenario/finding has its own key. Whole-bucket read/modify/write is
 * not atomic between tabs, even when both read immediately before writing.
 * Distinct findings cannot overwrite each other; for the SAME finding, the
 * last completed storage write deliberately replaces the earlier words.
 * This is browser-local editing, not collaborative text merging.
 *
 * ── ⚠ WHY THE RUN IS STAMPED ─────────────────────────────────────────────
 * A dissent written against one analysis, shown beside a later one with no
 * caveat, is a claim the user never made. The `disputed` history event carries
 * **no run identity at all** today, so the stamp is taken here at the moment
 * the words are composed, from the same `analysisHash` the call site already
 * holds. Consumers compare it and caveat; they must never assert "changed"
 * from an ABSENCE of a stamp, which is what an older record has.
 */
const LEGACY_PREFIX = 'olumi.dissent.v1.'
const KEY_PREFIX = 'olumi.dissent.v2.'

export interface DissentRecord {
  /** The user's words, verbatim and trimmed. Never rewritten. */
  reason: string
  at: number
  /**
   * The analysis this was written against, or `undefined` when it could not be
   * established. ⚠ `undefined` means UNKNOWN, never "unchanged" — see
   * `dissentCurrency`.
   */
  analysisHash?: string
}

type Bucket = Record<string, DissentRecord>

function scenarioPrefix(scenarioId: string): string {
  return `${KEY_PREFIX}${encodeURIComponent(scenarioId)}:`
}

function recordKey(scenarioId: string, recommendationId: string): string {
  return `${scenarioPrefix(scenarioId)}${encodeURIComponent(recommendationId)}`
}

function isRecord(value: unknown): value is DissentRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<DissentRecord>
  return typeof record.reason === 'string' && record.reason.trim().length > 0 &&
    typeof record.at === 'number' && Number.isFinite(record.at) &&
    (record.analysisHash === undefined || typeof record.analysisHash === 'string')
}

/** Preserve existing browser records without rewriting an entire legacy bucket. */
function readLegacy(scenarioId: string): Bucket {
  const records: Bucket = Object.create(null)
  try {
    const raw = localStorage.getItem(`${LEGACY_PREFIX}${scenarioId}`)
    if (!raw) return records
    const parsed = JSON.parse(raw)
    if (parsed?.version === 1 && parsed.records && typeof parsed.records === 'object') {
      for (const [id, record] of Object.entries(parsed.records)) {
        if (isRecord(record)) records[id] = record
      }
    }
  } catch {
    // Unreadable legacy bytes are not rewritten or asserted as a valid record.
  }
  return records
}

/**
 * Record one disagreement durably.
 *
 * The caller supplies the displayed scenario, never the shared last-opened
 * pointer. Independent record keys prevent cross-finding lost updates.
 * Returns false on storage failure; the caller must keep the unsaved words.
 */
export function recordDissent(
  scenarioId: string | null,
  recommendationId: string,
  reason: string,
  analysisHash?: string | null,
  now: number = Date.now(),
): boolean {
  const trimmed = reason.trim()
  // An empty reason is a no-op here as it is in `strengthenStore.dispute` — a
  // recorded disagreement with no stated ground is the same silence in a
  // different costume.
  if (!trimmed || !recommendationId || !Number.isFinite(now)) return false
  // No scenario id means no durable home. The caller keeps its in-memory and
  // session copy either way; inventing a global bucket would mix unrelated
  // boards and outlive the thing it describes.
  if (!scenarioId) return false
  try {
    const record: DissentRecord = { reason: trimmed, at: now, ...(analysisHash ? { analysisHash } : {}) }
    localStorage.setItem(recordKey(scenarioId, recommendationId), JSON.stringify({
      version: 2, scenarioId, recommendationId, record,
    }))
    return true
  } catch {
    return false
  }
}

/** Every durable dissent for the scenario on screen. `{}` when there is none. */
export function readDissent(scenarioId: string | null): Bucket {
  if (!scenarioId) return {}
  const records = readLegacy(scenarioId)
  try {
    const prefix = scenarioPrefix(scenarioId)
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key?.startsWith(prefix)) continue
      try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? 'null')
        if (parsed?.version === 2 && parsed.scenarioId === scenarioId &&
            typeof parsed.recommendationId === 'string' &&
            key === recordKey(scenarioId, parsed.recommendationId) && isRecord(parsed.record)) {
          records[parsed.recommendationId] = parsed.record
        }
      } catch {
        // One damaged record must not erase unrelated valid records.
      }
    }
  } catch {
    // Storage enumeration can be unavailable. Do not claim a successful write.
  }
  return records
}

/**
 * Three states, and the third is the point.
 *
 * ⚠ NEVER ASSERT "changed" FROM AN ABSENCE. A record written before the stamp
 * existed, or on a run whose hash could not be established, is `unknown` — not
 * stale. Saying "your model has changed" about a record we cannot place is
 * inventing a fact in the surface whose whole job is not to.
 */
export type DissentCurrency = 'current' | 'changed' | 'unknown'

export function dissentCurrency(
  record: DissentRecord | undefined,
  currentAnalysisHash: string | null | undefined,
): DissentCurrency {
  if (!record) return 'unknown'
  if (!record.analysisHash || !currentAnalysisHash) return 'unknown'
  return record.analysisHash === currentAnalysisHash ? 'current' : 'changed'
}

/**
 * Remove every durable dissent in this browser profile.
 *
 * ⚠ SWEEPS BY PREFIX, not by a hand-listed key — keys are per-scenario and
 * unbounded, so a list would miss every scenario created after it was written
 * (CLAUDE.md trap 12).
 *
 * ⚠⚠ AND AN HONEST LIMIT, BECAUSE THE OBVIOUS CLAIM WOULD BE FALSE.
 * `AuthContext.signOut` opens `if (!session) return`, so on the deployed guest
 * posture — the DEFAULT — sign-out never runs and this is never called. It
 * protects a signed-in user on a shared machine. It does **not** separate two
 * guests in one browser profile. The existing auth cleanup also invokes this
 * on some session-expiry paths. No server/team persistence is implied.
 */
export function clearDurableDissent(): void {
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k && (k.startsWith(KEY_PREFIX) || k.startsWith(LEGACY_PREFIX))) doomed.push(k)
    }
    for (const k of doomed) localStorage.removeItem(k)
  } catch {
    // Storage unavailable — there is nothing persisted to clear.
  }
}
