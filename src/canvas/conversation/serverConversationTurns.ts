/**
 * ⭐ THE CHAT SURVIVES A RELOAD (DL lease #75 5907275541; AIQ rows 5907300125 + condition 5907333766, met 5907360564).
 *
 * CEE persists every turn's text (`v5_conversation_turns`: the user's words and the POST-WIRE reply the user saw,
 * `agent-v1-turn.ts` writes `wireBody.assistant_text` after the leader-claim enforcer). The graph read is to carry it
 * as `conversation_turns` (Canvas's ask 5907308286). This module is the UI's one reader of that field and the one
 * builder of the restored thread. It is pure: no store, no fetch.
 *
 *   · History reads as history: the restored turns sit under ONE divider, "Earlier in this conversation".
 *   · Text history is inert unless the separate held-offer sidecar attests an executable original approve/amend pair.
 *   · Stale figures are marked (AIQ row 2), keyed on the SAME read the Goal panel uses: when the read says the Run is
 *     not current, every restored figure-bearing reply carries the line; otherwise only replies written before the
 *     current Run was computed.
 *   · A refused or absent field restores nothing (the local transcript, when present, is the caller's first choice).
 */
import { ActionSchema } from '@talchain/schemas/boundary'
import { buildSuggestedActionChips } from '../../v5/blocks/suggestedActionChips'
import type { ConversationMessage } from './types'

export const CONVERSATION_TURNS_READ_KEY = 'conversation_turns' as const
export const RESTORED_HISTORY_DIVIDER = 'Earlier in this conversation'
// AIQ 5908155550: true on every branch (a same-model re-run, a non-edit not-current), unlike "the model has changed".
// ⭐ ONCE, not under every reply (AIQ 5925678816; Paul's step-5 reload showed it under 8 replies): the sentence closes the
// LAST earlier reply, and each earlier figure-bearing reply carries the short tag, so row 2 still holds when a reader
// scrolls up to an old figure on its own. ⛔ IN `content`, NOT A DIVIDER (Canvas 5925780066): a trailing divider is
// rewritten to "Session resumed" on the next page load, and the saved transcript keeps `content` + `restoredTag`.
export const RESTORED_STALE_FIGURES_NOTE = 'The replies above came before the current analysis, so their figures may not match it.'
export const RESTORED_EARLIER_TAG = 'Earlier analysis'
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
  heldProposalOffers?: unknown,
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
  let anyStale = false
  let lastEarlierReply = -1
  for (const t of turns) {
    const at = new Date(t.createdAt)
    if (t.userMessage !== null) out.push({ id: `restored-user-${t.turnId}`, role: 'user', content: t.userMessage, timestamp: at })
    if (t.assistantMessage !== null) {
      const describesEarlierRun = run.runNotCurrent || (Number.isFinite(runAt) && at.getTime() < runAt)
      const stale = describesEarlierRun && FIGURE.test(t.assistantMessage)
      anyStale ||= stale
      out.push({
        id: `restored-assistant-${t.turnId}`,
        role: 'assistant',
        content: t.assistantMessage,
        timestamp: at,
        ...(stale ? { restoredTag: RESTORED_EARLIER_TAG } : {}),
      })
      if (describesEarlierRun) lastEarlierReply = out.length - 1
    }
  }
  if (anyStale) {
    const last = out[lastEarlierReply]
    out[lastEarlierReply] = { ...last, content: `${last.content}\n\n${RESTORED_STALE_FIGURES_NOTE}` }
  }
  return reconcileRestoredHeldControls(out, heldProposalOffers)
}


export interface ServerHeldProposalOffer {
  readonly turnId: string
  readonly proposalId: string
  readonly actions: Parameters<typeof buildSuggestedActionChips>[1]
}

/** The only held-offer reader. Both exact identities and the pinned ActionSchema must validate; no partial pair. */
export function readServerHeldProposalOffers(raw: unknown): readonly ServerHeldProposalOffer[] {
  if (!Array.isArray(raw)) return []
  const out: ServerHeldProposalOffer[] = []
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    if (typeof row.turn_id !== 'string' || row.turn_id.length === 0 || typeof row.proposal_id !== 'string'
      || !/^prop_[0-9a-f]{32}$/.test(row.proposal_id) || !Array.isArray(row.suggested_actions) || row.suggested_actions.length !== 2) continue
    const parsed = row.suggested_actions.map(action => ActionSchema.safeParse(action))
    if (!parsed.every(p => p.success)) continue
    const actions = parsed.flatMap(p => p.success ? [p.data] : [])
    if (actions[0].id !== `agent-approve-proposal:${row.proposal_id}` || actions[1].id !== 'agent-amend-proposal') continue
    out.push({ turnId: row.turn_id, proposalId: row.proposal_id, actions })
  }
  return out
}

/**
 * Local history keeps its words. ONLY this fresh server sidecar rebuilds restored approve/amend controls.
 * The saved proposal/turn association locates a card, never authorises it. No match or unreadable/absent sidecar → inert.
 * Live answers have neither the restored association nor a restored-server id and are left untouched by a late read.
 */
export function reconcileRestoredHeldControls(messages: readonly ConversationMessage[], rawOffers: unknown): ConversationMessage[] {
  const offers = readServerHeldProposalOffers(rawOffers)
  const used = new Set<string>()
  return messages.map(message => {
    if (message.role !== 'assistant') return message
    const serverTurnId = message.id.startsWith('restored-assistant-') ? message.id.slice('restored-assistant-'.length) : undefined
    if (message.heldProposalId === undefined && serverTurnId === undefined) return message
    const turnId = message.clientTurnId ?? serverTurnId
    const offer = offers.find(o => !used.has(o.proposalId)
      && (turnId !== undefined ? o.turnId === turnId : o.proposalId === message.heldProposalId)
      && (message.heldProposalId === undefined || o.proposalId === message.heldProposalId))
    // Drop any prior restored controls before adopting the fresh authority; saved chips never participate.
    const { actionChips: _oldChips, ...rest } = message
    if (offer === undefined) return rest
    used.add(offer.proposalId)
    return { ...rest, heldProposalId: offer.proposalId, clientTurnId: offer.turnId,
      actionChips: buildSuggestedActionChips([], offer.actions) }
  })
}
