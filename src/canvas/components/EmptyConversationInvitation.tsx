import { typo } from '../../styles/typography'
import { useEmptyConversationInvitation } from '../hooks/useConversationStage'

/**
 * The line an empty Olumi conversation shows in place of a thread.
 *
 * ⭐ WHY THIS IS A COMPONENT AND NOT A PARAGRAPH IN A TAB BODY.
 *
 * The invitation was introduced on 20 Sep 2026 to stop the empty Olumi surface
 * asking a user with a full canvas to "describe the decision you're working
 * through". It was written where the defect was photographed — inside
 * `OlumiTabBody` — and `useEmptyConversationInvitation` ended up with exactly
 * ONE consumer. But the conversation it describes has TWO hosts that show it
 * the same way: the docked tab and the floating panel, which renders
 * `ConversationPanel` directly and so inherited nothing.
 *
 * Measured, both surfaces in one browser run
 * (`e2e/geometry/floatingComposerLook.measure.ts`, same seeded canvas, same
 * empty conversation): the docked tab rendered the sentence; the floating panel
 * rendered a 400×550 white void above its composer. The fix that had been
 * described as "the empty Olumi surface now knows there is a model" was true of
 * one surface out of two.
 *
 * So the invitation lives here, reads its own state, and is rendered by both
 * hosts. A host may choose WHERE to put it and WHAT to call it; it may not
 * choose what it says.
 *
 * ⚠ NOT EXTENDED TO `DraftChat`, the third `ConversationPanel` host. That is a
 * different conversation (the draft loop, which is never idle-empty in the way
 * these two are) and it has not been photographed. Widening to a surface nobody
 * has looked at is how the first version of this got its scope wrong.
 */

/**
 * ⚠ BOTH HOSTS CAN BE MOUNTED AT ONCE, so they must not answer to one
 * `data-testid` — the same hazard, and the same remedy, as
 * `THREAD_TESTID_DOCKED` / `THREAD_TESTID_FLOATING` in `zones/ChatThread.tsx`.
 * The DOCKED host keeps the plain name it already had: it is the canonical
 * surface, existing specs bind to it, and renaming it here would be a churn
 * with no reader.
 */
/**
 * ⭐ THE PREDICATE SHIPS WITH THE SENTENCE, for the same reason the state does.
 * "Empty" here means no NON-SYNTHETIC messages: synthetic entries (status
 * lines, placeholders) are things the product said to itself and must not count
 * as a conversation. Two hosts deciding that separately is how the invitation
 * would come back on one surface and not the other — the defect this module
 * exists to close.
 */
export function conversationIsEmpty(messages: ReadonlyArray<{ synthetic?: boolean }>): boolean {
  return messages.filter((m) => !m.synthetic).length === 0
}

export const INVITATION_TESTID_DOCKED = 'olumi-tab-empty-invitation'
export const INVITATION_TESTID_FLOATING = 'olumi-floating-empty-invitation'

export interface EmptyConversationInvitationProps {
  /** One of the two constants above. */
  testId: string
  /** Extra classes for host-specific placement (e.g. the floating overlay). */
  className?: string
}

export function EmptyConversationInvitation({ testId, className }: EmptyConversationInvitationProps) {
  // ⚠ THE STATE IS NOT RE-DERIVED PER HOST. This reads the SAME ladder the
  // composer's placeholder reads (`useConversationStage`), so the sentence and
  // the placeholder twenty pixels below it cannot drift apart — a second
  // predicate is exactly how they came apart the first time.
  const invitation = useEmptyConversationInvitation()

  return (
    <p
      className={typo('panelBody', `text-text-light text-center max-w-xs${className ? ` ${className}` : ''}`)}
      data-testid={testId}
    >
      {invitation}
    </p>
  )
}
