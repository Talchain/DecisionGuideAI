/**
 * olumiHandOff — THE ONE hand-off used by every Model-tab affordance that
 * terminates in a conversation rather than in a mutation.
 *
 * It implements what `model-tab-v2/contracts.ts` §2 declared as `HandOffToOlumi`
 * — a type that, derived at `9ff14c19`, had exactly ONE occurrence in the tree:
 * its own declaration. Nothing was bound to it, and all eleven Model-tab
 * send-to-AI controls bypassed it entirely.
 *
 * ⚠ THE TYPES NOW LIVE HERE, WITH THE CODE THAT SATISFIES THEM. They cannot stay
 * in `model-tab-v2/` because that directory's boundary scan pins `ModelTabBody`
 * as the only outside file permitted to reference it — and a type import is a
 * real reference. Widening that allowlist to accommodate one import would have
 * spent a structural guarantee on a convenience. Co-locating is also simply
 * truer: a contract declared where it is CONSUMED has no owner, which is how
 * this one sat unimplemented while the product shipped the defect it described.
 *
 * ── THE DEFECT IT CLOSES ──────────────────────────────────────────────────
 *
 * Every send-to-AI control on the Model tab called `onSendMessage` DIRECTLY,
 * with no fronting: `FactorsSection.tsx:737` ("Add a factor"),
 * `RelationshipsSection.tsx:819` ("Add a relationship"),
 * `OptionsSection.tsx:486`/`:508` ("Explore other strategies"),
 * `RisksSection.tsx:100` ("Identify risks"), and six "Discuss this with the AI"
 * buttons. So a real turn was posted into a panel that could stay hidden: the
 * user clicked, and nothing visibly happened.
 *
 * That matters most for the STRUCTURAL controls. They terminate in a
 * conversation rather than a mutation, so an invisible conversation makes them
 * dead ends — the product offering an action it does not carry through. That is
 * preamble P8 (never ask what you cannot accept) and the same family as the
 * Research-CTA ruling.
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────
 *
 * FRONT FIRST, THEN SEND. Never the reverse: a send that lands before the
 * surface is revealed is the defect above with better timing.
 *
 * ⚠ THE OUTCOME IS TAKEN FROM `revealOlumiSurface`, NEVER RE-DERIVED HERE.
 * Modelling "is Olumi visible?" in this module would be a second copy of a rule
 * the surfaces already implement (trap 12), and #773 rejected precisely that
 * re-derivation. This module asks; it does not decide.
 *
 * ⚠ AND IT IS A FACTORY, NOT A FREE FUNCTION, ON PURPOSE. The sender comes from
 * the caller's React context. When there is no sender the hand-off CANNOT be
 * honoured, and `createOlumiHandOff(undefined)` returns `null` rather than a
 * callable that silently swallows the turn — so a surface with no conversation
 * cannot render an affordance that does nothing. Not offering is the honest
 * failure mode; offering-and-dropping is the dead end this file removes.
 */

import { revealOlumiSurface } from './revealOlumi'

/**
 * Whether the Olumi surface actually came to the front.
 *
 * ⚠ THE OUTCOME IS THE POINT. A hand-off that cannot front the panel must be
 * able to SAY so rather than send into silence — which is what every Model-tab
 * control did before this module existed.
 */
export type PanelFrontingOutcome = 'fronted' | 'deferred'

/**
 * Front the Olumi conversation wherever the user left it — docked, floating or
 * collapsed — and report whether a surface came forward.
 *
 * ⚠ ORIGIN IS THE USER'S. These are user gestures: they must not stamp
 * `outputSurfaceOrigin: 'assistant'` or raise the `AssistantOpenedNotice`.
 * Telling someone Olumi opened something they opened themselves is a lie on the
 * one channel whose entire purpose is truthfulness.
 */
export type FrontOlumiPanel = (opts?: { reason?: string }) => PanelFrontingOutcome

/**
 * The single hand-off every Model-tab send-to-AI affordance goes through.
 *
 * ⚠ THE RULE: no Model-tab control may call `onSendMessage` directly. Fronting
 * happens FIRST, then the send. It matters most for the STRUCTURAL affordances
 * ("Add a factor", "Add a relationship", "Explore other strategies", "Identify
 * potential risks") — they terminate in a conversation rather than a mutation, so
 * an invisible conversation makes them dead ends. That combination — the tab's
 * only structural affordances ending in a hidden panel — is the measured
 * mechanism behind "the less I feel like I can actually directly edit the model".
 */
export type HandOffToOlumi = (opts: {
  message: string
  reason?: string
}) => PanelFrontingOutcome

/**
 * The send signature as `ModelTabBody` already receives it. Deliberately the
 * live prop's shape rather than a tidier invention — a second shape here would
 * need an adapter, and the adapter is where the `hidden` option would get lost.
 */
export type OlumiSend = (
  message: string,
  opts?: { hidden?: boolean; debugSource?: string },
) => void

/**
 * Build the hand-off, or `null` when no conversation can receive it.
 *
 * `null` is load-bearing: callers render their affordances only when this is
 * non-null, which is the same `{onSendMessage && …}` guard the v1 sections
 * already used — preserved rather than dropped, because it is the thing that
 * stops the button existing when the turn cannot.
 */
export function createOlumiHandOff(send: OlumiSend | undefined | null): HandOffToOlumi | null {
  if (!send) return null
  return ({ message, reason }) => {
    // Front FIRST. The outcome is whatever the convergence primitive reports.
    const fronted = revealOlumiSurface()
    // Then send — unconditionally. A turn is still worth posting into a panel
    // the user can open themselves; what must not happen is CLAIMING it was
    // fronted when it was not, which the return value prevents.
    send(message, reason ? { debugSource: reason } : undefined)
    return fronted ? 'fronted' : 'deferred'
  }
}
