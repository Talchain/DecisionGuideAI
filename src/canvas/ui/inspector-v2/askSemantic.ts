/**
 * askSemantic — ONE semantic for every "ask Olumi about this" affordance.
 *
 * The defect this closes (ledger L-18, a trap-21 pair): the inspector carried
 * TWO ask affordances with OPPOSITE semantics. `InspectorCoaching` AUTO-SENT
 * via `_sendMessage`; `DiscussWithAiButton` PREFILLED an editable draft and
 * waited. Same user intent, opposite behaviour, one panel — and the auto-send
 * is the one that lies, because the message lands in a surface the user may not
 * be looking at, so the control reads as dead.
 *
 * ─── THE TWO QUESTIONS, NAMED APART ──────────────────────────────────
 *
 * Q1 · "How does an ask get CONFIRMED?"
 *      ONE answer, everywhere: it does not dispatch. It becomes an editable
 *      draft in a visible surface with a single obvious Send, which the user
 *      presses. That is `ASK_SEMANTIC`.
 *
 * Q2 · "Which CARRIER does the confirmed ask travel on?"
 *      Per call site, and deliberately NOT unified. An ask carrying dispatch
 *      `parameters` rides the conversation-typed turn, because chip_metadata —
 *      the contextual-session carrier — survives ONLY on that turn type.
 *      Flattening those into a bare composer prefill would silently drop it.
 *
 * Conflating Q1 and Q2 is what produced the pair in the first place. They are
 * answered separately here, on purpose.
 *
 * ─── ROUTING ─────────────────────────────────────────────────────────
 *
 *   plain ask + composer registered  → prefill the composer, reveal it.
 *                                      No third floating surface: a simple
 *                                      prefill suffices.
 *   ask with dispatch parameters     → the Ask-Olumi drawer (typed dispatch).
 *   no composer registered           → the Ask-Olumi drawer (the fallback
 *                                      confirm surface — the ask is never lost
 *                                      and never auto-sent).
 *   no surface at all                → nothing. The affordance should not have
 *                                      rendered; it must not pretend.
 *
 * NOT an ask, and therefore not routed here: a slash command such as
 * `/exercise premortem`. Its button IS the confirmation, and a prefilled slash
 * command would sit in the composer as literal text instead of executing.
 */

import { useGuidanceStore } from '../../stores/guidanceStore'
import { revealOlumiSurface } from '../../conversation/revealOlumi'
import { openAskOlumi } from '../../../components/results/coaching/askOlumiStore'

/**
 * The one semantic. Exported so a guard can pin it: if this string ever
 * changes, every surface that claims to implement it must be re-read.
 */
export const ASK_SEMANTIC = 'prefill-and-confirm' as const

export interface AskRequest {
  /** The question, as the user will see it in the editable draft. */
  text: string
  /** Short label describing the ask (drawer heading / dispatch label). */
  label: string
  /** Optional context line for the drawer. */
  context?: string
  /** Optional model target enabling the drawer's "Focus on canvas". */
  targetId?: string
  /**
   * Dispatch parameters. PRESENCE OF THIS FIELD IS THE CARRIER DECISION (Q2):
   * an ask that carries parameters must ride the typed dispatch, so it routes
   * to the drawer even when a composer is available.
   */
  parameters?: Record<string, unknown>
  /** Dispatch source tag (defaults to 'chip'). */
  source?: string
}

/**
 * Route an ask under the one semantic. NEVER dispatches; returns the surface
 * that received the draft so callers can assert on it.
 */
export function requestAsk(req: AskRequest): 'composer' | 'drawer' | 'none' {
  const text = req.text.trim()
  if (!text) return 'none'

  const state = useGuidanceStore.getState()
  const needsTypedDispatch = req.parameters !== undefined

  if (!needsTypedDispatch && state._prefillChat) {
    state._prefillChat(text)
    revealOlumiSurface()
    return 'composer'
  }

  // Any registered conversation wire means the drawer's Send can land.
  if (state._prefillChat || state._sendMessage || state._dispatchAction) {
    openAskOlumi({
      context: req.context ?? '',
      draft: text,
      label: req.label,
      targetId: req.targetId,
      parameters: req.parameters,
      source: req.source ?? 'chip',
    })
    return 'drawer'
  }

  return 'none'
}

/** True when any surface can receive an ask. Use to gate the affordance. */
export function canReceiveAsk(state: {
  _prefillChat: unknown
  _sendMessage: unknown
  _dispatchAction: unknown
}): boolean {
  return state._prefillChat !== null || state._sendMessage !== null || state._dispatchAction !== null
}
