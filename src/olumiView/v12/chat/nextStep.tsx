/** The next step under the newest reply: the review, the method or tool to run, the move and the session goal (moved verbatim from ViewChat.tsx). */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { type View } from '../../client'
import { useViewStore } from '../../store'
import { isFirstLook, type Session } from '../../layout'
import { typography } from '../../../styles/typography'
import { useUIStore } from '../../../stores/uiStore'
import { FigureEdit } from '../../FigureEdit'
import { VIEW_CHIP_CLASS, VIEW_CHIP_PRIMARY_CLASS } from '../../../v5/blocks/chipClass'
import { nextStepFor, type NextStep as V12NextStep, type WaitsOnItem, type ToolId } from '../actions'
import { RecordStepButton } from '../team'
import { ChangeMix } from './ChangeMix'
import { OkIcon } from '../../look/icons'
import { FoldChevron } from '../../look/FoldChevron'
import { useBriefPanelLeft } from '../../BriefPanel'
import { Words, citesIn } from './replyBlocks'
import { FIGURE_FIRST, MoveTap, askMethod, bringIntoView, chooseGoal, openFigureFirst } from './chatActions'
import { Proposal } from './ProposalCard'

export type NextStep = V12NextStep

/**
 * The one thing for the person to do next (V12: chosen from their purpose and the state, v12/actions.ts `nextStepFor`): a proposal Olumi holds
 * (checked first; nothing is kept until it is approved); else the newest reply's own move when it is a real one; else the first question core
 * orders for what they came for; else bringing a colleague in, only while the View shows a team activity begun alone. Else nothing: the
 * conversation is the next step. `isGone` drops a move core has refused as stale (MoveTap's own rule).
 */
export function nextStepOf(view: View, isGone?: (turn: number, move: string) => boolean): NextStep | null {
  return nextStepFor(view, isGone)
}

// A figure step has no words of the UI's own: it says what the chances wait on in core's words (`run.waits_on`), so it never claims who can
// give the figure (strategy witness 8, 8 Nov: core said "which no one can size yet" where the UI said "only you can give").
export const NEXT_STEP_WORDS = {
  // R25 (Paul's 6 Nov test: no ✎ appeared while a proposal waited): say why, here, where the decision is (core holds edits by contract).
  approve: 'Olumi proposes changes, shown on the canvas. Check them against your situation, then approve them or set them aside. Nothing changes until you approve, and figure edits wait until then.',
  invite: 'Bring in a colleague: each of you gives your own view privately, then you reveal them together and see where you differ.',
} as const

/** The next step, highlighted at the top of the Olumi tab: its words and the one control that does it. */
/**
 * Contract 3: the one row of Olumi's waiting proposal. A button (core's heading · on) opens and closes it; keyed on the proposal, so a new one
 * starts closed. Its body stays mounted while closed (the person's ticks and reading choices are kept) and is `hidden`; while open it is
 * `display: contents` (olumiLook.css), so the step's words, the change list and the actions are the pinned column's own items and the list
 * keeps its bounded scroll (Codex 15 Nov: a block wrapper, as a <details> body is, let the list grow and the whole box scroll instead).
 */
