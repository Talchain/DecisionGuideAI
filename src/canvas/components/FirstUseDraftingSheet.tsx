/**
 * ⭐ THE FIRST-USE DRAFTING SHEET (Paul, 7 Oct 2026, of the drafting screen: "The layout looks terrible… How can you
 * really enhance it so it looks premium?").
 *
 * Before: a disabled text box holding the status line, a row of pulsing shapes inside it, and a separate brief card of
 * a different width and frame below. Two mismatched objects, and the one the user reads first was a greyed-out input.
 * Now: ONE sheet.
 * - The top shows a model that draws itself from Olumi's node shapes (`DraftingModelMark`), and once the brief is
 *   read, from the user's own goal and options; the status line and two milestones; and Stop.
 * - Below it, the brief quoted in the user's words, and one question about it to answer in the wait
 *   (`BriefReadingCard`).
 *
 * What did not change:
 * - The status line is `DraftLoadingAnimation`'s elapsed-time table, verbatim (`messageForElapsed`). It names no
 *   stage, count or progress.
 * - Stop is the same control on the same predicate as the composer's (`draftStreamInFlight`, ROADMAP 2.134) and
 *   calls the same `cancelTurn`.
 * - The live region is the status line and the milestones: each changes a few times per draft, never every second.
 */
import { memo, useEffect, useState, type ReactNode } from 'react'
import { CheckCircle, Circle, Loader2, Square } from 'lucide-react'
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
  /** The model has landed (GRAPH_READY on screen): the sheet is in its short completion hold. */
  ready?: boolean
}

type MilestoneState = 'waiting' | 'active' | 'done'

const MILESTONE_ICON: Record<MilestoneState, ReactNode> = {
  waiting: <Circle className="h-3.5 w-3.5 text-text-light" aria-hidden="true" />,
  active: <Loader2 className="h-3.5 w-3.5 text-info motion-safe:animate-spin" aria-hidden="true" />,
  done: <CheckCircle className="h-3.5 w-3.5 text-success" aria-hidden="true" />,
}

function Milestone({ id, state, label }: { id: string; state: MilestoneState; label: string }) {
  return (
    <li data-testid={`first-use-milestone-${id}`} data-state={state} className={typo('bodySmall', `m-0 flex items-center gap-2 ${state === 'done' ? 'text-text-body' : 'text-text-light'}`)}>
      {MILESTONE_ICON[state]}
      {label}
    </li>
  )
}

/**
 * ⭐ TWO REAL MILESTONES, NO CLOCK (Paul, 21 Oct 2026: is the elapsed time "helpful or stressful … considering how
 * long Olumi currently takes?"). A count-up with no end point timed the user's wait back at them. The client gets
 * exactly two signals in a first draft, so it shows exactly two steps:
 * - "Read your brief" ticks when CEE's BRIEF_READ frame arrives (`reading`), within seconds;
 * - "Model ready" ticks when the model lands (GRAPH_READY, `ready`).
 * Nothing between them is known, so nothing between them is claimed: no bar, no percentage, no estimate. The status
 * line still follows elapsed time (`messageForElapsed`), which is what keeps a long wait from looking hung.
 */
const DraftingStatus = memo(function DraftingStatus({ briefRead, ready }: { briefRead: boolean; ready: boolean }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => window.clearInterval(id)
  }, [])
  const read: MilestoneState = briefRead || ready ? 'done' : 'active'
  const model: MilestoneState = ready ? 'done' : read === 'done' ? 'active' : 'waiting'
  return (
    <div role="status" aria-live="polite" data-testid="first-use-thinking" className="flex flex-col gap-2">
      <p data-testid="first-use-drafting-message" className={typo('h4', 'm-0 text-text-header [text-wrap:balance]')}>
        {ready ? 'Your model is ready' : messageForElapsed(elapsed)}
      </p>
      <ol aria-label="Progress" className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0">
        <Milestone id="brief" state={read} label={read === 'done' ? 'Read your brief' : 'Reading your brief'} />
        <Milestone id="model" state={model} label={ready ? 'Model ready' : 'Building your model'} />
      </ol>
    </div>
  )
})

export const FirstUseDraftingSheet = memo(function FirstUseDraftingSheet({ reading, userFields, onStop, ready = false }: FirstUseDraftingSheetProps) {
  return (
    <section
      data-testid="first-use-drafting-sheet"
      aria-label="Drafting"
      className="flex w-full max-w-2xl flex-col gap-5 overflow-hidden rounded-lg border border-panel-border bg-panel shadow-1"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 pt-5 sm:flex-nowrap sm:gap-x-6 sm:px-8 sm:pt-6">
        <DraftingModelMark brief={reading} numbered={!userFields} ready={ready} className="h-[56px] w-[66px] shrink-0 sm:h-[84px] sm:w-[99px]" />
        <div className="flex min-w-[180px] flex-1 flex-col sm:min-w-0">
          <DraftingStatus briefRead={reading !== null} ready={ready} />
        </div>
        {onStop && !ready ? (
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
