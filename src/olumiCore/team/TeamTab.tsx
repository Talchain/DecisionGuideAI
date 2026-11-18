import { useEffect, useRef } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useViewStore } from '../../olumiView/store'
import type { View } from '../../olumiView/client'
import { isForThisPage, NOT_FOR_THIS_PAGE, useMe } from '../me'
import { CommitmentPanel } from './CommitmentPanel'
import { ComparePanel } from './ComparePanel'
import { EvidencePanel } from './EvidencePanel'
import { InvitePanel, inviteNameKey } from './InvitePanel'
import { ViewEntry } from './ViewsPanel'
import { RevealStep } from './steps'
import { WhereWeDiffer } from '../../olumiView/v12/views/WhereWeDiffer'
import { AVATAR, BODY, CARD, ERR, H, META } from './ui'
import { TEAM_PAST_HELD } from './writes'
import { useDraft } from './drafts'
import { currentStep, openStepOf, STEP_ORDER, STEP_WORDS, stepState, stepSummary, takePending, toggleStep, useTeamFlow, viewIn, type StepId, type StepState } from './flow'
import { RevealDock, revealDockShown } from '../../olumiView/RevealDock'
import { EvidenceDock, evidenceDockShown } from '../../olumiView/EvidenceDock'
import { useReveal } from '../../olumiView/reveal'
import { StrategyOverviewSection } from '../../olumiView/strategy/StrategyOverview'
import { FrameEntry, MyFrames } from '../../olumiView/v12/views/FrameEntry'
import { useDifferLine } from '../../olumiView/v12/views/SimpleSummary'
import { FirstArrival } from '../../olumiView/v12/arrival'
import { typography } from '../../styles/typography'

/**
 * THE TEAM TAB (olumi-core lane only), redesigned overnight 18 Nov as ONE guided flow (./flow.ts): Bring a colleague in → Your view → Reveal
 * together → Where you differ → Commit to an action → What happened. The header says who is in and whose view is in; under it the six steps,
 * the current one open with its one green press, the others one line each with a short summary. The current step is read from the View's
 * own `collab` fields; every word about the scenario is core's. Writes go to core's own routes, exactly as before; after each one the View is
 * read again. Closed steps stay mounted (hidden), so a one-time invite link and every draft survive moving between steps.
 * Another member's change arrives on its own: while the page is seen the View is read again about every 10 s (`src/olumiView/poll.ts`).
 */
export function TeamTab(): JSX.Element {
  const view = useViewStore((s) => s.view)
  const sid = useViewStore((s) => s.sid)
  const status = useViewStore((s) => s.status)
  const error = useViewStore((s) => s.error)
  const refresh = useViewStore((s) => s.refresh)
  const past = useViewStore((s) => s.at)
  const me = useMe((s) => s.me)
  const shown: View | null = view !== null && isForThisPage(view, me) ? view : null
  // V11: a view or a piece of evidence opened from its mark on the canvas fills the tab (one focus); closing it brings the flow back.
  const opened = useReveal((s) => s.selected)
  const openedEvidence = useReveal((s) => s.evidence)
  if (shown !== null && sid && past === null && revealDockShown(shown, opened)) {
    return <div data-testid="team-tab" className="grid min-h-full pb-6"><RevealDock view={shown} /></div>
  }
  if (shown !== null && sid && past === null && evidenceDockShown(shown, openedEvidence)) {
    return <div data-testid="team-tab" className="grid min-h-full pb-6"><EvidenceDock view={shown} /></div>
  }

  return (
    <div data-testid="team-tab" className="grid gap-4 pb-6">
      {shown === null && <TabHead heading="Team" sid={sid} />}
      {!sid && <p className={BODY} data-testid="team-none">Start a model in the chat first. The team works on a model that is already saved.</p>}
      {sid && status === 'loading' && view === null && <p className={BODY} data-testid="team-loading">Reading your team’s page…</p>}
      {sid && view === null && status === 'error' && (
        <div className="grid gap-2" data-testid="team-error">
          <p role="alert" className={ERR}>{error}</p>
          <Button size="sm" variant="secondary" onClick={() => void refresh()}>Try again</Button>
        </div>
      )}
      {view !== null && shown === null && <p role="alert" className={ERR} data-testid="team-not-for-page">{NOT_FOR_THIS_PAGE}</p>}
      {shown !== null && sid && <Flow sid={sid} view={shown} past={past !== null} stale={error} />}
    </div>
  )
}

