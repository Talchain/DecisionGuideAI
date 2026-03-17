/**
 * CoachingTip — dismissible coaching card above the input.
 *
 * bg-panel, border info/12, shadow-s1, rounded-sm (8px).
 * Sparkles icon in info colour, tip text 12px, X dismiss.
 * Slides up 150ms on appearance.
 */

import { Sparkles } from 'lucide-react'

interface CoachingTipProps {
  tip: string
  onDismiss: () => void
}

export function CoachingTip({ tip, onDismiss }: CoachingTipProps) {
  return (
    <div
      className="coaching-tip-enter flex items-start bg-panel rounded-lg"
      style={{
        gap: 8,
        padding: '8px 12px',
        border: '1px solid rgba(99,173,207,0.12)',
        boxShadow: '0 1px 2px rgba(38,38,38,0.06)',
      }}
      data-testid="coaching-tip"
    >
      <Sparkles className="w-3.5 h-3.5 text-info flex-shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-text-body flex-1" style={{ fontSize: 12, lineHeight: 1.5 }}>{tip}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss tip"
        className="flex-shrink-0 flex items-center bg-transparent border-none p-0.5 text-text-light hover:text-text-body transition-colors duration-100 cursor-pointer"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>

      <style>{`
        @keyframes coachingTipIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .coaching-tip-enter {
          animation: coachingTipIn 150ms cubic-bezier(0.4, 0, 0.2, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .coaching-tip-enter { animation: none; }
        }
      `}</style>
    </div>
  )
}
