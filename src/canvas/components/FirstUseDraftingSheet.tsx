/**
 * ⭐ THE FIRST-USE DRAFTING SHEET (Paul, 7 Oct 2026, of the drafting screen: "The layout looks terrible… How can you
 * really enhance it so it looks premium?").
 *
 * Before: a disabled text box holding the status line, a row of pulsing shapes inside it, and a separate brief card of
 * a different width and frame below. Two mismatched objects, and the one the user reads first was a greyed-out input.
 * Now: ONE sheet.
 * - The top shows a model that draws itself from Olumi's node shapes (`DraftingModelMark`), the status line, the
 *   elapsed time, and Stop.
 * - The middle shows the brief, quoted in the user's words.
 * - The bottom shows the habits to pick while the draft is built (`BriefReadingCard`).
 *
 * What did not change:
 * - The status line is `DraftLoadingAnimation`'s elapsed-time table, verbatim (`messageForElapsed`). It names no
 *   stage, count or progress.
 * - Stop is the same control on the same predicate as the composer's (`draftStreamInFlight`, ROADMAP 2.134) and
 *   calls the same `cancelTurn`.
 * - The live region is the status line alone. The elapsed clock sits outside it, so a screen reader is not read a
 *   number every second.
 */
import { memo, useEffect, useState } from 'react'
import { Square } from 'lucide-react'
import { typo } from '../../styles/typography'
import { messageForElapsed } from './DraftLoadingAnimation'
import { DraftingModelMark } from './DraftingModelMark'
import { BriefReadingCard, type BriefReadingCardProps } from './BriefReadingCard'

export interface FirstUseDraftingSheetProps {
  reading: BriefReadingCardProps['reading']
  userFields: BriefReadingCardProps['userFields']
  /** The composer's own Stop handler, or null when no streamed draft is in flight (no Stop to offer). */
  onStop: (() => void) | null
}

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

/** The clock lives in its own component so the per-second tick re-renders only these two lines. */
const DraftingStatus = memo(function DraftingStatus() {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <>
      <div role="status" aria-live="polite" data-testid="first-use-thinking">
        <p data-testid="first-use-drafting-message" className="m-0 text-xl font-semibold leading-snug tracking-tight text-text-header [text-wrap:balance]">
          {messageForElapsed(elapsed)}
        </p>
      </div>
      <p className={typo('bodySmall', 'm-0 flex items-center gap-2 text-text-light')}>
        <span aria-hidden="true" className="relative inline-flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-info opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-info" />
        </span>
        <span data-testid="first-use-drafting-elapsed" className="tabular-nums">{clock(elapsed)}</span>
        <span>elapsed</span>
      </p>
    </>
  )
})

export const FirstUseDraftingSheet = memo(function FirstUseDraftingSheet({ reading, userFields, onStop }: FirstUseDraftingSheetProps) {
  return (
    <section
      data-testid="first-use-drafting-sheet"
      aria-label="Drafting"
      className="w-full max-w-2xl overflow-hidden rounded-2xl border border-panel-border bg-panel shadow-2"
    >
      <div className="flex flex-col gap-4 px-5 pb-5 pt-6 sm:flex-row sm:items-center sm:gap-6 sm:px-8 sm:pb-6 sm:pt-7">
        <DraftingModelMark className="h-[84px] w-[99px] shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <DraftingStatus />
          {onStop ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={onStop}
                data-testid="first-use-drafting-stop"
                className={typo(
                  'bodySmall',
                  'inline-flex items-center gap-2 rounded-full border border-border-emphasis px-3 py-1 text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info',
                )}
              >
                <Square className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true" />
                Stop drafting
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <BriefReadingCard reading={reading} userFields={userFields} />
    </section>
  )
})
