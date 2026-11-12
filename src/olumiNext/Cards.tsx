/**
 * The board's nodes, drawn as the look-proof draws them (ui-ws2-20261112 src/template.html: cardEl, noteEl, optionBody, quantityBody,
 * aimSlot, the question), class for class, so next.css styles them as it styles the proof. Every word is the View's, drawn as given; the
 * only judgement here is which of core's fields to show where, as the proof decides it. Who a card is by comes from the journey layer
 * (`authorshipOf`), never from words.
 */
import { createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { View, ViewCard } from '../olumiView/client'
import { authorshipOf } from '../olumiView/journey'
import { Down, Fam, Mk, OlumiMark, PartlyMark, PersonMark, Pencil } from './icons'

/** Core's fields the generated View type does not spell out for every card kind are read through here, never converted. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Loose = { readonly [k: string]: any }
export const loose = (x: unknown): Loose => (x ?? {}) as Loose

/** Where the layout put a node (geometry data only) and its board state classes (`sel`, `flash`). */
export type Place = { readonly style?: CSSProperties; readonly extra?: string }

/** Something on the board changed height (a clamp opened): the board measures and lays out again. */
export const Relayout = createContext<() => void>(() => {})
/** One of Olumi's questions the person chose to answer: the composer takes it as screen context (core binds no answer to a question). */
export const AnswerQuestion = createContext<((q: { at: number; text: string }) => void) | null>(null)
/** The card the person pressed: the panel opens its detail. */
export const OpenDetail = createContext<(id: string) => void>(() => {})

/** Core's words, clamped to `lines` (and `compact` lines at 1500): the look's "more" opens it whole, offered only when it is cut. */
export function Clamp({ as = 'p', cls = '', text, lines, compact, label, children }: { as?: 'p' | 'h3'; cls?: string; text?: string | null; lines: number; compact?: number; label?: string; children?: ReactNode }) {
  const relayout = useContext(Relayout)
  const ref = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [cut, setCut] = useState(false)
  useLayoutEffect(() => { const p = ref.current; if (p) setCut(open || p.scrollHeight > p.clientHeight + 1) })
  const Tag = as
  return (
    <div className={`cl${open ? ' is-open' : ''}`}>
      <Tag ref={ref as never} className={`${cls ? `${cls} ` : ''}clamp lines-${lines}${compact ? ` lines-c-${compact}` : ''}${open ? ' open' : ''}`}>{children ?? text}</Tag>
      <button type="button" className={`more${cut ? ' on' : ''}`} aria-expanded={open} aria-label={label}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); requestAnimationFrame(relayout) }}><Down /></button>
    </div>
  )
}
const OlumiSays = ({ text, lines = 3, compact }: { text: string; lines?: number; compact?: number }) => <div className="olumi-says"><Mk><OlumiMark s={8} /></Mk><Clamp text={text} lines={lines} compact={compact} /></div>

/** Whose: the person's mark, Olumi's diamond, or the half diamond for partly Olumi's; core's words as its name and hover. */
export function Who({ card }: { card: ViewCard }) {
  const a = authorshipOf(card)
  if (a.by === null) return null
  return <span className="who" title={a.title || a.text || undefined} role="img" aria-label={a.text ?? undefined}>{a.by === 'olumi' ? <OlumiMark /> : a.by === 'mixed' ? <PartlyMark /> : <PersonMark />}</span>
}
/** A card's name: core's short face title where it sends one (a person's words set as a quotation), else its heading. */
export function titleOf(c: ViewCard): { text: string; theirs: boolean } {
  const ft = loose(c).face?.title
  return ft?.text ? { text: ft.text, theirs: ft.words === 'theirs' } : { text: c.heading, theirs: false }
}
const keyText = (v: View, glyph: string): string | null => (loose(v.model).key ?? []).find((k: Loose) => k.glyph === glyph)?.text ?? null
const hasDigit = (s: string) => /\d/.test(s)

