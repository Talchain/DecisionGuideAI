/**
 * ThinkingDots — the chat thread's in-flight indicator.
 *
 * DS v5 §21.3: "Three pulsing dots (`text-info`) for thinking." The thread
 * drew the six-node-shape wave (`ThinkingIndicator`) instead; Paul asked for
 * the chat to match the design (26 Sep, Chat Atlas review). The first-use
 * composer keeps `ThinkingIndicator`: a different surface, not covered by §21.
 *
 * Left-aligned, on Olumi's side of the thread, because it stands in for the
 * reply that is coming. The label is the thread's own phase line
 * (`thinkingLabel`), unchanged, so the narration-honesty rules still hold.
 */
import { typography } from '../../../styles/typography'

interface ThinkingDotsProps {
  label?: string | null
}

const DOTS = [0, 1, 2] as const

export function ThinkingDots({ label }: ThinkingDotsProps) {
  return (
    <div
      className="flex items-center self-start"
      style={{ gap: 8, marginBottom: 20 }}
      data-testid="thinking-indicator"
      data-variant="dots"
      role="status"
    >
      <span className="flex items-center" style={{ gap: 4 }} aria-hidden="true">
        {DOTS.map((i) => (
          <span
            key={i}
            data-testid="thinking-dot"
            className="block rounded-full bg-info thinking-dot"
            style={{ width: 6, height: 6, animation: `thinkingDotPulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </span>
      {label && (
        <span className={`text-text-light ${typography.panelMeta}`} data-testid="thinking-label">
          {label}
        </span>
      )}
      <style>{`
        @keyframes thinkingDotPulse {
          0%, 80%, 100% { opacity: 0.25; }
          40% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .thinking-dot { animation: none !important; opacity: 0.6 !important; }
        }
      `}</style>
    </div>
  )
}
