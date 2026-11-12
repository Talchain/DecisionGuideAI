import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui/Button'
import { call, newOp, TeamApiError } from './team/api'
import { BODY, CARD, ERR, FIELD, H, META } from './team/ui'
import { typography } from '../styles/typography'
import { shownModel, useViewStore } from '../olumiView/store'
import { markOf, ShiftTrack, TrackKey } from './compareTrack'

/**
 * ANY TWO THINGS, SIDE BY SIDE (olumi-core `GET /api/compare?a=&b=`, `olumi.compare/1`; core wip/compare 7 Nov, src/app/compare-pair.ts):
 * the person picks two sides, each one of: this scenario as it is now (`s_…`), one of its approved versions (`s_…@n`), one of its saved
 * what-ifs (`w_…`), or another of their scenarios. Core reads each side's saved Run (no Run, no AI call) and this page draws it.
 * Not version history (`compare.tsx`, the other half of this tab).
 *
 * A WHAT-IF is saved here by name (core `POST /api/scenarios/:s/whatifs`): one figure, as the person types it, tried on a copy of the
 * approved model and kept, shared with the scenario's members. The word is always "what-if", never "scenario".
 *
 * Every label, measure, target, value, driver, range, author, limitation and note is a ready-made string of core's and is drawn verbatim:
 * nothing is formatted, paired, ranked or composed here. The two sides are drawn side by side and never ordered or called better. An aim's
 * `status` is an enum: `comparable`, `different_target`, `not_comparable`, `only_a`, `only_b`; a status this page does not know is drawn as
 * the aim's label, its limitation if core gives one and its unpaired options, never as a pairing. A cell core marks as resting on Olumi's
 * proposals carries core's mark and its `lead` words. A limitation core says once on the aim, a figure or a side is not said again in the notes.
 */
type Mark = { glyph: string; title: string }
/** `chance`: core's own number behind `value` (0 to 1), which places the shift track's mark; absent from an older core, then no mark. */
type Cell = { value: string; title: string; olumi: Mark | null; lead: string | null; condition: string | null; chance?: number | null
  /** Core's headline (the value without its companion) and the card's own short companion line (core wip/compare ff3622bb); an older core: the value. */
  headline?: string; companion?: Line | null }
type Line = { text: string; title: string }
type Side = { id: string; title: string; name: string; note: string | null; kind?: string; about?: string | null }
type AimSide = { label: string; measure: string; target: string | null }
/** `moves_most` (a saved what-if's side, core wip/compare cc13ef0c): which of its changes, on its own, moves this chance most, in core's words. */
type OptionSide = { cells: Cell[]; uncertainty?: Line | null; driver?: (Line & { figure: string; label: string }) | null; moves_most?: (Line & { figure: string }) | null }
type OptionRow = { label: string; only_in: 'a' | 'b' | null; only_in_text: string | null; a: OptionSide | null; b: OptionSide | null }
export type AimStatus = 'comparable' | 'different_target' | 'not_comparable' | 'only_a' | 'only_b'
type AimRow = { label: string; kind: 'aim' | 'limit'; status: AimStatus | string; limitation: string | null; only_in_text: string | null; a: AimSide | null; b: AimSide | null; options: OptionRow[]
  most_likely?: { a: Cell | null; b: Cell | null } }
type FigureSide = { text: string; olumi: Mark | null; by?: string | null }
type FigureRow = { label: string; status: 'same' | 'differs' | 'only_a' | 'only_b' | string; a: FigureSide | null; b: FigureSide | null; only_in_text: string | null; limitation: string | null }
export type ScenarioComparison = { schema: string; a: Side; b: Side; aims: AimRow[]; differences: { options: { label: string; status: string; only_in_text: string | null }[]; figures: FigureRow[] }; limits: string[] }
/** One saved what-if as core lists it (`GET /api/scenarios/:s/whatifs`). */
export type SavedWhatIf = { id: string; name: string; by: string; at: string; version: number; edits: { quantity: string; label: string; words: string }[]; about: string }

const arr = <T,>(x: T[] | undefined | null): T[] => (Array.isArray(x) ? x : [])
const words = (s: string | null | undefined): s is string => typeof s === 'string' && s.trim() !== ''

