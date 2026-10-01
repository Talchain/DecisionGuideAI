/**
 * The chat thread's in-flight indicator — Interaction Grammar v0 §2 "Waiting" (Canvas 5930399101, Paul 1 Oct 2026):
 * "the Olumi mark loader plus a rotating, short, science-grounded coaching line (≤90 characters). No static
 * 'Thinking…'." It replaces DS v5 §21.3's three dots.
 *
 * The coaching lines are the Reasoning Coach's `waiting_library` (REASONING COACH ruling 5931857395,
 * `output/reasoning-coach/REASONING-INTERVENTIONS.json` @ `770a7b73`, coach 5931982930), copied verbatim: three lines
 * per phase, each ≤90 characters, rotating within the current phase only. When the phase is unknown there is no coaching
 * line at all: the coach's rule is never to guess a phase. Their content belongs to the reasoning-coach lane; edit them
 * there first. The thread's phase line (`thinkingLabel`) still shows when it says something specific ("Analysing your
 * options…"); the generic "Thinking…" is replaced by the coaching line. Left-aligned, on Olumi's side of the thread,
 * because it stands in for the reply that is coming.
 */
import { useEffect, useState } from 'react'
import { typography } from '../../../styles/typography'
import { OlumiAiIcon } from '../../../components/results/analysisNew/OlumiAiIcon'

export type WaitingPhase = 'reading_brief' | 'structuring' | 'running_analysis' | 'preparing_explanation'

interface ThinkingDotsProps {
  label?: string | null
  phase?: WaitingPhase | null
}

/** The generic phase line the grammar retires. */
export const GENERIC_THINKING = 'Thinking…'
export const WAITING_LINE_MS = 5000

/**
 * `waiting_library.lines` @ `770a7b73`, verbatim. The coach's rule: never claim progress that has not happened. Governed
 * by `narrationHonesty.invariant.spec.ts` like every other wait surface.
 */
export const WAITING_LINES: Readonly<Record<WaitingPhase, readonly string[]>> = {
  reading_brief: [
    'Good decisions start with the real question, not the first one that comes to mind.',
    "Decisions with real alternatives tend to go better than 'whether or not' choices.",
    'A goal written as a number makes it easier to tell which option gets there.',
  ],
  structuring: [
    "Separating what you control from what you can't makes trade-offs easier to see.",
    'A cause-and-effect map shows which assumptions your choice actually rests on.',
    "Each figure is marked as yours or Olumi's estimate, so you can see what to check.",
  ],
  running_analysis: [
    'The analysis tries many combinations of the uncertain values in your model.',
    "Results show what follows from the model's assumptions, not a forecast.",
    'Often one or two figures decide the choice. Those are the ones worth checking.',
  ],
  preparing_explanation: [
    'Olumi only puts an option forward when the analysis supports it.',
    'A result is only as strong as the figures behind it. Look for which are yours.',
    "Where a figure is Olumi's estimate, your own number can sharpen the answer.",
  ],
}

/**
 * The coach's `phase_of` (5931982930), from what the thread knows for certain: the draft's settling window is
 * structuring; a Run in flight (`results.status` preparing/connecting/streaming) is running the analysis; a turn on an
 * empty canvas is reading the brief. Anything else (a question or edit on an existing model, an explanation whose
 * narration request the UI cannot yet see) is unknown, and unknown gets no coaching line.
 */
export function waitingPhaseOf(t: { settling: boolean; analysisRunning: boolean; nodeCount: number }): WaitingPhase | null {
  if (t.settling) return 'structuring'
  if (t.analysisRunning) return 'running_analysis'
  if (t.nodeCount === 0) return 'reading_brief'
  return null
}

const NO_LINES: readonly string[] = []

export function ThinkingDots({ label, phase = null }: ThinkingDotsProps) {
  const lines = phase ? WAITING_LINES[phase] : NO_LINES
  const [i, setI] = useState(0)
  useEffect(() => {
    setI(0)
    if (lines.length < 2) return
    const t = setInterval(() => setI((n) => (n + 1) % lines.length), WAITING_LINE_MS)
    return () => clearInterval(t)
  }, [lines])
  const phaseLine = label && label !== GENERIC_THINKING ? label : null
  const coaching = lines.length > 0 ? lines[i % lines.length] : null
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
      {!phaseLine && !coaching && <span className="sr-only">{GENERIC_THINKING}</span>}
      <span className="flex flex-col min-w-0" style={{ gap: 2 }}>
        {phaseLine && (
          <span className={`text-text-header ${typography.chatMeta}`} data-testid="thinking-label">
            {phaseLine}
          </span>
        )}
        {coaching && (
          <span className={`text-text-light ${typography.chatMeta}`} data-testid="thinking-coaching-line" data-phase={phase ?? undefined}>
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
