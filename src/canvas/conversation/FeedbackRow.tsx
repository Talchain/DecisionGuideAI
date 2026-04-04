/**
 * FeedbackRow — Thumbs up/down feedback buttons per assistant turn
 *
 * Ephemeral state (voted) is component-local — feedback is a one-shot
 * action and doesn't need to survive re-renders or session restore.
 * Hidden when turnId is undefined (synthetic messages, system turns).
 *
 * Accessibility:
 * - 44×44px minimum touch targets
 * - prefers-reduced-motion: no transitions on state change
 */

import { useState, memo } from 'react'

const feedbackBtnFocusClass = 'feedback-btn'

interface FeedbackRowProps {
  /** clientTurnId echoed from orchestrator envelope; undefined for synthetic messages */
  turnId: string | undefined
  onFeedback: (turnId: string, rating: 'up' | 'down') => void
}

export const FeedbackRow = memo(function FeedbackRow({ turnId, onFeedback }: FeedbackRowProps) {
  const [voted, setVoted] = useState<'up' | 'down' | null>(null)

  // Don't render for synthetic messages (no canonical turn ID to send)
  if (turnId === undefined) return null

  const handleVote = (rating: 'up' | 'down') => {
    if (voted !== null) return // Already voted
    setVoted(rating)
    onFeedback(turnId, rating)
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: '2px',
        justifyContent: 'flex-end',
        marginTop: '4px',
      }}
      aria-label="Was this helpful?"
    >
      <button
        type="button"
        onClick={() => handleVote('up')}
        disabled={voted !== null}
        aria-label="Helpful"
        aria-pressed={voted === 'up'}
        className={feedbackBtnFocusClass}
        style={{
          minWidth: '44px',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          borderRadius: '6px',
          cursor: voted !== null ? 'default' : 'pointer',
          opacity: voted !== null && voted !== 'up' ? 0.3 : 1,
          color: voted === 'up' ? 'var(--success, #67C89E)' : 'var(--text-light, #908D8D)',
          transition: 'none',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={voted === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => handleVote('down')}
        disabled={voted !== null}
        aria-label="Not helpful"
        aria-pressed={voted === 'down'}
        className={feedbackBtnFocusClass}
        style={{
          minWidth: '44px',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          borderRadius: '6px',
          cursor: voted !== null ? 'default' : 'pointer',
          opacity: voted !== null && voted !== 'down' ? 0.3 : 1,
          color: voted === 'down' ? 'var(--danger, #EA7B4B)' : 'var(--text-light, #908D8D)',
          transition: 'none',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={voted === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <style>{`
        .feedback-btn:focus-visible {
          outline: 2px solid var(--info, #2B7FA2);
          outline-offset: 2px;
        }
        .feedback-btn:not(:disabled):hover {
          color: var(--info, #52A3C8);
        }
      `}</style>
    </div>
  )
})