function waitsFor(v: View, c: ViewCard): Loose | null {
  const recs: string[] = loose(c).badge?.records ?? []
  return (loose(v.model).run?.waits_on?.items ?? []).find((it: Loose) => recs.includes(it.id)) ?? null
}
/** Olumi's newest question is pinned on the card it is about (`next.at`). */
export function pinOf(v: View): Loose | null {
  let pin: Loose | null = null
  for (const t of v.chat ?? []) { const n = loose(t).answer?.next; if (n?.newest) pin = n }
  return pin
}
const AskRow = ({ v, id }: { v: View; id: string }) => {
  const pin = pinOf(v)
  if (pin === null || pin.at !== id) return null
  return <div className="ask" title={(pin.text ?? []).map((s: Loose) => s.text ?? '').join('')}><Mk><OlumiMark s={8} /></Mk><span>{pin.label}</span></div>
}
function BadgeLink({ c }: { c: ViewCard }) {
  const open = useContext(OpenDetail), b = loose(c).badge
  if (!b?.face) return null
  return <button type="button" className="notes-link" title={b.label} onClick={(e) => { e.stopPropagation(); open(c.id) }}><span>{b.face}</span></button>
}

function OptionBody({ v, c }: { v: View; c: ViewCard }) {
  const L = loose(c), hl = L.headline, rows: Loose[] = L.rows ?? [], wi = waitsFor(v, c), W = loose(v.model).run?.waits_on ?? {}
  const oneGoal = (v.model?.cards ?? []).filter((x) => x.family === 'goal').length === 1
  const oneLimit = (v.model?.cards ?? []).filter((x) => x.family === 'limit').length === 1
  const out: ReactNode[] = []
  if (hl?.state === 'chance') {
    const r0 = rows.find((r) => r.kind === 'chance' && r.aim_id === hl.aim_id)
    out.push(<p key="h" className="chance" title={hl.title}>{hl.text}</p>)
    if (r0?.aim && !oneGoal) out.push(<p key="a" className="meta">{r0.aim}</p>)
    if (hl.range) out.push(<Clamp key="r" cls="meta" text={hl.range} lines={4} compact={3} />)
    if (r0?.olumi && r0.rests_on_text) out.push(<div key="o" className="olumi-says" title={r0.olumi.title}><Mk><OlumiMark s={8} /></Mk><p>{r0.rests_on_text}</p></div>)
  } else if (hl?.state === 'fixed') {
    const rf = rows.find((r) => r.aim_id === hl.aim_id)
    out.push(<p key="h" className="fixed" title={hl.title}>{hl.text}</p>)
    if (rf?.aim && !oneGoal) out.push(<p key="a" className="meta">{rf.aim}</p>)
  } else if (hl) {
    if (wi?.answer && wi.text === hl.text) out.push(<OlumiSays key="h" text={hl.text} lines={4} compact={2} />)
    else { out.push(<p key="h" className="nochance" title={hl.title}>{hl.text}</p>); if (hl.add) out.push(<OlumiSays key="a" text={hl.add} lines={4} compact={2} />) }
  } else if (wi) {
    out.push(<div key="w" className="words"><Clamp lines={3} compact={2}><span>{W.label}</span> <span>{wi.text}</span>{wi.unknown ? <span>{wi.unknown}</span> : null}</Clamp></div>)
  } else out.push(<span key="n" className="nothing" aria-hidden="true" />)
  rows.forEach((r, i) => {
    const key = oneLimit && keyText(v, '□') !== null
    if (r.kind === 'limit') out.push(
      <p key={`l${i}`} className={`lrow${key ? ' one-limit' : ''}`} title={r.title}>
        {key ? <span className="l-key"><Fam glyph="□" /><span className="meta">{keyText(v, '□')}</span></span> : null}
        <span className="lval">{r.olumi ? <Mk><OlumiMark s={8} /></Mk> : null}<span>{r.value}</span></span><span className="meta l-aim">{r.aim}</span>
      </p>)
    else if (r.kind === 'none' && r.text && !(hl && (r.aim_id === hl.aim_id || r.text === hl.text))) out.push(<div key={`n${i}`} className="words"><Clamp text={r.text} lines={2} compact={1} /></div>)
  })
  const notes = new Set((v.model?.cards ?? []).flatMap((x) => (NOTE_FAMILIES.has(x.family) ? [x.id] : [])))
  for (const p of (L.premises ?? []) as Loose[]) if (!notes.has(p.id)) out.push(
    <div key={`p${p.id}`} className={`premise${p.olumi ? ' by-olumi' : ''}`} title={p.title}><Fam glyph={p.glyph} /><div className="words"><Clamp text={p.text} lines={2} compact={1} /></div></div>)
  return <>{out}</>
}

