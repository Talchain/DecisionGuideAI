import { controls } from '../../../styles/controls'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../components/ui/Button'
import type { View } from '../../client'
import { teamApi, TeamApiError } from '../../../olumiCore/team/api'
import { putDraft, useDraft } from '../../../olumiCore/team/drafts'
import { MAY_HAVE_SAVED, runWrite, useWriteLocked, useWriteSending } from '../../../olumiCore/team/writes'
import { CARD, ERR, FIELD, H, LABEL, META } from '../../../olumiCore/team/ui'
import { currentModel, useViewStore } from '../../store'
import { useCanvasStore } from '../../../canvas/store'
import { useEscapeLayer } from '../edit/escapeLayers'
import { useLaneInspector } from '../edit/inspectorStore'
import { isForThisPage, useMe } from '../../../olumiCore/me'
import { ExpectationEntry, expectationOf } from '../learning/ExpectationEntry'
import { seedWords } from '../../plainWords'
import { OkIcon, OkIconButton } from '../../look/icons'
import { VIEW_CHIP_PRIMARY_CLASS } from '../../../v5/blocks/chipClass'

/**
 * V12 Funding-Commit, "Record what you will do": the board's three questions and one primary button, on the EXISTING commitment write
 * (`teamApi.addCommitment`, the Team tab's own write key and draft, so the two forms never send one commitment twice and a draft typed in
 * either is the same draft). The words of the form are the board's fixed chrome; the person's three answers are theirs, sent as typed.
 * Owner is the person writing it (a commitment is made by its owner; the Team tab's form offers the rest). No option is named: this form
 * records an action, and the Team tab still holds the option choice. Olumi writes none of the answers.
 */
export const COMMIT_WORDS = {
  heading: 'Record what you will do', action: 'What will you do?', expect: 'What do you expect to happen?',
  reconsider: 'When would you reconsider?', keep: 'Keep it', footnote: 'You can compare what happened with what you expected later.',
  /** Paul, 18 Nov ("There's no way to get rid of the 'Record what you will do' panel"): the form closes, and a draft can be thrown away. */
  close: 'Close', discard: 'Discard draft', draftKept: 'Draft kept',
  /** Codex review 008 (18 Nov): the folded line says a save in flight; it never reads as a draft merely kept. */
  saving: 'Saving',
  /** Fixed chrome for the form before a model is approved: says what it is not (no option chosen), and claims nothing about the model. */
  /** v10 review item 12: the Next step card's secondary button, and the kept idea's "Use as my action" (fixed chrome). */
  nextStepButton: 'Record what you will do', useAsAction: 'Use as my action', yours: 'This is your draft, copied from an idea you kept. Change it as you like.',
  /** A commitment started from an option's details: the form says which option it is about, and the person can take that off. */
  about: 'About this option:', notAboutOption: 'Not about an option', commitToThis: 'Commit to this',
  unanchored: 'No option is chosen. This records what you will do now, and it does not approve the proposed model.',
} as const

interface Draft { open: boolean; seeded?: boolean; action: string; owner: string; expect: string; reconsider: string; keeps: string[]; option?: string; reviewOn?: string; trigger?: string }
const EMPTY: Draft = { open: false, action: '', owner: '', expect: '', reconsider: '', keeps: [], option: '', reviewOn: '' }

/**
 * v10 review item 12: opens the form from outside it (the Next step card, a kept idea). With `action`, the idea's words go VERBATIM into the first box
 * as the person's own editable draft (after anything they already typed there, never over it); the expectation and the reconsider box stay blank.
 * Nothing is saved and nothing is sent: the person still presses "Keep it".
 */
export function openCommitDraft(sid: string, view: View, action?: string): void {
  putDraft<Draft>(`${sid}:commitment`, (prev) => {
    const base: Draft = { ...EMPTY, owner: view.you_id, ...prev, open: true }
    if (action === undefined) return base
    const typed = base.action.trim() !== ''
    // The idea's words, as plain text (a text box draws markdown's "## " as typed characters): every word kept, in order.
    const words = seedWords(action)
    return { ...base, action: !typed ? words : base.action.includes(words) ? base.action : `${base.action}\n\n${words}`, seeded: true }
  })
  setTimeout(() => document.getElementById('commit-form-action')?.focus({ preventScroll: true }), 0)
}

/**
 * "Commit to this", from an option's details panel: the same form, the same draft, with the option's id and nothing else set. The person's three
 * answers stay theirs; the version sent is the approved one on screen (`view.version`), as for any anchored commitment.
 */
