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
 *
 * The inverse also holds: a card action the user already TOOK must not come
 * back live. A user message records which card created it (`sourceBlockKey`),
 * and `settledSourceBlockKeys` reads that back, so the saved transcript is
 * the one witness of what was done (G1).
 */

import type { ConversationMessage } from '../types'
import { heldProposalMountKey } from '../selectors'

// ── G1: which CARD ACTION created a user message ─────────────────────────────
//
// THE DEFECT. After a reload a card action the user had already taken was live
// again: a coaching chip's `settled` was component state, and a held proposal's
// Confirm was settled only in the in-memory `patchBlockStates`. Both came back
// clickable, and one more click sent a second turn.
//
// THE RULE. A card action is settled after a reload if and only if a DELIVERED
// user message created by that action exists in the saved transcript. The
// message carries a `sourceBlockKey`; this store persists it (optionally, so
// older saves load unchanged); `settledSourceBlockKeys` reads it back. No
// separate "settled" record exists: the transcript is the one witness.
//
// ⚠ THE KEY STRINGS ARE A STORED CONTRACT — they are written to localStorage,
// so changing either format silently re-arms every action a returning user
// already took. Both are scoped by the TURN the card is mounted in as well as
// the block's own id: a `block_id` or a CEE hold handle can recur on a later
// turn, and that later card is a new offer.
//
// The key is UI-only. It rides the send beside the chip metadata and is stamped
// on the user bubble; it never enters the wire payload.

/**
 * A conversation message that may carry the G1 card-action key. Declared here,
 * beside the one store that persists and reads it back; on any message other
 * than a user message created by a card action it is absent.
 */
export type SourceKeyedMessage = ConversationMessage & {
  /** `coach:<turnId>:<block_id>` or `held:<turnId>:<proposal_id>`. */
  sourceBlockKey?: string
}

/** Key for a coaching card's action chip: `coach:<turnId>:<block_id>`. */
export function coachingSourceBlockKey(
  turnId: string | undefined,
  blockId: string | undefined,
): string | undefined {
  if (!turnId || !blockId) return undefined
  return `coach:${turnId}:${blockId}`
}

/**
 * Key for a held proposal's Confirm: `held:<turnId>:<proposal_id>`.
 *
 * Deliberately the held-proposal registry's own MOUNT key
 * (`heldProposalMountKey`), so a restored confirm seeds exactly the entry
 * `resolveHeldProposalState` reads — one key space, not two to keep aligned.
 * `turnId` absent ⇒ no key: the registry's bare-handle fallback would also
 * settle a later offer CEE re-issues under the same handle.
 */
export function heldProposalSourceBlockKey(
  turnId: string | undefined,
  proposalId: string | undefined,
): string | undefined {
  if (!turnId || !proposalId) return undefined
  return heldProposalMountKey(turnId, proposalId)
}

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
  /** G1 — the card action that created this user message. Optional: saves
   *  written before it existed load exactly as they always did. */
  sourceBlockKey?: string
  /**
   * Only ever `'unconfirmed'`: a send whose reply the client never received
   * (ROADMAP 2.665: the server may or may not have it). Stored so the bubble
   * still says "Sent — reply not received" after a reload. Without it, the
   * restored bubble looked delivered while its card (G1) read as taken: an
   * unknown outcome silently becoming a known one. `failed` and `pending` are
   * never stored (`isPersistable`), and `sent` is the default, so it is left
   * absent.
   */
  deliveryState?: 'unconfirmed'
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
  messages: SourceKeyedMessage[]
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

/**
 * G1 — the card actions a transcript records as TAKEN: the `sourceBlockKey` of
 * every user message this store would persist (`isPersistable`), and nothing
 * else.
 *
 * Built on the persistence rule rather than beside it, so "settled" cannot
 * drift from "saved": a failed or still-pending send is never saved, so it
 * never settles its card, and the answer read live is the answer a reload
 * would give. Pure and total; an empty set when nothing was taken.
 */
