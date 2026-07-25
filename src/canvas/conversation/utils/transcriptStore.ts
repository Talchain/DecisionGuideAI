/**
 * transcriptStore — local-first persistence of the conversation transcript.
 *
 * WHY THIS EXISTS (live defect, staging build `27d002c9`, 25 Jul 2026):
 * a returning user got their whole model back and an EMPTY chat showing the
 * first-use placeholder ("Describe your decision, goal, options…"), as though
 * they had never been there. The conversation was not lost — it simply had no
 * restore path on the surface the product actually runs on:
 *
 *   - `scenarios.thread` (the legacy Track-2 column `useScenario` reads into
 *     `_hydratedThread`) DOES NOT EXIST on the live database, and its writer
 *     and reader are both gated behind `VITE_FEATURE_THREAD_PERSIST` /
 *     `VITE_FEATURE_THREAD_HYDRATE`, neither of which is present in the
 *     deployed env — so both resolve to `false`.
 *   - `conversation_turns` IS written on every turn (always-on), but has ZERO
 *     readers anywhere in the client, and its RPC is RLS-gated so a guest's
 *     writes are refused and then suppressed.
 *   - staging runs `VITE_AUTH_MODE=guest`, so `isPersistenceActive()` is false
 *     and the GRAPH itself restores from `localStorage` (`olumi-canvas-autosave`),
 *     not from Supabase.
 *
 * The graph survives because it rides localStorage. This module puts the
 * transcript on the same lifecycle, so the two halves of a user's work come
 * back together. It is deliberately NOT flag-gated and needs no migration.
 *
 * WHAT IS AND IS NOT RESTORED — the honesty contract:
 * the real history is restored verbatim (role, text, rendered blocks), never a
 * synthesised summary of it. Fields that are documented-ephemeral in
 * `types.ts` (`reasoning`, `answerShape`) or that would re-arm a stale
 * interaction (`actionChips`) are dropped, and anything dropped for SIZE is
 * declared on screen via `droppedCount` — a placeholder that means "you have
 * never been here" is a factual claim, and it must not be made falsely.
 */

import type { ConversationMessage } from '../types'

/** localStorage key. Sibling of `olumi-canvas-autosave` / `-scenarios`. */
export const TRANSCRIPT_STORAGE_KEY = 'olumi-canvas-transcript'

/**
 * Identity of THIS page load, stamped onto every save.
 *
 * The feature is "show a RETURNING user what they left", so a transcript this
 * page load wrote is not something to restore — it is already on screen, or it
 * was deliberately cleared. Without this discriminator a provider remount
 * would replay the live conversation back over itself and mint a spurious
 * "Session resumed" divider mid-session.
 */
