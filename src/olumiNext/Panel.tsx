/**
 * The panel beside the board, as the look-proof draws it (template.html buildPanel, reviewEl, showDetail/openDetail), wired to the journey
 * layer. Only what works is drawn: no composer (no AI key on this slice), no lens other than Model. Core's words throughout; the screen's
 * own words are the look's three buttons ("Approve", "Approve selected · n") and the one line that says what unticked lines mean.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { View } from '../olumiView/client'
import { useViewStore } from '../olumiView/store'
import {
  TeamApiError, answer, approveAll, approveSelected, awaitTurn, correctFigure, editGateNow, readingsOn, tellOlumi, tickEvery, working, type Reading, type EditGate, type QuestionRef, groupTicked, lineKey, picksOf, renameCard, setAside, setGroup, toggleLine,
  type Change, type Ticks,
} from '../olumiView/journey'
import { Brand, Chev, Close, Dash, OlumiMark, Pencil, Send, Tick } from './icons'
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
      <div className="turn-meta"><span className="by">{t.by}</span><span className="meta">{t.version}</span>{t.status ? <span className="meta" data-testid="next-turn-status">{t.status}</span> : null}</div>
      <div className="said-wrap"><Clamp cls="said" text={t.said} lines={3} /></div>
      {t.broke ? (
        // Olumi held its reply back: core's one sentence for it (`broke`; with a later core's COACH-WITHHELD marker it names what Olumi could not
        // stand behind and the question to take forward). Drawn as that state, never as a reply; nothing of the held reply is shown.
        <div className="reply withheld" data-testid="next-withheld" data-kind={t.withheld?.kind ?? undefined}><span className="mk" aria-hidden="true"><Brand s={18} /></span>
          <div className="col"><p className="say">{t.broke}</p></div></div>
      ) : a ? (
        <div className="reply"><span className="mk" aria-hidden="true"><Brand s={18} /></span>
          <div className="col">
            <Segs arr={a.answer} />
            {a.why?.length ? <ul className="why">{(a.why as Loose[][]).map((w, i) => <li key={i}><Segs arr={w} cls="w" /></li>)}</ul> : null}
            {a.next ? <div className="askq"><h4>{a.next.label}</h4><Segs arr={a.next.text} />{a.next.at ? <button type="button" className="textlink" onClick={() => onShow(a.next.at)}><span>{t._show}</span></button> : null}</div> : null}
          </div>
        </div>
      ) : t.problem ? (
        // A turn that ended with no answer and no held reply: core's own words for why (JOIN-13 serves a turn that could not finish this way).
        <div className="reply" data-testid="next-turn-problem"><span className="mk" aria-hidden="true"><Brand s={18} /></span><div className="col"><p className="say err">{t.problem}</p></div></div>
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
function Detail({ v, id, editing, onClose, onTell }: { v: View; id: string; editing: boolean; onClose: () => void; onTell: (draft: string) => void }) {
  const c = (v.model?.cards ?? []).find((x) => x.id === id) ?? null
  const MW = loose(v.model_words), q = loose(v.model?.question)
  useViewStore((st) => st.view) // re-drawn on every View the store holds
  const gate = editGateNow()
  const [form, setForm] = useState<'figure' | 'name' | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The base THIS editor opened on (PL-581): captured when the person opens it, kept with their typing across any later View, never
  // retargeted silently; core refuses a stale base in its own words and the typing stays. A save, a cancel or a new editor takes it afresh.
  const [base, setBase] = useState<Extract<EditGate, { ok: true }> | null>(null)
  const open = (which: 'figure' | 'name', start: string) => { const g = editGateNow(); if (!g.ok) return; setBase(g); setTyped(start); setForm(which); setError(null) }
  const close = () => { setForm(null); setBase(null); setTyped(''); setError(null) }
  // The card's pencil opens the figure editor on a detail already open; never over an editor the person is typing in.
  useEffect(() => { if (editing && form === null) open('figure', '') }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps
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
    try { const r = await act(); if (r.shown) close(); else setError(MW.savedNotShown) } catch (e) { setError(said(e, MW)) } finally { setBusy(false) }
  }
  const offersFigure = c !== null && c.family !== 'option' && f != null
  return (
    <section className="nx-detail" data-testid="next-detail" data-detail-of={id}>
      <header><h3>{c?.heading ?? q.text}</h3><button type="button" className="icon-btn" aria-label={loose(v.evidence_words).close} onClick={onClose}><Close /></button></header>
      <dl>{pairs.map(([dt, dd], i) => (dd === null || dd.every((x) => !x) ? null : <div key={i}>{dt ? <dt>{dt}</dt> : <dt />}{dd.map((x, j) => (x ? <dd key={j}>{x}</dd> : null))}</div>))}</dl>
      {c === null ? null : form !== null && base !== null ? (
        <form className="edit" data-testid={`next-form-${form}`} data-base={base.base} onSubmit={(e) => {
          e.preventDefault()
          if (typed.trim() === '') return
          void save(() => (form === 'figure' ? correctFigure(base, id, typed) : renameCard(base, id, typed)))
        }}>
          <label className="meta" htmlFor="next-edit-field">{form === 'figure' ? (f?.edit?.ask ?? MW.figure) : MW.newName}</label>
          <div className="field"><input id="next-edit-field" type="text" value={typed} placeholder={form === 'figure' ? MW.figureHint : undefined} onChange={(e) => setTyped(e.target.value)} disabled={busy} data-testid="next-edit-field" /></div>
          <div className="edit-acts">
            <button type="submit" className="btn btn-primary" disabled={busy || typed.trim() === ''} data-testid="next-edit-save">{busy ? MW.saving : form === 'figure' ? (f?.text ? MW.changeFigure : MW.setFigure) : MW.saveName}</button>
            <button type="button" className="btn btn-text" onClick={close} disabled={busy}>{MW.cancel}</button>
          </div>
        </form>
      ) : gate.ok ? (
        <div className="detail-acts">
          {offersFigure && f.edit ? <button type="button" className="textlink" data-testid="next-change-figure" onClick={() => open('figure', '')}><Pencil /><span>{f.text ? MW.changeFigure : MW.setFigure}</span></button> : null}
          <button type="button" className="textlink" data-testid="next-rename" onClick={() => open('name', c.heading)}><span>{MW.rename}</span></button>
        </div>
      ) : gate.reason === 'after_approval' ? (
        // While Olumi's proposal waits, core takes no direct change (its own words say so) and the person corrects it by telling Olumi
        // (PL-567): core's own words for that, and core's own opening for this card.
        <div className="held" data-testid="next-held">
          <p className="say">{MW.heldLead}</p><p className="meta">{MW.heldBody}</p>
          {MW.askChange ? <button type="button" className="textlink" data-testid="next-ask-change" onClick={() => onTell(MW.askChangeDraft?.[id] ?? '')}><span>{MW.askChange}</span></button> : null}
        </div>
      ) : null}
      {error ? <p role="alert" className="meta err" data-testid="next-error">{error}</p> : null}
    </section>
  )
}

export function Panel({ v, detail, editing, closeDetail, flash, answering = null, setAnswering = () => {} }: { v: View; detail: string | null; editing: boolean; closeDetail: () => void; flash: (id: string) => void; answering?: QuestionRef | null; setAnswering?: (q: QuestionRef | null) => void }) {
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
  // PL-640: the person's answer to each of Olumi's readings is HELD here, never sent on its own; it goes only with an approval they make
  // (Approve: every line, Approve selected: the lines they ticked). Confirm sends the reading with it; Unsure sends neither the reading nor a refusal.
  const [answers, setAnswers] = useState<Readonly<Record<string, 'confirm' | 'unsure'>>>({})
  useEffect(() => { setAnswers({}) }, [P?.id])
  const confirmed = Object.entries(answers).flatMap(([id, a]) => (a === 'confirm' ? [id] : []))
  const chat: Loose[] = (v.chat ?? []).map((t) => ({ ...loose(t), _show: MW.showOnCanvas }))
  // The conversation (DL 12 Nov): the person writes to Olumi in their own words, as an answer to one of Olumi's questions (screen context
  // only) or as anything else; while a proposal is pending this is how it is corrected (PL-567). Olumi answers in core; the screen waits
  // (`awaitTurn`) and draws the answer, and any proposal it brings goes through the same review. Words stay in the box until Olumi answers.
  const [tell, setTell] = useState('')
  const [telling, setTelling] = useState(false)
  // A different measure for Olumi's reading (PL-626): the person says it in their own words; the reading's question is screen context only.
  const [measureFor, setMeasureFor] = useState<Reading | null>(null)
  const send = async () => {
    if (tell.trim() === '' || telling) return
    setTelling(true); setError(null)
    try {
      await (answering ? answer(answering, tell) : tellOlumi(tell))
      const ended = await awaitTurn()
      if (ended !== 'failed' && ended !== 'lost' && ended !== 'timeout') { setTell(''); setAnswering(null); setMeasureFor(null) }
    } catch (e) { setError(said(e, MW)) } finally { setTelling(false) }
  }
  // A question the person chose that Olumi no longer asks (a newer View): the chip goes, so their words are sent as an ordinary message.
  const asked: string[] = loose(v.model).coaching_questions ?? []
  useEffect(() => { if (answering && asked[answering.at] !== answering.text) setAnswering(null) }, [answering, asked, setAnswering])
  const turn = v.turn ? loose(v.turn) : null
  // A new turn, Olumi answering, an answer or a turn that failed: the panel moves to it so the person sees where the conversation stands
  // (not on first open, which keeps the panel where the look-proof draws it).
  const scroll = useRef<HTMLDivElement | null>(null), seen = useRef<string | null>(null)
  const at = `${chat.length}:${turn?.job ?? ''}:${turn?.status ?? ''}`
  useEffect(() => { if (seen.current !== null && seen.current !== at && scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; seen.current = at }, [at])
  const past = useViewStore((st) => st.at) !== null
  return (
    <aside className="nx-panel" data-testid="next-panel">
      <div className="nx-panel-head">{v.team_presence ? <span className="meta">{loose(v.team_presence).label}</span> : null}</div>
      <div className="nx-scroll" ref={scroll}>
        {detail !== null ? <Detail key={`${v.id}:${detail}`} v={v} id={detail} editing={editing} onClose={closeDetail} onTell={setTell} /> : null}
        {chat.some((t) => t.earlier) ? (
          <div className="earlier-list">{chat.flatMap((t, i) => (t.earlier ? [
            <details key={i} className="earlier"><summary><span className="by">{t.by}</span><span className="meta">{t.version}</span>{t.status ? <span className="meta">{t.status}</span> : null}<span className="one">{t.said}</span><span><Chev /></span></summary><Turn t={t} onShow={flash} /></details>,
          ] : []))}</div>
        ) : null}
        {chat.flatMap((t, i) => (t.earlier ? [] : [<Turn key={i} t={t} onShow={flash} />]))}
        {turn && (turn.status === 'answering' || turn.status === 'failed' || turn.status === 'lost') ? (
          // Waiting for Olumi, or a turn that did not finish: the person's words and core's own words for where it stands.
          <section className={`turn turn-${turn.status}`} data-testid={`next-turn-${turn.status}`}>
            <div className="turn-meta"><span className="by">{turn.by}</span></div>
            <div className="said-wrap"><p className="said">{turn.said}</p></div>
            <div className="reply"><span className="mk" aria-hidden="true"><Brand s={18} /></span><div className="col"><p className={turn.status === 'answering' ? 'say meta' : 'say err'}>{turn.words}</p></div></div>
          </section>
        ) : null}
        {P ? <Review v={v} ticks={ticks} setTicks={setTicks} /> : null}
        {readingsOn(P).map((r) => (
          // Olumi's reading on this proposal, in core's words, with the person's three answers (PL-626): confirm it, give a different measure in
          // their own words, or stay unsure (approve without it and without refusing it: the question stays open).
          <section key={r.id} className="sec reading" data-testid="next-reading" data-reading={r.id}>
            <p className="meta">{r.status}</p>
            <p>{r.question}</p>
            <div className="detail-acts">
              <button type="button" className={`btn ${answers[r.id] === 'confirm' ? 'btn-primary' : 'btn-quiet'}`} aria-pressed={answers[r.id] === 'confirm'} disabled={busy} data-testid="next-reading-confirm" onClick={() => setAnswers({ ...answers, [r.id]: 'confirm' })}>Confirm</button>
              <button type="button" className="btn btn-quiet" disabled={busy || telling} data-testid="next-reading-different" onClick={() => { const { [r.id]: _drop, ...rest } = answers; void _drop; setAnswers(rest); setMeasureFor(r); setAnswering(null) }}>A different measure</button>
              <button type="button" className={`btn ${answers[r.id] === 'unsure' ? 'btn-primary' : 'btn-quiet'}`} aria-pressed={answers[r.id] === 'unsure'} disabled={busy} data-testid="next-reading-unsure" onClick={() => setAnswers({ ...answers, [r.id]: 'unsure' })}>Unsure</button>
            </div>
          </section>
        ))}
      </div>
      {P ? (
        <div className="nx-decide" data-testid="next-decide">
          {/* Approve: the whole proposal. With a confirmed reading, every line goes with it (the person pressed Approve); without one, core's own whole approval. */}
          <button type="button" className="btn btn-primary" disabled={busy} data-testid="next-approve"
            onClick={() => void act(() => (confirmed.length > 0 ? approveSelected(picksOf(ch, tickEvery(ch)), { readings: confirmed }) : approveAll()))}>Approve</button>
          <button type="button" className="btn btn-quiet" disabled={busy || n === 0} data-testid="next-approve-selected"
            onClick={() => void act(() => approveSelected(picks, { readings: confirmed }, { lines: picks.left.map((c) => c.id) }))}>Approve selected · <span className="selcount">{n}</span></button>
          {MW.heldConfirm ? <button type="button" className="btn btn-text" disabled={busy} data-testid="next-set-aside" onClick={() => void act(setAside)}><span>{MW.heldConfirm}</span></button> : null}
        </div>
      ) : null}
      {/* Unticked lines are not added: said in plain numbers while some are ticked and some are not (the layer keeps no refusal record yet). */}
      {P && n > 0 && picks.left.length > 0 ? <p className="meta nx-decide-note" data-testid="next-left-out">{picks.left.length} not ticked: Approve selected does not add them.</p> : null}
      {error ? <p role="alert" className="meta err nx-decide-note" data-testid="next-error">{error}</p> : null}
      {!past ? (
        <form className="nx-composer" data-testid="next-tell" onSubmit={(e) => { e.preventDefault(); void send() }}>
          {measureFor ? <p className="meta answering" data-testid="next-measure-for">{measureFor.question}<button type="button" className="icon-btn" aria-label={MW.cancel} onClick={() => setMeasureFor(null)}><Close /></button></p> : null}
          {answering ? <p className="meta answering" data-testid="next-answering">{answering.text}<button type="button" className="icon-btn" aria-label={MW.cancel} onClick={() => setAnswering(null)}><Close /></button></p> : null}
          <div className="field">
            <input type="text" value={tell} onChange={(e) => setTell(e.target.value)} disabled={telling || working(v)} placeholder={P ? 'Tell Olumi what to change' : 'Reply, or edit the model'} aria-label={P ? 'Tell Olumi what to change' : 'Reply, or edit the model'} data-testid="next-tell-field" />
            <button type="submit" aria-label="Send" disabled={telling || working(v) || tell.trim() === ''} data-testid="next-tell-send"><Send /></button>
          </div>
        </form>
      ) : null}
    </aside>
  )
}