/** The tab's heading line with "Check for new views". `heading` is core's `collab.heading` once a View is drawn. */
function TabHead({ heading, sid }: { heading: string; sid: string | null }): JSX.Element {
  const status = useViewStore((s) => s.status)
  const refresh = useViewStore((s) => s.refresh)
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className={H} data-testid="team-views-heading">{heading}</h2>
      <button
        type="button" data-testid="team-check" disabled={!sid || status === 'loading'} onClick={() => void refresh()}
        className={`${META} inline-flex min-h-[24px] cursor-pointer items-center gap-1 underline underline-offset-2 hover:text-text-body disabled:cursor-not-allowed disabled:no-underline disabled:text-text-light`}
      >
        {status === 'loading' ? <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw strokeWidth={1.75} aria-hidden="true" className="h-3.5 w-3.5" />}
        Check for new views
      </button>
    </div>
  )
}

/** Whose view is in, where the View says so: yours once given, another member's once it is shown to you. Nobody else's private state is drawn. */
const VIEW_IN_WORDS = { yours: 'Your view is in', theirs: 'Their view is revealed' } as const

/** The first five seconds: who is in (core's lines for each member, "(you)" by `you_id`), whose view is in. */
export function Members({ view }: { view: View }): JSX.Element {
  const shownBy = new Set(view.collab.shared.filter((s) => !s.skip).map((s) => s.by_id))
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1.5 p-0" data-testid="team-members">
      {view.team_presence.members.map((m) => {
        const inWords = m.id === view.you_id ? (viewIn(view) ? VIEW_IN_WORDS.yours : null) : shownBy.has(m.id) ? VIEW_IN_WORDS.theirs : null
        return (
          <li key={m.id} data-testid={`team-member-${m.id}`} data-view-in={inWords === null ? undefined : ''} title={inWords ?? undefined} className={`${META} inline-flex items-center gap-1.5 text-text-body`}>
            <span aria-hidden="true" className={`${AVATAR} ${inWords === null ? '' : 'border-success'}`}>{(Array.from(m.text)[0] ?? '').toUpperCase()}</span>
            <span data-member-text="">{m.text}</span>
            {inWords !== null && <span className="sr-only">{inWords}</span>}
          </li>
        )
      })}
    </ul>
  )
}

/** A step's mark: its number in a small circle, the border saying how it is doing (done green, now ink, later quiet). */
const DISC: Record<StepState, string> = {
  done: 'border-success text-text-header',
  now: 'border-text-header text-text-header font-medium',
  later: 'border-panel-border text-text-light',
}
const STATE_WORDS: Record<StepState, string> = { done: 'Done', now: 'Now', later: 'Later' }

function Step({ id, n, state, open, summary, onToggle, children }: { id: StepId; n: number; state: StepState; open: boolean; summary: string; onToggle: () => void; children: JSX.Element | (JSX.Element | null | false)[] }): JSX.Element {
  const body = `team-step-${id}-body`
  return (
    <section data-testid={`team-step-${id}`} data-step-state={state} data-step-open={open ? '' : undefined} aria-label={STEP_WORDS[id]} className="grid">
      <button type="button" aria-expanded={open} aria-controls={body} data-testid={`team-step-${id}-row`} onClick={onToggle}
        className="flex min-h-[32px] w-full min-w-0 items-center gap-2 rounded-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header">
        <span aria-hidden="true" className={`${typography.viewPanelMeta} inline-grid h-[20px] w-[20px] flex-none place-items-center rounded-full border ${DISC[state]}`}>{n}</span>
        <span className="sr-only">{STATE_WORDS[state]}: </span>
        <span className={`${typography.viewPanelHeading} flex-none ${open || state === 'now' ? 'text-text-header' : 'text-text-body'}`}>{STEP_WORDS[id]}</span>
        {!open && <span className={`${META} min-w-0 truncate`} title={summary} data-testid={`team-step-${id}-summary`}>{summary}</span>}
      </button>
      <div id={body} hidden={!open} className={open ? 'grid gap-3 pb-3 pt-2' : 'hidden'} data-testid={body}>{children}</div>
    </section>
  )
}

