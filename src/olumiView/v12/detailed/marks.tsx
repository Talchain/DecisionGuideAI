/**
 * THE DETAILED FACE'S MARKS (Paul, 17 Nov 2026: "not overwhelming but truly valuable with rich data"; "anything that's standard text should be
 * an icon with a hover-over"). Each one draws a fact the Detailed card used to spell out as a sentence, as a mark or a small visual, with core's
 * words whole on hover and as its accessible name. Nothing here writes, rewords, rounds or works out a value; the numbers are core's.
 * Every icon is drawn through the registry (look/icons.tsx): one icon per meaning.
 * Look: look/olumiLook.css, the `.ok-dt-*` block.
 */
import { useCallback, useEffect, useId, useRef, useState, Fragment, type FocusEvent, type MouseEvent } from 'react'
import { isOlumiCoreLane } from '../../../olumiCore/lane'
import { typography } from '../../../styles/typography'
import type { ViewCard, ViewModel, ViewRow } from '../../client'
import { badgeFace, toggleBadge } from '../../Badge'
import { OlumiMark } from '../cards/marks'
import { Hover } from '../../look/Hover'
import { OkIcon } from '../../look/icons'
import { cardKind } from '../fields/fields'
import { optionLetters } from '../cards/letters'
import { figureRange } from '../contract'
import { bareReasonOfRow, withheldCardIds } from '../cards/words'
import { ringFrom } from '../../reasoning/tabRing'
import type { Said } from './said'

const MARK_SIZE = 14
const withheldReasonClass = `${typography.viewPanelMeta} text-text-light`

/** Each mounted line owns its contribution to the existing canvas ring. Escape also reaches pointer-only lines. */
export function useWithheldRing(ids: readonly string[]) {
  const source = `withheld:${useId()}`
  const release = useRef<(() => void) | null>(null)
  const clear = useCallback(() => {
    release.current?.()
    release.current = null
  }, [])
  const targetKey = JSON.stringify(ids)
  useEffect(() => clear, [clear, targetKey])

  const show = () => {
    if (ids.length === 0 || release.current !== null) return
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') clear() }
    document.addEventListener('keydown', onEscape, true)
    release.current = () => {
      document.removeEventListener('keydown', onEscape, true)
      ringFrom(source, [])
    }
    ringFrom(source, ids)
  }
  return {
    pointer: { onPointerEnter: show, onPointerLeave: clear, onClick: show },
    focus: {
      onFocus: (e: FocusEvent<HTMLElement>) => { if (e.target === e.currentTarget) show() },
      onBlur: (e: FocusEvent<HTMLElement>) => { if (e.target === e.currentTarget) clear() },
    },
  }
}
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
    <Hover as="button" words={words} tipSpacing="list" type="button" className={`ok-dt-badge nodrag nopan ${b.proposed ? 'ok-dt-badge-proposed' : ''}`} aria-label={change === null ? b.label : `${b.label} ${change}`} aria-expanded={b.open}
      data-core-badge={cardId} data-view={`${at}.badge`} onClick={(e) => { e.stopPropagation(); void toggleBadge(cardId, b) }}>
      <OkIcon id="folded-records" size={MARK_SIZE} decorative /><span className="tabular-nums" data-view={`${at}.badge.${face !== null ? 'face' : 'text'}`}>{face ?? b.text}</span>
      {change === null ? null : <span className="ok-dt-olumi" data-view={`${at}.badge.change`}>{change}</span>}
    </Hover>
  )
}

