/**
 * THE TEAM TAB AS ONE FLOW (overnight 18 Nov, lane wip/v12-tab-team): six steps, Invite → Your view → Reveal → Where you differ → Commit →
 * What happened. Which step is current, and which are done, is read from the View's own `collab` fields (`alone`, `mine`, `shared`,
 * `can_reveal`, `waiting`, `commitments`) and `gated`, never from words. Nothing here is about the scenario: the step names and the short
 * summaries are chrome, or core's own words (`team_presence.title`, `collab.waiting`, a commitment's action as the team wrote it).
 *
 * Only the open step's body is shown; the others are one line. The person may open any step; their choice holds until the current step
 * moves (a write that advances the flow opens the new current step).
 */
import { create } from 'zustand'
import type { View } from '../../olumiView/client'
import { withoutOutcome } from './outcomeNav'

export type StepId = 'invite' | 'view' | 'reveal' | 'differ' | 'commit' | 'outcome'
export const STEP_ORDER: readonly StepId[] = ['invite', 'view', 'reveal', 'differ', 'commit', 'outcome']

/** Fixed chrome: each step's name, and the summaries that are not core's words. */
export const STEP_WORDS = {
  invite: 'Bring a colleague in', view: 'Your view', reveal: 'Reveal together', differ: 'Where you differ', commit: 'Commit to an action', outcome: 'What happened',
  alone: 'Just you so far',
  aloneLead: 'Invite a colleague: each of you gives a view privately, then you reveal them together and see where you differ.',
  viewToGive: 'Not given yet', viewPrivate: 'Given, private until the reveal', viewShared: 'Given and shown to the team', viewSkipped: 'Skipped this round',
  revealReady: 'Everyone is in', revealDone: 'Revealed', revealLater: 'Once everyone has given a view',
  differLater: 'After the reveal', differOpen: 'Revealed views to compare',
  commitNone: 'Nothing recorded yet',
  outcomeLater: 'After a commitment', outcomeAll: 'All recorded',
  outcomeOpen: (n: number) => `${n} recorded · add what happened when it does`,
  differLaterBody: 'Once your views are revealed, where you differ shows here, drawn side by side.',
  commitGo: 'Commit to an action',
} as const

export type StepState = 'done' | 'now' | 'later'

/**
 * This viewer has given (or skipped) a view in this round: one of their own core does not mark `earlier` (a skip counts), or one of theirs
 * shown to the team. Core moves a view shown early out of `mine` into `shared` while the round still waits (measured on core 9ad89f81, 18 Nov),
 * so a shown view must count. A shown view carries no round marker, so one shown in an EARLIER round also counts here: that gap is core's to
 * close (a round marker on `collab.shared[]`), and the page must not guess it from `waiting`'s words.
 */
export function viewIn(view: View): boolean {
  if (view.gated) return false
  const c = view.collab
  return c.mine.some((m) => !m.earlier) || c.shared.some((s) => s.by_id === view.you_id)
}

/** Revealed views this viewer may see (core holds back nothing from them, and at least one is shown). */
export const revealed = (view: View): boolean => !view.gated && view.collab.shared.length > 0

/** The current step, the first of these that holds. After the reveal it is "Where you differ": exploring, evidence, dissent, an action and
 *  its review are activities the person opens when they want them; nothing here decides the thinking is finished (Codex 008 #3). */
export function currentStep(view: View): StepId {
  const c = view.collab
  if (c.alone) return 'invite'
  if (view.gated) return 'view'
  if (c.can_reveal) return 'reveal'
  if (!viewIn(view)) return 'view'
  if (c.waiting !== null || !revealed(view)) return 'reveal'
  return 'differ'
}

/** Whether a step is finished, from the View alone: only facts (a colleague joined, your view given, the reveal made, an action recorded,
 *  each action's outcome recorded). "Where you differ" is never marked finished: a commitment does not settle a disagreement. */
export function stepDone(view: View, id: StepId): boolean {
  const c = view.collab
  switch (id) {
    case 'invite': return !c.alone
    case 'view': return viewIn(view)
    case 'reveal': return revealed(view) && !c.can_reveal && c.waiting === null
    case 'differ': return false
    case 'commit': return c.commitments.length > 0
    case 'outcome': return c.commitments.length > 0 && withoutOutcome(c.commitments).length === 0
  }
}