function Flow({ sid, view, past, stale }: { sid: string; view: View; past: boolean; stale: string | null }): JSX.Element {
  const refresh = useViewStore((s) => s.refresh)
  const current = currentStep(view)
  const choice = useTeamFlow()
  const open = openStepOf(choice, sid, current)
  const line = useDifferLine(sid, view)
  // A step opened from elsewhere (an outcome form, the commitment form) is the person's choice under the current step.
  useEffect(() => { if (choice.pending !== null) takePending(sid, current) }, [choice.pending, sid, current])
  // The header's "Named in the brief but not matched" notice puts a name in the invite form (TeamPresence `inviteUnjoined`): open that step.
  const [inviteName] = useDraft(inviteNameKey(sid), '')
  // From '' so a name put in before this tab was drawn (the header's notice opens Team and fills the form in one go) opens the step too.
  const lastName = useRef('')
  useEffect(() => {
    if (inviteName !== lastName.current && inviteName !== '' && open !== 'invite') toggleStep(sid, current, 'invite', open)
    lastName.current = inviteName
  }, [inviteName, sid, current, open])

  const bodies: Record<StepId, JSX.Element | (JSX.Element | null | false)[]> = {
    invite: [view.collab.alone && <p key="lead" className={BODY} data-testid="team-alone">{STEP_WORDS.aloneLead}</p>, <InvitePanel key="invite" sid={sid} />],
    view: (
      <fieldset disabled={past} className="contents">
        {!past && <FirstArrival view={view} />}
        <ViewEntry sid={sid} view={view} onWrote={refresh} />
        {/* "My whole view, in words": its question, aim, options and links, folded behind its own button. */}
        <FrameEntry sid={sid} view={view} onWrote={refresh} />
        <MyFrames view={view} />
      </fieldset>
    ),
    reveal: <fieldset disabled={past} className="contents"><RevealStep sid={sid} view={view} onWrote={refresh} /></fieldset>,
    differ: <fieldset disabled={past} className="contents"><WhereWeDiffer sid={sid} view={view} onWrote={refresh} /></fieldset>,
    commit: <fieldset disabled={past} className="contents"><CommitmentPanel sid={sid} view={view} onWrote={refresh} part="form" /></fieldset>,
    outcome: view.collab.commitments.length === 0
      ? <p className={META} data-testid="team-outcome-later">{STEP_WORDS.outcomeLater}</p>
      : <fieldset disabled={past} className="contents"><CommitmentPanel sid={sid} view={view} onWrote={refresh} part="list" /></fieldset>,
  }

  return (
    <>
      <div className="grid gap-2">
        <TabHead heading={view.collab.heading} sid={sid} />
        <Members view={view} />
      </div>
      {stale && <p role="alert" className={ERR} data-testid="team-stale">{stale} What you see may be out of date.</p>}
      {past && (
        <div className={`${CARD} flex flex-wrap items-center gap-2`} data-testid="team-past">
          <span className={BODY}>{TEAM_PAST_HELD}</span>
          <Button size="sm" variant="secondary" data-testid="team-past-back" onClick={() => void useViewStore.getState().look(null)}>Back to the latest</Button>
        </div>
      )}
      {/* Strategy lane (7 Nov, by agreement): the strategy overview, a read-only projection of core's `strategy`; null without the key. */}
      <StrategyOverviewSection view={view} />
      <ol className="m-0 grid list-none gap-1 p-0" data-testid="team-steps" data-current-step={current}>
        {STEP_ORDER.map((id, i) => (
          <li key={id}>
            <Step id={id} n={i + 1} state={stepState(view, id)} open={open === id} summary={stepSummary(view, id, line)} onToggle={() => toggleStep(sid, current, id, open)}>
              {bodies[id]}
            </Step>
          </li>
        ))}
      </ol>
      {/* Evidence and the record stand outside the flow: evidence can come at any step (and the reveal dock's "Bring evidence" lands here). */}
      <div className="grid gap-4 pt-2">
        <fieldset disabled={past} className="contents"><EvidencePanel sid={sid} view={view} onWrote={refresh} /></fieldset>
        <ComparePanel sid={sid} view={view} />
      </div>
    </>
  )
}
