/**
 * collapsedResponseSignal — decides whether a just-settled assistant turn
 * must auto-expand the collapsed outputs dock to its Olumi tab.
 *
 * ## The defect this fixes
 * On the aiPanelV2 first-touch journey the canvas is empty, so the outputs
 * dock is forced to its collapsed 40px rail (`isFirstUse` overrides
 * `state.isOpen`) and the floating hero (FirstUseComposer) is the entry
 * point. The hero renders a composer only — it has NO transcript. When the
 * user sends a brief and CEE replies with a `clarify_v2` question + suggested
 * chips (a CONVERSATIONAL turn that drafts no graph), that response renders
 * ONLY inside the dock's Olumi tab — which is collapsed. From the user's
 * seat: they typed, the thinking indicator ended, and nothing visibly
 * happened. The question and its chips are invisible until they happen to
 * expand the dock.
 *
 * A DRAFT turn masks this same gap: the graph populates the canvas and
 * FirstUseComposer's 0→N reposition effect force-activates the Analysis tab,
 * so the dock visibly opens. A clarify turn adds no nodes, so neither the
 * graph nor the reposition fires — nothing surfaces the response.
 *
 * ## Why a pure helper
 * OutputsDock cannot be mounted in the unit suite (its supabase / threadService
 * dependency chain throws at import in the test env — see aiPanelV2.parity.spec
 * and OutputsDock.testability.spec). Following the same convention as the other
 * dock decision helpers (`dockHostsOlumi` in olumiSurface.ts, `deriveNextDockIsOpen`,
 * `runStatusRegion`), the surfacing decision is a pure function so it is directly
 * and mutation-checkably testable; OutputsDock's effect is a thin caller that
 * only gathers the inputs and, on a true verdict, performs the same rail-override
 * drop + tab-dock that the user's own chevron-expand (`toggleOpen`) performs.
 */

import type { ConversationMessage } from '../conversation/types'

/**
 * True when the latest REAL (non-synthetic) message is an assistant reply
 * that carries something visible — prose or chips. This is the "a genuine
 * conversational response arrived" test.
 *
 * Deliberately skips synthetic messages: a send FAILURE (transport / timeout /
 * typed error) leaves a synthetic assistant error bubble or no assistant reply
 * at all, so this returns false and the dock is NOT auto-expanded — the
 * FirstUseComposer shows its own point-of-failure notice instead. A blank CEE
 * response (guarded to a synthetic bubble) likewise yields false.
 */
export function latestRealMessageIsAssistantReply(
  messages: readonly ConversationMessage[] | undefined | null,
): boolean {
  if (!messages || messages.length === 0) return false
  let latestReal: ConversationMessage | undefined
  for (let i = messages.length - 1; i >= 0; i--) {
    if (!messages[i].synthetic) {
      latestReal = messages[i]
      break
    }
  }
  if (!latestReal || latestReal.role !== 'assistant') return false
  const hasProse = (latestReal.content?.trim().length ?? 0) > 0
  const hasChips = (latestReal.actionChips?.length ?? 0) > 0
  return hasProse || hasChips
}

/**
 * True when the latest REAL (non-synthetic) message is a user send that did not
 * resolve into a delivered reply — `deliveryState` 'failed' OR 'unconfirmed'.
 * This is the honest ERROR counterpart to `latestRealMessageIsAssistantReply`:
 * an invisible error is worse than an invisible question, so a failed turn must
 * surface the same way a clarify reply does.
 *
 * ⚠ ROADMAP 2.665 — 'unconfirmed' IS INCLUDED, AND THE OMISSION WOULD HAVE BEEN
 * A SILENT REGRESSION. The wait-expiry path used to mark its bubble 'failed';
 * it now marks it 'unconfirmed', because the client cannot verify non-delivery
 * (see deliveryUnknown.ts). Had this predicate kept testing 'failed' alone, a
 * wait expiry with the panel collapsed would have surfaced NOTHING — the exact
 * invisible-error case this function exists to prevent, reintroduced by a state
 * rename. An unknown outcome needs surfacing at least as much as a known
 * failure does: the user is owed the notice either way.
 *
 * Every user-mode failure path in useConversation.ts — buildV5Payload refusal,
 * the request timeout, a typed_error response, and a thrown dispatch — marks
 * the user bubble `deliveryState: 'failed'` (useConversation.ts:3254, 3304,
 * 3386, 3873) and then appends a SYNTHETIC assistant error bubble carrying the
 * "Not delivered" copy + Retry chip + recovery guidance. `updateMessage`
 * patches the user bubble in place (useConversation.ts:1888), so it keeps its
 * original position AHEAD of the appended synthetic bubble. Skipping synthetics
 * (exactly as the assistant-reply scan does), the latest real message is
 * therefore that failed user bubble.
 *
 * Deliberately narrow — matches a genuinely FAILED user send only:
 *   - a delivered-but-empty turn leaves the user bubble `deliveryState: 'sent'`
 *     (useConversation.ts:3386) and matches neither predicate — that's the
 *     blank-response case #446 already stands down on;
 *   - a system / background failure adds no user bubble at all (its transcript
 *     bubble is suppressed), so there is no failed user send to find.
 * This does NOT loosen `latestRealMessageIsAssistantReply` — the two are
 * mutually exclusive by construction (the latest real message is one role or
 * the other).
 */
