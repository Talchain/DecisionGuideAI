import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '../components/ui/Button'
import type { ViewRun } from '../olumiView/client'
import { shownModel, useViewStore } from '../olumiView/store'
import { call, TeamApiError } from './team/api'
import { BODY, CARD, ERR, H, META, QUIET } from './team/ui'
import { typography } from '../styles/typography'
import { Pick, SeparateRuns, SideBySide, useOtherScenarios, useOwnSides, WhatIfSave, type Group } from './scenarioCompare'
import { focusNodeById } from '../canvas/utils/focusHelpers'
import { useCanvasStore } from '../canvas/store'
import { focusWhenDrawn } from '../olumiView/AddFigure'
import { setGroupOpen, setInputsOpen } from '../olumiView/v12/bands/foldStore'
import { cardGroupsOf } from '../olumiView/v12/bands/groups'
import { drawnModelOf } from '../olumiView/layout'
import { OkIcon } from '../olumiView/look/icons'
import { Hover, HoverButton } from '../olumiView/look/Hover'
import { FOLD_SUMMARY, FoldChevron } from '../olumiView/look/FoldChevron'
import { COMPARE_OPTIONS_CHROME, CompareOptions } from '../olumiView/v12/tools/CompareOptions'
import { isForThisPage, useMe } from './me'
import { marksOf, useCompareMarks } from './compareMarks'
import { revealedForYou } from '../olumiView/v12/views/differGroups'
import { useCompare } from '../olumiView/v12/views/useCompare'
import { COMPARE_WORDS } from '../olumiView/v12/views/WhereWeDiffer'

/**
 * TWO APPROVED VERSIONS, AS CORE COMPARES THEM (olumi-core API.md v1.7, "Comparing two versions"): core's read-only
 * `GET /api/scenarios/:s/compare` (no Run, no AI call). Who proposed and approved each version, the change lines between the two models
 * and how each saved result moved, every word and mark core's; nothing is computed here. One module for the dock's Compare tab, the
 * version history panel and the Team tab.
 */
/** `chance` (core wip/compare, 7 Nov): core's own number behind the value (0 to 1); an order only, never drawn (separate runs: no track). */
type Side = { value: string; title: string; olumi: { glyph: string; title: string } | null; chance?: number | null
  /** Core's headline and the card's short companion line (core wip/compare ff3622bb); an older core: the value alone. */
  headline?: string; companion?: { text: string; title: string } | null }
const headOf = (s: Side) => (typeof s.headline === 'string' && s.headline.trim() !== '' ? s.headline : s.value)
/** `label` and `move_text` (core wip/compare, 7 Nov): core's own words for what the result is about and how it moved. */
export type Move = { kind: 'chance' | 'limit' | 'most_likely'; option: string | null; optionLabel: string | null; aim: string; condition: string | null
  before: Side | null; after: Side | null; move: 'up' | 'down' | 'changed' | 'unchanged' | 'new' | 'gone'; label?: string; move_text?: string }
/** `who` (core wip/compare, 7 Nov): core's own words for who proposed and approved the version. */
export type Compared = { versions: { n: number; at: string; proposedBy: string | null; briefBy: string | null; approvedBy: string; who?: string }[]
  /** `olumi` (API v1.8): true exactly where `mark` is core's ◆, Olumi's. */
  changes: { text: string; detail: string; mark: { glyph: string; title: string } | null; olumi?: boolean
    /** Core wip/x-compare-core (frozen 19 Nov): the record the line is about and its family code; both null on a top-level-field line,
     *  absent from an older core. */
    record_id?: string | null; kind?: string | null }[]; results: Move[] }

/**
 * Core's own words for a move, for what a result is about and for who proposed and approved a version (`move_text`, `label`, `who`: core
 * wip/compare, 7 Nov, from its page's review.ts). Drawn verbatim. Only a core that predates those fields gets the page's same words built here
 * (the fallback below, the old path), so an older serving core still reads.
 */
const MOVE_BEFORE_CORE_WORDS: Record<Move['move'], string> = { up: 'up', down: 'down', changed: 'changed', unchanged: 'unchanged', new: 'new', gone: 'no longer worked out' }
const moveWords = (r: Move) => r.move_text ?? MOVE_BEFORE_CORE_WORDS[r.move]
export const what = (r: Move) => r.label ?? (r.kind === 'most_likely' ? `Most likely to achieve ‘${r.aim}’${r.condition ?? ''}` : `‘${r.optionLabel ?? r.option ?? ''}’ ${r.kind === 'limit' ? 'within' : 'on'} ‘${r.aim}’`)
export const whoOf = (v: Compared['versions'][number]) => v.who ?? `proposed by ${v.proposedBy ?? 'unknown'}${v.briefBy ? `, from ${v.briefBy}'s brief` : ''} · approved by ${v.approvedBy}`

