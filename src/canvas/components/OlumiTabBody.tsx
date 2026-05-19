import { memo, useCallback } from 'react'
import { ExternalLink } from 'lucide-react'
import { typo } from '../../styles/typography'
import { useConversationContext } from '../conversation/ConversationContext'
import { ConversationPanel } from '../conversation/ConversationPanel'

interface OlumiTabBodyProps {
  /** Opens the floating Olumi panel for the user. */
  onFloatOut?: () => void
}

/**
 * OlumiTabBody — docked Olumi tab content.
 *
 * Renders the conversation thread at full panel height. Composer is owned by
 * the persistent input strip below the tab body — this surface intentionally
 * does NOT render its own composer (preserves the "no duplicate composer"
 * invariant). Reuses ConversationPanel with `hideComposer` so all patch /
 * feedback / run wiring stays in a single source of truth.
 */
export const OlumiTabBody = memo(function OlumiTabBody({ onFloatOut }: OlumiTabBodyProps) {
  const conversation = useConversationContext()
  const realMessageCount = conversation.messages.filter((m) => !m.synthetic).length

  // No-op handlers — the docked surface delegates these to its host.
  const handleCollapse = useCallback(() => {
    // The dock's own collapse button handles this; ChatTopBar is hidden anyway.
  }, [])
  const handleAttach = useCallback(() => {
    // Attach evidence is handled by CogPopover, not here.
  }, [])

  if (realMessageCount === 0) {
    return (
      <div
        className="flex flex-1 min-h-0 items-center justify-center px-6 py-6"
        data-testid="olumi-tab-empty"
      >
        <div className="flex flex-col items-center gap-3 max-w-xs">
          <p className={typo('panelBody', 'text-text-light text-center')}>
            Describe your decision, the options you're weighing, and what a good outcome looks like.
          </p>
          {onFloatOut ? (
            <button
              type="button"
              onClick={onFloatOut}
              className={typo(
                'panelMeta',
                'inline-flex items-center gap-1 text-text-light hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded px-1.5 py-0.5',
              )}
              aria-label="Open Olumi in floating panel"
              data-testid="olumi-tab-float-out"
            >
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
              <span>Open floating</span>
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col" data-testid="olumi-tab-body">
      {onFloatOut ? (
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
      ) : null}
      <div className="flex flex-1 min-h-0 flex-col">
        <ConversationPanel
          conversation={conversation}
          onCollapse={handleCollapse}
          onAttach={handleAttach}
          hideComposer
          hideTopBar
        />
      </div>
    </div>
  )
})
