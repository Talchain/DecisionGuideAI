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
import { AMEND_PROPOSAL_ACTION, readProposalFields } from './proposalFields'
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
  readonly suggestedActions?: readonly ServerSuggestedAction[]
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
    const suggestedActions = readRestoredSuggestedActions(r.suggested_actions)
    out.push({ turnId, createdAt, userMessage, assistantMessage, ...(suggestedActions ? { suggestedActions } : {}) })
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
  proposalFields?: unknown,
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
  return reconcileRestoredProposalFields(
    reconcileRestoredSuggestedActions(reconcileRestoredHeldControls(out, heldProposalOffers, true), turns), proposalFields)
}

/**
 * ⭐ S-D (§15): a held Agent-lane change (`gmh_…`) comes back on a reload ONLY through the read's `proposal_fields`,
 * which CEE documents as "the proposals still held, with what each assumes and its exact card". `held_proposal_offers`
 * never carries one: CEE builds it from the conventional pending store alone (witnessed on CEE 4f9f9e5, sd-wire-4).
 * Each proposal belongs to its issuing reply. Older reads without an issuing turn, or entries whose turn was not
 * restored, may arm the latest reply only when it has no held card; that fallback is explicitly labelled earlier.
 * A later user message, or another held card that reply already carries, takes priority. No valid entry → unchanged.
 */
export function reconcileRestoredProposalFields(
  messages: readonly ConversationMessage[],
  rawProposalFields: unknown,
): ConversationMessage[] {
  const proposals = readProposalFields(rawProposalFields)?.proposals ?? []
  const out = [...messages]
  const unmatched: typeof proposals = []
  const isReply = (message: ConversationMessage) => message.role === 'assistant' && !message.synthetic
    && typeof message.sessionDivider !== 'string'
  const approveIds = (message: ConversationMessage) => (message.actionChips ?? [])
    .filter(c => typeof c.id === 'string' && c.id.startsWith('agent-approve-proposal:')).map(c => c.id)
  const attach = (index: number, held: typeof proposals[number], earlier: boolean) => {
    const reply = out[index]
    const card = buildSuggestedActionChips([], [held.approve_action, AMEND_PROPOSAL_ACTION, held.decline_action])
    const others = (reply.actionChips ?? []).filter(c => !card.some(k => k.id === c.id))
    out[index] = { ...reply, heldProposalId: held.proposal_id, heldProposalEarlier: earlier,
      actionChips: [...card, ...others], proposalFields: rawProposalFields }
  }

  // Issuing replies take priority over an unmatched entry's fallback, regardless of the read's proposal order.
  for (const held of proposals) {
    const matches = held.issued_turn_id == null ? [] : out.flatMap((message, index) =>
      isReply(message) && (message.id === `restored-assistant-${held.issued_turn_id}`
        || message.clientTurnId === held.issued_turn_id || message.serverTurnId === held.issued_turn_id) ? [index] : [])
    if (matches.length !== 1) { unmatched.push(held); continue }
    const index = matches[0]
    // The same restored card is enriched with its binding; a different card retains its own reply.
    if (approveIds(out[index]).some(id => id !== held.approve_action.id)) continue
    attach(index, held, false)
  }

  // A matched proposal is shown on its issuing reply only: CEE's continuity copy on another reply (the last turn's
  // persisted suggested_actions) leaves that reply, with its amend chip when no other approve card remains there.
  const placed = new Map<string, number>()
  out.forEach((message, index) => { if (message.heldProposalId !== undefined && message.heldProposalEarlier === false) placed.set(message.heldProposalId, index) })
  for (let i = 0; i < out.length; i++) {
    const chipsHere = out[i].actionChips
    if (!chipsHere) continue
    const strip = new Set<string>()
    for (const [id, at] of placed) if (at !== i) { strip.add(`agent-approve-proposal:${id}`); strip.add(`agent-decline-proposal:${id}`) }
    if (strip.size === 0 || !chipsHere.some(c => strip.has(c.id))) continue
    let kept = chipsHere.filter(c => !strip.has(c.id))
    if (!kept.some(c => typeof c.id === 'string' && c.id.startsWith('agent-approve-proposal:'))) kept = kept.filter(c => c.id !== 'agent-amend-proposal')
    out[i] = { ...out[i], actionChips: kept }
  }

  // A restore's "Session resumed" divider is not a reply: the card goes on the reply before it, as ChatThread
  // hosts chips there (served E1c, 7 Oct: the divider was last, so the card never came back).
  let last = out.length - 1
  while (last >= 0 && typeof out[last].sessionDivider === 'string') last--
  const reply = out[last]
  if (unmatched.length > 0 && reply !== undefined && isReply(reply) && approveIds(reply).length === 0) {
    attach(last, unmatched[0], true)
  } else if (proposals.length > 0 && reply !== undefined && isReply(reply) && out[last].proposalFields === undefined) {
    // The latest reply carries the read's CURRENT held set, as a live reply carries `_proposal_fields`: ChatThread
    // shows an earlier reply's card only while this set still lists it.
    out[last] = { ...out[last], proposalFields: rawProposalFields }
  }
  return out
}