/** The question's date (core's `decide_by`): a calendar mark and core's words; Olumi's blue where Olumi set it. */
export const DecideBy = ({ d }: { d: { text: string; title: string; olumi: boolean } }): JSX.Element => (
  <Hover focusable={false} words={d.title || d.text} className={`ok-dt-date ${d.olumi ? 'ok-dt-olumi' : ''}`} data-olumi={d.olumi || undefined} data-view="question.decide_by.text">
    <OkIcon id="decide-by" size={MARK_SIZE} /><span>{d.text}</span>
  </Hover>
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

type RowT = { kind: string; aim_id?: string | null; aim?: string; value?: string | null; title?: string | null; text?: string | null; question?: string | null; state_text?: string | null; olumi?: { glyph: string; title: string } | null; chance?: number | null; tips?: string; next_test?: string }

/** An option's rows for aims other than its headline's (core's rows with an `aim_id`), each with its place in `rows`. */
const otherRows = (card: ViewCard) => {
  const head = card.headline?.aim_id ?? null
  return card.rows.map((r, i) => ({ r, i })).filter(({ r }) => r.aim_id != null && r.aim_id !== head)
}
/** Words longer than this are not drawn on a row: core's whole sentence (Run sentences reach 800 characters) is one press away instead. */
export const ROW_WORDS_MAX = 80
/**
 * Core's words on a row: drawn as they are where short; a long sentence is a mark that opens the whole words out of the card's flow (`.ok-pop`,
 * so the board never moves), the same words its hover and name. Never cut, never reworded.
 */
export function RowWords({ words, at, reason, ring }: { words: string; at: string; reason?: string; ring?: ReturnType<typeof useWithheldRing> }): JSX.Element | null {
  const [open, setOpen] = useState(false)
  if (reason) return <span className={withheldReasonClass} data-row-words={at} data-view={`${at}.title`}>{reason}</span>
  if (words === '') return null
  if (words.length <= ROW_WORDS_MAX) return <span data-row-words={at}>{words}</span>
  return (
    <span className="ok-dt-whole" data-row-words={at} data-row-words-long="">
      <Hover as="button" words={words} type="button" className="ok-dt-icon ok-dt-press nodrag nopan" aria-label={words} aria-expanded={open} {...ring?.focus}
        onClick={(e: MouseEvent<HTMLElement>) => { e.stopPropagation(); ring?.pointer.onClick(); setOpen((o) => !o) }}><OkIcon id="full-answer" size={MARK_SIZE} words={words} decorative /></Hover>
      {open ? <p className="ok-pop nodrag nopan" role="note">{words}</p> : null}
    </span>
  )
}

/** A headline-less option's row keeps its existing long-text control. */
export function WithheldLead({ text, blockers, row }: {
  text: string; blockers: readonly string[]; row: string
}): JSX.Element {
  const holder = useWithheldRing(blockers)
  const ring = blockers.length === 0 ? undefined : holder
  return (
    <p className="ok-quiet" data-view={`${row}.text`} {...ring?.pointer}><RowWords words={text} at={row} ring={ring} /></p>
  )
}

/** One result row: a lead (the aim's marker, or the option's letter), a mini track (core's chance, else no track where nothing can
 *  be worked out yet), core's value or state words, and Olumi's mark where the value rests on Olumi's figures. */
function ResultRow({ lead, r, at, words, hover, mark, reason, blockers }: { lead: JSX.Element; r: RowT; at: string; words: string; hover: string; mark: Record<string, string | boolean | undefined>; reason?: string; blockers: readonly string[] }): JSX.Element {
  const chance = typeof r.chance === 'number' && r.chance >= 0 && r.chance <= 1 ? r.chance : null
  const holder = useWithheldRing(blockers)
  const ring = blockers.length === 0 ? undefined : holder
  return (
    <Hover as="div" className="ok-dt-aim" words={hover} data-view={at} data-aim-row={r.kind} {...mark} {...ring?.pointer} {...ring?.focus}>
      {lead}
      {r.kind === 'none' ? <span className="ok-dt-mini-none" data-withheld-row={at} />
        : chance !== null ? <span className="ok-dt-mini" data-at={chance}><i style={{ width: `${chance * 100}%` }} /></span>
        : <span className="ok-dt-mini-none" />}
      <span className="ok-dt-aim-val" data-view={r.kind === 'none' ? undefined : `${at}.value`}><RowWords words={words} at={at} reason={reason} ring={ring} /></span>
      {r.olumi == null ? <span /> : <OlumiMark words={r.olumi.title} />}
    </Hover>
  )
}
/** A7(a) (DL 19 Nov; Codex 10:16 "fix its actual adapter seam"): a withheld row's switch sentence (`tips`) and the one input to check (`next_test`),
 *  core's own words read at rest under the row instead of on hover; each only where the row's drawn words do not already say it. By field. */
export function RowBelow({ r, at, shown }: { r: RowT; at: string; shown: string }): JSX.Element | null {
  if (r.kind !== 'none') return null
  // `shown` is the line at rest, including a whole withheld reason when present. Long fallback row words sit behind a press.
  const below = ([['tips', r.tips], ['next_test', r.next_test]] as const).flatMap(([f, x]) => (x == null || x === '' || shown.includes(x) ? [] : [{ f, x }]))
  return below.length === 0 ? null : <>{below.map(({ f, x }) => <p key={f} className="ok-dt-said-line" data-view={`${at}.${f}`} data-row-below={f}>{x}</p>)}</>
}
const rowWords = (r: RowT) => (r.kind === 'none' ? (r.state_text || r.text || '') : r.value ?? '')
const reasonOf = (r: ViewRow) => isOlumiCoreLane() ? bareReasonOfRow(r) ?? undefined : undefined
/** What a ResultRow/RowWords draws at rest: its words, or nothing when they sit behind a closed press. */
const atRest = (words: string, reason: string | undefined) => reason ?? (words.length <= ROW_WORDS_MAX ? words : '')
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
          <ResultRow r={r} at={`${c.id}.rows.${i}`} words={rowWords(r)} hover={hoverOf(c.heading, rowWords(r), r.title, 'question' in r ? r.question : undefined)}
            reason={reasonOf(r)} blockers={isOlumiCoreLane() ? withheldCardIds(model, [r]) : []}
            lead={<span className="ok-letter" data-letter-chip={letters.get(c.id) ?? ''}>{letters.get(c.id) ?? '·'}</span>} mark={{ 'data-ok-limit': aim.id, 'data-aim-result': c.id }} />
          <RowBelow r={r} at={`${c.id}.rows.${i}`} shown={atRest(rowWords(r), reasonOf(r))} />
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
        const reason = shared.has(r.aim_id!) ? undefined : reasonOf(r)
        const at = `${card.id}.rows.${i}`
        return (
          <Fragment key={i}>
            <ResultRow r={r} at={at} words={words} hover={hoverOf(nameOf(r), rowWords(r), r.title, 'question' in r ? r.question : undefined)}
              reason={reason} blockers={!shared.has(r.aim_id!) && isOlumiCoreLane() ? withheldCardIds(model, [r]) : []}
              lead={<AimMarker kind={aimKindOf(model, r.aim_id!)} />} mark={{ 'data-ok-limit': r.aim_id!, 'data-said-once': shared.has(r.aim_id!) || undefined }} />
            <RowBelow r={r} at={at} shown={atRest(words, reason)} />
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
        <SaidLine key={i} line={s} at={`${at}.said.${i}`} />
      ))}
    </div>
  )
}

function SaidLine({ line, at }: { line: Said; at: string }): JSX.Element {
  const holder = useWithheldRing(line.blockers ?? [])
  const ring = line.blockers?.length ? holder : undefined
  return (
    <Hover as="p" className="ok-dt-said-line" words={line.title} {...ring?.pointer} {...ring?.focus}>
      <RowWords words={line.text} at={at} reason={line.reason} ring={ring} />
      {line.olumi == null ? null : <span data-said-olumi={at}><OlumiMark words={line.olumi.title} /></span>}
    </Hover>
  )
}

/** A figure whose range has a real spread (low below high). A single value, with or without a deadline beside it, encodes nothing a bar adds. */
export const hasSpread = (card: ViewCard): boolean => {
  const r = figureRange(card)
  return r !== null && Number.isFinite(r.low) && Number.isFinite(r.high) && r.high > r.low
}
