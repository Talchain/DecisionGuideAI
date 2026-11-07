/**
 * "Find evidence" on a selected card or link (the dock's "Selected:" row, beside Rename), and the panel it opens: Olumi's web-search
 * proposals for that one record, each marked as Olumi's and provisional, with the member's three choices (accept as evidence, set the
 * figure's range from it, reject), and the evidence already attached to the record. Nothing is applied without a member's press; every
 * word about a source and every figure is core's (research/api.ts), drawn here as it came.
 *
 * The panel is a fixed overlay by portal, so it never moves the board or the dock (no canvas layout file is touched). While a search runs,
 * the list is read again every few seconds until core says it has landed.
 */
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../components/ui/Button'
import { TeamApiError, teamApi } from '../../olumiCore/team/api'
import { runWrite, useWriteSending } from '../../olumiCore/team/writes'
import { linkOf } from '../../olumiCore/team/EvidencePanel'
import { BODY, CARD, ERR, H, LABEL, META } from '../../olumiCore/team/ui'
import { isForThisPage, useMe } from '../../olumiCore/me'
import { useViewStore } from '../store'
import type { View } from '../client'
import { research, type ResearchChoice, type ResearchItem, type ResearchProposal } from './api'

const POLL_MS = 3_000
const STANCE: Record<ResearchProposal['stance'], string> = { supports: 'Supports the model as it is', challenges: 'Challenges the model as it is', unclear: 'Not clear against the model' }
const STRENGTH: Record<ResearchProposal['strength'], string> = { strong: 'Strong', moderate: 'Moderate', weak: 'Weak' }
/** A piece of evidence's stance in the Team tab's own words (EvidencePanel STANCES). */
const EVIDENCE_STANCE: Record<string, string> = { supports: 'Supports it', challenges: 'Challenges it', unclear: 'Not clear yet' }
const CHOSEN: Record<ResearchChoice, string> = { accept: 'Attached as evidence', reject: 'Set aside', set_range: 'Range set and attached as evidence' }
const failed = (e: unknown) => (e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')

/** The record a selection names: a card's own id; a link's relation record (the View's `links[].remove.record`), else none. */
function recordOf(view: View | null, s: { id: string; kind: 'node' | 'edge' }): { record: string; about: string } | null {
  const m = view?.model
  if (!m) return null
  if (s.kind === 'node') {
    for (const c of m.cards) if (c.id === s.id) return c.family === 'quantity' || c.family === 'assumption' ? { record: c.id, about: c.heading } : null
    return null
  }
  for (const l of m.links) if (`${l.from}->${l.to}:${l.kind}` === s.id) return l.remove ? { record: l.remove.record, about: l.label || l.title } : null
  return null
}

function Proposal({ sid, item, p, base, onWrote }: { sid: string; item: ResearchItem; p: ResearchProposal; base: number | null; onWrote: (modelChanged: boolean) => Promise<void> }): JSX.Element {
  const key = `${sid}:research:${item.id}:${p.k}`
  const sending = useWriteSending(key)
  const [error, setError] = useState<string | null>(null)
  const choose = async (choice: ResearchChoice) => {
    setError(null)
    try {
      await runWrite(key, { op: true }, { research: item.id, proposal: p.k, choice, base }, (op) => research.choose(sid, item.id, p.k, choice, choice === 'set_range' ? base : null, op!))
      await onWrote(choice === 'set_range')
    } catch (e) { setError(failed(e)) }
  }
  const link = linkOf(p.url)
  let host = p.url
  try { host = new URL(p.url).hostname.replace(/^www\./, '') } catch { /* shown as given */ }
  return (
    <li data-research-proposal={p.k} data-olumi="" data-provisional="" className="grid gap-1.5 rounded-[12px] border border-dashed border-info/60 bg-panel p-2.5">
      <p className={`${META} text-info`} title={p.mark} aria-label={p.mark}>Olumi’s proposal · provisional</p>
      <p className={H}>{link ? <a href={link} target="_blank" rel="noreferrer noopener" className="underline decoration-info/50 underline-offset-2">{p.title}</a> : p.title}</p>
      <p className={META}>{host} · {p.published ?? 'undated'}</p>
      <blockquote className={`${BODY} m-0 border-l-2 border-panel-border pl-2 italic`}>“{p.quote}”</blockquote>
      <p className={BODY}><span className={LABEL + ' inline'}>Suggests </span>{p.implies.words}</p>
      <p className={META}><span className="text-text-header">Relevance:</span> {p.relevance}</p>
      <p className={META}><span className="text-text-header">Strength:</span> {STRENGTH[p.strength]}. {p.strength_why}</p>
      <p className={META} data-stance={p.stance}>{STANCE[p.stance]}</p>
      {p.choice ? (
        <p className={`${META} text-text-header`} data-research-choice={p.choice.choice}>{CHOSEN[p.choice.choice]} by {p.choice.by}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="secondary" disabled={sending} onClick={() => void choose('accept')} data-research-accept={p.k}>Attach as evidence</Button>
          {p.settable && base !== null ? <Button size="sm" variant="secondary" disabled={sending} onClick={() => void choose('set_range')} data-research-range={p.k}>Use to set the range</Button> : null}
          <Button size="sm" variant="ghost" disabled={sending} onClick={() => void choose('reject')} data-research-reject={p.k}>Set aside</Button>
        </div>
      )}
      {!p.choice && !p.settable && p.implies.kind === 'range' && p.why_not ? <p className={META}>Cannot set the range: {p.why_not}.</p> : null}
      {error ? <p className={ERR}>{error}</p> : null}
    </li>
  )
}

function Attached({ sid, view, record, onWrote }: { sid: string; view: View; record: string; onWrote: () => Promise<void> }): JSX.Element | null {
  const rows: View['evidence'] = []
  for (const e of view.evidence) if (e.concerns.includes(record)) rows.push(e)
  const [error, setError] = useState<string | null>(null)
  if (rows.length === 0) return null
  const consider = async (id: number) => {
    setError(null)
    try { await runWrite(`${sid}:consider:${id}`, { op: true }, { evidence: id }, (op) => teamApi.considerEvidence(sid, id, op!)); await onWrote() } catch (e) { setError(failed(e)) }
  }
  return (
    <section className="grid gap-1.5" data-research-attached="">
      <p className={LABEL}>Evidence on this card</p>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {rows.map((e) => (
          <li key={e.id} className="grid gap-1 rounded-[10px] border border-panel-border p-2" data-evidence={e.id}>
            <p className={BODY}>{e.text}</p>
            <p className={META}>{e.by} · {EVIDENCE_STANCE[e.stance] ?? e.stance}{e.link ? <> · <a href={e.link} target="_blank" rel="noreferrer noopener" className="underline">source</a></> : null}</p>
            {e.considered ? <p className={META}>Olumi considered it{e.considered.proposal !== null ? ': it proposed a change, shown in the chat' : e.considered.why ? `: ${e.considered.why.text}` : ''}</p>
              : <div><Button size="sm" variant="ghost" onClick={() => void consider(e.id)} data-research-consider={e.id}>Ask Olumi what it changes</Button></div>}
          </li>
        ))}
      </ul>
      {error ? <p className={ERR}>{error}</p> : null}
    </section>
  )
}

function Panel({ sid, view, record, about, right, onClose }: { sid: string; view: View; record: string; about: string; right: number; onClose: () => void }): JSX.Element {
  const [items, setItems] = useState<ResearchItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const key = `${sid}:research:${record}`
  const sending = useWriteSending(key)
  const read = useCallback(async () => {
    try { const r = await research.list(sid); const mine: ResearchItem[] = []; for (const x of r.research) if (x.record === record) mine.push(x); setItems(mine) } catch (e) { setError(failed(e)) }
  }, [sid, record])
  useEffect(() => { void read() }, [read])
  const searching = items !== null && items.some((x) => x.status === 'searching')
  useEffect(() => {
    if (!searching) return
    const t = setInterval(() => { void read() }, POLL_MS)
    return () => clearInterval(t)
  }, [searching, read])
  const start = async () => {
    setError(null)
    try { await runWrite(key, { op: true }, { record, at: Date.now() }, (op) => research.start(sid, record, op!)); await read() } catch (e) { setError(failed(e)) }
  }
  const onWrote = async (modelChanged = false) => {
    const s = useViewStore.getState()
    await (modelChanged ? s.modelChanged() : s.refresh())
    await read()
  }
  const latest = items && items.length ? items[0]! : null
  const base = view.model?.edit_base ?? null
  return createPortal(
    <aside role="dialog" aria-label={`Evidence for ${about}`} data-research-panel={record} style={{ right }}
      className={`${CARD} fixed top-[108px] z-[60] w-[380px] max-h-[calc(100vh-176px)] overflow-y-auto shadow-lg`}>
      <div className="flex items-start justify-between gap-2">
        <p className={H}>Evidence for “{about}”</p>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close">Close</Button>
      </div>
      <p className={META}>Olumi searches the web and proposes sources. Nothing in the model changes until you choose.</p>
      {latest === null || latest.status !== 'searching' ? (
        <div><Button size="sm" variant="secondary" disabled={sending} onClick={() => void start()} data-research-start={record}>{latest === null ? 'Search the web' : 'Search again'}</Button></div>
      ) : null}
      {latest ? (
        <section className="grid gap-2" data-research-item={latest.id} data-research-status={latest.status}>
          {latest.said ? <p className={BODY}>{latest.said}</p> : null}
          {latest.look_for.length ? (
            <div><p className={LABEL}>What to look for</p><ul className={`${META} m-0 list-disc pl-4`}>{latest.look_for.map((x) => <li key={x}>{x}</li>)}</ul></div>
          ) : null}
          {latest.proposals.length ? (
            <ul className="m-0 grid list-none gap-2 p-0">
              {latest.proposals.map((p) => <Proposal key={p.k} sid={sid} item={latest} p={p} base={base} onWrote={onWrote} />)}
            </ul>
          ) : null}
        </section>
      ) : null}
      {error ? <p className={ERR}>{error}</p> : null}
      <Attached sid={sid} view={view} record={record} onWrote={() => onWrote(false)} />
    </aside>,
    document.body,
  )
}

/** The dock's "Find evidence" for the selected card or link: on the person's own page, the live version, a card core can research. */
export function FindEvidence({ s }: { s: { id: string; kind: 'node' | 'edge' } }): JSX.Element | null {
  const sid = useViewStore((x) => x.sid)
  const view = useViewStore((x) => x.view)
  const at = useViewStore((x) => x.at)
  const me = useMe((x) => x.me)
  const [open, setOpen] = useState<string | null>(null)
  // The panel opens over the board, just left of the dock that holds this button, so it never sits under the dock or covers its row.
  const [right, setRight] = useState(16)
  const target = recordOf(view, s)
  if (sid === null || view === null || at !== null || target === null || !isForThisPage(view, me)) return null
  return (
    <>
      <Button size="sm" variant="ghost" data-research-find={target.record}
        onClick={(e) => { const dock = e.currentTarget.closest('aside') ?? e.currentTarget; setRight(Math.max(16, window.innerWidth - dock.getBoundingClientRect().left + 12)); setOpen(open === target.record ? null : target.record) }}>Find evidence</Button>
      {open === target.record ? <Panel sid={sid} view={view} record={target.record} about={target.about} right={right} onClose={() => setOpen(null)} /> : null}
    </>
  )
}
