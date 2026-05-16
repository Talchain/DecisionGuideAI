/**
 * AIZone — owns the right-panel AI conversation surface.
 *
 * Calls `useConversation()` exactly once and passes the instance into
 * `ConversationPanel`. This is the single-instance guarantee required by
 * the approved plan's step-2 singleton checkpoint (correction #9): one
 * `_sendMessage` registration, one network request per send, no duplicate
 * message IDs across the conversation store.
 *
 * Step 3 will replace `ConversationPanel` (which mounts the heavy
 * `ChatComposer`) with a thinner mount of `ChatThread + AIInputBar` to
 * match the brief's compact mockup. For step 2 we reuse `ConversationPanel`
 * so the contract is verifiable end-to-end (chat, blocks, chips, patches,
 * registered callbacks) without re-implementing the handler matrix.
 */

import { memo } from 'react'
import { ConversationPanel } from '../conversation/ConversationPanel'
import { useConversation } from '../conversation/useConversation'

export const AIZone = memo(function AIZone() {
  const conversation = useConversation()
  return (
    <div data-testid="ai-panel-v2-zone" className="flex flex-col h-full min-h-0">
      <ConversationPanel
        conversation={conversation}
        // No collapse affordance in the persistent right-panel zone.
        onCollapse={noop}
        // Attachment trigger lands in step 3 with the cog popover.
        onAttach={noop}
      />
    </div>
  )
})

function noop() {
  /* intentionally empty — see AIZone JSDoc */
}
