/**
 * ⭐ THE FIRST-USE DRAFTING SHEET (Paul, 7 Oct 2026, of the drafting screen: "The layout looks terrible… How can you
 * really enhance it so it looks premium?").
 *
 * Before: a disabled text box holding the status line, a row of pulsing shapes inside it, and a separate brief card of
 * a different width and frame below. Two mismatched objects, and the one the user reads first was a greyed-out input.
 * Now: ONE sheet.
 * - The top shows a model that draws itself from Olumi's node shapes (`DraftingModelMark`), the status line, the
 *   elapsed time, and Stop.
 * - Below it, the brief quoted in the user's words, and one question about it to answer in the wait
 *   (`BriefReadingCard`).
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
import { Button } from '../../components/ui/Button'
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
        <p data-testid="first-use-drafting-message" className={typo('h4', 'm-0 text-text-header [text-wrap:balance]')}>
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
      className="flex w-full max-w-2xl flex-col gap-5 overflow-hidden rounded-lg border border-panel-border bg-panel shadow-1"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 pt-5 sm:flex-nowrap sm:gap-x-6 sm:px-8 sm:pt-6">
        <DraftingModelMark className="h-[56px] w-[66px] shrink-0 sm:h-[84px] sm:w-[99px]" />
        <div className="flex min-w-[180px] flex-1 flex-col gap-1 sm:min-w-0">
          <DraftingStatus />
        </div>
        {onStop ? (
          <Button variant="secondary" size="sm" onClick={onStop} data-testid="first-use-drafting-stop" className="inline-flex shrink-0 items-center gap-2">
            <Square className="h-2.5 w-2.5" fill="currentColor" aria-hidden="true" />
            Stop drafting
          </Button>
        ) : null}
      </div>
      <BriefReadingCard reading={reading} userFields={userFields} />
    </section>
  )
})