export function ProposalReview({ p, busy, evidence }: { p: NonNullable<View['proposal']>; busy: boolean; evidence: View['evidence'] }) {
  const [open, setOpen] = useState(false)
  const body = `view-proposal-body-${p.id}`
  const self = useRef<HTMLDivElement>(null)
  // The list opens ABOVE the one line at the foot, so an opened review starts at its first words (Codex 15 Nov, held 329, nine changes: a long
  // list is the box's own scroll). Readings, where held, are placed by their own rule (Proposal's land), which this leaves alone.
  useLayoutEffect(() => {
    if (!open) return
    const box = self.current?.closest<HTMLElement>('.ok-pinned') ?? null
    if (box !== null && box.querySelector('[data-reading-row]') === null) box.scrollTop = 0
  }, [open])
  // ONE line (17 Nov, the calm panel): Olumi's mark in --info, core's heading and version, Review (opens the list), then Approve as the one green
  // filled button and Set aside as an icon (Proposal's actions). The mark is beside core's words, never in their place.
  const lead = (
    <>
      <button type="button" className="flex min-h-7 min-w-0 flex-[1_1_12rem] cursor-pointer items-center gap-2 text-left" data-testid="view-proposal-row" title={p.on === '' ? p.heading : `${p.heading} · ${p.on}`}
        aria-expanded={open} aria-controls={body} onClick={() => setOpen((o) => !o)}>
        <OkIcon id="olumi-mark" size={16} decorative />
        {/* One flowing run: the heading, the dot and the version wrap together, never three flex columns (DL look at 1500x904 at 1.33). It wraps and is never cut: Paul, 19 Nov. */}
        <span className="min-w-0 flex-1 break-words" data-testid="view-proposal-words"><span className={`${typography.viewPanelHeading} text-text-header`} data-view="proposal.heading">{p.heading}</span>{p.on === '' ? null : <> · <span data-view="proposal.on">{p.on}</span></>}</span>
      </button>
      <button type="button" className={`${VIEW_CHIP_CLASS} ok-review-toggle`}
        data-testid="view-proposal-review-toggle" aria-expanded={open} aria-controls={body} onClick={() => setOpen((o) => !o)}>
        Review<FoldChevron open={open} />
      </button>
    </>
  )
  return (
    <div ref={self} className="ok-row-review" data-testid="view-proposal-review" data-open={open ? 'true' : 'false'}>
      {/* PANEL-SPEC 1: closed, the body draws only core's alerts and the actions, so Approve is in view at rest; open, the step's words, the
          change list and the readings join them, above the line. The Proposal stays mounted either way, so ticks and reading choices are kept. */}
      <div id={body} data-review-body="">
        {open ? <><p>{NEXT_STEP_WORDS.approve}</p><ChangeMix changes={p.changes} /></> : null}
        <Proposal p={p} busy={busy} evidence={evidence} inRow open={open} onOpen={() => setOpen(true)} lead={lead} />
      </div>
    </div>
  )
}

/** The presses the menu and the next step share: one action system. A question is asked as one answered turn that may propose a change, held for approval (askMethod); "Let us give
 *  our figure first" opens its blind entry; the reply or the entry is brought into view once drawn. */
export function runMethod(id: string): void {
  const from = document.querySelector('[data-testid="view-chat"]')
  if (id === FIGURE_FIRST) void openFigureFirst().then(() => bringIntoView(from, 'view-figure-first-entry'))
  else void askMethod(id).then((sent) => { if (sent) bringIntoView(from, 'view-chat-latest') })
}

/** The tools folded in from the Reasoning tab. "Your brief" shows the brief's account (the brief panel on a first look, else the tab that holds
 *  the brief); "Review all inputs" opens the Model tab, the model's own inputs, to read and change there. Neither asks Olumi anything. */
export function runTool(id: ToolId): void {
  if (id === 'review_inputs') { useUIStore.getState().forceActivateOutputTab('diagnostics'); return }
  const { sid, view } = useViewStore.getState()
  if (sid !== null) useBriefPanelLeft.setState((st) => { const left = new Set(st.left); left.delete(sid); return { left } })
  if (!isFirstLook(view)) useUIStore.getState().forceActivateOutputTab('analysisNew')
}

/** What the chances wait on, for the figure step, in core's words at their paths: its label, the figure's name, and, where core says no one
 *  can size it yet, that clause. The hover is core's (the question asked, or why it is unknown). */
function FigureWaits({ view, item }: { view: View; item: WaitsOnItem }) {
  const w = view.model!.run!.waits_on!, k = w.items.indexOf(item)
  return (
    <p title={item.title} data-testid="view-next-figure-waits">
      <span data-view="run.waits_on.label">{w.label}</span>{' '}
      <span data-view={`run.waits_on.items.${k}.text`}>{item.text}</span>
      {item.unknown === null || item.unknown === '' ? null : <span data-view={`run.waits_on.items.${k}.unknown`}>{item.unknown}</span>}
    </p>
  )
}

