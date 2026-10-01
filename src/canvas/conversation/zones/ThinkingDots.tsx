/**
 * The chat thread's in-flight indicator — Interaction Grammar v0 §2 "Waiting" (Canvas 5930399101, Paul 1 Oct 2026):
 * "the Olumi mark loader plus a rotating, short, science-grounded coaching line (≤90 characters). No static
 * 'Thinking…'." It replaces DS v5 §21.3's three dots.
 *
 * The coaching lines are the reasoning methods' own approved descriptions (`METHOD_CATALOGUE`), so this surface adds
 * no new meaning; their content belongs to the reasoning-coach lane. The thread's phase line (`thinkingLabel`) still
 * shows when it says something specific ("Analysing your options…"); the generic "Thinking…" is replaced by the
 * coaching line. Left-aligned, on Olumi's side of the thread, because it stands in for the reply that is coming.
 */
import { useEffect, useState } from 'react'
import { typography } from '../../../styles/typography'
import { OlumiAiIcon } from '../../../components/results/analysisNew/OlumiAiIcon'
import { METHOD_CATALOGUE } from '../../../components/results/decision-overview/actionsCatalogue'

interface ThinkingDotsProps {
  label?: string | null
}

/** The generic phase line the grammar retires. */
export const GENERIC_THINKING = 'Thinking…'
export const WAITING_LINE_MS = 5000
const lowerFirst = (s: string) => (s === '' ? s : `${s.charAt(0).toLowerCase()}${s.slice(1)}`)
/** "Consider the opposite: build the strongest case against the current result." — each ≤90 characters. */
// `review_bias` is left out: its description ("use only biases grounded in this brief or model") instructs Olumi,
// not the person waiting.
export const WAITING_COACHING_LINES: readonly string[] = METHOD_CATALOGUE
  .filter((m) => m.id !== 'review_bias')
  .map((m) => `${m.title}: ${lowerFirst(m.description)}`)
  .filter((line) => line.length <= 90)

export function ThinkingDots({ label }: ThinkingDotsProps) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (WAITING_COACHING_LINES.length < 2) return
    const t = setInterval(() => setI((n) => (n + 1) % WAITING_COACHING_LINES.length), WAITING_LINE_MS)
    return () => clearInterval(t)
  }, [])
  const phase = label && label !== GENERIC_THINKING ? label : null
  const coaching = WAITING_COACHING_LINES[i] ?? null
  return (
    <div
      className="flex items-start self-start"
      style={{ gap: 8, marginBottom: 20 }}
      data-testid="thinking-indicator"
      data-variant="olumi-mark"
      role="status"
    >
      <span className="olumi-waiting-mark flex-shrink-0" style={{ marginTop: 1 }} aria-hidden="true">
        <OlumiAiIcon size={18} />
      </span>
      <span className="flex flex-col min-w-0" style={{ gap: 2 }}>
        {phase && (
          <span className={`text-text-header ${typography.chatMeta}`} data-testid="thinking-label">
            {phase}
          </span>
        )}
        {coaching && (
          <span className={`text-text-light ${typography.chatMeta}`} data-testid="thinking-coaching-line">
            {coaching}
          </span>
        )}
      </span>
      <style>{`
        @keyframes olumiWaitingPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(0.9); }
        }
        .olumi-waiting-mark { display: inline-flex; animation: olumiWaitingPulse 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .olumi-waiting-mark { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
