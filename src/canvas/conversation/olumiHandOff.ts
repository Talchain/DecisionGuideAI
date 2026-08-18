/**
 * olumiHandOff — THE ONE hand-off used by every Model-tab affordance that
 * terminates in a conversation rather than in a mutation.
 *
 * This is the implementation of `model-tab-v2/contracts.ts` §2 `HandOffToOlumi`,
 * which until now was a TYPE WITH NO IMPLEMENTATION anywhere in the tree
 * (derived at `9ff14c19`: one occurrence, the declaration itself).
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
import type { HandOffToOlumi } from '../model-tab-v2/contracts'

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