/** The newest reply's move as the Next step: core's words for it (`next.text`) at their paths (these fold with the row); its one tap, filled, is `MoveStepTap`. */
function MoveStep({ view, turn }: { view: View; turn: number }) {
  const k = view.chat.findIndex((t) => t.id === turn), t = view.chat[k], a = t?.answer ?? null
  if (a === null) return null
  const at = `chat.${k}.answer.next`
  // The reply's own order (Turn): its answer's cites, then its next step's, then its Why lines'. The next step starts after the answer's.
  const first = 1 + citesIn(a.answer)
  return (
    <div className="space-y-2">
      {a.next.text.length === 0 ? null : <p data-testid="view-next-move-words"><Words parts={a.next.text} at={`${at}.text`} first={first} /></p>}
    </div>
  )
}

/** The Next step's one filled press (S4, 19 Nov: exactly one filled action wherever core offers a next move). It is drawn under the closed row, not inside
 *  the folded body, so it is in view at rest at every width; the row's fold holds only core's words for it. */
function MoveStepTap({ view, turn }: { view: View; turn: number }) {
  const k = view.chat.findIndex((t) => t.id === turn), a = view.chat[k]?.answer ?? null
  return a === null ? null : <MoveTap turn={turn} next={a.next} primary at={`chat.${k}.answer.next`} />
}

