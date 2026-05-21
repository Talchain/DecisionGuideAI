import { memo, useCallback } from 'react'
import { ExternalLink } from 'lucide-react'
import { typo } from '../../styles/typography'
import { useConversationContext } from '../conversation/ConversationContext'
import { ConversationPanel } from '../conversation/ConversationPanel'

interface OlumiTabBodyProps {
  /** Opens the floating Olumi panel for the user (manual float-out from
   *  the docked tab). Rendered as a small, subtle icon-only control —
   *  never as a CTA that blocks access to the docked conversation. */
  onFloatOut?: () => void
}

/**
 * OlumiTabBody — docked Olumi tab content.
 *
 * Round-3 UX correction: clicking the Olumi tab always docks the
 * conversation here (handleTabClick closes the floating panel first if
 * needed). The docked view is never a redirect to floating; the empty
 * state shows a calm welcome line, and a small float-out icon lives in
 * the top-right corner for users who prefer the floating window.
 *
 * Two render states:
 *  - Empty conversation → calm welcome line + subtle float-out icon.
 *  - Has messages → full ConversationPanel with `hideComposer` (the
 *    persistent strip below the tab body owns submission so the docked
 *    composer is never duplicated).
 */
export const OlumiTabBody = memo(function OlumiTabBody({ onFloatOut }: OlumiTabBodyProps) {
  const conversation = useConversationContext()
  const realMessageCount = conversation.messages.filter((m) => !m.synthetic).length

  const handleCollapse = useCallback(() => {
    // The dock's own collapse button handles this; ChatTopBar is hidden anyway.
  }, [])
  const handleAttach = useCallback(() => {
    // Attach evidence is handled by CogPopover, not here.
  }, [])

  // Float-out icon — small, top-right corner, subtle. Available in both
  // empty and populated states so users can switch surface preference
  // without losing draft text (singleton ConversationContext preserves it).
  const floatOutIcon = onFloatOut ? (
    <div className="flex justify-end px-2 pt-1 pb-0.5">
      <button
        type="button"
        onClick={onFloatOut}
        className="inline-flex items-center justify-center w-6 h-6 rounded text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        aria-label="Open Olumi in floating panel"
        data-testid="olumi-tab-float-out"
        title="Open in floating window"
      >
        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  ) : null

  if (realMessageCount === 0) {
    return (
      <div className="flex flex-1 min-h-0 flex-col" data-testid="olumi-tab-empty">
        {floatOutIcon}
        <div className="flex flex-1 items-center justify-center px-6 py-6">
          <p className={typo('panelBody', 'text-text-light text-center max-w-xs')}>
            Start a conversation with Olumi using the input below.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col" data-testid="olumi-tab-body">
      {floatOutIcon}
      <div className="flex flex-1 min-h-0 flex-col">
        <ConversationPanel
          conversation={conversation}
          onCollapse={handleCollapse}
          onAttach={handleAttach}
          hideComposer
        />
      </div>
    </div>
  )
})