export function SideText({ s }: { s: Side | null }) {
  if (s === null) return <span className="text-text-light">none</span>
  const own = headOf(s) !== s.value && s.companion ? s.companion : null
  // Core's sentence is the value's hover; Olumi's mark is the registry's own icon, named by core's words, a sibling of the value (never inside its hover).
  return <><Hover words={s.title}>{headOf(s)}</Hover>{s.olumi ? <> <OkIcon id="olumi-mark" size={14} words={s.olumi.title} /></> : null}{own ? <> <Hover words={own.title} className="text-text-light" data-compare-companion="">({own.text})</Hover></> : null}</>
}

/** One change line as core's change card writes it: its text, how it moved, and Olumi's mark with core's hover. */
export function ChangeItem({ l }: { l: Compared['changes'][number] }): JSX.Element {
  const olumi = olumiLine(l)
  return <li className={BODY}>{l.text}{l.detail ? <> <span className="text-text-light whitespace-pre-line">{l.detail}</span></> : null}{l.mark ? <> <Whose olumi={olumi} theirs={!olumi} words={l.mark.title} /></> : null}</li>
}
/** Whose a change line is: core's `olumi` flag (API v1.8), else its ◆ mark (Olumi's; ◐ is the person's figure Olumi read as a range, so the person's). */
const olumiLine = (l: Compared['changes'][number]): boolean => l.olumi ?? l.mark?.glyph === '◆'

/** The comparison as core read it, in three short lists. `id` prefixes each list's test id, one per surface; `who: false` leaves out the
 *  first list where the surface names the version's people itself (the version history's record). */
export function ComparedLists({ c, id = 'team-compare', who = true }: { c: Compared; id?: string; who?: boolean }): JSX.Element {
  const list = (items: JSX.Element[], empty: string, part: string) => (items.length
    ? <ul className="m-0 grid list-none gap-3 p-0" data-testid={`${id}-${part}`}>{items}</ul>
    : <p className={META} data-testid={`${id}-${part}-none`}>{empty}</p>)
  // Inline (the Team tab's and the version history's, already inside their own sections): a heading line, then the list.
  const part = (name: string, heading: string, body: JSX.Element, tag: ReactNode = null) => (
    <div key={name} className="space-y-2">
      <p className={`${BODY} flex flex-wrap items-center gap-2 text-text-header`}>{heading}{tag}</p>
      {body}
    </div>
  )
  return (
    <div className="space-y-4" data-testid={`${id}-out`}>
      {who && part('versions', 'Who proposed and approved',
        list(c.versions.map((v) => <li key={v.n} className={BODY}><span className="text-text-header">Version {v.n}:</span> {whoOf(v)}</li>), 'None', 'versions'))}
      {part('changes', 'What changed', list(c.changes.map((l, i) => <ChangeItem key={i} l={l} />), 'No change to the model', 'changes'))}
      {part('results', 'How the results moved', list(c.results.map((r, i) => (
        // What the result is about on its own line, then before → after and how it moved: one result, two short lines.
        <li key={i} className={`${BODY} grid`}><span className="text-text-header">{what(r)}:</span>{' '}<span><SideText s={r.before} /> → <SideText s={r.after} /> <span className="text-text-light">({moveWords(r)})</span></span></li>
      )), 'No results in either version', 'results'), c.results.length === 0 ? null : <SeparateRuns />)}
    </div>
  )
}

/** The version pickers' compact field (the dock's measure: never the full-width answer field, which stacked two tall boxes). */
const PICK = `${typography.viewPanelBody} min-h-[28px] rounded-md border border-panel-border bg-panel px-2 py-1 text-text-body`

/**
 * Pick two of the scenario's `latest` versions and read core's comparison (the Team tab and the version history). `auto`: read the
 * previous version against the latest at once; otherwise only on Compare.
 */