export function NextStepCard({ view, busy, step }: { view: View; busy: boolean; step: NextStep }) {
  // Paul, 18 Nov: the Next step card sat open at the top of the panel, "takes up space and makes it look busy", and covered the card under
  // it. At rest it is ONE quiet row (its name and, where the step is a single press, that press's own words); a press opens it in place.
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [step.kind])
  // Contract 3 (ONE-PLAN, 15 Nov: "the pending review collapses to one row; all changes can be read without approving"): Olumi's waiting
  // proposal is ONE row, in core's words (`proposal.heading` · `proposal.on`), closed at rest so the thread keeps its room; opening it
  // shows every change, its readings and Approve / Set aside (the box then grows and scrolls as before). A new proposal starts closed.
  if (step.kind === 'approve') {
    const p = view.proposal!
    return (
      <section className={`${typography.viewPanelBody} space-y-2`} data-testid="view-next-step" data-step="approve" aria-label="Next step">
        <ProposalReview key={p.id} p={p} busy={busy} evidence={view.evidence} />
      </section>
    )
  }
  return (
    <section className={`${typography.viewPanelBody} space-y-1`} data-testid="view-next-step" data-step={step.kind} data-open={open ? 'true' : 'false'} aria-label="Next step">
      <button type="button" aria-expanded={open} aria-controls="view-next-step-body" data-testid="view-next-step-toggle" onClick={() => setOpen((o) => !o)}
        className={`${typography.viewPanelMeta} flex min-h-[28px] w-full cursor-pointer items-center gap-1.5 rounded-md text-left text-text-light hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>
        <OkIcon id="next-step" size={14} decorative />
        <span className="flex-none font-medium">Next step</span>
        <FoldChevron open={open} className="ml-auto" />
      </button>
      <div id="view-next-step-body" hidden={!open} className="space-y-2 rounded-md border border-panel-border bg-panel p-3" data-testid="view-next-step-body">
      {step.kind === 'move' ? <MoveStep view={view} turn={step.turn} /> : null}
      {step.kind === 'figure' ? <FigureWaits view={view} item={step.item} /> : null}
      {step.kind === 'method' && step.method.prerequisite !== null ? <p className={`${typography.viewPanelMeta} text-text-light`} data-testid="view-method-prerequisite">{step.method.prerequisite}</p> : null}
      {step.kind === 'invite' ? <p>{NEXT_STEP_WORDS.invite}</p> : null}
      {/* v10 review item 12: committing is a step, so its button is here, secondary; it opens the form below and writes nothing. */}
      <div className="empty:hidden"><RecordStepButton /></div>
      </div>
      <StepPress view={view} busy={busy} step={step} />
    </section>
  )
}
const NEXT_INVITE_WORDS = 'Invite a colleague'

/** The Next step's one filled press, whatever its kind (S4 ruling, 19 Nov: exactly one filled action at rest wherever core offers a next step). It is drawn
 *  under the closed row, outside the folded body, so it is in view at rest; the fold holds only core's words for the step. A held proposal is the
 *  'approve' step, drawn by ProposalReview (Approve outranks), so no other kind is ever drawn beside it. */
function StepPress({ view, busy, step }: { view: View; busy: boolean; step: NextStep }) {
  switch (step.kind) {
    case 'move': return <MoveStepTap view={view} turn={step.turn} />
    case 'figure': return <div><FigureEdit id={step.item.id} edit={step.item.edit} label="Add the figure" place="next-figure" solid /></div>
    case 'method': return (
      <div>
        <button type="button" disabled={busy} onClick={() => runMethod(step.method.id)} className={VIEW_CHIP_PRIMARY_CLASS} data-testid="view-next-method" data-method={step.method.id}>
          <span data-view={`session.methods.${step.method.i}.text`}>{step.method.text}</span>
        </button>
      </div>
    )
    case 'invite': return <div><button type="button" data-testid="view-next-invite" className={VIEW_CHIP_PRIMARY_CLASS} onClick={() => useUIStore.getState().forceActivateOutputTab('team')}>{NEXT_INVITE_WORDS}</button></div>
    default: return null
  }
}

/** The question the goal picker asks: the page's own words for core's `session.goals` (canon wave step 1). */
export const GOAL_QUESTION = 'What did you come here for?'

/**
 * What the team came for (canon wave step 1; Paul: asked at the start, always changeable). With no goal: one small row of core's goals,
 * in core's order and words. With one: a compact chip of core's words for it, which reopens the row to change it, and a clear (null).
 * Who set it is the chip's hover (`set_by`, a member's name). Nothing here touches the model.
 */
export function SessionGoal({ session, held }: { session: Session; held: boolean }) {
  const [changing, setChanging] = useState(false)
  const goal = session.goal
  const choose = (id: string | null) => { setChanging(false); if (id !== (goal?.id ?? null)) void chooseGoal(id) }
  if (goal !== null && !changing) {
    return (
      <div className="flex" data-testid="view-session-goal">
        <span className={`inline-flex items-center gap-1 rounded-lg border border-field bg-panel pl-2.5 pr-1 ${typography.viewPanelBody}`} data-testid="view-session-goal-chip">
          <OkIcon id="goal" size={14} decorative />
          <button type="button" disabled={held} onClick={() => setChanging(true)} title={session.set_by === null ? undefined : `Set by ${session.set_by}`}
            aria-label={`${GOAL_QUESTION} ${goal.text}. Change it`} data-testid="view-session-goal-change"
            className="py-1 text-text-body hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:text-text-light disabled:cursor-not-allowed">
            <span data-view="session.goal.text">{goal.text}</span>
          </button>
          <button type="button" disabled={held} onClick={() => choose(null)} aria-label={`Clear: ${goal.text}`} title={`Clear: ${goal.text}`} data-testid="view-session-goal-clear"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:text-text-light disabled:cursor-not-allowed">
            <OkIcon id="clear-goal" size={14} decorative inherit />
          </button>
        </span>
      </div>
    )
  }
  // The question, then core's goals two by two: the dock is too narrow for four on one line, and a wrapped row reads ragged.
  return (
    <div role="group" aria-labelledby="view-session-goal-question" className="space-y-2" data-testid="view-session-goal">
      <p id="view-session-goal-question" className={`${typography.chatMeta} text-text-light`}>{GOAL_QUESTION}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {session.goals.map((g, i) => (
          <button key={g.id} type="button" disabled={held} onClick={() => choose(g.id)} aria-pressed={g.id === goal?.id}
            className={VIEW_CHIP_CLASS} data-goal={g.id} data-testid="view-session-goal-option">
            <span data-view={`session.goals.${i}.text`}>{g.text}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** The menu's name for assistive technology; on screen it is the question glyph (visual indicators, not default text: Paul, 24 Oct). */
export const MENU_NAME = 'Questions to explore with Olumi'
/** What the quiet emphasis on a question means, for its hover and for assistive technology. */
export const FIRST_FOR_GOAL = 'Suits what you came here for'
