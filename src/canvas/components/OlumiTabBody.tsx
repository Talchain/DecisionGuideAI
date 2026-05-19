import { memo, useCallback } from 'react'
import { ExternalLink, MessageSquare } from 'lucide-react'
import { typo } from '../../styles/typography'
import { useConversationContext } from '../conversation/ConversationContext'
import { ConversationPanel } from '../conversation/ConversationPanel'
import { useFloatingPanelState } from '../hooks/useFloatingPanelState'
import { focusFloating } from '../hooks/useFloatingFocus'

interface OlumiTabBodyProps {
  /** Opens the floating Olumi panel for the user. */
  onFloatOut?: () => void
}

/**
 * OlumiTabBody — docked Olumi tab content.
 *
 * Three render states:
 *  - Floating panel is open → placeholder + actions ("Focus floating",
 *    "Dock here"). Preserves the one-readable-surface invariant: we never
 *    render the conversation twice.
 *  - Empty conversation (and floating closed) → guidance text + float-out.
 *  - Otherwise → full ConversationPanel with `hideComposer` (the persistent
 *    strip below the tab body owns submission).
 */
export const OlumiTabBody = memo(function OlumiTabBody({ onFloatOut }: OlumiTabBodyProps) {
  const conversation = useConversationContext()
  const realMessageCount = conversation.messages.filter((m) => !m.synthetic).length
  const floatingIsOpen = useFloatingPanelState((s) => s.isOpen)
  const closeFloating = useFloatingPanelState((s) => s.close)

  const handleCollapse = useCallback(() => {
    // The dock's own collapse button handles this; ChatTopBar is hidden anyway.
  }, [])
  const handleAttach = useCallback(() => {
    // Attach evidence is handled by CogPopover, not here.
  }, [])

  const handleFocusFloating = useCallback(() => {
    focusFloating()
  }, [])
  const handleDockHere = useCallback(() => {
    closeFloating()
  }, [closeFloating])

  if (floatingIsOpen) {
    return (
      <div
        className="flex flex-1 min-h-0 items-center justify-center px-6 py-6"
        data-testid="olumi-tab-floating-placeholder"
      >
        <div className="flex flex-col items-center gap-3 max-w-xs">
          <MessageSquare className="w-8 h-8 text-text-light" aria-hidden="true" />
          <p className={typo('panelBody', 'text-text-body text-center')}>
            Olumi is open in the floating panel.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFocusFloating}
              className={typo(
                'panelMeta',
                'inline-flex items-center gap-1 text-info hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded px-1.5 py-0.5',
              )}
              data-testid="olumi-tab-focus-floating"
            >
              Focus floating
            </button>
            <span className={typo('panelMeta', 'text-text-light')} aria-hidden="true">·</span>
            <button
              type="button"
              onClick={handleDockHere}
              className={typo(
                'panelMeta',
                'inline-flex items-center gap-1 text-info hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded px-1.5 py-0.5',
              )}
              data-testid="olumi-tab-dock-here"
            >
              Dock here
            </button>
          </div>
        </div>
      </div>
    )
  }

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
        />
      </div>
    </div>
  )
})