function MarkSpan({ m }: { m: Mark | null }): JSX.Element | null {
  return m === null ? null : <><span title={m.title} aria-label={m.title}>{m.glyph}</span>{' '}</>
}

function Cells({ side }: { side: OptionSide | null }): JSX.Element {
  return (
    <div className="grid content-start gap-1 break-words" data-compare-cells="">
      {arr(side?.cells).map((c, i) => (
        <p key={i} className={`${BODY} grid gap-0.5`} title={c.title} data-compare-cell="">
          {/* Core's headline reads as the cell's headline; an older core's whole value keeps today's look (UI audit item 4). */}
          <span><MarkSpan m={c.olumi} /><span className={words(c.headline) ? 'font-semibold text-text-header' : undefined} data-compare-value="">{words(c.headline) ? c.headline : c.value}</span></span>
          {words(c.headline) && c.companion && words(c.companion.text) ? <span className={META} title={c.companion.title} data-compare-companion="">{c.companion.text}</span> : null}
          {c.olumi !== null && words(c.lead) ? <span className={META} data-compare-lead="">{c.lead}</span> : null}
          {words(c.condition) ? <span className={META} data-compare-condition="">{c.condition}</span> : null}
        </p>
      ))}
      {/* Core's own range for what the aim measures under this option (its uncertainty), and the figure its chance moves most with. */}
      {side?.uncertainty && words(side.uncertainty.text) ? <p className={META} title={side.uncertainty.title} data-compare-uncertainty="">{side.uncertainty.text}</p> : null}
      {side?.driver && words(side.driver.text) ? <p className={META} title={side.driver.title} data-compare-driver={side.driver.figure}>{side.driver.text}</p> : null}
      {side?.moves_most && words(side.moves_most.text) ? <p className={`${BODY} break-words`} title={side.moves_most.title} data-compare-moves={side.moves_most.figure}>{side.moves_most.text}</p> : null}
    </div>
  )
}

function AimSideWords({ s, target }: { s: AimSide | null; target: boolean }): JSX.Element {
  return (
    <div className="grid content-start gap-0.5 break-words" data-compare-aim-side="">
      {s === null ? null : <p className={META} data-compare-measure="">{s.measure}</p>}
      {s !== null && target && words(s.target) ? <p className={META} data-compare-target="">{s.target}</p> : null}
    </div>
  )
}

function Lead({ c }: { c: Cell | null | undefined }): JSX.Element {
  return <p className={`${BODY} break-words`} title={c?.title} data-compare-most-likely="">{c ? <><MarkSpan m={c.olumi} />{c.value}</> : null}</p>
}

/** The mark for one side of an option: its first cell's own number (its headline chance), with core's words. */
const sideMark = (s: OptionSide | null) => { const c = arr(s?.cells)[0]; return c ? markOf(c.chance, words(c.headline) ? c.headline : c.value) : null }