/**
 * Reconcile only retained uncertain requests, under the read's scenario. Text is
 * never an identity. Receipt clears the marker; a user-only turn keeps the exact
 * association for a later reply. Existing history and held authority stay intact.
 */
export function reconcileUnconfirmedServerTurns(
  messages: readonly ConversationMessage[],
  scenarioId: string,
  turns: readonly ServerConversationTurn[],
  run: RestoreRunContext,
): ConversationMessage[] {
  const requestCounts = new Map<string, number>()
  const turnCounts = new Map<string, number>()
  for (const m of messages) {
    if (m.role === 'user' && m.deliveryScenarioId === scenarioId && m.deliveryRequestId) {
      requestCounts.set(m.deliveryRequestId, (requestCounts.get(m.deliveryRequestId) ?? 0) + 1)
    }
  }
  for (const t of turns) turnCounts.set(t.turnId, (turnCounts.get(t.turnId) ?? 0) + 1)
  const received = new Set<string>()
  const out: ConversationMessage[] = []
  for (const m of messages) {
    const id = m.deliveryRequestId
    const turn = m.role === 'user' && m.deliveryScenarioId === scenarioId && id
      && requestCounts.get(id) === 1 && turnCounts.get(id) === 1
      ? turns.find(t => t.turnId === id && t.userMessage !== null) : undefined
    if (!turn || !id) { out.push(m); continue }
    received.add(id)
    const replyId = `restored-assistant-${id}`
    const hasReply = messages.some(reply => reply.role === 'assistant' && reply.id === replyId)
    if (turn.assistantMessage === null && !hasReply) {
      out.push({ ...m, deliveryState: 'sent' })
      continue
    }
    const { deliveryRequestId: _request, deliveryScenarioId: _scenario, ...settled } = m
    out.push({ ...settled, deliveryState: 'sent' })
    if (!hasReply) {
      // Use the same history builder, including earlier-figure disclosure. No
      // saved chip can authorise a reply; the caller reconciles the fresh sidecar.
      out.push(...buildRestoredThread([turn], run).filter(reply => reply.role === 'assistant' && !reply.sessionDivider))
    }
  }
  return out.filter(m => !(m.synthetic && m.deliveryScenarioId === scenarioId
    && m.deliveryRequestId && received.has(m.deliveryRequestId)))
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
      || !/^(?:prop_[0-9a-f]{32}|gmh_[0-9a-f]{12})$/.test(row.proposal_id) || !Array.isArray(row.suggested_actions) || ![2, 3].includes(row.suggested_actions.length)) continue
    const parsed = row.suggested_actions.map(action => ActionSchema.safeParse(action))
    if (!parsed.every(p => p.success)) continue
    const actions = parsed.flatMap(p => p.success ? [p.data] : [])
    if (actions[0].id !== `agent-approve-proposal:${row.proposal_id}` || actions[1].id !== 'agent-amend-proposal'
      || (actions.length === 3 && (actions[2].id !== `agent-decline-proposal:${row.proposal_id}`
        || actions[2].label !== 'Not now' || actions[2].message !== 'Not now.'))) continue
    out.push({ turnId: row.turn_id, proposalId: row.proposal_id, actions })
  }
  return out
}

/**
 * Local history keeps its words. ONLY this fresh server sidecar rebuilds restored approve/amend controls.
 * The saved proposal/turn association locates a card, never authorises it. No match or unreadable/absent sidecar → inert.
 * Replies without a held association or a restored-server id are left untouched by a late read.
 */
