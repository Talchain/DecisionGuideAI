/**
 * DiscussWithAiButton — small sparkle icon (P1-2) anchored bottom-right of a
 * card. Click pre-fills the chat input with a contextual prompt; falls back
 * to direct send if pre-fill is not registered.
 *
 * Visual rules (DS v5):
 * - Lucide Sparkles icon, 14px
 * - text-text-light at rest, text-info on hover
 * - Bottom-right of the card with 8px inset (positioned by parent)
 * - Tooltip "Discuss this with AI"
 * - Visually secondary to primary card actions (smaller than the 16px
 *   pencil/check/sparkles icons in InlineValueControls)
 *
 * Memoised: hover should not trigger re-renders of parent cards.
 */

import { memo, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import Tooltip from '@/components/Tooltip'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import { buildAiDiscussPrompt, type AiDiscussElement } from './buildAiDiscussPrompt'

interface DiscussWithAiButtonProps {
  element: AiDiscussElement
  /**
   * Optional send override — called with the contextual prompt instead of the
   * guidanceStore. Use when the caller manages its own message handler (e.g.
   * ChallengeSection passing onSendMessage as a prop). When provided, the
   * guidanceStore is bypassed entirely.
   */
  onSend?: (prompt: string) => void
  /** Optional ARIA label override; defaults to "Discuss {label} with AI" */
  ariaLabel?: string
  /** Optional className extension for positioning context */
  className?: string
}

function DiscussWithAiButtonImpl({ element, onSend, ariaLabel, className }: DiscussWithAiButtonProps) {
  // Subscribe to primitive references only — no inline selectors that return
  // new arrays each call (would cause infinite loops per project guidance).
  const prefillChat = useGuidanceStore(s => s._prefillChat)
  const sendMessage = useGuidanceStore(s => s._sendMessage)

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const text = buildAiDiscussPrompt(element)
    // When caller provides onSend, bypass the store entirely.
    if (onSend) {
      onSend(text)
      return
    }
    // Auto-submit preferred: message lands immediately. Fall back to pre-fill
    // only when sendMessage is not registered (e.g. during onboarding flow).
    if (sendMessage) {
      sendMessage(text)
    } else if (prefillChat) {
      prefillChat(text)
    }
  }, [element, onSend, prefillChat, sendMessage])

  // If neither callback is registered and no onSend override, render nothing — no dead button.
  if (!onSend && !sendMessage && !prefillChat) return null

  const computedAriaLabel = ariaLabel ?? buildDefaultAriaLabel(element)

  return (
    <Tooltip content="Discuss this with AI" delay={200}>
      <button
        type="button"
        onClick={handleClick}
        aria-label={computedAriaLabel}
        data-testid="discuss-with-ai"
        className={
          'inline-flex items-center justify-center w-6 h-6 rounded-full ' +
          'text-text-light hover:text-info focus-visible:text-info ' +
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 ' +
          'transition-colors ' +
          (className ?? '')
        }
      >
        <Sparkles size={14} aria-hidden="true" />
      </button>
    </Tooltip>
  )
}

function buildDefaultAriaLabel(el: AiDiscussElement): string {
  switch (el.kind) {
    case 'factor': return `Discuss ${el.label} with AI`
    case 'edge':   return `Discuss the relationship between ${el.from} and ${el.to} with AI`
    case 'option': return `Discuss ${el.label} with AI`
    case 'bias':   return `Discuss ${el.biasType} with AI`
    case 'goal':   return `Discuss the goal ${el.label} with AI`
    case 'missing': return `Tell AI about something missing from the model`
  }
}

export const DiscussWithAiButton = memo(DiscussWithAiButtonImpl)
