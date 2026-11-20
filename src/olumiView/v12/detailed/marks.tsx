/**
 * THE DETAILED FACE'S MARKS (Paul, 17 Nov 2026: "not overwhelming but truly valuable with rich data"; "anything that's standard text should be
 * an icon with a hover-over"). Each one draws a fact the Detailed card used to spell out as a sentence, as a mark or a small visual, with core's
 * words whole on hover and as its accessible name. Nothing here writes, rewords, rounds or works out a value; the numbers are core's.
 * Every icon is drawn through the registry (look/icons.tsx): one icon per meaning.
 * Look: look/olumiLook.css, the `.ok-dt-*` block.
 */
import { useState, Fragment } from 'react'
import type { ViewCard, ViewModel } from '../../client'
import { badgeFace, toggleBadge } from '../../Badge'
import { OlumiMark, worthMarksOf } from '../cards/marks'
import { OkIcon } from '../../look/icons'
import { cardKind } from '../fields/fields'
import { optionLetters } from '../cards/letters'
import { figureRange } from '../contract'
import type { Said } from './said'

const ICON = 14

/**
 * What core folded behind a card or the question (its badge): a stack icon and CORE'S OWN words for it, its `face` where core sends one, else its
 * `text` (Badge.tsx badgeFace); never a count made in the page. A fold holding a record a held proposal adds or changes keeps core's change marker
 * (`badge.change`: + added, ↻ changed) beside it, in the hover and in the accessible name, so a change behind a fold is seen before it is approved
 * (as Badge.tsx draws it), and keeps its dashed Olumi outline. Core's words whole on hover, its label the name; pressing it opens them (toggleBadge).
 */
export function BadgeCount({ cardId, badge, at }: { cardId: string; badge: NonNullable<ViewCard['badge']>; at: string }): JSX.Element {
  const b = badge as typeof badge & { readonly words?: string; readonly face?: string }
  const face = badgeFace(b)
  const change = b.proposed && b.change !== '' ? b.change : null
  const said = [change, b.words || b.face || b.text].filter((x) => x != null && x !== '').join(' ')
  const words = [said, b.title].filter((x) => x != null && x !== '').join('\n')
  return (
    <button type="button" className={`ok-dt-badge nodrag nopan ${b.proposed ? 'ok-dt-badge-proposed' : ''}`} title={words} aria-label={change === null ? b.label : `${b.label} ${change}`} aria-expanded={b.open}
      data-core-badge={cardId} data-view={`${at}.badge`} onClick={(e) => { e.stopPropagation(); void toggleBadge(cardId, b) }}>
      <OkIcon id="folded-records" size={ICON} decorative /><span className="tabular-nums" data-view={`${at}.badge.${face !== null ? 'face' : 'text'}`}>{face ?? b.text}</span>
      {change === null ? null : <span className="ok-dt-olumi" data-view={`${at}.badge.change`}>{change}</span>}
    </button>
  )
}

/** Core's honesty line (`card.unused`: Olumi's analysis does not use this figure yet), as a mark with core's words. */
export const UnusedMark = ({ id, words }: { id: string; words: string }): JSX.Element => (
  <span className="ok-dt-icon" data-view={`${id}.unused`} data-unused={id}><OkIcon id="feeds-no-result" size={ICON} words={words} decorative={false} /></span>
)

/** Olumi's own observations on this card (core's `worth_checking`): one mark per distinct code, the same icons and words as the Simple foot (worthMarksOf), so a
 *  switch to Detailed never drops what Olumi said is worth checking, and two different observations are two different marks (C3). */
export const WorthMark = ({ card }: { card: ViewCard }): JSX.Element | null => {
  const marks = worthMarksOf(card)
  return marks.length === 0 ? null : (
    <>
      {marks.map((m) => (
        <span key={m.code} className="ok-dt-icon" data-view={`${card.id}.worth_checking`} data-card-mark="worth-checking" data-worth-code={m.code}><OkIcon id={m.icon} size={ICON} words={m.words} decorative={false} /></span>
      ))}
    </>
  )
}

/** The question's date (core's `decide_by`): a calendar mark and core's words; Olumi's blue where Olumi set it. */
export const DecideBy = ({ d }: { d: { text: string; title: string; olumi: boolean } }): JSX.Element => (
  <span className={`ok-dt-date ${d.olumi ? 'ok-dt-olumi' : ''}`} title={d.title || d.text} data-olumi={d.olumi || undefined} data-view="question.decide_by.text">
    <OkIcon id="decide-by" size={ICON} /><span>{d.text}</span>
  </span>
)