export function latestRealMessageIsFailedTurn(
  messages: readonly ConversationMessage[] | undefined | null,
): boolean {
  if (!messages || messages.length === 0) return false
  let latestReal: ConversationMessage | undefined
  for (let i = messages.length - 1; i >= 0; i--) {
    if (!messages[i].synthetic) {
      latestReal = messages[i]
      break
    }
  }
  if (!latestReal || latestReal.role !== 'user') return false
  return latestReal.deliveryState === 'failed' || latestReal.deliveryState === 'unconfirmed'
}

export interface CollapsedResponseSignalInput {
  /** aiPanelV2 floating-first UX is active. The whole signal is FF-gated. */
  aiPanelV2On: boolean
  /**
   * A live turn just settled: `isThinking` transitioned true→false. This EDGE
   * is the reliable "user's own composer send" discriminator — hydration and
   * session-resume set isThinking=false WITHOUT a preceding true
   * (useConversation.ts), so a page load never trips it. Only a composer send
   * produces the edge, and on the empty first-touch canvas a composer send is
   * the only thing that can.
   */
  thinkingSettled: boolean
  /** The dock is visually collapsed right now (effectiveIsOpen === false). */
  dockCollapsed: boolean
  /**
   * A graph exists on the canvas. The DRAFT path already surfaces the dock in
   * this case (canvas populates + Analysis force-activates), so the clarify
   * signal must stand down — this cleanly separates a clarify turn (no nodes)
   * from a draft turn (nodes added before the turn settles).
   */
  hasGraphContent: boolean
  /**
   * The conversation is already visible in an OPEN floating panel showing its
   * transcript (source !== 'system-first-use', not minimised). Never move a
   * conversation the user can already see — that would be surprise motion.
   * The transcript-less first-use hero does NOT count as visible.
   */
  floatingTranscriptVisible: boolean
  /** The just-settled turn produced a genuine assistant reply (prose or chips). */
  hasAssistantReply: boolean
  /**
   * The just-settled turn FAILED — its user send is marked
   * `deliveryState: 'failed'` (timeout / typed error / thrown dispatch) and the
   * "Not delivered" + Retry + recovery guidance renders only inside the
   * collapsed dock. Surfaced for the same reason as a reply: an invisible error
   * is worse than an invisible question.
   */
  hasFailedTurn: boolean
}

/**
 * Whether a just-settled turn must auto-expand the collapsed dock to its Olumi
 * tab so its outcome is visible. All five context gates must hold, and the turn
 * must have produced something worth surfacing — a genuine assistant reply OR a
 * failed send whose recovery affordance is otherwise stranded in the collapsed
 * dock. Any context gate false stands the signal down (no surprise motion, no
 * fighting the draft path); a turn that produced neither a reply nor a failure
 * surfaces nothing.
 */
export function shouldAutoExpandDockForResponse(
  input: CollapsedResponseSignalInput,
): boolean {
  return (
    input.aiPanelV2On &&
    input.thinkingSettled &&
    input.dockCollapsed &&
    !input.hasGraphContent &&
    !input.floatingTranscriptVisible &&
    (input.hasAssistantReply || input.hasFailedTurn)
  )
}