export function stepState(view: View, id: StepId): StepState {
  if (id === currentStep(view)) return 'now'
  return stepDone(view, id) ? 'done' : 'later'
}

/** The one-line summary of a closed step: core's words where it has them, else chrome. `differLine` is the count line from core's rows. */
export function stepSummary(view: View, id: StepId, differLine: string | null): string {
  const c = view.collab
  switch (id) {
    case 'invite': return c.alone ? STEP_WORDS.alone : view.team_presence.title
    case 'view': {
      if (!viewIn(view)) return STEP_WORDS.viewToGive
      if (c.shared.some((s) => s.by_id === view.you_id && !s.skip)) return STEP_WORDS.viewShared
      return c.mine.some((m) => !m.earlier && !m.skip) ? STEP_WORDS.viewPrivate : STEP_WORDS.viewSkipped
    }
    case 'reveal': return c.can_reveal ? STEP_WORDS.revealReady : c.waiting !== null ? c.waiting : revealed(view) ? STEP_WORDS.revealDone : STEP_WORDS.revealLater
    case 'differ': return !revealed(view) ? STEP_WORDS.differLater : differLine ?? STEP_WORDS.differOpen
    case 'commit': return c.commitments.length === 0 ? STEP_WORDS.commitNone : c.commitments[c.commitments.length - 1]!.action
    case 'outcome': {
      if (c.commitments.length === 0) return STEP_WORDS.outcomeLater
      const open = withoutOutcome(c.commitments).length
      return open === 0 ? STEP_WORDS.outcomeAll : STEP_WORDS.outcomeOpen(open)
    }
  }
}

/**
 * The person's own choice of open step, held only while the current step is the one it was made under (`under`), for this scenario. `'none'`:
 * they closed the open step. Anything outside the tab that sends the person to a step (an outcome form, the commitment form, the invite form)
 * calls `openStep`, which is chosen under whatever the current step is when the tab next draws.
 */
interface FlowChoice { readonly sid: string | null; readonly under: StepId | null; readonly chosen: StepId | 'none' | null; readonly pending: StepId | null
  /** Held whatever the current step becomes, until the person presses a row: a one-time invite link must stay in view after core counts the
   *  colleague as a member (core sets `alone` false when the link is made, not when they join; measured on core 9ad89f81). */
  readonly held?: boolean }
export const useTeamFlow = create<FlowChoice>()(() => ({ sid: null, under: null, chosen: null, pending: null, held: false }))

/** Open a step from anywhere (it applies to the scenario on screen the next time the tab draws). */
export function openStep(id: StepId): void { useTeamFlow.setState({ pending: id }) }
/** For specs. */
export function resetTeamFlow(): void { useTeamFlow.setState({ sid: null, under: null, chosen: null, pending: null, held: false }) }
/** Keep a step open whatever the current step becomes, until the person presses a row (the invite link just made). */
export function holdStep(sid: string, id: StepId): void { useTeamFlow.setState({ sid, under: null, chosen: id, pending: null, held: true }) }

/** Which step is open now. */
export function openStepOf(choice: FlowChoice, sid: string, current: StepId): StepId | null {
  if (choice.sid === sid && choice.held === true && choice.chosen !== null && choice.chosen !== 'none') return choice.chosen
  if (choice.sid !== sid || choice.under !== current || choice.chosen === null) return current
  return choice.chosen === 'none' ? null : choice.chosen
}

/** The person presses a step's row: it opens, or (already open) closes. */
export function toggleStep(sid: string, current: StepId, id: StepId, openNow: StepId | null): void {
  useTeamFlow.setState({ sid, under: current, chosen: openNow === id ? 'none' : id, pending: null, held: false })
}

/** A pending `openStep` becomes the person's choice under the current step. */
export function takePending(sid: string, current: StepId): void {
  const p = useTeamFlow.getState().pending
  if (p !== null) useTeamFlow.setState({ sid, under: current, chosen: p, pending: null, held: false })
}