/** An aim's own marker, small, beside a row that is about it: a goal's diamond in the goal's colour, a limit's outlined square (DS shapes). */
export function AimMarker({ kind }: { kind: 'goal' | 'limit' }): JSX.Element {
  return (
    <svg className="ok-dt-aim-mark" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" data-aim-marker={kind}>
      {kind === 'goal'
        ? <path d="M5 0.8 L9.2 5 L5 9.2 L0.8 5 Z" fill="var(--goal)" stroke="var(--text-body)" strokeWidth="0.75" />
        : <rect x="1.2" y="1.2" width="7.6" height="7.6" fill="var(--bg-panel)" stroke="var(--text-light)" strokeWidth="1.25" />}
    </svg>
  )
}
const aimKindOf = (model: ViewModel | null, aimId: string): 'goal' | 'limit' => {
  const aim = model?.cards.find((c) => c.id === aimId)
  if (aim === undefined) return 'goal'
  const k = cardKind(aim, model)
  return (k.kind === 'aim' && k.aim === 'limit') || aim.family === 'limit' ? 'limit' : 'goal'
}

type RowT = { kind: string; aim_id?: string | null; aim?: string; value?: string | null; title?: string; text?: string | null; question?: string | null; state_text?: string | null; olumi?: { glyph: string; title: string } | null; chance?: number | null; tips?: string; next_test?: string }

/** An option's rows for aims other than its headline's (core's rows with an `aim_id`), each with its place in `rows`. */
const otherRows = (card: ViewCard) => {
  const head = card.headline?.aim_id ?? null
  return card.rows.map((r, i) => ({ r: r as RowT, i })).filter(({ r }) => r.aim_id != null && r.aim_id !== head)
}
/** Words longer than this are not drawn on a row: core's whole sentence (Run sentences reach 800 characters) is one press away instead. */
export const ROW_WORDS_MAX = 80
/**
 * Core's words on a row: drawn as they are where short; a long sentence is a mark that opens the whole words out of the card's flow (`.ok-pop`,
 * so the board never moves), the same words its hover and name. Never cut, never reworded.
 */
export function RowWords({ words, at }: { words: string; at: string }): JSX.Element | null {
  const [open, setOpen] = useState(false)
  if (words === '') return null
  if (words.length <= ROW_WORDS_MAX) return <span data-row-words={at}>{words}</span>
  return (
    <span className="ok-dt-whole" data-row-words={at} data-row-words-long="">
      <button type="button" className="ok-dt-icon ok-dt-press nodrag nopan" title={words} aria-label={words} aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}><OkIcon id="full-answer" size={ICON} words={words} decorative /></button>
      {open ? <p className="ok-pop nodrag nopan" role="note">{words}</p> : null}
    </span>
  )
}

/** One result row: a lead (the aim's marker, or the option's letter), a mini track (core's chance, else no track where nothing can
 *  be worked out yet), core's value or state words, and Olumi's mark where the value rests on Olumi's figures. */
function ResultRow({ lead, r, at, words, hover, mark }: { lead: JSX.Element; r: RowT; at: string; words: string; hover: string; mark: Record<string, string | boolean | undefined> }): JSX.Element {
  const chance = typeof r.chance === 'number' && r.chance >= 0 && r.chance <= 1 ? r.chance : null
  return (
    <div className="ok-dt-aim" title={hover} data-view={at} data-aim-row={r.kind} {...mark}>
      {lead}
      {r.kind === 'none' ? <span className="ok-dt-mini-none" data-withheld-row={at} />
        : chance !== null ? <span className="ok-dt-mini" data-at={chance}><i style={{ width: `${chance * 100}%` }} /></span>
        : <span className="ok-dt-mini-none" />}
      <span className="ok-dt-aim-val" data-view={r.kind === 'none' ? undefined : `${at}.value`}><RowWords words={words} at={at} /></span>
      {r.olumi == null ? <span /> : <OlumiMark words={r.olumi.title} />}
    </div>
  )
}
/** A7(a) (DL 19 Nov; Codex 10:16 "fix its actual adapter seam"): a withheld row's switch sentence (`tips`) and the one input to check (`next_test`),
 *  core's own words read at rest under the row instead of on hover; each only where the row's drawn words do not already say it. By field. */
export function RowBelow({ r, at, shown }: { r: RowT; at: string; shown: string }): JSX.Element | null {
  if (r.kind !== 'none') return null
  // `shown` = the words each caller actually draws at rest (Codex 12:12Z): a ResultRow's words over ROW_WORDS_MAX are a closed press (atRest),
  // while the option card's headline is a wrapping paragraph and passes its whole line.
  const below = ([['tips', r.tips], ['next_test', r.next_test]] as const).flatMap(([f, x]) => (x == null || x === '' || shown.includes(x) ? [] : [{ f, x }]))
  return below.length === 0 ? null : <>{below.map(({ f, x }) => <p key={f} className="ok-dt-said-line" data-view={`${at}.${f}`} data-row-below={f}>{x}</p>)}</>
}
const rowWords = (r: RowT) => (r.kind === 'none' ? (r.state_text || r.text || '') : r.value ?? '')
/** What a ResultRow/RowWords draws at rest: its words, or nothing when they sit behind a closed press. */
const atRest = (words: string) => (words.length <= ROW_WORDS_MAX ? words : '')
const hoverOf = (...xs: (string | null | undefined)[]) => xs.filter((x, j, a) => x != null && x !== '' && a.indexOf(x) === j).join('\n')

