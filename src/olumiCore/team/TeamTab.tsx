import { useEffect, useId, useRef, useState } from 'react'
import { useAnchoredTip } from '../../olumiView/look/Tip'
import { Hover, HoverButton } from '../../olumiView/look/Hover'
import { Menu } from '../../olumiView/look/Menu.tsx'
import { OkIcon } from '../../olumiView/look/icons'
import { TOOLBAR_ICON } from '../../olumiView/look/toolbar'
import { Button } from '../../components/ui/Button'
import { useViewStore } from '../../olumiView/store'
import type { View } from '../../olumiView/client'
import { isForThisPage, NOT_FOR_THIS_PAGE, useMe } from '../me'
import { CommitmentPanel } from './CommitmentPanel'
import { SavedActions } from './SavedActions'
import { ComparePanel } from './ComparePanel'
import { EvidencePanel } from './EvidencePanel'
import { InvitePanel, inviteNameKey, type MadeInvite } from './InvitePanel'
import { ViewEntry } from './ViewsPanel'
import { RevealStep } from './steps'
import { DifferTool } from '../../olumiView/v12/tools/DifferTool'
import { WhereWeDiffer } from '../../olumiView/v12/views/WhereWeDiffer'
import { BODY, CARD, ERR, H, META } from './ui'
import { TEAM_PAST_HELD } from './writes'
import { useDraft } from './drafts'
import { currentStep, openStepOf, STEP_ORDER, STEP_WORDS, revealed, stepState, stepSummary, takePending, toggleStep, useTeamFlow, type StepId, type StepState } from './flow'
import { RevealDock, revealDockShown } from '../../olumiView/RevealDock'
import { EvidenceDock, evidenceDockShown } from '../../olumiView/EvidenceDock'
import { useReveal } from '../../olumiView/reveal'
import { StrategyOverviewSection } from '../../olumiView/strategy/StrategyOverview'
import { FrameEntry, MyFrames } from '../../olumiView/v12/views/FrameEntry'
import { useDifferLine } from '../../olumiView/v12/views/SimpleSummary'
import { FirstArrival } from '../../olumiView/v12/arrival'
import { typography } from '../../styles/typography'

/**
 * The Team tab opens with member names and contribution marks. The header menu holds the invite form and its one-time link.
 * The guided flow starts at Your view, then Reveal together → Where you differ → Commit to an action → What happened.
 * The current step opens with its action. The View's `collab` fields determine progress and supply the scenario's words.
 * Writes go to Core, then the View is read again. Closed steps stay mounted so drafts survive moving between steps.
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
    return <div data-testid="team-tab" className="grid min-h-full"><RevealDock view={shown} /></div>
  }
  if (shown !== null && sid && past === null && evidenceDockShown(shown, openedEvidence)) {
    return <div data-testid="team-tab" className="grid min-h-full"><EvidenceDock view={shown} /></div>
  }

  return (
    <div data-testid="team-tab" className="space-y-4">
      {shown === null && <h2 className={H} data-testid="team-views-heading">Team</h2>}
      {!sid && <p className={BODY} data-testid="team-none">Start a model in the chat first. The team works on a model that is already saved.</p>}
      {sid && status === 'loading' && view === null && <p className={BODY} data-testid="team-loading">Reading your team’s page…</p>}
      {sid && view === null && status === 'error' && (
        <div className="grid gap-3" data-testid="team-error">
          <p role="alert" className={ERR}>{error}</p>
          <Button size="sm" variant="secondary" onClick={() => void refresh()}>Try again</Button>
        </div>
      )}
      {view !== null && shown === null && <p role="alert" className={ERR} data-testid="team-not-for-page">{NOT_FOR_THIS_PAGE}</p>}
      {shown !== null && sid && <Flow sid={sid} view={shown} past={past !== null} stale={error} />}
    </div>
  )
}

export const TEAM_HEADER_WORDS = {
  invite: 'Invite a colleague',
  aloneLead: 'Invite a colleague: each of you gives a view privately, then you reveal them together and see where you differ.',
  private: 'Given, private until the reveal',
  given: 'Your view is in',
  revealed: 'Revealed',
} as const

const CONTRIBUTION_ICON = { private: 'private-view', given: 'approve', revealed: 'views' } as const

/** Only the viewer's own current submission and views Core has revealed are attributable. */
export function Members({ view }: { view: View }): JSX.Element {
  const shownBy = new Set(revealed(view) ? view.collab.shared.filter((s) => !s.skip).map((s) => s.by_id) : [])
  const mine = view.collab.mine.filter((m) => !m.earlier && !m.skip)
  const ownStatus = mine.some((m) => !m.shared) ? 'private' : mine.length > 0 ? 'given' : null
  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1.5 p-0" data-testid="team-members">
      {view.team_presence.members.map((m) => {
        const status = shownBy.has(m.id) ? 'revealed' : m.id === view.you_id ? ownStatus : null
        return (
          <li key={m.id} data-testid={`team-member-${m.id}`} className={`${META} text-text-body`}>
            <Hover as="span" words={status === null ? null : TEAM_HEADER_WORDS[status]} className="inline-flex items-center gap-1.5">
              {status !== null && <OkIcon id={CONTRIBUTION_ICON[status]} size={14} decorative testid={`team-contribution-${status}`} />}
              <span data-member-text="">{m.text}</span>
              {status !== null && <span className="sr-only">{TEAM_HEADER_WORDS[status]}</span>}
            </Hover>
          </li>
        )
      })}
    </ul>
  )
}