export function openCommitTo(sid: string, view: View, option: string): void {
  putDraft<Draft>(`${sid}:commitment`, (prev) => ({ ...EMPTY, owner: view.you_id, ...prev, open: true, option }))
  openCommitDraft(sid, view)
}

/** The "Commit to this" press for an option's details: drawn only where this page may commit (the approved model, never a past version). */
export function CommitToThisButton({ option }: { option: string }): JSX.Element | null {
  const reach = useCommitReach()
  if (reach === null || reach.view.version === null || reach.view.proposal !== null) return null
  return (
    <button type="button" data-testid="lane-inspector-commit" onClick={() => openCommitTo(reach.sid, reach.view, option)}
      className={VIEW_CHIP_PRIMARY_CLASS}>
      <OkIcon id="commit-action" size={14} decorative inherit />{COMMIT_WORDS.commitToThis}
    </button>
  )
}

/** Whether this page may draw the commitment form at all: its own View, never a past version, only for the person it is for. */
function useCommitReach(): { view: View; sid: string } | null {
  const view = useViewStore((s) => s.view), sid = useViewStore((s) => s.sid), at = useViewStore((s) => s.at)
  const me = useMe((s) => s.me)
  return view === null || !sid || at !== null || !isForThisPage(view, me) ? null : { view, sid }
}

/** P5 (system spec): "Record what you will do" is an icon in the composer's icon row, its words the hover (the registry's `commit-action`, through the one Tip). It only opens
 *  the form below (the same form, draft and write route as ever); commitment stays a step, not a footnote. */
export function RecordStepButton(): JSX.Element | null {
  const reach = useCommitReach()
  if (reach === null) return null
  return <OkIconButton id="commit-action" words={COMMIT_WORDS.nextStepButton} testid="view-next-record" tone="ghost" onClick={() => openCommitDraft(reach.sid, reach.view)} />
}