/**
 * EACH AIM'S RESULTS, ON THE AIM'S OWN CARD (Paul's 17 Nov capture: every option card repeated the same limit, "Avoid dipping into personal
 * savings"). The aim names itself once; under it, one row per option by its letter (the option's name is said on its own card): core's chance
 * as a mini track, or no track where nothing can be worked out yet, and core's words. A state every option says alike for the
 * aim is said once instead (said.ts sharedRowStates, drawn by SaidOnce), with no rows. The headline's own aim is not drawn here: the option
 * cards and the question's rail carry it.
 */
export function AimResults({ aim, model, shared }: { aim: ViewCard; model: ViewModel | null; shared: ReadonlyMap<string, Said> }): JSX.Element | null {
  if (shared.has(aim.id) || model === null) return null
  const letters = optionLetters(model)
  const rows = model.cards.filter((c) => c.family === 'option').flatMap((c) => otherRows(c).filter(({ r }) => r.aim_id === aim.id).map((x) => ({ c, ...x })))
  if (rows.length === 0) return null
  return (
    <div className="ok-dt-aims" data-aim-results={aim.id}>
      {rows.map(({ c, r, i }) => (
        <Fragment key={`${c.id}.${i}`}>
          <ResultRow r={r} at={`${c.id}.rows.${i}`} words={rowWords(r)} hover={hoverOf(c.heading, rowWords(r), r.title, r.question)}
            lead={<span className="ok-letter" data-letter-chip={letters.get(c.id) ?? ''}>{letters.get(c.id) ?? '·'}</span>} mark={{ 'data-ok-limit': aim.id, 'data-aim-result': c.id }} />
          <RowBelow r={r} at={`${c.id}.rows.${i}`} shown={atRest(rowWords(r))} />
        </Fragment>
      ))}
    </div>
  )
}

/** An option's results on aims that have no card on the board (so AimResults cannot say them): the aim's marker, the row, its name on hover. */
export function AimRows({ card, model, shared }: { card: ViewCard; model: ViewModel | null; shared: ReadonlyMap<string, Said> }): JSX.Element | null {
  const rows = otherRows(card).filter(({ r }) => !(model?.cards ?? []).some((c) => c.id === r.aim_id))
  if (rows.length === 0) return null
  const nameOf = (r: RowT) => r.aim ?? ''
  return (
    <div className="ok-dt-aims" data-view={`${card.id}.limits`}>
      {rows.map(({ r, i }) => {
        const words = r.kind === 'none' && shared.has(r.aim_id!) ? '' : rowWords(r)
        const at = `${card.id}.rows.${i}`
        return (
          <Fragment key={i}>
            <ResultRow r={r} at={at} words={words} hover={hoverOf(nameOf(r), rowWords(r), r.title, r.question)}
              lead={<AimMarker kind={aimKindOf(model, r.aim_id!)} />} mark={{ 'data-ok-limit': r.aim_id!, 'data-said-once': shared.has(r.aim_id!) || undefined }} />
            <RowBelow r={r} at={at} shown={atRest(words)} />
          </Fragment>
        )
      })}
    </div>
  )
}

/** Lines the board says once on this card (said.ts): core's words, a quiet line each, their whole the hover; Olumi's mark beside a line where
 *  every row it stands for carries the same one (core's words for it its name). */
export function SaidOnce({ lines, at }: { lines: readonly Said[]; at: string }): JSX.Element | null {
  if (lines.length === 0) return null
  return (
    <div className="ok-dt-said" data-said-once-on={at}>
      {lines.map((s, i) => (
        <p key={i} className="ok-dt-said-line" title={s.title}><RowWords words={s.text} at={`${at}.said.${i}`} />
          {s.olumi == null ? null : <span data-said-olumi={`${at}.said.${i}`}><OlumiMark words={s.olumi.title} /></span>}</p>
      ))}
    </div>
  )
}

/** A figure whose range has a real spread (low below high). A single value, with or without a deadline beside it, encodes nothing a bar adds. */
export const hasSpread = (card: ViewCard): boolean => {
  const r = figureRange(card)
  return r !== null && Number.isFinite(r.low) && Number.isFinite(r.high) && r.high > r.low
}