function InviteMenu({ sid, alone }: { sid: string; alone: boolean }): JSX.Element {
  const [open, setOpen] = useState(false)
  const [made, setMade] = useState<MadeInvite | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const form = useRef<HTMLDivElement>(null)
  const formId = useId()
  const [name] = useDraft(inviteNameKey(sid), '')
  const lastName = useRef('')
  useEffect(() => { if (alone) setOpen(true) }, [alone])
  useEffect(() => {
    if (name !== lastName.current && name !== '') setOpen(true)
    lastName.current = name
  }, [name])
  useEffect(() => {
    if (open) form.current?.querySelector('input')?.focus({ preventScroll: true })
  }, [open])

  return (
    <>
      <HoverButton ref={trigger} type="button" aria-label={TEAM_HEADER_WORDS.invite} words={TEAM_HEADER_WORDS.invite}
        aria-expanded={open} aria-controls={open ? formId : undefined} aria-haspopup="menu"
        className={TOOLBAR_ICON} onClick={() => setOpen(!open)} data-testid="team-invite-menu-trigger">
        <OkIcon id="invite" size={14} decorative inherit />
      </HoverButton>
      {open && trigger.current && (
        <Menu anchor={trigger.current} label={TEAM_HEADER_WORDS.invite} placement="bottom-end" onClose={() => setOpen(false)}>
          <div id={formId} ref={form} className="space-y-3 p-3" onKeyDown={(event) => {
            // Keep ordinary form keys within the form. The menu still handles Escape.
            if (event.key !== 'Escape') event.stopPropagation()
          }} onBlur={(event) => {
            if (event.relatedTarget && event.relatedTarget !== trigger.current && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
          }}>
            {alone && <p className={BODY}>{TEAM_HEADER_WORDS.aloneLead}</p>}
            <InvitePanel sid={sid} made={made} onMade={setMade} />
          </div>
        </Menu>
      )}
    </>
  )
}

/** A step's mark: its number in a small circle, the border saying how it is doing (done green, now ink, later quiet). */
const DISC: Record<StepState, string> = {
  done: 'border-success text-text-header',
  now: 'border-text-header text-text-header font-medium',
  later: 'border-panel-border text-text-light',
}
const STATE_WORDS: Record<StepState, string> = { done: 'Done', now: 'Now', later: 'Later' }

function Step({ id, n, state, open, summary, onToggle, compact = false, children }: { id: StepId; n: number; state: StepState; open: boolean; summary: string; onToggle: () => void; compact?: boolean; children: JSX.Element }): JSX.Element {
  const body = `team-step-${id}-body`
  // The step's summary is its hover: a finished step shrunk to a name says it there, a step at rest says it in a line (the Tip, on the row's one focus stop).
  const tip = useAnchoredTip(compact || !open ? summary : undefined)
  // After the reveal the finished steps before it shrink to one line of names (Paul's critique, 18 Nov): the difference leads the panel.
  // Each stays a row the person can press to open, its body mounted and hidden, its summary in the title.
  if (compact) return (
    <section data-testid={`team-step-${id}`} data-step-state={state} data-step-compact="" aria-label={STEP_WORDS[id]} className="inline-flex">
      <button type="button" aria-expanded={false} aria-controls={body} data-testid={`team-step-${id}-row`} onClick={() => { tip.dismiss(); onToggle() }} {...tip.handlers} aria-describedby={tip.describedBy}
        className={`${META} inline-flex min-h-[24px] items-center gap-1.5 rounded-sm text-text-body hover:text-text-header focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>
        <span aria-hidden="true" className={`${typography.viewPanelMeta} inline-grid h-[20px] w-[20px] flex-none place-items-center rounded-full border ${DISC[state]}`}>{n}</span>
        <span className="sr-only">{STATE_WORDS[state]}: </span>{STEP_WORDS[id]}
      </button>
      {tip.tip}
      <div id={body} hidden className="hidden" data-testid={body}>{children}</div>
    </section>
  )
  return (
    <section data-testid={`team-step-${id}`} data-step-state={state} data-step-open={open ? '' : undefined} aria-label={STEP_WORDS[id]} className="grid">
      <button type="button" aria-expanded={open} aria-controls={body} data-testid={`team-step-${id}-row`} onClick={() => { tip.dismiss(); onToggle() }} {...tip.handlers} aria-describedby={tip.describedBy}
        className="flex w-full min-w-0 items-center gap-2 rounded-sm py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header">
        <span aria-hidden="true" className={`${typography.viewPanelMeta} inline-grid h-[20px] w-[20px] flex-none place-items-center rounded-full border ${DISC[state]}`}>{n}</span>
        <span className="sr-only">{STATE_WORDS[state]}: </span>
        <span className={`${typography.viewPanelHeading} flex-none ${open || state === 'now' ? 'text-text-header' : 'text-text-body'}`}>{STEP_WORDS[id]}</span>
        {!open && <span className={`${META} min-w-0 break-words`} data-testid={`team-step-${id}-summary`}>{summary}</span>}
      </button>
      {tip.tip}
      <div id={body} hidden={!open} className={open ? 'space-y-3 pt-3' : 'hidden'} data-testid={body}>{children}</div>
    </section>
  )
}

function Flow({ sid, view, past, stale }: { sid: string; view: View; past: boolean; stale: string | null }): JSX.Element {
  const refresh = useViewStore((s) => s.refresh)
  const current = currentStep(view)
  const choice = useTeamFlow()
  const open = openStepOf(choice, sid, current)
  const line = useDifferLine(sid, view)
  // The steps still to come are folded behind one press ("Where this goes"), with their bodies still mounted.
  const [showLater, setShowLater] = useState(false)
  const folded = (id: StepId): boolean => !showLater && stepState(view, id) === 'later' && open !== id
  const foldedCount = STEP_ORDER.filter(folded).length
  // What the "Where this goes" press shows: the later steps' list items (ids unique to this tab, one per step).
  const laterIds = STEP_ORDER.filter((id) => stepState(view, id) === 'later' && open !== id).map((id) => `team-step-${id}-item`)
  // A step opened from elsewhere (an outcome form, the commitment form) is the person's choice under the current step.
  useEffect(() => { if (choice.pending !== null) takePending(sid, current) }, [choice.pending, sid, current])
  // After the reveal, while "Where you differ" is the step open, the finished steps before it are one line.
  const done = current === 'differ' && open === 'differ' ? STEP_ORDER.slice(0, STEP_ORDER.indexOf('differ')).filter((id) => stepState(view, id) === 'done') : []
  const bodies: Record<StepId, JSX.Element> = {
    view: (
      <fieldset disabled={past} className="min-w-0 space-y-4">
        {!past && <FirstArrival view={view} />}
        <ViewEntry sid={sid} view={view} onWrote={refresh} />
        {/* "My whole view, in words": its question, aim, options and links, folded behind its own button. */}
        <FrameEntry sid={sid} view={view} onWrote={refresh} />
        <MyFrames view={view} />
      </fieldset>
    ),
    reveal: <fieldset disabled={past} className="contents"><RevealStep sid={sid} view={view} onWrote={refresh} /></fieldset>,
    // On the current View, the tool above the steps owns the shared figure axis.
    differ: <fieldset disabled={past} className="contents"><WhereWeDiffer sid={sid} view={view} onWrote={refresh} axis={past} /></fieldset>,
    commit: <fieldset disabled={past} className="min-w-0 space-y-4"><SavedActions sid={sid} view={view} /><CommitmentPanel sid={sid} view={view} onWrote={refresh} part="form" /></fieldset>,
    outcome: view.collab.commitments.length === 0
      ? <p className={META} data-testid="team-outcome-later">{STEP_WORDS.outcomeLater}</p>
      : <fieldset disabled={past} className="contents"><CommitmentPanel sid={sid} view={view} onWrote={refresh} part="list" /></fieldset>,
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className={H} data-testid="team-views-heading">{view.collab.heading}</h2>
          <InviteMenu key={JSON.stringify([sid, view.you_id])} sid={sid} alone={view.collab.alone} />
        </div>
        <Members view={view} />
      </div>
      {stale && <p role="alert" className={ERR} data-testid="team-stale">{stale} What you see may be out of date.</p>}
      {past && (
        <div className={`${CARD} flex flex-wrap items-center gap-2`} data-testid="team-past">
          <span className={BODY}>{TEAM_PAST_HELD}</span>
          <Button size="sm" variant="secondary" data-testid="team-past-back" onClick={() => void useViewStore.getState().look(null)}>Back to the latest</Button>
        </div>
      )}
      <DifferTool sid={sid} view={view} />
      {/* Strategy lane (7 Nov, by agreement): the strategy overview, a read-only projection of core's `strategy`; null without the key. */}
      <StrategyOverviewSection view={view} />
      {/* One <li> per step, always under this list in the same order (Codex review 2 #4): a finished step shrinking to a name never remounts its
          body, so its draft survives. Rows take the full width; shrunk names share one line. */}
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-3 p-0" data-testid="team-steps" data-current-step={current} data-steps-done={done.length}>
        {STEP_ORDER.map((id, index) => (
          <li key={id} id={`team-step-${id}-item`} hidden={folded(id)} className={done.includes(id) ? '' : 'basis-full'}>
            <Step id={id} n={index + 1} state={stepState(view, id)} open={open === id} compact={done.includes(id)} summary={stepSummary(view, id, line)} onToggle={() => toggleStep(sid, current, id, open)}>
              {bodies[id]}
            </Step>
          </li>
        ))}
        {(foldedCount > 0 || showLater) && (
          <li className="basis-full">
            <button type="button" aria-expanded={showLater} aria-controls={laterIds.length > 0 ? laterIds.join(' ') : undefined} data-testid="team-steps-later" onClick={() => setShowLater((x) => !x)}
              className={`${META} inline-flex items-center gap-1 rounded-sm py-2.5 text-text-body hover:text-text-header focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>
              {STEP_WORDS.whereThisGoes}
            </button>
          </li>
        )}
      </ol>
      {/* Evidence and the record stand outside the flow: evidence can come at any step (and the reveal dock's "Bring evidence" lands here). */}
      <div className="space-y-4">
        <fieldset disabled={past} className="min-w-0"><EvidencePanel sid={sid} view={view} onWrote={refresh} /></fieldset>
        <ComparePanel sid={sid} view={view} />
      </div>
    </>
  )
}