const PAGE_LOAD_ID: string = (() => {
  try {
    return crypto.randomUUID()
  } catch {
    return `pl-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
})()

/** Most recent messages kept per scenario. */
export const MAX_MESSAGES_PER_SCENARIO = 120

/** Scenarios retained (least-recently-saved evicted first). */
export const MAX_SCENARIOS = 8

/**
 * Byte ceiling for the whole key. localStorage is typically ~5 MB per origin
 * and `olumi-canvas-autosave` already spends ~25 kB of it, so this stays well
 * inside budget while holding a long conversation.
 */
export const MAX_SERIALISED_BYTES = 400_000

/** Persisted form of one message — only the fields the panel renders. */
interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: string
  displayContent?: string
  blocks?: unknown[]
  insights?: unknown[]
  clientTurnId?: string
  chipInitiated?: boolean
  sessionDivider?: string
  synthetic?: boolean
}

interface StoredTranscript {
  savedAt: string
  /** The page load that wrote this. See `PAGE_LOAD_ID`. */
  pageLoadId?: string
  /** Count of messages dropped to respect the caps. 0 = the history is whole. */
  dropped: number
  messages: StoredMessage[]
}

type TranscriptFile = Record<string, StoredTranscript>

export interface LoadedTranscript {
  messages: ConversationMessage[]
  savedAt: Date | null
  /** >0 when older turns were dropped to fit — MUST be disclosed on screen. */
  droppedCount: number
  /**
   * True when this transcript was written by an EARLIER page load, i.e. the
   * user genuinely went away and came back. False when this page load wrote
   * it, in which case there is nothing to "restore".
   */
  fromPreviousSession: boolean
}

function storageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  } catch {
    return false
  }
}

function readFile(): TranscriptFile {
  if (!storageAvailable()) return {}
  try {
    const raw = localStorage.getItem(TRANSCRIPT_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as TranscriptFile
  } catch {
    // Corrupt payload: treat as absent rather than throwing into a render path.
    return {}
  }
}

/**
 * A message worth persisting: it must be something the user actually said or
 * was told. Synthetic UI chrome is dropped (mirroring `useThreadPersistence`),
 * EXCEPT session dividers, which are the record of the boundaries themselves.
 * A user turn that never reached the server (`deliveryState: 'failed'`, or
 * still `'pending'` when we serialise) is never committed — the same
 * transcript-honesty rule the live path applies.
 */
function isPersistable(m: ConversationMessage): boolean {
  if (m.synthetic && !m.sessionDivider) return false
  if (m.role === 'user' && (m.deliveryState === 'failed' || m.deliveryState === 'pending')) return false
  if (m.isStreaming) return false
  if (!m.content && !m.sessionDivider && !(m.blocks && m.blocks.length > 0)) return false
  return true
}

function toStored(m: ConversationMessage): StoredMessage {
  const out: StoredMessage = {
    id: m.id,
    role: m.role,
    content: m.content ?? '',
    ts: (m.timestamp instanceof Date ? m.timestamp : new Date()).toISOString(),
  }
  if (m.displayContent) out.displayContent = m.displayContent
  if (m.blocks && m.blocks.length > 0) out.blocks = m.blocks as unknown[]
  if (m.insights && m.insights.length > 0) out.insights = m.insights as unknown[]
  if (m.clientTurnId) out.clientTurnId = m.clientTurnId
  if (m.chipInitiated) out.chipInitiated = true
  if (m.sessionDivider) out.sessionDivider = m.sessionDivider
  if (m.synthetic) out.synthetic = true
  return out
}

function fromStored(s: StoredMessage): ConversationMessage {
  const ts = new Date(s.ts)
  return {
    id: s.id,
    role: s.role === 'user' ? 'user' : 'assistant',
    content: typeof s.content === 'string' ? s.content : '',
    timestamp: Number.isNaN(ts.getTime()) ? new Date() : ts,
    ...(s.displayContent ? { displayContent: s.displayContent } : {}),
    ...(Array.isArray(s.blocks) && s.blocks.length > 0
      ? { blocks: s.blocks as ConversationMessage['blocks'] }
      : {}),
    ...(Array.isArray(s.insights) && s.insights.length > 0
      ? { insights: s.insights as ConversationMessage['insights'] }
      : {}),
    ...(s.clientTurnId ? { clientTurnId: s.clientTurnId } : {}),
    ...(s.chipInitiated ? { chipInitiated: true } : {}),
    ...(s.sessionDivider ? { sessionDivider: s.sessionDivider } : {}),
    ...(s.synthetic ? { synthetic: true } : {}),
  }
}

function isStoredMessage(v: unknown): v is StoredMessage {
  if (v == null || typeof v !== 'object') return false
  const m = v as Partial<StoredMessage>
  return (
    typeof m.id === 'string' &&
    (m.role === 'user' || m.role === 'assistant') &&
    typeof m.ts === 'string'
  )
}

/**
 * Persist the transcript for one scenario. Best-effort and total: it never
 * throws into the caller's render path.
 *
 * Returns the number of messages dropped to fit the caps (0 when whole), or
 * `null` when nothing was written at all.
 */
export function saveTranscript(
  scenarioId: string | null | undefined,
  messages: readonly ConversationMessage[],
): number | null {
  if (!scenarioId || !storageAvailable()) return null

  const persistable = messages.filter(isPersistable)
  if (persistable.length === 0) return null

  const file = readFile()
  const prevDropped = file[scenarioId]?.dropped ?? 0

  let kept = persistable
  let dropped = prevDropped
  if (kept.length > MAX_MESSAGES_PER_SCENARIO) {
    dropped += kept.length - MAX_MESSAGES_PER_SCENARIO
    kept = kept.slice(-MAX_MESSAGES_PER_SCENARIO)
  }

  const build = (msgs: readonly ConversationMessage[], drop: number): StoredTranscript => ({
    savedAt: new Date().toISOString(),
    pageLoadId: PAGE_LOAD_ID,
    dropped: drop,
    messages: msgs.map(toStored),
  })

  // Evict least-recently-saved scenarios beyond the cap.
  const next: TranscriptFile = { ...file }
  next[scenarioId] = build(kept, dropped)
  const ids = Object.keys(next)
  if (ids.length > MAX_SCENARIOS) {
    ids
      .filter((id) => id !== scenarioId)
      .sort((a, b) => Date.parse(next[a]?.savedAt ?? '') - Date.parse(next[b]?.savedAt ?? ''))
      .slice(0, ids.length - MAX_SCENARIOS)
      .forEach((id) => { delete next[id] })
  }

  // Shrink until it fits the byte ceiling, then until the browser accepts it.
  let payload = JSON.stringify(next)
  while (payload.length > MAX_SERIALISED_BYTES && kept.length > 1) {
    const drop = Math.max(1, Math.ceil(kept.length / 4))
    dropped += drop
    kept = kept.slice(drop)
    next[scenarioId] = build(kept, dropped)
    payload = JSON.stringify(next)
  }

  for (;;) {
    try {
      localStorage.setItem(TRANSCRIPT_STORAGE_KEY, payload)
      return dropped
    } catch {
      // Quota (or a hostile storage impl). Halve and retry; give up cleanly.
      if (kept.length <= 1) {
        try { localStorage.removeItem(TRANSCRIPT_STORAGE_KEY) } catch { /* noop */ }
        return null
      }
      const drop = Math.ceil(kept.length / 2)
      dropped += drop
      kept = kept.slice(drop)
      next[scenarioId] = build(kept, dropped)
      payload = JSON.stringify(next)
    }
  }
}

/**
 * Read back the transcript for one scenario. Returns `null` when there is
 * nothing stored — the caller must then leave the first-use placeholder
 * standing, because in that case it is TRUE.
 */
export function loadTranscript(scenarioId: string | null | undefined): LoadedTranscript | null {
  if (!scenarioId || !storageAvailable()) return null

  const entry = readFile()[scenarioId]
  if (entry == null || typeof entry !== 'object') return null
  if (!Array.isArray(entry.messages)) return null

  const messages = entry.messages.filter(isStoredMessage).map(fromStored)
  if (messages.length === 0) return null

  const savedAt = typeof entry.savedAt === 'string' ? new Date(entry.savedAt) : null
  const droppedCount = Number.isFinite(entry.dropped) ? Number(entry.dropped) : 0

  return {
    messages,
    savedAt: savedAt && !Number.isNaN(savedAt.getTime()) ? savedAt : null,
    droppedCount: droppedCount > 0 ? droppedCount : 0,
    fromPreviousSession: entry.pageLoadId !== PAGE_LOAD_ID,
  }
}

/** Forget one scenario's transcript (scenario deleted / canvas reset). */
export function clearTranscript(scenarioId: string | null | undefined): void {
  if (!scenarioId || !storageAvailable()) return
  try {
    const file = readFile()
    if (!(scenarioId in file)) return
    delete file[scenarioId]
    localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
  } catch {
    /* best-effort */
  }
}

/**
 * The on-screen disclosure for a partially-restored history.
 *
 * Rendered as a session divider above the restored turns. It states the
 * shortfall in plain words rather than letting the panel imply the history is
 * complete.
 */
export function formatTruncationNotice(droppedCount: number): string {
  return droppedCount === 1
    ? 'The earliest message from this decision could not be restored'
    : `The earliest ${droppedCount} messages from this decision could not be restored`
}