export function reconcileRestoredHeldControls(
  messages: readonly ConversationMessage[],
  rawOffers: unknown,
  freshlyBuiltServerHistory = false,
): ConversationMessage[] {
  const offers = readServerHeldProposalOffers(rawOffers)
  const used = new Set<string>()
  // Fresh history has no saved proposal association: a repeated turn cannot locate an unambiguous reply.
  const serverReplyCounts = new Map<string, number>()
  if (freshlyBuiltServerHistory) {
    for (const message of messages) {
      if (message.role !== 'assistant' || message.sessionDivider || message.synthetic
        || !message.id.startsWith('restored-assistant-')) continue
      const turnId = message.id.slice('restored-assistant-'.length)
      serverReplyCounts.set(turnId, (serverReplyCounts.get(turnId) ?? 0) + 1)
    }
  }
  // The latest eligible local reply owns a duplicate exact pair; keep display order unchanged.
  return [...messages].reverse().map(message => {
    if (message.role !== 'assistant' || message.sessionDivider || message.synthetic) return message
    const hasServerPrefix = message.id.startsWith('restored-assistant-')
    // Only the builder above knows that this id came from THIS read's turn_id.
    // A persisted prefix is not a saved (turn_id, proposal_id) association.
    const serverTurnId = freshlyBuiltServerHistory && hasServerPrefix
      ? message.id.slice('restored-assistant-'.length) : undefined
    if (message.heldProposalId === undefined && !hasServerPrefix) return message
    const turnId = message.heldTurnId ?? serverTurnId
    const offer = offers.find(o => !used.has(o.proposalId)
      && turnId !== undefined && o.turnId === turnId
      && (serverTurnId === undefined || serverReplyCounts.get(serverTurnId) === 1)
      && (o.proposalId === message.heldProposalId
        || (serverTurnId !== undefined && message.heldProposalId === undefined)))
    // Drop any prior restored controls before adopting the fresh authority; saved chips never participate.
    const { actionChips: _oldChips, ...rest } = message
    if (offer === undefined) return rest
    used.add(offer.proposalId)
    return { ...rest, heldProposalId: offer.proposalId, heldTurnId: offer.turnId,
      actionChips: buildSuggestedActionChips([], offer.actions) }
  }).reverse()
}

interface ServerSuggestedAction {
  readonly id: string
  readonly label: string
  readonly message: string
}

/** CEE's exact next-step shape. A malformed action array withholds actions, never the turn's text. */
function readRestoredSuggestedActions(raw: unknown): readonly ServerSuggestedAction[] | undefined {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 8) return undefined
  const actions: ServerSuggestedAction[] = []
  for (const action of raw) {
    if (action === null || typeof action !== 'object' || Array.isArray(action)) return undefined
    const row = action as Record<string, unknown>
    const keys = Object.keys(row)
    if (keys.length !== 3 || keys.some(key => key !== 'id' && key !== 'label' && key !== 'message')
      || text(row.id) === null || text(row.label) === null || text(row.message) === null) return undefined
    actions.push({ id: row.id as string, label: row.label as string, message: row.message as string })
  }
  return actions
}

/** Only the read's last turn can arm its exact last answer; a later user message or armed held controls take priority. */
export function reconcileRestoredSuggestedActions(
  messages: readonly ConversationMessage[],
  turns: readonly ServerConversationTurn[],
): ConversationMessage[] {
  const turn = turns[turns.length - 1]
  if (!turn?.suggestedActions || turn.assistantMessage === null) return [...messages]
  let lastAnswer = -1
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]
    if (message.role === 'assistant' && !message.sessionDivider && !message.synthetic) lastAnswer = i
  }
  if (lastAnswer < 0 || messages.slice(lastAnswer + 1).some(message => message.role === 'user')) return [...messages]
  const answer = messages[lastAnswer]
  if (answer.id !== `restored-assistant-${turn.turnId}` && answer.clientTurnId !== turn.turnId
    && answer.serverTurnId !== turn.turnId) return [...messages]
  if (answer.heldProposalId && answer.actionChips?.length) return [...messages]
  // The retained card owns its Confirm/Decline; rebuilding with no wire blocks would duplicate those controls (F4).
  if (answer.blocks?.some(block => block.type === 'v5_held_proposal')) return [...messages]
  return messages.map((message, i) => i === lastAnswer
    ? { ...message, actionChips: buildSuggestedActionChips([], turn.suggestedActions) } : message)
}
