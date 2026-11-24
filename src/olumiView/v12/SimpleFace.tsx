/**
 * V12 Simple level: a card drawn as visuals, with the words behind hover (Paul, 16 Nov: "the graph should be visualisations, icons, graphs,
 * colour systems"; coaching text belongs in the AI panel). Every card and link stays; only the sentences go. Nothing here is worked out:
 *  - an option's chance is a gauge bar with core's own value text (`rows[chance].value`) and its position (`rows[chance].chance`); core's
 *    words after the number are the qualifier, on their own line, with Olumi's mark where the chance rests on Olumi's figures;
 *  - an option with no chance is ONE quiet line in core's own words for what is missing (its next step `headline.add`, else its headline's text),
 *    its long reason whole on hover: no "?", no "Why not" and no empty track at rest (R6, 16 Nov); unknown is never drawn as zero;
 *  - a figure with a modelled band (`values[]`: p10 / p50 / p90) is a range bar per option on one shared axis, positions only; an option
 *    core could not calculate (contract.ts withheldValues) is named by its letter, then core's reason;
 *  - a figure with a stated value shows core's words, one line; one that waits or has no value is core's words alone, once, one quiet line (R6: no empty track);
 *  - an aim or limit shows its bound (core's words, one line), in the goal's colour where it is measured;
 *  - authorship is a mark (Olumi's, or a person's), the words on hover; Olumi's question is its mark in a ring on its card.
 * The marks and shapes are v12/cards (marks.tsx, kind.ts); the card's own outline by kind is the look's (look/olumiLook.css).
 * D2 (the lead, 17 Nov: shorter cards on Simple): ONE visual (the gauge, the bands, the range bar, the figure, or the aim's bound) and ONE quiet line,
 * on one line, whole on hover: core's `description` where it sends one (fields.ts cardTitle), else the card's state line above (the chance's qualifier,
 * the no-chance line, the "waits on …" words, the gap words). What a card rests on and its working stay closed at rest (CoreCard).
 */