function QuantityBody({ v, c, onEdit }: { v: View; c: ViewCard; onEdit: (id: string) => void }) {
  const L = loose(c), f = L.figure, MW = loose(v.model_words)
  const byId = new Map((v.model?.cards ?? []).map((x) => [x.id, x]))
  const out: ReactNode[] = []
  const edit = (label: string) => (f?.edit ? <button type="button" className="icon-btn" title={f.edit.prompt} aria-label={label} onClick={(e) => { e.stopPropagation(); onEdit(c.id) }}><Pencil /></button> : null)
  if (L.values?.length) out.push(
    <div key="vals" className="vals" title={f?.title}>{(L.values as Loose[]).map((x, i) => { const o = byId.get(x.option); return (
      <div key={i}>{o ? <div className="v-opt">{titleOf(o).text}</div> : null}<div className="v-val">{x.olumi ? <Mk><OlumiMark s={8} /></Mk> : null}<span>{x.text}</span></div></div>) })}</div>)
  else if (f?.text) out.push(<div key="f" className="figrow"><span className={hasDigit(f.text) ? 'figure' : 'words'} title={f.title} data-figure-of={c.id}>{f.text}</span>{edit(MW.changeFigure)}</div>)
  else if (L.bound?.text) out.push(<div key="b" className="figrow"><span className="figure" title={L.bound.title}>{L.bound.text}</span></div>)
  else if (f) out.push(<div key="f" className="figrow"><span className="words" title={f.title}>{L.author ? L.author.text : ''}</span>{edit(MW.setFigure)}</div>)
  const tf = (v.collab?.shared ?? []).flatMap((s) => (s.figures ?? []).flatMap((x) => (x.quantity === c.id ? [{ by: s.by, f: loose(x) }] : [])))
  if (tf.length) out.push(<div key="t" className="views">{tf.map((t, i) => <span key={i} title={t.f.mark_label}><span className="vby">{t.by}</span><span className="vfig">{t.f.text}</span></span>)}</div>)
  return <>{out}</>
}

/** Reasoning records (left out, a condition or challenge, a relation) sit beside the question, not in the bands. */
export const NOTE_FAMILIES: ReadonlySet<string> = new Set(['left_out', 'condition', 'relation'])

export function CardNode({ v, c, allProposed, onEdit, style, extra = '' }: { v: View; c: ViewCard; allProposed: boolean; onEdit: (id: string) => void } & Place) {
  const open = useContext(OpenDetail), t = titleOf(c), a = authorshipOf(c), L = loose(c)
  // Olumi's proposals read as proposals: where every card is proposed (a first draft) the panel says so once; otherwise a proposed card
  // is marked on its own (the look's `.proposed`), with core's words for the change as its hover.
  const proposed = L.change != null && !allProposed
  const cls = `node card by-${a.by ?? 'person'} fam-${c.family}${L.focus ? ' focus' : ''}${proposed ? ' proposed' : ''}`
  return (
    <article className={cls + extra} style={style} data-id={c.id} tabIndex={0} title={proposed ? L.change.title : undefined} onClick={() => open(c.id)}>
      <header><Who card={c} /><Fam glyph={L.glyph} /><h3 className={t.theirs ? 'quoted' : undefined} title={c.heading} data-heading-of={c.id}>{t.text}</h3></header>
      <div className="body">{c.family === 'option' ? <OptionBody v={v} c={c} /> : <QuantityBody v={v} c={c} onEdit={onEdit} />}</div>
      <AskRow v={v} id={c.id} />
      {L.badge?.face ? <div className="foot"><BadgeLink c={c} /></div> : null}
    </article>
  )
}