function Aim({ aim, names }: { aim: AimRow; names: { first: string; second: string } }): JSX.Element {
  const targets = aim.status === 'different_target'
  const paired = aim.status === 'comparable' || targets
  const lead = aim.most_likely
  return (
    <section className={CARD} data-compare-aim={aim.status} aria-label={aim.label}>
      <h4 className={H}>{aim.label}</h4>
      {words(aim.only_in_text) ? <p className={META} data-compare-only-in="">{aim.only_in_text}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <AimSideWords s={aim.a} target={targets} />
        <AimSideWords s={aim.b} target={targets} />
      </div>
      {words(aim.limitation) ? <p className={`${BODY} break-words`} data-compare-limitation="">{aim.limitation}</p> : null}
      {lead && (lead.a || lead.b) ? <div className="grid grid-cols-2 gap-3" data-compare-leads=""><Lead c={lead.a} /><Lead c={lead.b} /></div> : null}
      {arr(aim.options).map((o, i) => (
        <div key={`${o.label}-${i}`} className="grid gap-1" data-compare-option={paired && o.only_in === null ? 'paired' : 'alone'}>
          <p className={`${BODY} text-text-header break-words`}>{o.label}</p>
          {words(o.only_in_text) ? <p className={META} data-compare-only-in="">{o.only_in_text}</p> : null}
          {/* The earlier DGAI's shift track: hollow for the first side, filled for the second, where core gives each its number. Only where
              both sides answer the same question ('comparable'): two chances of different targets are never drawn as one chance moving. */}
          {aim.status === 'comparable' && o.only_in === null ? <ShiftTrack first={sideMark(o.a)} second={sideMark(o.b)} names={names} /> : null}
          <div className="grid grid-cols-2 gap-3"><Cells side={o.a} /><Cells side={o.b} /></div>
        </div>
      ))}
    </section>
  )
}

function FigureCell({ f }: { f: FigureSide | null }): JSX.Element {
  return (
    <div className="grid content-start gap-0.5 break-words">
      <p className={BODY}>{f === null ? null : <><MarkSpan m={f.olumi} />{f.text}</>}</p>
      {f !== null && words(f.by) ? <p className={META} data-compare-by="">{f.by}</p> : null}
    </div>
  )
}

function Figures({ rows }: { rows: FigureRow[] }): JSX.Element | null {
  const shown = rows.filter((f) => f.status !== 'same')
  return shown.length === 0 ? null : (
    <>
      {shown.map((f, i) => (
        <div key={`${f.label}-${i}`} className="grid gap-1" data-compare-figure={f.status}>
          <p className={`${BODY} text-text-header break-words`}>{f.label}</p>
          {words(f.only_in_text) ? <p className={META} data-compare-only-in="">{f.only_in_text}</p> : null}
          <div className="grid grid-cols-2 gap-3"><FigureCell f={f.a} /><FigureCell f={f.b} /></div>
          {words(f.limitation) ? <p className={`${BODY} break-words`} data-compare-limitation="">{f.limitation}</p> : null}
        </div>
      ))}
    </>
  )
}

/** The comparison as core read it: the two names as column heads (with what each side is, and a side's note when it has no saved model
 *  or results), then each aim. */
export function ScenarioComparisonView({ c }: { c: ScenarioComparison }): JSX.Element {
  const aims = arr(c.aims), figures = arr(c.differences?.figures)
  // An option only one scenario has is said where its aim lists it; the Differences list adds only those no aim lists.
  const listed = new Set(aims.flatMap((a) => arr(a.options).map((o) => o.label)))
  const options = arr(c.differences?.options).filter((o) => o.status !== 'both' && !listed.has(o.label))
  // Every limitation core says on an aim, a figure or a side is drawn there; the notes list carries only what none of those did.
  const said = new Set<string>([c.a?.note, c.b?.note, ...aims.map((a) => a.limitation), ...figures.map((f) => f.limitation)].filter(words))
  const notes = arr(c.limits).filter((l) => !said.has(l))
  const showFigures = figures.some((f) => f.status !== 'same')
  const names = { first: c.a?.name ?? '', second: c.b?.name ?? '' }
  return (
    <div className="grid gap-2" data-testid="scenario-compare-out">
      <div className="sticky top-0 z-10 grid grid-cols-2 gap-3 bg-panel py-1" data-testid="scenario-compare-heads">
        {[c.a, c.b].map((s, i) => (
          <div key={i} className="grid content-start gap-0.5 break-words" data-compare-side={i === 0 ? 'a' : 'b'} data-compare-kind={s?.kind ?? 'scenario'}>
            <p className={`${H}`} data-compare-name="">{s?.name}</p>
            {words(s?.about) ? <p className={META} data-compare-about="">{s!.about}</p> : null}
            {words(s?.note) ? <p className={META} data-compare-note="">{s!.note}</p> : null}
          </div>
        ))}
      </div>
      {aims.map((a, i) => <Aim key={`${a.label}-${i}`} aim={a} names={names} />)}
      {/* The key to the marks, once, named by the two sides as core names them; only when a track is drawn ('comparable' aims). */}
      {aims.some((a) => a.status === 'comparable' && arr(a.options).some((o) => o.only_in === null && (sideMark(o.a) || sideMark(o.b))))
        ? <TrackKey first={names.first} second={names.second} /> : null}
      {options.length === 0 && !showFigures ? null : (
        <section className={CARD} data-testid="scenario-compare-differences" aria-label="Differences">
          <h4 className={H}>Differences</h4>
          {options.map((o, i) => <p key={`${o.label}-${i}`} className={`${BODY} break-words`} data-compare-diff-option={o.status}><span className="text-text-header">{o.label}</span>{words(o.only_in_text) ? <span className={META}>{`  ${o.only_in_text}`}</span> : null}</p>)}
          <Figures rows={figures} />
        </section>
      )}
      {notes.length === 0 ? null : (
        <section className={CARD} data-testid="scenario-compare-notes" aria-label="Notes">
          <h4 className={H}>Notes</h4>
          <ul className="m-0 grid list-none gap-1 p-0">{notes.map((l, i) => <li key={i} className={`${BODY} break-words`}>{l}</li>)}</ul>
        </section>
      )}
    </div>
  )
}

const PICK = `${typography.viewPanelBody} min-h-[28px] min-w-0 max-w-full rounded-md border border-panel-border bg-panel px-2 py-1 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info`

/** The person's other scenarios (`GET /api/me` `scenarios[]`), read once; null while reading, [] when there is none. */
function useOtherScenarios(sid: string): { id: string; title: string; label: string }[] | null | 'error' {
  const [list, setList] = useState<{ id: string; title: string; label: string }[] | null | 'error'>(null)
  useEffect(() => {
    let live = true
    call<{ scenarios?: { id?: unknown; title?: unknown; label?: unknown }[] }>('GET', '/api/me')
      .then((r) => { if (live) setList(arr(r?.scenarios).flatMap((s) => (typeof s?.id === 'string' && typeof s.title === 'string' && s.id !== sid ? [{ id: s.id, title: s.title, label: typeof s.label === 'string' && s.label.trim() !== '' ? s.label : s.title }] : []))) })
      .catch(() => { if (live) setList('error') })
    return () => { live = false }
  }, [sid])
  return list
}

/** This scenario's saved what-ifs and its approved version numbers, read once and again after a what-if is saved. A list core cannot give
 *  is drawn as none (the rest of the picker still works). */
function useOwnSides(sid: string): { whatifs: SavedWhatIf[]; versions: number[]; reread: () => Promise<SavedWhatIf[]> } {
  const [whatifs, setWhatifs] = useState<SavedWhatIf[]>([])
  const [versions, setVersions] = useState<number[]>([])
  const reread = useCallback(async () => {
    const r = await call<{ whatifs?: SavedWhatIf[] }>('GET', `/api/scenarios/${encodeURIComponent(sid)}/whatifs`).catch(() => null)
    const got = arr(r?.whatifs).filter((w) => typeof w?.id === 'string' && /^w_\d+$/.test(w.id) && typeof w.name === 'string')
    setWhatifs(got)
    return got
  }, [sid])
  useEffect(() => {
    let live = true
    void reread()
    call<{ versions?: { n?: unknown }[] }>('GET', `/api/scenarios/${encodeURIComponent(sid)}/versions`)
      .then((r) => { if (live) setVersions(arr(r?.versions).flatMap((v) => (typeof v?.n === 'number' ? [v.n] : []))) })
      .catch(() => { if (live) setVersions([]) })
    return () => { live = false }
  }, [sid, reread])
  return { whatifs, versions, reread }
}

type Choice = { value: string; label: string; title: string }
type Group = { label: string; choices: Choice[] }
function Pick({ id, label, groups, value, disabled, onChange }: { id: string; label: string; groups: Group[]; value: string; disabled: boolean; onChange: (v: string) => void }): JSX.Element {
  const shown = groups.filter((g) => g.choices.length > 0)
  return (
    <select aria-label={label} data-testid={id} className={PICK} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {shown.length === 1
        ? shown[0]!.choices.map((c) => <option key={c.value} value={c.value} title={c.title}>{c.label}</option>)
        : shown.map((g) => <optgroup key={g.label} label={g.label}>{g.choices.map((c) => <option key={c.value} value={c.value} title={c.title}>{c.label}</option>)}</optgroup>)}
    </select>
  )
}

/**
 * "Save a what-if": one of the model's figures the person may set (a card core offers `figure.edit` on), typed as they would type it, and a
 * name. Core tries it on a copy of the approved version shown and keeps it with its Run; nothing in the model changes. Core's refusal is
 * drawn in its own words.
 */
/** At most this many figures in one what-if from this form (core takes up to 20). */
const WHATIF_FIGURES = 5

type Row = { quantity: string | null; label: string | null; typed: string }
const EMPTY: Row[] = [{ quantity: null, label: null, typed: '' }]

function WhatIfSave({ sid, onSaved }: { sid: string; onSaved: (id: string) => void }): JSX.Element | null {
  const view = useViewStore((s) => s.view), at = useViewStore((s) => s.at), shownSid = useViewStore((s) => s.sid)
  const model = useViewStore(shownModel)
  const figures = arr(model?.cards).filter((c) => c.figure?.edit != null)
  // The version shown, only while the View shown is this scenario's own (never another scenario's model under this form).
  const live = at === null && shownSid === sid ? view?.version?.id ?? null : null
  // Each row is one figure of the model and what the person types for it; one row to start, more on "Add another figure".
  const [rows, setRows] = useState<Row[]>(EMPTY)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // What the draft was started on (Codex review-ui item 4): the scenario, the version and each row's own figure are fixed from the first
  // keystroke. If any of them is no longer what is shown, the draft is refused in words that name which, and nothing is sent.
  const [draft, setDraft] = useState<{ sid: string; base: number; n: number | null } | null>(null)
  const op = useRef<{ key: string; op: string } | null>(null)
  const again = () => { setRows(EMPTY); setName(''); setDraft(null); setError(null); op.current = null }
  const stale = draft === null ? null
    : draft.sid !== sid || shownSid !== sid ? 'This what-if was started on another scenario, so it is not saved here. Start again to try figures on this one.'
    : live !== draft.base ? `This what-if was started on version ${draft.n}; ${view?.version?.n != null ? `version ${view.version.n} is shown now, so it is not saved. Start again to try it on version ${view.version.n}.` : 'that version is not shown now, so it is not saved. Start again on the version shown.'}`
    // While a change waits for approval no figure can be set (said below, the draft kept); otherwise a row's own figure must still be offered.
    : figures.length === 0 && view?.proposal != null ? null
    : (() => { const gone = rows.find((r) => r.quantity !== null && !figures.some((c) => c.id === r.quantity)); return gone ? `‘${gone.label ?? gone.quantity}’ is no longer a figure you can set here, so this what-if is not saved. Start again to choose another figure.` : null })()
  if (stale !== null) {
    return (
      <div className={CARD} data-testid="whatif-save" aria-label="Save a what-if">
        <h4 className={H}>Save a what-if</h4>
        <p role="alert" className={ERR} data-testid="whatif-save-stale">{stale}</p>
        <div><Button size="sm" variant="secondary" data-testid="whatif-save-again" onClick={again}>Start again</Button></div>
      </div>
    )
  }
  // While a change waits for approval no card offers its figure (core's `figure.edit` is null): said once, so the form is not just missing.
  if (live !== null && figures.length === 0 && view?.proposal != null) return <p className={META} data-testid="whatif-save-waiting">Approve or set aside the waiting change to save a what-if here.</p>
  if (live === null || figures.length === 0) return null
  const base = draft?.base ?? live
  // A row's figure: its own (fixed once the draft starts), else the first figure no earlier row has taken.
  const picks: string[] = []
  for (const r of rows) picks.push(r.quantity ?? figures.find((c) => !picks.includes(c.id))?.id ?? figures[0]!.id)
  const twice = new Set(picks).size !== picks.length
  const ready = name.trim() !== '' && rows.every((r) => r.typed.trim() !== '') && !twice && !busy
  const labelOf = (q: string) => figures.find((c) => c.id === q)?.heading ?? q
  /** The first change starts the draft: it takes the scenario and version shown, and every row's figure as shown, explicitly. */
  const fixed = (rs: Row[]): Row[] => rs.map((r, j) => (r.quantity !== null ? r : { ...r, quantity: picks[j] ?? null, label: picks[j] ? labelOf(picks[j]!) : null }))
  const begin = () => { if (draft === null) setDraft({ sid, base: live, n: view?.version?.n ?? null }) }
  const set = (i: number, patch: Partial<Row>) => {
    begin()
    setRows((rs) => fixed(rs).map((r, j) => (j === i ? { ...r, ...patch, ...(patch.quantity ? { label: labelOf(patch.quantity) } : {}) } : r))); setError(null)
  }
  const save = async () => {
    if (!ready || stale !== null) return
    const edits = rows.map((r, i) => ({ quantity: picks[i]!, typed: r.typed }))
    // The same request re-sent keeps its operation id, so core saves it once.
    const key = JSON.stringify([base, edits, name])
    if (op.current?.key !== key) op.current = { key, op: newOp() }
    setBusy(true); setError(null)
    try {
      const r = await call<{ whatif: string }>('POST', `/api/scenarios/${encodeURIComponent(sid)}/whatifs`, { base, name, edits, op: op.current.op })
      again()
      onSaved(r.whatif)
    } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through.')
    } finally { setBusy(false) }
  }
  return (
    <form className={`${CARD}`} data-testid="whatif-save" aria-label="Save a what-if" onSubmit={(e) => { e.preventDefault(); void save() }}>
      <h4 className={H}>Save a what-if</h4>
      <p className={META}>Tried on a copy of version {draft?.n ?? view?.version?.n}; the model itself does not change.</p>
      {rows.map((r, i) => {
        const card = figures.find((c) => c.id === picks[i])!
        // One column (DL round 6, the re-score's #3): `sm:` reads the window, not the 300 px dock, so two columns cut the figure's name and
        // value ("Monthly reve"). Stacked, each field takes the dock's width.
        return (
          <div key={i} className="grid gap-2" data-whatif-row={i}>
            <label className="grid content-start gap-1">
              <span className={META}>Figure</span>
              <select aria-label="Figure to try" data-testid="whatif-save-figure" className={PICK} value={picks[i]} disabled={busy} onChange={(e) => set(i, { quantity: e.target.value })}>
                {figures.map((c) => <option key={c.id} value={c.id} title={c.figure!.title}>{c.heading}</option>)}
              </select>
            </label>
            <label className="grid content-start gap-1">
              <span className={META} title={card.figure!.edit!.ask}>{card.figure!.edit!.prompt}</span>
              <input data-testid="whatif-save-typed" className={FIELD} value={r.typed} disabled={busy} placeholder={card.figure!.text} onChange={(e) => set(i, { typed: e.target.value })} />
            </label>
            {rows.length > 1 ? <div className="sm:col-span-2"><Button size="sm" variant="ghost" data-testid="whatif-save-remove" disabled={busy} onClick={() => { begin(); setRows((rs) => fixed(rs).filter((_, j) => j !== i)); setError(null) }}>Remove this figure</Button></div> : null}
          </div>
        )
      })}
      {twice ? <p className={ERR} data-testid="whatif-save-twice">Each figure once in a what-if.</p> : null}
      {rows.length < Math.min(WHATIF_FIGURES, figures.length)
        ? <div><Button size="sm" variant="ghost" data-testid="whatif-save-more" disabled={busy} onClick={() => { begin(); setRows((rs) => fixed([...rs, { quantity: null, label: null, typed: '' }])); setError(null) }}>Add another figure</Button></div> : null}
      <label className="grid gap-1">
        <span className={META}>Name this what-if</span>
        <input data-testid="whatif-save-name" className={FIELD} value={name} disabled={busy} maxLength={80} onChange={(e) => { begin(); setRows(fixed); setName(e.target.value); setError(null) }} />
      </label>
      <div className="flex flex-wrap items-center gap-3"><Button size="sm" variant="secondary" type="submit" data-testid="whatif-save-go" disabled={!ready}>Save what-if</Button>
        {/* Why it waits (DL ruling 9 Nov: a disabled button says why). */}
        {ready || busy ? null : <span className={META} data-testid="whatif-save-why">{twice ? 'Each figure once' : rows.some((r) => r.typed.trim() === '') ? 'Type a figure to try' : 'Name this what-if'}</span>}</div>
      {error && <p role="alert" className={ERR} data-testid="whatif-save-error">{error}</p>}
    </form>
  )
}