export function CoreCompare({ sid, latest, id, auto = false }: { sid: string; latest: number; id: string; auto?: boolean }): JSX.Element {
  const [from, setFrom] = useState<number | null>(null)
  const [to, setTo] = useState<number | null>(null)
  const [shown, setShown] = useState<Compared | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const f = from ?? latest - 1, t = to ?? latest
  const versions = Array.from({ length: latest }, (_, i) => i + 1)
  // Reads are numbered: an answer a newer read has overtaken (a slow pair after the auto-refresh's) is dropped whole, its busy and error
  // with it (R1 review 3).
  const seq = useRef(0)
  const go = async (a: number, b: number) => {
    const mine = ++seq.current
    if (a === b) { setBusy(false); setShown(null); setError('Pick two different versions.'); return }
    setBusy(true); setError(null)
    // Asked earlier first, as the pickers' labels say (UI audit item 1); core answers lower-to-higher either way.
    const [lo, hi] = a < b ? [a, b] : [b, a]
    try {
      const r = await call<Compared>('GET', `/api/scenarios/${encodeURIComponent(sid)}/compare?from=${lo}&to=${hi}`)
      if (mine === seq.current) setShown(r)
    } catch (e) {
      if (mine === seq.current) { setShown(null); setError(e instanceof TeamApiError ? e.message : 'That did not go through.') }
    } finally { if (mine === seq.current) setBusy(false) }
  }
  // A new version (another member's approval) moves the default pair to the new latest, read again.
  useEffect(() => { if (auto) { setFrom(null); setTo(null); void go(latest - 1, latest) } }, [auto, sid, latest]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-3" data-testid={`${id}-picker`}>
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Earlier version" data-testid={`${id}-from`} className={PICK} value={f} disabled={busy} onChange={(e) => setFrom(Number(e.target.value))}>
          {versions.map((n) => <option key={n} value={n}>version {n}</option>)}
        </select>
        <span className={BODY}>with</span>
        <select aria-label="Later version" data-testid={`${id}-to`} className={PICK} value={t} disabled={busy} onChange={(e) => setTo(Number(e.target.value))}>
          {versions.map((n) => <option key={n} value={n}>version {n}</option>)}
        </select>
        <Button size="sm" variant="secondary" data-testid={`${id}-go`} disabled={busy} onClick={() => void go(f, t)}>Compare</Button>
      </div>
      {error && <p role="alert" className={ERR} data-testid={`${id}-error`}>{error}</p>}
      <div aria-live="polite">{shown ? <ComparedLists c={shown} id={id} /> : null}</div>
    </div>
  )
}

/**
 * The scenario's latest approved version: the View's own while it is the latest, else (an earlier version drawn from the history) the last
 * of core's stored versions (`GET /versions`), never the version drawn (R1 review 2). Undefined while that read is on its way.
 */
export function useLatestApproved(): number | null | undefined {
  const sid = useViewStore((s) => s.sid), at = useViewStore((s) => s.at)
  const own = useViewStore((s) => s.view?.version?.n ?? null)
  const [listed, setListed] = useState<{ key: string; n: number | null } | null>(null)
  const key = `${sid}:${at}`
  useEffect(() => {
    if (!sid || at === null) return
    let live = true
    call<{ versions: { n: number }[] }>('GET', `/api/scenarios/${encodeURIComponent(sid)}/versions`)
      .then((r) => { if (live) setListed({ key, n: r.versions.at(-1)?.n ?? null }) })
      .catch(() => { if (live) setListed({ key, n: null }) })
    return () => { live = false }
  }, [sid, at, key])
  if (at === null) return own
  return listed?.key === key ? listed.n : undefined
}

export type Since = NonNullable<ViewRun['since']>

/**
 * UI-9 (DL 11 Nov): the version shown beside the one before it, as the View carries it (`model.run.since`, science surface 3, SCI-6: read
 * from the chance facts the two versions already saved, under one engine stamp; no Run on read). Core's heading, then each option's line
 * verbatim (what changed and what it accounts for, whose the figure is in core's words), under one "Separate runs" label: two versions are
 * two runs, so no track places core's two fractions (`from`, `to` are used only to order, never drawn).
 * The changed figures are listed only where no line names one (`sole` null: core credits no single change), each in core's words, Olumi's
 * in blue. Absent on version 1 and where the builds differ: nothing is drawn.
 */
/** `movedFirst` (DL journey 4, under a save's receipt): the lines whose reading moved come first, so the chance that moved is read first in a
 *  short thread; each keeps its place in core's list as its id (`run.since.lines.<i>`). Core's words are unchanged. */
/** `dense`: core's lines in the meta size, for the thread's foot under a save's receipt (DL journey 4: at 1128 the moved line ran past the
 *  thread's foot at the reading size). */
