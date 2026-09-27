/**
 * ⭐ C6-2 — "READING YOUR DECISION": the user's own goal and options, a few seconds into a first brief.
 *
 * A first brief waits ~60 s for its model on the first-use screen, with nothing but a thinking indicator. CEE's
 * `BRIEF_READ` frame copies the goal and the options out of the brief; each is an exact substring of what the user
 * typed (CEE drops any span that is not). This card shows them back AS QUOTES, under the neutral headings AI Quality
 * ruled (#70 5858767026): no leader, no ranking, no limits, nothing Olumi inferred, and never the word "model".
 * It lives only while the turn is drafting (`draftStore.draftStreamBriefReading`); the model supersedes it.
 */
import { memo } from 'react'

export interface BriefReadingCardProps {
  reading: { goal: string | null; options: string[] }
}

const quoted = (span: string) => `“${span}”`

export const BriefReadingCard = memo(function BriefReadingCard({ reading }: BriefReadingCardProps) {
  const { goal, options } = reading
  if (goal === null && options.length === 0) return null
  return (
    <section
      data-testid="brief-reading"
      aria-label="What Olumi read in your brief"
      className="w-full max-w-2xl rounded-lg border border-panel-border bg-panel px-4 py-3 flex flex-col gap-2"
    >
      <p className="text-xs text-text-light m-0">Reading your decision</p>
      {goal !== null ? (
        <div data-testid="brief-reading-goal" className="flex flex-col gap-0.5">
          <span className="text-xs text-text-light">You said you want to</span>
          <span className="text-sm text-text-body">{quoted(goal)}</span>
        </div>
      ) : null}
      {options.length > 0 ? (
        <div data-testid="brief-reading-options" className="flex flex-col gap-0.5">
          <span className="text-xs text-text-light">
            {options.length === 1 ? 'You’re considering' : 'You’re choosing between'}
          </span>
          <ul className="m-0 pl-4 list-disc flex flex-col gap-0.5">
            {options.map((o) => (
              <li key={o} data-testid="brief-reading-option" className="text-sm text-text-body">
                {quoted(o)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
})