import { useEffect, useId, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { isOlumiCoreLane } from '../../olumiCore/lane'
import { useAnchoredTip } from '../look/Tip'
import { Hover } from '../look/Hover'
import { colourClass, ICONS, OkIcon } from '../look/icons'
import type { ViewCard, ViewModel, ViewRow } from '../client'
import { typography } from '../../styles/typography'
import { chanceAtOf } from '../resultRange'
import { ChanceBand } from '../ResultBand'
import { FigureEdit } from '../FigureEdit'
import { targetCardOf } from '../model/targets'
import { barCardOf, olumiKey } from '../layout'
import { figureRange, isBaseline, isFigureNumber, limitLeadOf, withheldValues } from './contract'
import { cardKindOf, type CardKind } from './cards/kind'
import { GoalMeasureLine, waitingMeasureQuestion } from './cards/GoalMeasureLine'
import { optionLetters } from './cards/letters'
import { AuthorMark, BaselinePill, CardMarks, ChangeGlyph, ConditionTag, KindTag, LetterChip, LimitTag, OlumiAsksMark, OlumiMark, whoseOf } from './cards/marks'
import { chanceParts, headlineChanceRow, headlineWithheldRowIndex, noChanceLineOf, onceWords, sharedNoChanceOf, tipsLineOf, unsizedWords, withheldCardIds } from './cards/words'
import { useWithheldRing } from './detailed/marks'
import { cardKind, cardTitle, needsOf } from './fields/fields'
import { aimOf, axisOf, fmt, pctOf, unitOf, type Axis } from './scale/axis'

/**
 * ONE TYPE SCALE ON A SIMPLE CARD (Paul, 17 Nov: no big bold text on a card): the title (BaseNode's) and the card's one headline, an option's
 * chance or an aim's bound, are 14 / 500 (`typography.viewValue`; design findings section 4: "one headline per card"); every other word on the
 * card is 12 / 400 (`typography.viewLabel`, the card's small text), a figure's digits tabular.
 */
const FIGURE = `${typography.viewLabel} tabular-nums`
/** Olumi's blue, the person's ink and the goal's colour: the board's own tokens. */

export type BandRow = { readonly option: string; readonly letter: string; readonly heading: string; readonly lo: number; readonly mid: number | null; readonly hi: number; readonly text: string; readonly olumi: boolean }

/** The option letters (A, B, ...) in the model's order (cards/letters.ts): a short name for a row, its heading on hover. */
/** The quiet status's least width on its line (DL BUILD 3, 1232: "n" / "o" beside "4 figures, 3 calculations"): grows from 7rem, never below. */
export const QUIET_BASIS = 'flex-[1_1_7rem]'
export const optionLetterOf =(model: ViewModel | null, id: string): string => optionLetters(model).get(id) ?? '·'

/** The served bands of one card (not the withheld ones) and the axis they share: the same axisOf / pctOf / unitOf as the Detailed strips (scale/OutcomeStrips.tsx). */
type Bands = { readonly values: ReadonlyArray<NonNullable<ViewCard['values']>[number]>; readonly axis: Axis; readonly unit: string | null; readonly goal: number | null }
function bandsOf(card: ViewCard, model: ViewModel | null): Bands | null {
  const held = new Set(withheldValues(card).map((w) => w.option))
  const values = (card.values ?? []).filter((v) => !held.has(v.option) && Number.isFinite(v.p10) && Number.isFinite(v.p90))
  if (values.length === 0) return null
  const aim = model === null ? null : aimOf(model), unit = unitOf(card, aim)
  // The aim's own value, a gold tick, only where this card is the aim's quantity and the units match (as OutcomeStrips does).
  const goal = aim !== null && aim.quantity === card.id && (unit === null || aim.unit === unit) ? aim.value : null
  const p50s = values.flatMap((v) => (v.p50 !== null && Number.isFinite(v.p50) ? [v.p50] : []))
  const axis = axisOf(Math.min(...values.map((v) => v.p10), ...p50s, 0), Math.max(...values.map((v) => v.p90), ...p50s, goal ?? -Infinity, 0))
  return { values, axis, unit, goal }
}

/**
 * The positions (0..100) of each option's modelled band on ONE true axis shared by the card's rows (v10 review item 5: the Detailed strips' own 0-based
 * axis, not min-to-max, so a small gap is a small gap), from the served p10 / p50 / p90. An option core withheld has no band: it is drawn as its own
 * row, with core's reason.
 */
export function bandRowsOf(card: ViewCard, model: ViewModel | null): readonly BandRow[] {
  const b = bandsOf(card, model)
  if (b === null) return []
  const at = (n: number): number => pctOf(b.axis, n)
  return b.values.map((v) => ({
    option: v.option, letter: optionLetterOf(model, v.option), heading: model?.cards.find((c) => c.id === v.option)?.heading ?? '',
    lo: at(Math.min(v.p10, v.p90)), mid: v.p50 === null ? null : at(v.p50), hi: at(Math.max(v.p10, v.p90)), text: v.text, olumi: v.olumi,
  }))
}

/** The axis ends (printed once, under the bars) and the gold goal tick's position, from the same axis as the bars; null where the card has no band. */
export function bandAxisOf(card: ViewCard, model: ViewModel | null): { readonly min: string; readonly max: string; readonly unit: string | null; readonly goalAt: number | null; readonly goal: number | null } | null {
  const b = bandsOf(card, model)
  return b === null ? null : { min: fmt(b.axis.min), max: fmt(b.axis.max), unit: b.unit, goalAt: b.goal === null ? null : pctOf(b.axis, b.goal), goal: b.goal }
}

/** The chance row's own value words for the headline's aim ("24%"), else null. Core's text, never formatted here. */
export function chanceWordsOf(card: ViewCard): string | null {
  const value = headlineChanceRow(card)?.value ?? ''
  return value !== '' ? value : null
}

/** The Olumi / person mark (cards/marks.tsx AuthorMark): Olumi's own mark or a person's; core's author words on hover. */
export const AuthorGlyph = ({ card }: { card: ViewCard }): JSX.Element | null => <AuthorMark card={card} simple />

export type SimpleFaceProps = {
  readonly card: ViewCard
  readonly model: ViewModel | null
  /** Olumi's note sits beside this card (core's `next.at`): Olumi's mark in a ring here, the words in the panel. */
  readonly noted: boolean
  /** Core's own label for that step (`next.label`), the mark's name; the fixed name where core sends none. */
  readonly notedWords?: string | null
  /** The card's kind, where the caller has worked it out with the whole View (cards/kind.ts); else read from the model here. */
  readonly kind?: CardKind
  /** The card's own controls that stay (the figure's edit, core's fold badge). */
  readonly extra?: ReactNode
  /** The figure's range bar (v12/scale RangeBar), on a full-width row of its own above the foot: squeezed into the foot it was only as wide as
   *  its labels, which then ran together ("0 months5 months", Paul's 15:00Z test). */
  readonly scale?: ReactNode
  /** The figure tried on a copy (What if), drawn in place of the saved figure with the saved one named beside it (CoreCard). */
  readonly trying?: ReactNode
  /** A full-width row under the foot (what the card rests on, v12/cards/RestsOn): its lines wrap within the card, never run out of it. */
  readonly below?: ReactNode
}

/** The card's state line: core's words, their whole as the hover, and the data marks its readers bind by. */
type StateLine = { readonly text: string; readonly title: string; readonly marks: Readonly<Record<string, string>>; readonly row?: true; /** Core's words wrap whole, never cut by the two-line clamp. */ readonly whole?: true; /** Olumi's mark, before the words, on a line that is Olumi's calculation. */ readonly mark?: ReactNode }

export function SimpleFace({ card, model, noted, notedWords, kind = cardKindOf(card, model), extra, scale, trying, below }: SimpleFaceProps): JSX.Element {
  const conditionalPanel = useId()
  const conditionalButton = useRef<HTMLButtonElement>(null)
  const conditionalPremise = useRef<HTMLParagraphElement>(null)
  const [conditionalOpen, setConditionalOpen] = useState(false)
  useEffect(() => {
    if (!conditionalOpen) return
    const outside = (e: PointerEvent) => {
      if (e.target instanceof Node && !conditionalButton.current?.contains(e.target) && !conditionalPremise.current?.contains(e.target)) setConditionalOpen(false)
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [conditionalOpen])
  let conditionalWords: string | null = null
  const id = card.id
  const at = chanceAtOf(card), words = chanceWordsOf(card), h = card.family === 'option' ? card.headline ?? null : null
  const bands = card.family === 'option' ? [] : bandRowsOf(card, model)
  const axisInfo = card.family === 'option' ? null : bandAxisOf(card, model)
  const held = card.family === 'option' ? [] : withheldValues(card)
  const hasFigure = card.figure != null && card.figure.text !== ''
  const nameOf = (aid: string | null | undefined, own?: string) => own ?? (aid == null ? '' : model?.cards.find((c) => c.id === aid)?.heading ?? '')
  let visual: ReactNode = null
  let state: StateLine | null = null
  let withheldRows: readonly (ViewRow | undefined)[] = []
  if (card.family === 'option') {
    if (h !== null && h.state === 'chance' && at !== null) {
      // The chance: a gauge with core's own words for the number (Codex 006 #3); its qualifier, core's words after the number, is the state line, with Olumi's
      // mark beside the number where the chance rests on Olumi's figures (`rows[].olumi`). No figure is read from the words; none is dropped or reordered.
      const parts = words === null ? null : chanceParts(words), row = headlineChanceRow(card)
      visual = (
        <Hover as="div" focusable={false} className="grid min-w-0 basis-full gap-2" data-simple-face="gauge" words={h.title !== '' ? h.title : h.text}>
          <ChanceBand card={card} />
          <p className={`${typography.viewValue} min-w-0 break-words text-text-header`} data-simple-chance={id}>
            {parts === null ? `${Math.round(at * 100)}%` : parts.head}
            {row?.olumi == null ? null : <span className="ml-1 inline-flex align-middle"><OlumiMark words={row.olumi.title} /></span>}
          </p>
        </Hover>
      )
      if (parts !== null && parts.qualifier !== null) state = { text: parts.qualifier, title: [words, h.title].filter((x) => x != null && x !== '').join('\n'), marks: { 'data-simple-qual': id } }
    } else if (limitLeadOf(card) !== null) {
      // DL 16 Nov: no goal-type aim, but a worked-out result on a limit: that result leads (core's limit name and value), not "No chance…".
      const l = limitLeadOf(card)!
      state = { text: `${nameOf(l.aim_id)} ${l.value}`, title: l.title, marks: { 'data-simple-face': 'limit' } }
    } else if (h !== null && h.state === 'fixed') {
      state = { text: h.text, title: h.title !== '' ? h.title : h.text, marks: { 'data-simple-face': 'fixed' } }
    } else if (h !== null && sharedNoChanceOf(model, h.aim_id) === null) {
      // R6 (16 Nov): an option with no chance is ONE quiet line, core's own words for what is missing (words.ts noChanceLineOf); the long reason is the hover.
      // Where every option waits for one shared reason, the aim card says it once and the options say nothing (words.ts sharedNoChanceOf).
      // Each option's own `add` line is whole, never clamped. (A waits item every option shares is core's to say once: it sends it on none of them.)
      const { line, hover } = noChanceLineOf(h)
      const tip = tipsLineOf(card, h), key = model === null ? null : olumiKey(model)
      if (h.state === 'none') withheldRows = [card.rows[tip?.i ?? headlineWithheldRowIndex(card)]]
      if (tip?.conditional) conditionalWords = tip.whole
      state = tip === null
        ? { text: line, title: hover, marks: { 'data-simple-face': 'no-chance', 'data-simple-state': id }, ...(h.add != null && h.add !== '' ? { whole: true as const } : {}) }
        // CP-3: core's break-even, short (`tips_face`), replaces the next-step line; the whole sentence joins the hover. A what-if says so in its own words
        // ("What-if: …", S2 01:3xZ); `tips_label` only marks it (data-simple-tips-whatif), never a second line.
        // CP-3 full-width (DL 21 Nov): the threshold and unit must fit two lines at 1.33.
        : { text: tip.face, title: tip.whole !== '' && !hover.includes(tip.whole) ? `${hover}\n${tip.whole}` : hover, row: true,
            marks: { 'data-simple-face': 'tips', 'data-view': `${id}.rows.${tip.i}.tips_face`, ...(tip.label === null ? {} : { 'data-simple-tips-whatif': id }), ...(tip.conditional ? { 'data-simple-tips-conditional': id } : {}) },
            mark: <>{key === null ? null : <span className="mr-1 inline-flex align-middle"><OlumiMark words={key.text} /></span>}{tip.conditional ? (
              <button ref={conditionalButton} type="button" className={`ok-dt-badge nodrag nopan mr-1.5 h-6 align-middle ${colourClass(ICONS['conditional-tag'].colour)}`}
                aria-expanded={conditionalOpen} aria-controls={conditionalPanel} aria-describedby={conditionalOpen ? conditionalPanel : undefined}
                onFocus={(e) => e.stopPropagation()}
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setConditionalOpen(false) }}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key !== 'Escape' || e.target !== e.currentTarget || !conditionalOpen) return
                  e.preventDefault()
                  setConditionalOpen(false)
                  e.currentTarget.focus()
                }}
                onClick={(e) => { e.stopPropagation(); setConditionalOpen((open) => !open); e.currentTarget.focus() }}>
                <OkIcon id="conditional-tag" size={14} />{ICONS['conditional-tag'].hover}
              </button>
            ) : null}</> }
    }
  } else if (bands.length > 0 || held.length > 0) {
    const letters = optionLetters(model), headingOf = (option: string) => model?.cards.find((c) => c.id === option)?.heading ?? ''
    visual = (
      // ONE visual: each option's band is a thin bar of its own, stacked (up to 4, 4 px each) on the one shared axis; the letters and words are the hover.
      // The options core could not calculate are named by their letters after the bars (R6: no dashed track), core's reason the state line.
      <Hover as="div" focusable={false} className="grid min-w-0 basis-full gap-2" data-simple-face="range" words={bands.length === 0 ? undefined : bands.map((b) => `${b.letter} ${b.heading} · ${b.text}`).join('\n')}>
        {bands.length === 0 ? null : (
          <div className="relative grid gap-px" data-simple-axis={id}>
            {axisInfo?.goalAt == null ? null : <i className="pointer-events-none absolute -top-[2px] -bottom-[2px] block w-0 border-l-2 ok-simple-goal-tick" style={{ '--chart-x': `${axisInfo.goalAt}%` } as CSSProperties} data-testid="simple-goal-tick" data-at={axisInfo.goal ?? undefined} />}
        {bands.slice(0, 4).map((b) => (
          <Hover as="div" focusable={false} key={b.option} words={`${b.heading} · ${b.text}`} className="flex items-center" data-simple-band={b.option}>
            <span className="relative block h-[4px] flex-1 rounded-full ok-simple-track" role="img" aria-label={`${b.heading} · ${b.text}`}>
              {b.hi > b.lo ? <i className={`absolute top-0 block h-full rounded-full ok-simple-band${b.olumi ? ' ok-simple-band-olumi' : ''}`} style={{ '--chart-x': `${b.lo}%`, '--chart-width': `${b.hi - b.lo}%` } as CSSProperties} data-band-from={b.lo.toFixed(1)} data-band-to={b.hi.toFixed(1)} /> : null}
              {b.mid === null ? null : <i className="absolute -top-[1px] block h-[6px] w-[2px] rounded-sm bg-text-header ok-simple-mid" style={{ '--chart-x': `${b.mid}%` } as CSSProperties} />}
            </span>
          </Hover>
        ))}
          </div>
        )}
        {axisInfo === null || bands.length === 0 ? null : (
          <div className={`${typography.viewLabel} flex justify-between gap-2 whitespace-nowrap text-text-light`} data-testid="simple-axis-ends">
            <span data-testid="simple-axis-min">{axisInfo.min}</span>
            <span data-testid="simple-axis-max">{axisInfo.max}{axisInfo.unit === null ? '' : ` ${axisInfo.unit}`}</span>
          </div>
        )}
        {held.length === 0 ? null : (
          <Hover as="div" focusable={false} className="ok-withheld-row" data-simple-withheld-group={id} words={held.map((w) => [headingOf(w.option), w.text].filter((x) => x !== '').join(' · ')).join('\n')}>
            {held.map((w) => (
              <Hover focusable={false} key={w.option} words={[headingOf(w.option), w.text].filter((x) => x !== '').join(' · ')} data-simple-withheld={w.option}>
                {letters.has(w.option) ? <LetterChip letter={letters.get(w.option)!} words={headingOf(w.option)} /> : null}
              </Hover>
            ))}
          </Hover>
        )}
      </Hover>
    )
    if (held.length > 0) state = { text: held[0]!.text, title: held.map((w) => [headingOf(w.option), w.text].filter((x) => x !== '').join(' · ')).join('\n'), marks: { 'data-simple-withheld-why': held[0]!.option } }
  } else if (card.bound != null) {
    const olumi = card.bound.olumi != null
    // The aim's bar (core's `bar_of`, layout.ts barsOf) has no card of its own on this face: the bound is its place, and the author mark beside it is the bar figure's
    // (core's author words), not the aim's own.
    // One source: the bar is the card layout.ts barsOf names for this aim; its editor and its author mark are that card's. Where core names no bar, the
    // aim's target line (targets.ts) is the editor and the mark is bound.olumi's. The mark is decided on data (whoseOf), never on an element existing.
    const bar = model === null ? null : barCardOf(model, id)
    const target = model === null || model.edit_base === null ? null : bar !== null ? (bar.figure?.edit != null ? bar : null) : targetCardOf(model, card)
    const mark = bar !== null && whoseOf(bar) !== null ? <AuthorGlyph card={bar} /> : olumi ? <OlumiMark words={card.bound.olumi!.title} /> : null
    const bound = <span className="min-w-0 break-words text-text-header">{card.bound.text}</span>
    const quietBound = <span className="min-w-0 break-words">{card.bound.text}</span>
    const question = waitingMeasureQuestion(card, model)
    visual = (
      // The aim's mark is the diamond before its name (the look's); here its bound, core's words, as a quiet outlined pill.
      // A bound core has not measured (`bound.measured` false: "not checked yet: nothing in the model is counted against it") is the card's state, so it is its quiet
      // meta line, no border and no heading type (Paul, url3-2: two identical large pills); a measured bound keeps the outlined pill.
      card.bound.measured ? (
        <Hover focusable={false} as="p" words={card.bound.title !== '' ? card.bound.title : card.bound.text} className={`${typography.viewValue} ok-tone-goal flex min-w-0 basis-full items-center gap-1`} data-simple-face="target">
          <span className="ok-pill ok-bound min-w-0">
            {target === null ? bound : <FigureEdit id={target.id} edit={target.figure!.edit ?? null} place="view-aim" opener={bound} />}
            {mark}
          </span>
        </Hover>
      ) : question !== null ? (
        <div className="ok-quiet flex min-w-0 basis-full items-center gap-1" data-simple-face="target" data-simple-bound-state={id}>
          <GoalMeasureLine question={question} className="ok-quiet min-w-0 flex-1 break-words" />
          {mark}
        </div>
      ) : (
        <Hover focusable={false} as="p" words={card.bound.title !== '' ? card.bound.title : card.bound.text} className="ok-quiet flex min-w-0 basis-full items-center gap-1" data-simple-face="target" data-simple-bound-state={id}>
          {target === null ? quietBound : <FigureEdit id={target.id} edit={target.figure!.edit ?? null} place="view-aim" opener={quietBound} />}
          {mark}
        </Hover>
      )
    )
  } else if (card.figure?.state === 'waits') {
    // Canvas rule 5, pending, quiet (R6): a calculated figure that waits on an input says so in core's own "waits on …" words; what it waits on (core's
    // `needs`, fields.ts needsOf) is the hover, one per line, after core's title.
    const needs = needsOf(card).needs.map((n) => n.label)
    if (card.figure.text !== '') state = { text: card.figure.text, title: [card.figure.title !== '' ? card.figure.title : card.figure.text, ...needs].join('\n'), marks: { 'data-simple-face': 'pending', 'data-simple-pending': id } }
  } else if (figureRange(card) !== null && scale != null) {
    // A figure with a range: core's own words for the figure first, at rest (UI reviewer #27, 17 Nov: testers read the axis end "50,000 GBP" as a £30,000
    // limit), coloured by whose it is as the plain figure line is; the range bar under it, its end labels the axis only. Nothing is worked out here.
    const estimate = card.olumi !== null && card.author?.by !== 'olumi', words = card.figure?.text ?? ''
    visual = (
      <Hover focusable={false} words={card.figure?.title || words || undefined} className="flex min-w-0 basis-full flex-col gap-1" data-simple-scale={id}>
        {words === '' ? null : <p className={`${FIGURE} ${card.author?.by === 'olumi' || estimate ? 'ok-tone-info' : 'ok-tone-ink'} min-w-0 break-words`} data-simple-figure-text={id}>{words}</p>}
        {scale}
      </Hover>
    )
  } else if (hasFigure) {
    const estimate = card.olumi !== null && card.author?.by !== 'olumi'
    visual = <Hover focusable={false} as="p" words={card.figure!.title !== '' ? card.figure!.title : card.figure!.text} className={`${FIGURE} ${card.author?.by === 'olumi' || estimate ? 'ok-tone-info' : 'ok-tone-ink'} min-w-0 basis-full break-words`} data-simple-face="figure">{card.figure!.text}</Hover>
  } else if (card.figure != null) {
    // An input not sized yet: core's own words for the gap ("not sized yet · …"), once (words.ts onceWords), whole on hover (R6). No empty track.
    const gap = unsizedWords(card)
    if (gap !== null) state = { text: onceWords(gap), title: gap, marks: { 'data-simple-face': 'no-figure', 'data-unsized': id, 'data-unsized-words': id } }
  }
  // The reason every option shares for having no chance on this aim, once, here (words.ts sharedNoChanceOf); the aim's own state stays in the hover.
  const once = card.family === 'option' ? null : sharedNoChanceOf(model, id)
  if (once !== null) withheldRows = model!.cards
    .filter((c) => c.family === 'option' && c.headline?.aim_id === id)
    .map((c) => c.rows[headlineWithheldRowIndex(c)])
  if (once !== null) state = { text: once.text, title: [noChanceLineOf(once).hover, state?.text].filter((x) => x != null && x !== '').join('\n'), marks: { 'data-simple-face': 'no-chance', 'data-simple-no-chance-once': id } }
  // Codex 006 (what-if): Simple drew only the SAVED figure while a different one was being tried, so the card and the what-if disagreed with
  // nothing to say why. While a figure is tried, its card says so in place, and names the saved figure beside it.
  if (trying !== undefined && card.family !== 'option') visual = <div className="min-w-0 basis-full">{trying}</div>
  // The card's own result or state is the one quiet line (a chance's condition, what a figure waits on, a withheld reason, the shared no-chance line): it is
  // never moved to the hover. Core's description is the line only where the card has no state to say, and is added to the hover where it has (Codex root, 1b9).
  // Said once (18 Nov audit canvas-goal-said-three-times): a description that is, string for string, the card's own heading, its figure or its bound is
  // that same text said again, so it is no line. Identity only, never a fuzzy match: a different wording (core's quote of the brief) is kept.
  const said = [card.heading, card.face?.title?.text, card.figure?.text, card.bound?.text].filter((x): x is string => x != null && x.trim() !== '').map((x) => x.trim())
  const described = cardTitle(card).description
  // (And a bare number that is the card's typed figure value, `isFigureNumber`: Paul 19 Nov, "12 weeks" over "12".)
  // A source quote is never a line at rest (say3, Paul 18 Nov, "the aim said three times"; investor audit #5, 20 Nov: quotes cut mid-word on every card at 1232):
  // where core's description is the person's own words that core also serves, quoted whole, in `author.title` ("You said: “…”"), it is that same text in core's
  // own field, matched whole, never by its words. The quote stays one hover away on the author's mark. Olumi's own description (not quoted there) is kept.
  const quoted = described !== null && typeof card.author?.title === 'string' && card.author.title.includes(`\u201c${described.trim()}\u201d`)
  const description = described !== null && (said.includes(described.trim()) || isFigureNumber(card, described) || quoted) ? null : described
  const quiet: StateLine | null = state !== null
    ? (description === null ? state : { ...state, title: [state.title !== '' ? state.title : state.text, description].join('\n') })
    : description === null ? null : { text: description, title: description, marks: { 'data-simple-description': id } }
  // An option's other aims' gauges and its limits, the card's hover (the visual shows the headline's aim only): each result's name and short value, then core's
  // whole sentence for it (`title`) where core sends one, so a condition the sentence carries (a result that uses an approximate figure as given, 17 Nov) is
  // reachable here and not only the short value.
  const more = card.family !== 'option' ? [] : card.rows.filter((r) => (r.aim_id == null ? h === null : h === null || r.aim_id !== h.aim_id))
    .map((r) => {
      const row = r as { kind: string; aim_id?: string | null; aim?: string; value?: string; text?: string; state_text?: string; title?: string }
      const short = `${nameOf(row.aim_id, row.aim)} ${row.kind === 'none' ? row.state_text ?? row.text ?? '' : row.value ?? ''}`.trim()
      return [short, row.title != null && row.title !== '' && row.title !== short ? row.title : null].filter((x) => x != null && x !== '').join('\n')
    })
    .filter((t) => t !== '')
  // The card's other results, one per line, on the one Tip (150 ms, keyboard focus too): the card holds a stop only where there are words to reach.
  const moreTip = useAnchoredTip(more.length === 0 ? undefined : more.join('\n'))
  const blockerIds = isOlumiCoreLane() ? withheldCardIds(model, withheldRows) : []
  const ring = useWithheldRing(blockerIds)
  const moreHandlers = blockerIds.length === 0 ? moreTip.handlers : {
    ...moreTip.handlers,
    onFocus: (e: Parameters<typeof ring.focus.onFocus>[0]) => { moreTip.handlers.onFocus(e); ring.focus.onFocus(e) },
    onBlur: (e: Parameters<typeof ring.focus.onBlur>[0]) => { moreTip.handlers.onBlur(); ring.focus.onBlur(e) },
  }
  // A card core no longer holds as live (`status`, e.g. "ruled out") is marked for the look: its name draws in the light ink (olumiLook.css).
  return (
    <>
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2" data-simple-card={id} data-simple-set-aside={card.status != null && card.status !== '' ? '' : undefined} data-simple-more={more.length === 0 ? undefined : more.length}
      {...(more.length === 0 ? {} : { tabIndex: 0, 'aria-describedby': moreTip.describedBy, ...moreHandlers })}>
      {visual}
      {/* DL BUILD 3 (1232): the status never narrows to single letters beside the foot's chips; under 7rem left on its line, it takes the line
          and the chips drop below (QUIET_BASIS). */}
      {quiet === null ? null : <Hover as="p" focusable={false} className={`ok-quiet min-w-0 ${quiet.row === true ? 'basis-full' : QUIET_BASIS}${quiet.whole === true ? '' : ' ok-two-lines'}`} words={conditionalOpen ? undefined : quiet.title} {...quiet.marks} {...(blockerIds.length === 0 ? {} : ring.pointer)}>{quiet.mark}{quiet.text}</Hover>}
      {!conditionalOpen || conditionalWords === null ? null : (
        <p ref={conditionalPremise} id={conditionalPanel} className="ok-quiet min-w-0 basis-full whitespace-pre-wrap">{conditionalWords}</p>
      )}
      {/* THE FOOT, one order on both faces (C1, 20 Nov): the state marks (the kind's own icon, then core's marks with the "+N" overflow, the change, Olumi's
          question), then the count badges and the rest of `extra`, then whose it is LAST. */}
      <div className="ml-auto flex flex-none items-center gap-2" data-simple-foot={id}>
        {card.family === 'option' && isBaseline(card) ? <BaselinePill id={id} /> : null}
        {kind.shape === 'assumption' ? <KindTag id={id} model={model} /> : null}
        {card.family === 'condition' ? <ConditionTag id={id} /> : null}
        {kind.shape === 'aim' && cardKind(card, model).aim === 'limit' ? <LimitTag id={id} model={model} /> : null}
        {/* The card's state marks, capped (cards/marks.tsx): an option's corner driver badge takes one of the three places. */}
        <CardMarks card={card} taken={card.driver != null ? 1 : 0} />
        {/* An added card's "+" repeats its proposed frame: shown only for a change the frame does not say (16 Nov, Paul: less noise). */}
        {card.change == null || card.change.kind === 'added' ? null : <ChangeGlyph card={card} />}
        {noted ? <OlumiAsksMark id={id} words={notedWords} /> : null}
        {extra}
        <AuthorGlyph card={card} />
      </div>
      {below == null ? null : <div className="min-w-0 basis-full" data-simple-below={id}>{below}</div>}
    </div>
    {moreTip.tip}
    </>
  )
}