export function NoteNode({ v, c, style, extra = '' }: { v: View; c: ViewCard } & Place) {
  const open = useContext(OpenDetail), t = titleOf(c), a = authorshipOf(c), L = loose(c), kt = keyText(v, L.glyph)
  return (
    <article className={`node note by-${a.by ?? 'person'} fam-${c.family}${L.focus ? ' focus' : ''}${extra}`} style={style} data-id={c.id} tabIndex={0} onClick={() => open(c.id)}>
      <header><Fam glyph={L.glyph} />{kt ? <span className="meta famname">{kt}</span> : null}<Who card={c} /></header>
      {t.text.length > 110 ? <Clamp cls="note-text" text={t.text} lines={5} compact={3} /> : <h3 className={t.theirs ? 'quoted' : undefined} title={c.heading}>{t.text}</h3>}
      {L.reason && L.reason !== t.text ? <p className="meta">{L.reason}</p> : null}
      <div className="attrib">{L.author ? <span className="meta" title={L.author.title}>{L.author.text}</span> : null}<BadgeLink c={c} /></div>
      <AskRow v={v} id={c.id} />
    </article>
  )
}

export function AimSlot({ v, style }: { v: View } & Place) {
  const ask = useContext(AnswerQuestion)
  const W = loose(v.model).run?.waits_on ?? {}, qs: string[] = loose(v.model).coaching_questions ?? []
  return (
    <section className="node aimslot" style={style} data-id="slot:aim">
      <header><Fam glyph="aim-empty" /><span className="meta">{keyText(v, '★')}</span>
        {(W.items ?? []).length ? <><span className="meta">·</span><span className="meta">{W.head}</span><span className="meta">·</span><span className="meta">{W.text}</span></> : null}</header>
      {qs.length ? <ul>{qs.map((q, i) => <li key={i}><Mk><OlumiMark s={8} /></Mk>{ask ? <button type="button" className="q-ask" data-testid={`next-question-${i}`} onClick={() => ask({ at: i, text: q })}>{q}</button> : <span>{q}</span>}</li>)}</ul> : null}
    </section>
  )
}

/** The question, with Olumi's proposal named over it while one is held, and the key of the marks the board uses beneath it. */
export function QuestionNode({ v, style, extra = '' }: { v: View } & Place) {
  const open = useContext(OpenDetail), q = loose(v.model?.question), P = v.proposal, cards = v.model?.cards ?? []
  const used: string[] = []
  for (const c of cards) for (const g of [loose(c).glyph, ...((loose(c).premises ?? []) as Loose[]).map((p) => p.glyph)]) if (g && !used.includes(g) && keyText(v, g)) used.push(g)
  const marks: [ReactNode, string | null][] = []
  if (cards.some((c) => authorshipOf(c).by === 'olumi')) marks.push([<OlumiMark key="o" />, keyText(v, '◆')])
  if (cards.some((c) => authorshipOf(c).by === 'mixed')) marks.push([<PartlyMark key="p" />, keyText(v, '◐')])
  return (
    <section className={`node nx-question${extra}`} style={style} data-id="page:question">
      {P ? <div className="status"><Mk><OlumiMark s={8} /></Mk><span className="meta">{P.heading}</span><span className="meta sep">·</span><span className="meta">{P.on}</span></div> : null}
      <h1>{q.text}</h1>
      {q.badge?.face ? <button type="button" className="notes-link" title={q.badge.label} onClick={() => open('page:question')}><span>{q.badge.face}</span></button> : null}
      <footer className="nx-legend">
        {marks.flatMap(([m, t], i) => (t ? [<span key={`m${i}`} className="it"><Mk>{m}</Mk><span>{t}</span></span>] : []))}
        {used.map((g) => <span key={g} className="it"><Fam glyph={g} /><span>{keyText(v, g)}</span></span>)}
      </footer>
    </section>
  )
}