export function SinceVersion({ since, movedFirst = false, dense = false }: { since: Since; movedFirst?: boolean; dense?: boolean }): JSX.Element | null {
  if (since.lines.length === 0 && since.changed.length === 0) return null
  // Two versions are two runs: core's line for each reading stands alone, with no two-mark track, and the heading says "Separate runs".
  // A reading moved where core's words differ (as its own `move` reads two versions): a drift in the number under the same words is not one.
  return (
    <section className={CARD} data-testid="core-compare-since" aria-label={since.heading} data-since-from={since.from.n} data-since-to={since.to.n}>
      <div className="flex flex-wrap items-center gap-2"><h4 className={H} data-view="run.since.heading">{since.heading}</h4>{since.lines.length === 0 ? null : <SeparateRuns />}</div>
      {since.lines.length === 0 ? null : (() => {
        // Each line keeps its place in core's list as its id; moved readings first where asked (`movedFirst`). A reading that did not move
        // is counted at rest and its line is one press away (Paul, 18 Nov: a line per unmoved reading was the wall he asked about).
        const order = since.lines.map((l, i) => ({ l, i })).sort((a, b) => (movedFirst ? Number(a.l.from_text === a.l.to_text) - Number(b.l.from_text === b.l.to_text) : 0))
        const row = ({ l, i }: { l: Since['lines'][number]; i: number }) => (
          <li key={`${l.option}:${l.aim}`} className={dense ? META : BODY} data-since-line={`${l.option}:${l.aim}`}>
            <span data-view={`run.since.lines.${i}.line`}>{l.line}</span>
          </li>
        )
        const live = order.filter(({ l }) => lineMoved(l)), still = order.filter(({ l }) => !lineMoved(l))
        return (
          <>
            {live.length === 0 ? null : <ul className="m-0 grid list-none gap-2 p-0">{live.map(row)}</ul>}
            {still.length === 0 ? null : (
              <Fold id="core-compare-since-still" summary={notMoved(still.length)}>
                <ul className="m-0 grid list-none gap-2 p-0">{still.map(row)}</ul>
              </Fold>
            )}
          </>
        )
      })()}
      {since.sole !== null || since.changed.length === 0 ? null : (
        <ul className="m-0 grid list-none gap-3 p-0" data-testid="core-compare-since-changed">
          {since.changed.map((c, i) => (
            <li key={c.id} className={`${META} ${c.whose === 'olumi' ? 'text-info' : ''}`} data-since-changed={c.id} data-since-whose={c.whose ?? ''} data-view={`run.since.changed.${i}.label`}>{c.label}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * THE COMPARE TAB on the olumi-core lane (overnight redesign, 18 Nov; Paul: "Is the scenario/version comparison working?"). One picker:
 * the version shown with an earlier version, a saved what-if or another of the person's scenarios. Against an earlier version it answers
 * two questions at a glance, every word core's:
 *  · WHAT CHANGED, each change by whose it is (Olumi's blue mark, a person's mark), each a press to its card on the canvas where core
 *    names the card (`run.since.changed[].id`); otherwise core's change lines (`/compare` `changes`), which carry no card;
 *  · WHAT MOVED, each result that moved in core's words before and after, labelled "Separate runs", the largest move first (ordered by core's
 *    own numbers, never printed),
 *    and one line counting the results that did not move.
 * Where the View's own comparison is the pair shown, core's line for the largest move is said once; where core credits no single change
 * (`sole` null) one press puts an editable question in the chat box (nothing is sent). Against a what-if or another scenario: core's
 * side-by-side (`SideBySide`). With one approved version, or none, one line.
 */
export const COMPARE_NONE = 'Compare starts once you approve a version.'
export const COMPARE_HELD = "Compare starts once you approve Olumi's proposal in the chat."
export const COMPARE_ONE = 'Comparing versions needs two approved versions. Approve a change to the model to make the second.'
/** With one version and something else to compare it with: only comparing VERSIONS waits for a second (Codex live read, wording). */
export const COMPARE_ONE_VERSIONS = 'Comparing versions needs two approved versions; you can compare this one with a what-if or another scenario.'
/** Fixed chrome: the one ask where core credits no single change. It names no figure and makes no claim about the model. */
export const ASK_WHICH = {
  label: 'Ask Olumi which change mattered',
  request: 'Between these two versions, which single change moved the results most, and how could I check it?',
  placed: 'Your question is in the message box. Edit it if you like, then send it.',
} as const
export const moreChanges = (n: number) => (n === 1 ? '1 more change' : `${n} more changes`)
export const notMoved = (n: number) => (n === 1 ? '1 result did not move.' : `${n} results did not move.`)

/**
 * The tab reads approved VERSIONS; comparing PEOPLE is the "Compare views" workspace. Where nothing is comparable yet, one press to that
 * workspace, offered only where its stage can draw (the stage's own gate: this person's page, a reveal authorised for them).
 */
function PeopleViewsPress(): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const sid = useViewStore((s) => s.sid)
  const me = useMe((s) => s.me)
  if (sid === null || view === null || !isForThisPage(view, me) || !revealedForYou(view)) return null
  return <div><button type="button" className={QUIET} data-testid="core-compare-people" onClick={() => useCompare.getState().show()}><OkIcon id="compare-views" size={14} decorative />{COMPARE_WORDS.control}</button></div>
}

const TAB = 'mx-auto grid w-full max-w-[440px] grid-cols-1 gap-4 p-3'

export function CoreCompareTab(): JSX.Element {
  const sid = useViewStore((s) => s.sid)
  const model = useViewStore(shownModel)
  const held = useViewStore((s) => s.view?.proposal != null)
  const latest = useLatestApproved()
  return (
    // The Compare row pads itself (`padding: 'self'` in the shell contract): the shell's own measure, as the Team tab gets it.
    <div data-testid="core-compare-tab" className={TAB}>
      {model === null ? null : <CompareOptions key={`options:${sid}`} model={model} />}
      <h3 className={H}>{COMPARE_OPTIONS_CHROME.versions}</h3>
      {sid && latest === undefined
        ? <p className={META} data-testid="core-compare-loading">Reading the versions…</p>
        : !sid || latest == null
          // A first model still held as Olumi's proposal is on the canvas, so "start a model" was wrong there (Paul's A11 board, 12 Nov).
          ? <><p className={META} data-testid="core-compare-none">{sid && held ? COMPARE_HELD : COMPARE_NONE}</p><PeopleViewsPress /></>
          // Keyed by the scenario: another scenario starts afresh, with none of this one's pick or answer. Two approved versions are needed
          // only for version against version: with one, a saved what-if or another scenario can still be compared (Codex live read P1).
          : <ComparePicked key={sid} sid={sid} latest={latest} />}
    </div>
  )
}

/** The version this side of the comparison is: the one the View's own comparison is of, else the latest approved. */
function ComparePicked({ sid, latest }: { sid: string; latest: number }): JSX.Element {
  const since = useViewStore((s) => s.view?.model?.run?.since ?? null)
  const others = useOtherScenarios(sid)
  const own = useOwnSides(sid)
  const base = since !== null && since.to.n <= latest ? since.to.n : latest
  const first = since !== null && since.to.n === base ? since.from.n : base - 1
  const [picked, setPicked] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const formId = useId()
  // The what-if press is offered only where it can act: a figure core lets the person set on the version shown (while a change waits, core
  // offers none, so no press), or the form already open, which stays so a started draft is kept (WhatIfSave says what it waits for).
  const settable = useViewStore((s) => s.at === null && s.sid === sid && (s.view?.model?.cards ?? []).some((c) => c.figure?.edit != null))
  const canSave = settable || saving
  const earlier: Group = { label: 'Earlier versions', choices: Array.from({ length: base - 1 }, (_, i) => base - 1 - i).map((n) => ({ value: `v:${n}`, label: `Version ${n}`, title: `Version ${n} of this scenario, as approved` })) }
  const whatIfs: Group = { label: 'Saved what-ifs', choices: [...own.whatifs].reverse().map((w) => ({ value: w.id, label: `What-if: ${w.name}`, title: w.about })) }
  const scenarios: Group = { label: 'Your other scenarios', choices: (Array.isArray(others) ? others : []).map((o) => ({ value: o.id, label: o.label, title: o.title })) }
  const groups = [earlier, whatIfs, scenarios]
  const all = groups.flatMap((g) => g.choices.map((c) => c.value))
  // The first choice: core's own pair where the View has one, else the version before; with one version, the newest what-if or the
  // first other scenario; none at all is '' (nothing to compare yet).
  const value = picked !== null && all.includes(picked) ? picked : base >= 2 ? `v:${first}` : all[0] ?? ''
  const version = value.startsWith('v:') ? Number(value.slice(2)) : null
  // This side, for core's side-by-side: the scenario now when it is the latest, else that version of it.
  const self = base === latest ? sid : `${sid}@${base}`
  // A quiet text press in the person's ink (the ghost button draws blue, which is Olumi's colour only); pressed again, the form closes.
  const whatIfPress = !canSave ? null : (
    <div className="space-y-3">
      <button type="button" className={`${BODY} inline-flex items-center gap-1.5 rounded-md py-2.5 text-text-body hover:text-text-header`} data-testid="core-compare-whatif-open" aria-expanded={saving} aria-controls={saving ? formId : undefined} onClick={() => setSaving((x) => !x)}>
        <OkIcon id="what-if" size={14} decorative />{saving ? 'Close the what-if' : 'Save a what-if to compare'}
      </button>
      {saving ? <div id={formId}><WhatIfSave sid={sid} onSaved={(id) => { setSaving(false); void own.reread().then(() => setPicked(id)) }} /></div> : null}
    </div>
  )
  // One approved version and nothing else to compare it with: the one line, and the what-if press where a figure can be set.
  if (value === '') return <><p className={BODY} data-testid="core-compare-one">{COMPARE_ONE}</p>{whatIfPress}<PeopleViewsPress /></>
  return (
    <>
      {base < 2 ? <p className={META} data-testid="core-compare-one">{COMPARE_ONE_VERSIONS}</p> : null}
      <div className="flex min-w-0 items-center gap-2" data-testid="core-compare-picker">
        <span className={`${BODY} flex-none text-text-header`} data-testid="core-compare-base">Version {base} with</span>
        <Pick id="core-compare-with" label={`Compare version ${base} with`} groups={groups} value={value} disabled={false} onChange={setPicked} />
      </div>
      {version !== null
        ? <VersionDiff sid={sid} from={version} to={base} since={since !== null && since.from.n === version && since.to.n === base ? since : null} />
        : <SideBySide a={self} b={value} />}
      {whatIfPress}
    </>
  )
}

/** A fold's summary line: the one chevron, then core's words in body ink (a control, not a caption). */
const FOLD_ROW = `${FOLD_SUMMARY} ${typography.viewPanelMeta} cursor-pointer py-2.5 text-text-body`

/**
 * One press to more of core's own rows: a quiet summary line, the rows under it. The native `<details>` stays the source of truth (its `open`,
 * the chevron's turn, the keyboard); its state is mirrored on the summary (`aria-expanded`) with `aria-controls` naming the rows' own unique id.
 */
function Fold({ id, summary, children }: { id: string; summary: string; children: ReactNode }): JSX.Element {
  const [open, setOpen] = useState(false)
  const rows = useId()
  return (
    // A plain block while closed (a closed grid still spaced its hidden rows); the rows sit under the summary once open.
    <details data-testid={id} className="group" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={FOLD_ROW} aria-expanded={open} aria-controls={rows}><FoldChevron />{summary}</summary>
      <div id={rows} className="mt-3">{children}</div>
    </details>
  )
}

/** A result moved where core says so (`move`), never by a rule of the page's. */
const movedOf = (r: Move) => r.move !== 'unchanged'
/** The size of a move, from core's two numbers: an order only, never drawn. A move without both numbers goes after those with them. */
const sizeOf = (r: Move) => (typeof r.before?.chance === 'number' && typeof r.after?.chance === 'number' ? Math.abs(r.after.chance - r.before.chance) : -1)
const sizeOfLine = (l: Since['lines'][number]) => Math.abs(l.to - l.from)
/** A reading moved where core's words for it differ between the two versions: the same rule as core's own `move` (`unchanged` = same words). */
const lineMoved = (l: Since['lines'][number]) => l.from_text !== l.to_text

function VersionDiff({ sid, from, to, since }: { sid: string; from: number; to: number; since: Since | null }): JSX.Element {
  const [shown, setShown] = useState<{ key: string; c: Compared } | null>(null)
  const [error, setError] = useState<{ key: string; text: string } | null>(null)
  const key = `${sid}:${from}:${to}`
  useEffect(() => {
    let live = true
    const [lo, hi] = from < to ? [from, to] : [to, from]
    // A fresh read clears any earlier failure (Codex live read P2: pair A failed, then B, then A again must draw A's answer).
    setError(null)
    call<Compared>('GET', `/api/scenarios/${encodeURIComponent(sid)}/compare?from=${lo}&to=${hi}`)
      .then((r) => { if (live) { setError(null); setShown({ key, c: r }) } })
      .catch((e) => { if (live) setError({ key, text: e instanceof TeamApiError ? e.message : 'That did not go through.' }) })
    return () => { live = false }
  }, [sid, from, to, key])
  const c = shown?.key === key ? shown.c : null
  // The canvas draws this pair's difference while it is shown: core's lines by the record each names (compareMarks.tsx); gone with the pair.
  useEffect(() => {
    if (c === null) return
    const [lo, hi] = from < to ? [from, to] : [to, from]
    useCompareMarks.getState().show({ sid, from: lo, to: hi, byId: marksOf(c.changes) })
    return () => useCompareMarks.getState().clear()
  }, [c, sid, from, to])
  if (error?.key === key) return <p role="alert" className={ERR} data-testid="core-compare-error">{error.text}</p>
  if (c === null) return <p className={META} data-testid="core-compare-loading">Reading both versions…</p>
  const moved = c.results.map((r, i) => ({ r, i })).filter(({ r }) => movedOf(r)).sort((a, b) => sizeOf(b.r) - sizeOf(a.r) || a.i - b.i)
  const still = c.results.length - moved.length
  // Core's line for the largest move in its own comparison, said once (its tail credits a single change, or says none is credited).
  const told = since === null ? null : [...since.lines.map((l, i) => ({ l, i }))].filter(({ l }) => lineMoved(l)).sort((a, b) => sizeOfLine(b.l) - sizeOfLine(a.l) || a.i - b.i)[0] ?? null
  return (
    <div className="grid grid-cols-1 gap-4" data-testid="core-compare-out" aria-live="polite">
      <Changes c={c} since={since} />
      <section className="space-y-2" aria-label={moved.length === 0 ? undefined : 'What moved'} data-testid="core-compare-moved">
        {/* No heading that promises movement over nothing (18 Nov audit compare-model-02): what did not move is counted below, as it was. */}
        {/* The label is drawn only where it labels something: the moved list, on its heading line. Nothing moved, the counted line says it. */}
        {moved.length === 0 ? null : <div className="flex flex-wrap items-center gap-2"><h4 className={H}>What moved</h4><SeparateRuns /></div>}
        {moved.length === 0 ? null : (
          <ul className="m-0 grid list-none gap-3 p-0">
            {moved.map(({ r, i }) => <MovedResult key={i} r={r} i={i} />)}
          </ul>
        )}
        {c.results.length === 0 ? <p className={META} data-testid="core-compare-results-none">No results in either version.</p>
          : still === 0 ? null : (
            // Counted at rest; core's own rows one press away, each with its words in both versions.
            <Fold id="core-compare-still" summary={notMoved(still)}>
              <ul className="m-0 grid list-none gap-3 p-0">
                {c.results.map((r, i) => ({ r, i })).filter(({ r }) => !movedOf(r)).map(({ r, i }) => (
                  <li key={i} className={`${META} break-words`} data-compare-still-row={i}><span className="text-text-body">{what(r)}</span>: <SideText s={r.before} /> → <SideText s={r.after} /> ({moveWords(r)})</li>
                ))}
              </ul>
            </Fold>
          )}
      </section>
      {told === null ? null : (
        // Where a reading moved: the one useful press where core credits no single change, and core's own line for every result one press
        // away (the largest move first), each in its own words, so no one result's line stands for the rest.
        <section className="space-y-2" aria-label="What Olumi credits" data-testid="core-compare-credit" data-sole={since!.sole ?? ''}>
          {since!.sole === null ? <AskWhich /> : null}
          <Fold id="core-compare-readings" summary={since!.lines.length === 1 ? 'Olumi’s reading' : `Olumi’s reading of each result (${since!.lines.length})`}>
            <ul className="m-0 grid list-none gap-3 p-0">
              {[told, ...since!.lines.map((l, i) => ({ l, i })).filter(({ i }) => i !== told.i)].map(({ l, i }) => (
                <li key={i} className={`${META} break-words`} data-view={`run.since.lines.${i}.line`}>{l.line}</li>
              ))}
            </ul>
          </Fold>
        </section>
      )}
      {c.versions.length === 0 ? null : (
        <Fold id="core-compare-who" summary="Who proposed and approved">
          <ul className="m-0 grid list-none gap-3 p-0">{c.versions.map((v) => <li key={v.n} className={`${META} break-words`}><span className="text-text-body">Version {v.n}:</span> {whoOf(v)}</li>)}</ul>
        </Fold>
      )}
    </div>
  )
}

/** One moved result: what it is (core's `label`) and its words before and after, in core's own words (separate runs: no track). */
function MovedResult({ r, i }: { r: Move; i: number }): JSX.Element {
  return (
    <li className="space-y-2" data-compare-result={i} data-compare-move={r.move}>
      <p className={`${BODY} break-words text-text-header`}>{what(r)}</p>
      <p className={`${META} break-words`}><SideText s={r.before} /> → <SideText s={r.after} /> ({moveWords(r)})</p>
    </li>
  )
}

/** Whose a change is, as an icon from the one registry: Olumi's blue mark, a person's mark, or nothing where core says neither. */
function Whose({ olumi, theirs, words }: { olumi: boolean; theirs: boolean; words?: string }): JSX.Element | null {
  return olumi ? <OkIcon id="olumi-mark" size={14} words={words ?? 'Olumi’s'} /> : theirs ? <OkIcon id="person-mark" size={14} words={words ?? 'A person’s'} /> : null
}

/**
 * What changed. The View's own comparison names each changed figure by its card (`since.changed`): each is a press that selects and centres
 * that card. Otherwise core's change lines between the two versions. Where both exist, core's full lines sit behind one press, counted at
 * rest, so one named figure never reads as the only change.
 */
/** Fixed chrome (the press's one hover): what a change line's press does. */
const SHOW_ON_CANVAS = 'Show it on the canvas'
/** Core's change lines are drawn open at rest up to this many; more are counted behind one press. */
const OPEN_LINES_UP_TO = 3
function Changes({ c, since }: { c: Compared; since: Since | null }): JSX.Element {
  const cards = useViewStore((s) => s.view?.model?.cards)
  const sid = useViewStore((s) => s.sid)
  // A core that names each line's record (`record_id`, wip/x-compare-core) makes its own lines the one list, each a press to its card: the
  // View's named list (`since.changed`) would say the same change twice. An older core's lines name no card, so the named list stays.
  const typed = c.changes.some((l) => typeof l.record_id === 'string' && l.record_id !== '')
  const named = !typed && since !== null && since.changed.length > 0 ? since.changed : null
  const onCanvas = (id: string) => Array.isArray(cards) && cards.some((x) => x.id === id)
  const linesOf = (some: Compared['changes'], at: number) => (
    <ul className="m-0 grid list-none gap-3 p-0" data-testid={at === 0 ? 'core-compare-lines' : 'core-compare-lines-more'}>
      {some.map((l, j) => {
        const i = at + j
        const body = (
          <>
            <span className="mt-0.5 flex-none">{/* Core's mark, with its hover: ◆ is Olumi's; ◐ is the person's figure Olumi read as a range, so the person's. */}
            <Whose olumi={olumiLine(l)} theirs={l.mark !== null && !olumiLine(l)} words={l.mark?.title} /></span>
            <span className="min-w-0 break-words">{l.text}{l.detail ? <> <span className="whitespace-pre-line text-text-light">{l.detail}</span></> : null}</span>
          </>
        )
        const rid = typeof l.record_id === 'string' && l.record_id !== '' ? l.record_id : null
        return (
          <li key={i} className={`${BODY} flex min-w-0 items-start gap-1.5`} data-compare-line={i} data-compare-line-record={rid ?? undefined}>
            {rid !== null && onCanvas(rid)
              // One tip for the one focus stop: what the press does, then core's own words for the mark inside it (the icon alone would be pointer-only here).
              ? <HoverButton type="button" className={`${BODY} flex w-full min-w-0 items-start gap-1.5 rounded-md py-2.5 text-left hover:bg-panel-hover`} data-compare-card={rid} words={l.mark?.title ? `${SHOW_ON_CANVAS}\n${l.mark.title}` : SHOW_ON_CANVAS} onClick={() => { if (sid !== null) showCard(sid, rid) }}>{body}</HoverButton>
              : body}
          </li>
        )
      })}
    </ul>
  )
  const lines = linesOf(c.changes, 0)
  return (
    <section className="space-y-2" aria-label="What changed" data-testid="core-compare-changes">
      <h4 className={H}>What changed</h4>
      {named === null
        ? (c.changes.length === 0 ? <p className={META} data-testid="core-compare-changes-none">No change to the model</p>
          // Typed lines are the one list: the first few open at rest, the rest one press away (never a wall, never said twice).
          : typed && c.changes.length > OPEN_LINES_UP_TO
            ? <>{linesOf(c.changes.slice(0, OPEN_LINES_UP_TO), 0)}<Fold id="core-compare-more-lines" summary={moreChanges(c.changes.length - OPEN_LINES_UP_TO)}>{linesOf(c.changes.slice(OPEN_LINES_UP_TO), OPEN_LINES_UP_TO)}</Fold></>
            : lines)
        : (
          <>
            <ul className="m-0 grid list-none gap-3 p-0" data-testid="core-compare-named">
              {named.map((x, i) => {
                const body = <><span className="mt-0.5 flex-none"><Whose olumi={x.whose === 'olumi'} theirs={x.whose === 'theirs'} /></span><span className="min-w-0 break-words" data-view={`run.since.changed.${i}.label`}>{x.label}</span></>
                return (
                  <li key={x.id} data-since-changed={x.id} data-since-whose={x.whose ?? ''}>
                    {onCanvas(x.id)
                      ? <HoverButton type="button" className={`${BODY} flex w-full min-w-0 items-start gap-1.5 rounded-md py-2.5 text-left hover:bg-panel-hover`} data-compare-card={x.id} words={SHOW_ON_CANVAS} onClick={() => { if (sid !== null) showCard(sid, x.id) }}>{body}</HoverButton>
                      : <p className={`${BODY} flex min-w-0 items-start gap-1.5`}>{body}</p>}
                  </li>
                )
              })}
            </ul>
            {c.changes.length === 0 ? null
              // Few enough to read at rest: core's own lines are the change, open (18 Nov audit compare-model-01); a long list stays one press away.
              : c.changes.length <= OPEN_LINES_UP_TO ? lines
              : <Fold id="core-compare-all-lines" summary={`All ${c.changes.length} changes in full`}>{lines}</Fold>}
          </>
        )}
    </section>
  )
}

/** A press on a changed figure: its card selected and centred. A card Simple has folded into the inputs group is not drawn, so the group is
 *  opened first (the group's own press, `setInputsOpen`) and the card is centred once the board draws it (`focusWhenDrawn`). */
export function showCard(sid: string, id: string): void {
  if (useCanvasStore.getState().nodes.some((n) => n.id === id)) { focusNodeById(id); return }
  // A card in a ROW's group card (groups.ts: Olumi's proposals, notes, unsized) is in no node either: open the group that holds it, as its own press does.
  const { view } = useViewStore.getState()
  if (view?.model != null) { const g = cardGroupsOf(drawnModelOf(view.model), view).find((x) => x.cards.includes(id)); if (g !== undefined) setGroupOpen(sid, g.id) }
  setInputsOpen(sid, true)
  focusWhenDrawn(id)
}

/** One press: an editable question in the chat's message box, never sent (the chat is loaded on the press, so this module never imports it). */
function AskWhich(): JSX.Element {
  const [placed, setPlaced] = useState(false)
  const ask = () => { void import('../olumiView/ViewChat').then((m) => { m.prefillComposer(ASK_WHICH.request); setPlaced(true) }) }
  return (
    <div className="grid justify-items-start gap-3" data-testid="core-compare-ask">
      <Button size="sm" variant="primary" data-testid="core-compare-ask-go" onClick={ask}>
        <span className="inline-flex items-center gap-1.5"><OkIcon id="olumi-mark" size={14} decorative inherit />{ASK_WHICH.label}</span>
      </Button>
      <p role="status" className={META} data-testid="core-compare-ask-placed">{placed ? ASK_WHICH.placed : ''}</p>
    </div>
  )
}
