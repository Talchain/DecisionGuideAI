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
 * ── ⚠⚠ WHY EVERY WRITE RE-READS ──────────────────────────────────────────
 * An independent review of PR #1272 faulted a store that read its map once at
 * module init and wrote the whole map back on every save. **A `storage` event
 * listener does NOT fix that** — it is delivered only to OTHER tabs and only
 * AFTER the write, so the losing tab learns about the loss it already caused.
 * The only structural answer is **read-modify-write against live storage**,
 * which is what `record()` does. Per-scenario keys then make a clobber between
 * DIFFERENT scenarios impossible as well.
 *
 * ── ⚠ WHY THE RUN IS STAMPED ─────────────────────────────────────────────
 * A dissent written against one analysis, shown beside a later one with no
 * caveat, is a claim the user never made. The `disputed` history event carries
 * **no run identity at all** today, so the stamp is taken here at the moment
 * the words are composed, from the same `analysisHash` the call site already
 * holds. Consumers compare it and caveat; they must never assert "changed"
 * from an ABSENCE of a stamp, which is what an older record has.
 */
import { getCurrentScenarioId } from '../store/scenarios'

const KEY_PREFIX = 'olumi.dissent.v1.'

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

function keyFor(scenarioId: string | null): string | null {
  return scenarioId ? `${KEY_PREFIX}${scenarioId}` : null
}

function read(key: string): Bucket {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed?.version === 1 && parsed.records ? (parsed.records as Bucket) : {}
  } catch {
    return {}
  }
}

/**
 * Record one disagreement durably.
 *
 * ⚠ READ-MODIFY-WRITE, deliberately. It re-reads live storage immediately
 * before writing and merges, so a second tab on the SAME scenario cannot lose
 * the first tab's entry. Returns whether the durable write landed, so the
 * caller can tell the truth about what happened rather than assume.
 */
export function recordDissent(
  recommendationId: string,
  reason: string,
  analysisHash?: string | null,
  now: number = Date.now(),
): boolean {
  const trimmed = reason.trim()
  // An empty reason is a no-op here as it is in `strengthenStore.dispute` — a
  // recorded disagreement with no stated ground is the same silence in a
  // different costume.
  if (!trimmed) return false
  const key = keyFor(getCurrentScenarioId())
  // No scenario id means no durable home. The caller keeps its in-memory and
  // session copy either way; inventing a global bucket would mix unrelated
  // boards and outlive the thing it describes.
  if (!key) return false
  try {
    const merged: Bucket = { ...read(key), [recommendationId]: { reason: trimmed, at: now, ...(analysisHash ? { analysisHash } : {}) } }
    localStorage.setItem(key, JSON.stringify({ version: 1, records: merged }))
    return true
  } catch {
    return false
  }
}

/** Every durable dissent for the scenario on screen. `{}` when there is none. */
export function readDissent(): Bucket {
  const key = keyFor(getCurrentScenarioId())
  if (!key) return {}
  try {
    return read(key)
  } catch {
    return {}
  }
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
 * guests, and nothing in the product does: no product-data key is cleared by
 * any sign-out path today. This joins an existing gap rather than closing it.
 */
export function clearDurableDissent(): void {
  try {
    const doomed: string[] = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k && k.startsWith(KEY_PREFIX)) doomed.push(k)
    }
    for (const k of doomed) localStorage.removeItem(k)
  } catch {
    // Storage unavailable — there is nothing persisted to clear.
  }
}