export function settledSourceBlockKeys(
  messages: readonly SourceKeyedMessage[],
): ReadonlySet<string> {
  const keys = new Set<string>()
  for (const m of messages) {
    if (m.role !== 'user' || !m.sourceBlockKey) continue
    if (!isPersistable(m)) continue
    keys.add(m.sourceBlockKey)
  }
  return keys
}

function toStored(m: SourceKeyedMessage): StoredMessage {
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
  if (m.sourceBlockKey) out.sourceBlockKey = m.sourceBlockKey
  if (m.deliveryState === 'unconfirmed') out.deliveryState = 'unconfirmed'
  if (m.sessionDivider) out.sessionDivider = m.sessionDivider
  if (m.synthetic) out.synthetic = true
  return out
}

function fromStored(s: StoredMessage): SourceKeyedMessage {
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
    ...(typeof s.sourceBlockKey === 'string' && s.sourceBlockKey
      ? { sourceBlockKey: s.sourceBlockKey }
      : {}),
    ...(s.deliveryState === 'unconfirmed' ? { deliveryState: 'unconfirmed' as const } : {}),
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
  // A forgotten decision must stay forgotten for the rest of this page load —
  // see the tombstone block above `clearTranscript`. Without this the clear is
  // nominal: it is undone on the very commit it happens.
  if (forgottenThisPageLoad.has(scenarioId)) return null

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

/**
 * ── THE TOMBSTONE, and why deleting the key is not enough ──────────────────
 *
 * MEASURED, not derived (`useConversation.resetTranscript.spec.tsx`): deleting
 * the key alone is UNDONE ON THE SAME REACT COMMIT. `useConversation`'s persist
 * effect (`:2712`, deps `[messages, scenarioId]`) is declared BEFORE the
 * scenario-switch effect (`:2721`). `resetCanvas` sets `currentScenarioId: null`,
 * so on that commit the persist effect runs FIRST — while `messagesOwnerRef`
 * still holds the OLD id and `messages` is still the old conversation — and
 * `saveTranscript(oldId, messages)` writes back exactly what was just deleted.
 *
 * The store-level test could not see this: it mounts no component, so there is
 * no effect to race. It passed, and the clear was nominal.
 *
 * Reordering the two effects was rejected: `messagesOwnerRef`'s own comment
 * records a privacy defect that keying persistence on the owner (not on
 * `scenarioId`) exists to prevent, and moving the effect changes which decision
 * owns the messages on a switch render. So the fix lives here, where "forget
 * this" is defined, and holds regardless of who races it.
 *
 * Scope is deliberately ONE PAGE LOAD and one id:
 *   - it is released the moment the user genuinely re-enters that decision
 *     (`releaseTranscriptTombstone`, called from the scenario-switch effect), so
 *     re-opening a saved decision after a reset persists normally;
 *   - it does not survive a reload, because after one it cannot be needed: the
 *     key is gone and no in-memory `messages` remain to write back.
 */
const forgottenThisPageLoad = new Set<string>()

/**
 * The user has genuinely entered this decision, so it is no longer forgotten.
 * Called from the scenario-switch effect. Without it, resetting and then
 * re-opening a saved decision would silently stop persisting its conversation
 * for the rest of the page load — the tombstone's own failure mode, and the
 * reason it has a release rather than being permanent.
 */
export function releaseTranscriptTombstone(scenarioId: string | null | undefined): void {
  if (!scenarioId) return
  forgottenThisPageLoad.delete(scenarioId)
}

/** Test-only: the tombstone is module state and must not leak between cases. */
export function __resetTranscriptTombstonesForTests(): void {
  forgottenThisPageLoad.clear()
}

/** Forget one scenario's transcript (scenario deleted / canvas reset). */
export function clearTranscript(scenarioId: string | null | undefined): void {
  if (!scenarioId) return
  // Tombstone FIRST and unconditionally: if storage is unavailable the delete
  // is a no-op, but a later write must still be refused.
  forgottenThisPageLoad.add(scenarioId)
  if (!storageAvailable()) return
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
