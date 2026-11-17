import { useState } from 'react'
import { Plus } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { Button } from '../../../components/ui/Button'
import type { View } from '../../client'
import { teamApi, TeamApiError } from '../../../olumiCore/team/api'
import { useDraft } from '../../../olumiCore/team/drafts'
import { MAY_HAVE_SAVED, runWrite, useWriteLocked, useWriteSending } from '../../../olumiCore/team/writes'
import { CARD, ERR, FIELD, H, LABEL, META } from '../../../olumiCore/team/ui'
import { ReviewOnField } from '../../../olumiCore/team/ReviewOnField'
import { useViewStore } from '../../store'
import { isForThisPage, useMe } from '../../../olumiCore/me'

/**
 * V12 Funding-Commit, "Record what you will do": the board's three questions and one primary button, on the EXISTING commitment write
 * (`teamApi.addCommitment`, the Team tab's own write key and draft, so the two forms never send one commitment twice and a draft typed in
 * either is the same draft). The words of the form are the board's fixed chrome; the person's three answers are theirs, sent as typed.
 * Owner is the person writing it (a commitment is made by its owner; the Team tab's form offers the rest). No option is named: this form
 * records an action, and the Team tab still holds the option choice. Olumi writes none of the answers.
 */
export const COMMIT_WORDS = {
  heading: 'Record what you will do', proposed: 'Proposed', action: 'What will you do?', expect: 'What do you expect to happen?',
  reconsider: 'When would you reconsider?', keep: 'Keep it', footnote: 'You can compare what happened with what you expected later.',
  /** Fixed chrome for the form before a model is approved: says what it is not (no option chosen), and claims nothing about the model. */
  unanchored: 'No option is chosen. This records what you will do now, and it does not approve the proposed model.',
} as const

interface Draft { open: boolean; action: string; owner: string; expect: string; reconsider: string; keeps: string[]; option?: string; reviewOn?: string; trigger?: string }
const EMPTY: Draft = { open: false, action: '', owner: '', expect: '', reconsider: '', keeps: [], option: '', reviewOn: '' }

/** A labelled field. Defined once at module level: a component made inside the form's render is a new type every keystroke, so React
 *  remounts the textarea and the person loses focus after one character (Codex's UI chat, 16 Nov). */
const L = ({ id, t, children }: { id: string; t: string; children: JSX.Element }) => <div className="grid gap-1"><label htmlFor={id} className={LABEL}>{t}</label>{children}</div>

export function CommitForm({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => Promise<boolean> }): JSX.Element | null {
  const key = `${sid}:commitment`
  const [d, setD, drop] = useDraft<Draft>(key, { ...EMPTY, owner: view.you_id })
  const [mine, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locked = useWriteLocked(key), sending = useWriteSending(key)
  const busy = mine || sending
  // Collapsed to one quiet line until pressed (V12 refinement spec 6); a draft already typed (here or in the Team tab) keeps it open.
  const [opened, setOpened] = useState(false)
  const hasDraft = [d.action, d.expect, d.reconsider].some((t) => t.trim() !== '')
  // Core refuses a commitment TO AN OPTION without an approved version, so with none this is the unanchored form: an action and what the
  // person expects, with no option, version, trigger or kept dissent (record-writes.ts commit takes option:null). A pending proposal stays
  // unapproved; nothing here is read from it. The review date is not a model field: core takes it with or without a version, so it is sent
  // whenever the person picked one.
  const anchored = view.version !== null
  const owner = d.owner === '' ? view.you_id : d.owner
  const ready = [d.action, d.expect, d.reconsider].every((t) => t.trim() !== '') && view.collab.owners.some((o) => o.id === owner)
  const put = (p: Partial<Draft>) => { setD((x) => ({ ...x, ...p })); if (error) setError(null) }
  const save = async () => {
    if (!ready || locked || busy) return
    setBusy(true); setError(null)
    try {
      await runWrite(key, { op: false }, null, () => teamApi.addCommitment(sid, { action: d.action, owner, expect: d.expect, reconsider: d.reconsider, keeps: anchored ? d.keeps ?? [] : [], option: anchored && d.option && d.option !== '-' ? d.option : null, version: view.version?.n ?? null, review_on: d.reviewOn ? d.reviewOn : null, trigger: anchored && d.trigger ? d.trigger : null }))
      drop()
      await onWrote()
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : view.team_words.failed)
    } finally { setBusy(false) }
  }
  const area = (id: string, k: 'action' | 'expect' | 'reconsider') => (
    <textarea id={id} data-testid={id} className={`${FIELD} min-h-[56px]`} value={d[k]} disabled={busy || locked} onChange={(e) => put({ [k]: e.target.value })} />
  )
  if (!opened && !hasDraft && !d.open) {
    return (
      <section data-testid="commit-form" data-anchored={anchored ? 'true' : 'false'} aria-label={COMMIT_WORDS.heading} className="grid">
        <button type="button" data-testid="commit-form-open" onClick={() => setOpened(true)}
          className={`${typography.viewPanelMeta} inline-flex min-h-[24px] w-fit cursor-pointer items-center gap-1.5 font-medium text-text-light hover:text-text-body`}>
          <Plus aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5 flex-none" />{COMMIT_WORDS.heading}
        </button>
      </section>
    )
  }
  return (
    <section data-testid="commit-form" data-anchored={anchored ? 'true' : 'false'} aria-label={COMMIT_WORDS.heading} className={CARD}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={H} data-testid="commit-form-heading">{COMMIT_WORDS.heading}</h3>
        <span className={`${META} rounded-full border border-panel-border px-2 py-0.5`} data-testid="commit-form-proposed">{COMMIT_WORDS.proposed}</span>
      </div>
      {!anchored && <p className={META} data-testid="commit-form-unanchored">{COMMIT_WORDS.unanchored}</p>}
      <L id="commit-form-action" t={COMMIT_WORDS.action}>{area('commit-form-action', 'action')}</L>
      <L id="commit-form-expect" t={COMMIT_WORDS.expect}>{area('commit-form-expect', 'expect')}</L>
      <L id="commit-form-reconsider" t={COMMIT_WORDS.reconsider}>{area('commit-form-reconsider', 'reconsider')}</L>
      <ReviewOnField id="commit-form-review-on" value={d.reviewOn ?? ''} disabled={busy || locked} onChange={(v) => put({ reviewOn: v })} />
      {locked ? <p role="alert" data-testid="commit-form-error" className={ERR}>{MAY_HAVE_SAVED}</p> : error && <p role="alert" data-testid="commit-form-error" className={ERR}>{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" data-testid="commit-form-keep" disabled={!ready || busy || locked} onClick={() => void save()}>{COMMIT_WORDS.keep}</Button>
        {!busy && !locked && !ready && <span className={META} data-testid="commit-form-why">Answer all three first</span>}
      </div>
      <p className={META} data-testid="commit-form-footnote">{COMMIT_WORDS.footnote}</p>
    </section>
  )
}

/** The Olumi tab's mount: reads the page's own View, never past versions, and only for the person this page is for. */
export function CommitFormSlot(): JSX.Element | null {
  const view = useViewStore((s) => s.view), sid = useViewStore((s) => s.sid), at = useViewStore((s) => s.at), refresh = useViewStore((s) => s.refresh)
  const me = useMe((s) => s.me)
  if (view === null || !sid || at !== null || !isForThisPage(view, me)) return null
  return <CommitForm sid={sid} view={view} onWrote={refresh} />
}