/** A kept idea's "Use as my action": its words, verbatim, in the form's first box as the person's draft. */
export function UseAsActionButton({ text }: { text: string }): JSX.Element | null {
  const reach = useCommitReach()
  if (reach === null) return null
  return (
    <button type="button" data-testid="view-kept-idea-use" onClick={() => openCommitDraft(reach.sid, reach.view, text)}
      className={`${controls.chipText} inline-flex items-center text-text-light hover:bg-panel-hover hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>{COMMIT_WORDS.useAsAction}</button>
  )
}

/** A labelled field. Defined once at module level: a component made inside the form's render is a new type every keystroke, so React
 *  remounts the textarea and the person loses focus after one character (Codex's UI chat, 16 Nov). */
const L = ({ id, t, children }: { id: string; t: string; children: JSX.Element }) => <div className="grid gap-1"><label htmlFor={id} className={LABEL}>{t}</label>{children}</div>

/** `docked`: the chat's mount, where the form stands in its own box at the thread's foot (ViewChat), outside the thread's scroll, so it is
 *  always in view and never scrolls the conversation; the Team tab's mount sits in its tab's flow and brings itself into view on open. */
export function CommitForm({ sid, view, onWrote, docked = false }: { sid: string; view: View; onWrote: () => Promise<boolean>; docked?: boolean }): JSX.Element | null {
  const key = `${sid}:commitment`
  const [d, setD, drop] = useDraft<Draft>(key, { ...EMPTY, owner: view.you_id })
  const [mine, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // "Keep it" is always pressable: pressed with a box empty it marks the empty boxes (aria-invalid) and sends nothing (Paul, 19 Nov).
  const [tried, setTried] = useState(false)
  const locked = useWriteLocked(key), sending = useWriteSending(key)
  const busy = mine || sending
  // Collapsed to one quiet line until pressed (V12 refinement spec 6). Open only while the person has it open (its own line, the Next step
  // card or a kept idea opened it): Close folds it and KEEPS the draft, which the folded line then says; Discard draft empties it.
  const hasDraft = [d.action, d.expect, d.reconsider].some((t) => t.trim() !== '')
  // ONE open flag (the draft's `open`). A form the person has not touched folds itself when they go on to another card: it was in the way of the chat,
  // and nothing is lost. A touched form, one opened from an option, or one that is saving stays as it is.
  const picked = useCanvasStore((s) => [...s.selection.nodeIds].join('\u0000'))
  const seen = useRef(picked)
  useEffect(() => {
    if (seen.current === picked) return
    seen.current = picked
    if (d.open && !hasDraft && !d.option && !busy && !locked) setD((x) => ({ ...x, open: false }))
  })
  // One surface at a time (Paul, 19 Nov): a card's pop-over opening folds a form nobody has touched; a touched one, one opened from an option, or a saving one stays.
  const popover = useLaneInspector((s) => (s.current?.kind === 'details' ? s.current.n : null))
  useEffect(() => {
    if (popover !== null && d.open && !hasDraft && !d.option && !busy && !locked) setD((x) => ({ ...x, open: false }))
  }, [popover]) // eslint-disable-line react-hooks/exhaustive-deps
  // Core refuses a commitment TO AN OPTION without an approved version, so with none this is the unanchored form: an action and what the
  // person expects, with no option, version, trigger, review date or kept dissent (record-writes.ts commit takes option:null). A pending
  // proposal stays unapproved; nothing here is read from it.
  const anchored = view.version !== null
  // The option this commitment is about: sent ONLY when it is a live option of the approved model and so named on the form (a draft's option set
  // aside or removed since is never written unseen; review finding 18 Nov).
  const approved = useViewStore(currentModel)
  const bound = anchored && d.option && d.option !== '-' ? (approved ?? view.model)?.cards.find((x) => x.id === d.option && x.family === 'option' && x.status === null) ?? null : null
  const owner = d.owner === '' ? view.you_id : d.owner
  const ready = [d.action, d.expect, d.reconsider].every((t) => t.trim() !== '') && view.collab.owners.some((o) => o.id === owner)
  const put = (p: Partial<Draft>) => { setD((x) => ({ ...x, ...p })); if (error) setError(null) }
  const save = async () => {
    if (locked || busy) return
    if (!ready) { setTried(true); return }
    setBusy(true); setError(null)
    try {
      await runWrite(key, { op: false }, null, () => teamApi.addCommitment(sid, { action: d.action, owner, expect: d.expect, reconsider: d.reconsider, keeps: anchored ? d.keeps ?? [] : [], option: bound?.id ?? null, version: view.version?.n ?? null, review_on: anchored && d.reviewOn ? d.reviewOn : null, trigger: anchored && d.trigger ? d.trigger : null }))
      drop(); setTried(false)
      // Saved: the form folds back to its one line. It stayed open and empty when the person had opened it by its own button (the native
      // team journey, 17 Nov: an expanded empty form left after save).
      await onWrote()
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : view.team_words.failed)
    } finally { setBusy(false) }
  }
  const area = (id: string, k: 'action' | 'expect' | 'reconsider') => (
    // One line tall at rest and as tall as what is typed, to about seven lines (three empty tall boxes read as a long form).
    <textarea id={id} data-testid={id} rows={1} className={`${FIELD} min-h-[36px] max-h-[168px] [field-sizing:content] aria-[invalid=true]:border-danger`} value={d[k]} disabled={busy || locked} aria-invalid={tried && d[k].trim() === '' ? true : undefined} onChange={(e) => put({ [k]: e.target.value })} />
  )
  const close = () => { if (d.open) put({ open: false }) }
  // Escape folds the form and keeps the draft, as its X does (the one shared Escape rule, ../edit/escapeLayers.ts).
  useEscapeLayer(d.open, close)
  const discard = () => { drop(); setError(null); setTried(false) }
  // The save's own state, drawn the same folded or open: a save that may have landed (or that core refused) is never hidden by Close.
  const status = locked ? <p role="alert" data-testid="commit-form-error" className={ERR}>{MAY_HAVE_SAVED}</p> : error ? <p role="alert" data-testid="commit-form-error" className={ERR}>{error}</p> : null
  // Opening, from its own button or from outside, brings the form just far enough into its tab's scroll area (the Team tab). Docked in the
  // chat it is already in view, and the thread rests on its newest reply as it shrinks (ViewChat followNewest). Focus never scrolls.
  // jsdom draws no layout and has no scrollIntoView.
  const form = useRef<HTMLElement>(null)
  useEffect(() => { if (d.open && !docked) form.current?.scrollIntoView?.({ block: 'nearest' }) }, [d.open, docked])
  if (!d.open) {
    return (
      <section data-testid="commit-form" data-anchored={anchored ? 'true' : 'false'} data-open="false" aria-label={COMMIT_WORDS.heading} className="grid">
        {/* The entry is the composer's icon (RecordStepButton); this folded section says only what is in flight or kept, never a second button. */}
        {busy ? <p className={`${META} font-normal`} data-testid="commit-form-saving">{COMMIT_WORDS.saving}</p>
          : hasDraft ? <p className={`${META} font-normal`} data-testid="commit-form-draft-kept">{COMMIT_WORDS.draftKept}</p> : null}
        {status}
      </section>
    )
  }
  return (
    <section ref={form} data-testid="commit-form" data-anchored={anchored ? 'true' : 'false'} data-open="true" aria-label={COMMIT_WORDS.heading} className={CARD}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={H} data-testid="commit-form-heading">{COMMIT_WORDS.heading}</h3>
        <OkIconButton id="cancel-close" tone="ghost" words={COMMIT_WORDS.close} testid="commit-form-close" onClick={close} />
      </div>
      {!anchored && <p className={META} data-testid="commit-form-unanchored">{COMMIT_WORDS.unanchored}</p>}
      {bound === null ? null : (
        <p className={`${META} flex flex-wrap items-center gap-1.5`} data-testid="commit-form-option" data-option={bound.id}>
          <span>{COMMIT_WORDS.about} <span className="font-medium text-text-header">{bound.heading}</span></span>
          <button type="button" data-testid="commit-form-option-clear" onClick={() => put({ option: '' })}
            className={`${controls.chipText} inline-flex cursor-pointer items-center text-text-light hover:bg-panel-hover hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>{COMMIT_WORDS.notAboutOption}</button>
        </p>
      )}
      {d.seeded && d.action.trim() !== '' && <p className={META} data-testid="commit-form-yours">{COMMIT_WORDS.yours}</p>}
      <L id="commit-form-action" t={COMMIT_WORDS.action}>{area('commit-form-action', 'action')}</L>
      <L id="commit-form-expect" t={COMMIT_WORDS.expect}>{area('commit-form-expect', 'expect')}</L>
      <L id="commit-form-reconsider" t={COMMIT_WORDS.reconsider}>{area('commit-form-reconsider', 'reconsider')}</L>
      {status}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="chip" data-testid="commit-form-keep" disabled={busy || locked} onClick={() => void save()}>{COMMIT_WORDS.keep}</Button>
        {/* A quiet grey text press, never blue (blue is Olumi's) and never a second filled button beside Keep it. */}
        {hasDraft && !busy && !locked ? (
          <button type="button" data-testid="commit-form-discard" onClick={discard}
            className={`${controls.chipText} inline-flex cursor-pointer items-center text-text-light hover:bg-panel-hover hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>{COMMIT_WORDS.discard}</button>
        ) : null}
      </div>
      {/* One quiet line under the buttons: what keeping it is for. A box left empty is marked on the box itself, not said again here. */}
      <p className={META} data-testid="commit-form-footnote">{COMMIT_WORDS.footnote}</p>
    </section>
  )
}

/** A message is sent: a form the person has not touched (all three answers blank, not opened from an option) folds itself; a touched one keeps its draft. */
export function closeUntouchedCommit(sid: string): void {
  putDraft<Draft>(`${sid}:commitment`, (prev) => prev !== undefined && prev.open && !prev.option && [prev.action, prev.expect, prev.reconsider].every((t) => t.trim() === '') ? { ...prev, open: false } : (prev as Draft))
}

export function useSavedExpectationCount(): 0 | 1 {
  const reach = useCommitReach()
  return reach !== null && expectationOf(reach.view) !== null ? 1 : 0
}

/** The Olumi tab's foot-row mount: the person's saved expectation with no outcome yet (v12/learning), read from the page's own View, never past
 *  versions, and only for the person this page is for. The form that records the next one is docked under the thread (CommitFormFoot). */
export function CommitFormSlot(): JSX.Element | null {
  const reach = useCommitReach()
  return reach === null ? null : <ExpectationEntry sid={reach.sid} view={reach.view} />
}

/** The Olumi tab's form mount, docked at the thread's foot above the composer (DL 20 Nov, the 1232 and 1.33 limit: inside the thread, the open
 *  form scrolled Olumi's newest reply out of view). Folded, it is only its in-flight or kept line. */
export function CommitFormFoot(): JSX.Element | null {
  const reach = useCommitReach(), refresh = useViewStore((s) => s.refresh)
  return reach === null ? null : <CommitForm sid={reach.sid} view={reach.view} onWrote={refresh} docked />
}
