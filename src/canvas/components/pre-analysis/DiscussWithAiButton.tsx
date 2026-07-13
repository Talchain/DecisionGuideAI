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
import { openAskOlumi } from '@/components/results/coaching/askOlumiStore'
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
  /**
   * Visual emphasis variant (Brief 5.1 Task 9).
   *
   * - 'primary' (default): full emphasis — preserves current behaviour at
   *   every non-Analysis-tab call site.
   * - 'secondary': opacity-50 at rest; reveals to full emphasis on hover,
   *   keyboard focus (focus-visible), or parent focus (focus-within).
   *   Reduces panel-wide sparkle density on the Analysis tab without
   *   making the control invisible at rest (visibility floor — no
   *   opacity-0 / sr-only). Keyboard users still see the affordance
   *   revealed before activation.
   */
  variant?: 'primary' | 'secondary'
}

function DiscussWithAiButtonImpl({ element, onSend, ariaLabel, className, variant = 'primary' }: DiscussWithAiButtonProps) {
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
    // Parity P7a: open the Work-through-it-with-Olumi drawer with the prompt
    // PREFILLED and EDITABLE instead of auto-sending into a conversation on
    // another tab — the invisible auto-send read as "the button does
    // nothing" (audit dead-button class). The drawer dispatches on Send and
    // degrades honestly when no conversation callback is registered.
    openAskOlumi({
      context: 'Discuss this part of the model with Olumi.',
      draft: text,
      label: 'Discuss with Olumi',
      source: 'chip',
    })
  }, [element, onSend])

  // If neither callback is registered and no onSend override, render nothing — no dead button.
  if (!onSend && !sendMessage && !prefillChat) return null

  const computedAriaLabel = ariaLabel ?? buildDefaultAriaLabel(element)

  // Brief 5.1 Task 9: opacity-50 at rest for the secondary variant, with
  // full-emphasis reveal on hover or keyboard focus. Transition-opacity is
  // appended so the reveal animates alongside the existing colour shift.
  const variantClasses = variant === 'secondary'
    ? ' opacity-50 hover:opacity-100 focus-visible:opacity-100 focus-within:opacity-100 transition-opacity'
    : ''

  return (
    <Tooltip content="Discuss this with AI" delay={200}>
      <button
        type="button"
        onClick={handleClick}
        aria-label={computedAriaLabel}
        data-testid="discuss-with-ai"
        data-variant={variant}
        className={
          'inline-flex items-center justify-center w-6 h-6 rounded-full ' +
          'text-text-light hover:text-info focus-visible:text-info ' +
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 ' +
          'transition-colors' +
          variantClasses + ' ' +
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