/**
 * "Compare side by side": pick two sides, each this scenario now, one of its versions, one of its saved what-ifs, or another of the person's
 * scenarios, and read core's side-by-side of the two saved Runs. The first side starts as this scenario; the second as its newest saved
 * what-if, else the first other scenario.
 */
export function CompareWithScenario({ sid }: { sid: string }): JSX.Element {
  // Keyed by the scenario (Codex review-ui item 2): another scenario starts afresh, with none of this one's picks, result, error or draft.
  return <CompareSides key={sid} sid={sid} />
}

function CompareSides({ sid }: { sid: string }): JSX.Element {
  const others = useOtherScenarios(sid)
  const own = useOwnSides(sid)
  const [pickedA, setPickedA] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [shown, setShown] = useState<ScenarioComparison | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0), here = useRef(true)
  // Once this scenario is left, an answer still on its way is never drawn and nothing more is asked.
  useEffect(() => { here.current = true; return () => { here.current = false; seq.current += 1 } }, [])
  const list = Array.isArray(others) ? others : []
  const latest = own.versions.length ? Math.max(...own.versions) : null
  const thisOne: Group = { label: 'This scenario', choices: [{ value: sid, label: latest === null ? 'This scenario now' : `This scenario now (version ${latest})`, title: 'This scenario as it is now' },
    ...own.versions.filter((n) => n !== latest).sort((x, y) => y - x).map((n) => ({ value: `${sid}@${n}`, label: `Version ${n}`, title: `Version ${n} of this scenario, as approved` }))] }
  const whatIfs: Group = { label: 'Saved what-ifs', choices: [...own.whatifs].reverse().map((w) => ({ value: w.id, label: `What-if: ${w.name}`, title: w.about })) }
  const otherOnes: Group = { label: 'Your other scenarios', choices: list.map((s) => ({ value: s.id, label: s.label, title: s.title })) }
  const valuesOf = (gs: Group[]) => gs.flatMap((g) => g.choices.map((c) => c.value))
  const groupsA = [thisOne, whatIfs, otherOnes]
  const a = pickedA !== null && valuesOf(groupsA).includes(pickedA) ? pickedA : sid
  // The second side never offers the first side's own choice.
  const groupsB = [otherOnes, whatIfs, thisOne].map((g) => ({ ...g, choices: g.choices.filter((c) => c.value !== a) }))
  const firstB = valuesOf([whatIfs, otherOnes]).find((v) => v !== a) ?? valuesOf(groupsB).find((v) => v !== a) ?? ''
  const b = picked !== null && valuesOf(groupsB).includes(picked) ? picked : firstB
  const any = list.length > 0 || own.whatifs.length > 0 || own.versions.length > 1
  const go = async (x = a, y = b) => {
    if (x === '' || y === '' || !here.current) return
    const mine = ++seq.current
    setBusy(true); setError(null)
    try {
      const r = await call<ScenarioComparison>('GET', `/api/compare?a=${encodeURIComponent(x)}&b=${encodeURIComponent(y)}`)
      if (mine === seq.current) setShown(r)
    } catch (e) {
      if (mine === seq.current) { setShown(null); setError(e instanceof TeamApiError ? e.message : 'That did not go through.') }
    } finally { if (mine === seq.current) setBusy(false) }
  }
  const saved = async (id: string) => { await own.reread(); setPicked(id); void go(a, id) }
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-2" data-testid="scenario-compare" aria-label="Compare side by side">
      <h3 className={H}>Compare side by side</h3>
      {others === null ? <p className={META} data-testid="scenario-compare-loading">Reading your scenarios…</p>
        : others === 'error' && !any ? <p className={ERR} data-testid="scenario-compare-list-error">Your scenarios could not be read just now.</p>
        : !any ? <p className={BODY} data-testid="scenario-compare-none">You have no other scenario to compare with yet.</p>
        : (
          <div className="flex flex-wrap items-center gap-2">
            <Pick id="scenario-compare-pick-a" label="First side" groups={groupsA} value={a} disabled={busy} onChange={(v) => { setPickedA(v); setShown(null); setError(null) }} />
            <span className={META} aria-hidden="true">beside</span>
            <Pick id="scenario-compare-pick" label="Second side" groups={groupsB} value={b} disabled={busy} onChange={(v) => { setPicked(v); setShown(null); setError(null) }} />
            <Button size="sm" variant="secondary" data-testid="scenario-compare-go" disabled={busy || a === b} onClick={() => void go()}>Compare</Button>
            {!busy && a === b ? <span className={META} data-testid="scenario-compare-why">Pick two different sides</span> : null}
          </div>
        )}
      {error && <p role="alert" className={ERR} data-testid="scenario-compare-error">{error}</p>}
      <div aria-live="polite">{shown ? <ScenarioComparisonView c={shown} /> : null}</div>
      <WhatIfSave sid={sid} onSaved={(id) => void saved(id)} />
    </section>
  )
}
