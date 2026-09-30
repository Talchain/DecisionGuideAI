/**
 * ⭐ THE CHAT SURVIVES A RELOAD (DL lease #75 5907275541; AIQ rows 5907300125 + condition 5907333766, met 5907360564).
 *
 * CEE persists every turn's text (`v5_conversation_turns`: the user's words and the POST-WIRE reply the user saw,
 * `agent-v1-turn.ts` writes `wireBody.assistant_text` after the leader-claim enforcer). The graph read is to carry it
 * as `conversation_turns` (Canvas's ask 5907308286). This module is the UI's one reader of that field and the one
 * builder of the restored thread. It is pure: no store, no fetch.
 *
 *   · History reads as history: the restored turns sit under ONE divider, "Earlier in this conversation".
 *   · Cards are inert by construction: the carrier holds text only, so no chip or block is ever rebuilt.
 *   · Stale figures are marked (AIQ row 2), keyed on the SAME read the Goal panel uses: when the read says the Run is
 *     not current, every restored figure-bearing reply carries the line; otherwise only replies written before the
 *     current Run was computed.
 *   · A refused or absent field restores nothing (the local transcript, when present, is the caller's first choice).
 */
import type { ConversationMessage } from './types'

export const CONVERSATION_TURNS_READ_KEY = 'conversation_turns' as const
export const RESTORED_HISTORY_DIVIDER = 'Earlier in this conversation'
// AIQ 5908155550: true on every branch (a same-model re-run, a non-edit not-current), unlike "the model has changed".
export const RESTORED_STALE_FIGURES_NOTE = 'These replies came before the current analysis; their figures may not match it.'
/**
 * CEE's cap (CEE #2352 `CONVERSATION_TURNS_CAP`, 50 TURNS = up to 100 messages). A read AT the cap may have left older
 * turns out (AIQ 5907906662: say so). The words hold whether or not anything was — at exactly 50 CEE cannot tell us which.
 * ⚠ CEE filters empty rows AFTER its limit, so a capped read can return < 50 (AIQ repair-train ask: a `truncated` flag).
 */
export const CONVERSATION_TURNS_CAP = 50
export const RESTORED_AT_CAP_DIVIDER = `${RESTORED_HISTORY_DIVIDER} · only the latest ${CONVERSATION_TURNS_CAP} exchanges are shown; any earlier ones are not`

export interface ServerConversationTurn {
  readonly turnId: string
  readonly createdAt: string
  readonly userMessage: string | null
  readonly assistantMessage: string | null
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim().length > 0 ? v : null)

/** Parse the read's `conversation_turns`. Not an array → null (not served). Entries without an id or a valid time are dropped. */
export function readServerConversationTurns(raw: unknown): readonly ServerConversationTurn[] | null {
  if (!Array.isArray(raw)) return null
  const out: ServerConversationTurn[] = []
  for (const t of raw) {
    if (t === null || typeof t !== 'object') continue
    const r = t as Record<string, unknown>
    const turnId = text(r.turn_id)
    const createdAt = typeof r.created_at === 'string' && Number.isFinite(Date.parse(r.created_at)) ? r.created_at : null
    if (turnId === null || createdAt === null) continue
    const userMessage = text(r.user_message)
    const assistantMessage = text(r.assistant_message)
    if (userMessage === null && assistantMessage === null) continue
    out.push({ turnId, createdAt, userMessage, assistantMessage })
  }
  return out.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
}

/** A reply that may state a figure: it contains any digit (deliberately broad — an extra note on a figure-free digit is an under-claim, never a false one). */
const FIGURE = /\d/

export interface RestoreRunContext {
  /** The read says the held Run is not current (the `heldRunIsNotCurrentPerRead` family). */
  readonly runNotCurrent: boolean
  /** The current Run's `run_state.computed_at`, when the read has one. */
  readonly currentRunComputedAt: string | null
}

/** Build the restored thread: one divider, the turns as plain text (oldest first), and AIQ's stale line where due. */
export function buildRestoredThread(
  turns: readonly ServerConversationTurn[],
  run: RestoreRunContext,
): ConversationMessage[] {
  if (turns.length === 0) return []
  const runAt = run.currentRunComputedAt !== null ? Date.parse(run.currentRunComputedAt) : Number.NaN
  const out: ConversationMessage[] = [{
    id: 'restored-divider',
    role: 'assistant',
    content: '',
    timestamp: new Date(turns[0].createdAt),
    synthetic: true,
    sessionDivider: turns.length >= CONVERSATION_TURNS_CAP ? RESTORED_AT_CAP_DIVIDER : RESTORED_HISTORY_DIVIDER,
  }]
  for (const t of turns) {
    const at = new Date(t.createdAt)
    if (t.userMessage !== null) out.push({ id: `restored-user-${t.turnId}`, role: 'user', content: t.userMessage, timestamp: at })
    if (t.assistantMessage !== null) {
      const describesEarlierRun = run.runNotCurrent || (Number.isFinite(runAt) && at.getTime() < runAt)
      const stale = describesEarlierRun && FIGURE.test(t.assistantMessage)
      out.push({
        id: `restored-assistant-${t.turnId}`,
        role: 'assistant',
        content: stale ? `${t.assistantMessage}\n\n${RESTORED_STALE_FIGURES_NOTE}` : t.assistantMessage,
        timestamp: at,
      })
    }
  }
  return out
}
