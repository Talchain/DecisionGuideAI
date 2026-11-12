/**
 * The panel beside the board, as the look-proof draws it (template.html buildPanel, reviewEl, showDetail/openDetail), wired to the journey
 * layer. Only what works is drawn: no composer (no AI key on this slice), no lens other than Model. Core's words throughout; the screen's
 * own words are the look's three buttons ("Approve", "Approve selected · n") and the one line that says what unticked lines mean.
 */
import { useState, type ReactNode } from 'react'
import type { View } from '../olumiView/client'
import { useViewStore } from '../olumiView/store'
import {
  TeamApiError, approveAll, approveSelected, correctFigure, editGateNow, groupTicked, lineKey, picksOf, renameCard, setAside, setGroup, toggleLine,
  type Change, type Ticks,
} from '../olumiView/journey'
import { Brand, Chev, Close, Dash, OlumiMark, Pencil, Tick } from './icons'
import { Clamp, loose, type Loose } from './Cards'

const said = (e: unknown, MW: Loose): string => (e instanceof TeamApiError ? e.message : MW.failed)

function Segs({ arr, cls = 'say' }: { arr: Loose[] | null | undefined; cls?: string }) {
  return <p className={cls}>{(arr ?? []).map((s, i) => (s.text != null ? <span key={i}>{s.text}</span> : s.cite != null ? <Cite key={i} text={s.cite} /> : null))}</p>
}
function Cite({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return <><button type="button" className="cite" title={text} aria-expanded={open} onClick={() => setOpen(!open)}><svg viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.2" /><path d="M8 7.3v3.4M8 5.2v.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg></button>{open ? <span className="cite-text">{text}</span> : null}</>
}
function Turn({ t, onShow }: { t: Loose; onShow: (id: string) => void }) {
  const a = t.answer
  return (
    <section className="turn">
      <div className="turn-meta"><span className="by">{t.by}</span><span className="meta">{t.version}</span></div>
      <div className="said-wrap"><Clamp cls="said" text={t.said} lines={3} /></div>
      {a ? (
        <div className="reply"><span className="mk" aria-hidden="true"><Brand s={18} /></span>
          <div className="col">
            <Segs arr={a.answer} />
            {a.why?.length ? <ul className="why">{(a.why as Loose[][]).map((w, i) => <li key={i}><Segs arr={w} cls="w" /></li>)}</ul> : null}
            {a.next ? <div className="askq"><h4>{a.next.label}</h4><Segs arr={a.next.text} />{a.next.at ? <button type="button" className="textlink" onClick={() => onShow(a.next.at)}><span>{t._show}</span></button> : null}</div> : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function Check({ state, label, onPress, testid }: { state: boolean | 'mixed'; label: string; onPress: () => void; testid: string }) {
  return (
    <button type="button" className="check" role="checkbox" aria-checked={state === 'mixed' ? 'mixed' : state ? 'true' : 'false'} aria-label={label} data-testid={testid} onClick={onPress}>
      <i /><span className="tickbox"><Tick /><Dash /></span>
    </button>
  )
}

/** Olumi's proposal: its groups, each line with its tick (with the lines that stand or fall with it), and what the ticks leave out. */
function Review({ v, ticks, setTicks }: { v: View; ticks: Ticks; setTicks: (t: Ticks) => void }) {
  const P = v.proposal!, ch = P.changes, MW = loose(v.model_words)
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set())
  return (
    <section className="sec review" data-testid="next-review">
      <div className="rule" />
      <header><h4>{P.heading}</h4><span className="meta">{P.on}</span></header>
      {MW.heldBody ? <p className="meta">{MW.heldBody}</p> : null}
      {(P.groups ?? []).map((G, gi) => {
        const parts = G.heading.split(' · '), name = parts.shift(), rest = parts.join(' · ')
        const all = groupTicked(ch, ticks, G.lines), some = G.lines.some((i) => ch[i] !== undefined && ticks.has(lineKey(ch[i]!)))
        const isOpen = open.has(gi)
        return (
          <div key={gi} className={`group${isOpen ? ' open' : ''}`} data-group={gi}>
            <div className="ghead">
              <button type="button" className="gtoggle" aria-expanded={isOpen} onClick={() => { const n = new Set(open); if (isOpen) n.delete(gi); else n.add(gi); setOpen(n) }}>
                <Chev /><span><span className="gname">{name}</span>{rest ? <span className="gcount">{rest}</span> : null}</span>
              </button>
              <Check state={all ? true : some ? 'mixed' : false} label={G.heading} testid={`next-group-${gi}`} onPress={() => setTicks(setGroup(ch, ticks, G.lines, !all))} />
            </div>
            <div className="glines">{G.lines.map((ix) => {
              const c = ch[ix]!, t = c.text, cut = t.indexOf(': '), on = ticks.has(lineKey(c))
              return (
                <div key={lineKey(c)} className={`gline${on ? '' : ' left-out'}`} title={c.detail} data-line={c.id}>
                  <div className="gtext">{cut > 0 ? <span className="kind">{t.slice(0, cut + 1)}</span> : null}<span className="nm">{cut > 0 ? t.slice(cut + 2) : t}</span>
                    {c.olumi ? <span className="mk" title={c.olumi.title}><OlumiMark s={8} /></span> : null}</div>
                  <Check state={on} label={t} testid={`next-line-${c.id}`} onPress={() => setTicks(toggleLine(ch, ticks, c))} />
                </div>
              )
            })}</div>
          </div>
        )
      })}
    </section>
  )
}

/** The detail of one card: core's words for whose it is, its figure, what it rests on; and, where the person may, their correction and name. */
function Detail({ v, id, editing, onClose }: { v: View; id: string; editing: boolean; onClose: () => void }) {
  const c = (v.model?.cards ?? []).find((x) => x.id === id) ?? null
  const MW = loose(v.model_words), q = loose(v.model?.question)
  useViewStore((st) => st.view) // re-drawn on every View the store holds
  const gate = editGateNow()
  const [form, setForm] = useState<'figure' | 'name' | null>(editing ? 'figure' : null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The base the editor OPENED on: a background read never moves the person's words onto a newer version.
  const [base] = useState(gate)
  const L = loose(c), f = L.figure, ls = (v.model?.links ?? []).filter((l) => l.from === id || l.to === id)
  const pairs: [ReactNode, (string | null | undefined)[] | null][] = c === null ? [[null, [q.badge?.title]]] : [
    [MW.whose, L.author ? [L.author.text, L.author.title] : null],
    [MW.figure, f ? [f.title || f.text] : L.bound ? [L.bound.title] : null],
    [L.headline?.text ?? null, L.headline ? [L.headline.title !== L.headline.text ? L.headline.title : null, L.headline.range, L.headline.add] : null],
    [MW.whatWouldChange, L.driver ? [L.driver.text] : null],
    [L.badge?.words ?? null, L.badge?.title ? String(L.badge.title).split('\n') : null],
    [null, ((L.premises ?? []) as Loose[]).map((p) => p.title || p.text)],
    [MW.detail, L.detail ? [L.detail] : null],
    [MW.links, ls.map((l) => loose(l).title)],
  ]
  const save = async (act: () => Promise<{ shown: boolean }>) => {
    setBusy(true); setError(null)
    try { const r = await act(); if (r.shown) { setForm(null); setTyped('') } else setError(MW.savedNotShown) } catch (e) { setError(said(e, MW)) } finally { setBusy(false) }
  }
  const offersFigure = c !== null && c.family !== 'option' && f != null
  return (
    <section className="nx-detail" data-testid="next-detail" data-detail-of={id}>
      <header><h3>{c?.heading ?? q.text}</h3><button type="button" className="icon-btn" aria-label={loose(v.evidence_words).close} onClick={onClose}><Close /></button></header>
      <dl>{pairs.map(([dt, dd], i) => (dd === null || dd.every((x) => !x) ? null : <div key={i}>{dt ? <dt>{dt}</dt> : <dt />}{dd.map((x, j) => (x ? <dd key={j}>{x}</dd> : null))}</div>))}</dl>
      {c === null ? null : !base.ok ? (
        // Core takes no change while Olumi's proposal waits (DL ruling c): its own words say so, where a change would be made.
        base.reason === 'after_approval' ? <div className="held" data-testid="next-held"><p className="say">{MW.heldLead}</p><p className="meta">{MW.heldBody}</p></div> : null
      ) : form === null ? (
        <div className="detail-acts">
          {offersFigure && f.edit ? <button type="button" className="textlink" data-testid="next-change-figure" onClick={() => setForm('figure')}><Pencil /><span>{f.text ? MW.changeFigure : MW.setFigure}</span></button> : null}
          <button type="button" className="textlink" data-testid="next-rename" onClick={() => { setTyped(c.heading); setForm('name') }}><span>{MW.rename}</span></button>
        </div>
      ) : (
        <form className="edit" data-testid={`next-form-${form}`} onSubmit={(e) => {
          e.preventDefault()
          if (!base.ok || typed.trim() === '') return
          void save(() => (form === 'figure' ? correctFigure(base, id, typed) : renameCard(base, id, typed)))
        }}>
          <label className="meta" htmlFor="next-edit-field">{form === 'figure' ? (f?.edit?.ask ?? MW.figure) : MW.newName}</label>
          <div className="field"><input id="next-edit-field" type="text" value={typed} placeholder={form === 'figure' ? MW.figureHint : undefined} onChange={(e) => setTyped(e.target.value)} disabled={busy} data-testid="next-edit-field" /></div>
          <div className="edit-acts">
            <button type="submit" className="btn btn-primary" disabled={busy || typed.trim() === ''} data-testid="next-edit-save">{busy ? MW.saving : form === 'figure' ? (f?.text ? MW.changeFigure : MW.setFigure) : MW.saveName}</button>
            <button type="button" className="btn btn-text" onClick={() => { setForm(null); setError(null) }} disabled={busy}>{MW.cancel}</button>
          </div>
        </form>
      )}
      {error ? <p role="alert" className="meta err" data-testid="next-error">{error}</p> : null}
    </section>
  )
}

export function Panel({ v, detail, editing, closeDetail, flash }: { v: View; detail: string | null; editing: boolean; closeDetail: () => void; flash: (id: string) => void }) {
  const MW = loose(v.model_words), P = v.proposal
  const [ticks, setTicks] = useState<Ticks>(new Set())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ch: readonly Change[] = P?.changes ?? []
  const picks = picksOf(ch, ticks), n = picks.only.length + picks.only_top.length
  const act = async (f: () => Promise<{ shown: boolean }>) => {
    setBusy(true); setError(null)
    try { const r = await f(); setTicks(new Set()); if (!r.shown) setError(MW.savedNotShown) } catch (e) { setError(said(e, MW)) } finally { setBusy(false) }
  }
  const chat: Loose[] = (v.chat ?? []).map((t) => ({ ...loose(t), _show: MW.showOnCanvas }))
  return (
    <aside className="nx-panel" data-testid="next-panel">
      <div className="nx-panel-head">{v.team_presence ? <span className="meta">{loose(v.team_presence).label}</span> : null}</div>
      <div className="nx-scroll">
        {detail !== null ? <Detail key={`${detail}:${editing}:${v.version?.n ?? 0}`} v={v} id={detail} editing={editing} onClose={closeDetail} /> : null}
        {chat.some((t) => t.earlier) ? (
          <div className="earlier-list">{chat.flatMap((t, i) => (t.earlier ? [
            <details key={i} className="earlier"><summary><span className="by">{t.by}</span><span className="meta">{t.version}</span><span className="one">{t.said}</span><span><Chev /></span></summary><Turn t={t} onShow={flash} /></details>,
          ] : []))}</div>
        ) : null}
        {chat.flatMap((t, i) => (t.earlier ? [] : [<Turn key={i} t={t} onShow={flash} />]))}
        {P ? <Review v={v} ticks={ticks} setTicks={setTicks} /> : null}
      </div>
      {P ? (
        <div className="nx-decide" data-testid="next-decide">
          <button type="button" className="btn btn-primary" disabled={busy} data-testid="next-approve" onClick={() => void act(approveAll)}>Approve</button>
          <button type="button" className="btn btn-quiet" disabled={busy || n === 0} data-testid="next-approve-selected"
            onClick={() => void act(() => approveSelected(picks, {}, { lines: picks.left.map((c) => c.id) }))}>Approve selected · <span className="selcount">{n}</span></button>
          {MW.heldConfirm ? <button type="button" className="btn btn-text" disabled={busy} data-testid="next-set-aside" onClick={() => void act(setAside)}><span>{MW.heldConfirm}</span></button> : null}
        </div>
      ) : null}
      {/* Unticked lines are not added: said in plain numbers while some are ticked and some are not (the layer keeps no refusal record yet). */}
      {P && n > 0 && picks.left.length > 0 ? <p className="meta nx-decide-note" data-testid="next-left-out">{picks.left.length} not ticked: Approve selected does not add them.</p> : null}
      {error ? <p role="alert" className="meta err nx-decide-note" data-testid="next-error">{error}</p> : null}
    </aside>
  )
}
