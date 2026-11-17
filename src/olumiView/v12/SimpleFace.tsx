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
import type { ReactNode } from 'react'
import type { ViewCard, ViewModel } from '../client'
import { typography } from '../../styles/typography'
import { chanceAtOf } from '../resultRange'
import { ChanceBand } from '../ResultBand'
import { FigureEdit } from '../FigureEdit'
import { targetCardOf } from '../model/targets'
import { figureRange, isBaseline, limitLeadOf, withheldValues } from './contract'
import { cardKindOf, type CardKind } from './cards/kind'
import { optionLetters } from './cards/letters'
import { AuthorMark, BaselinePill, KindTag, LetterChip, OlumiAsksMark, OlumiMark } from './cards/marks'
import { chanceParts, headlineChanceRow, noChanceLineOf, onceWords, sharedNoChanceOf, unsizedWords } from './cards/words'
import { cardTitle, needsOf } from './fields/fields'

/** Olumi's blue, the person's ink, the goal's colour and the challenge colour: the board's own tokens. */
/** Type on a compact card, by DS role: 14 for figures and reading text, 12 for state words (typography tokens). */
const SMALL = typography.viewValue
const BLUE = 'var(--semantic-info)', INK = 'var(--text-header)', GOAL = 'var(--edge-positive)', ORANGE = 'var(--olumi-mark-orange)'

export type BandRow = { readonly option: string; readonly letter: string; readonly heading: string; readonly lo: number; readonly mid: number | null; readonly hi: number; readonly text: string; readonly olumi: boolean }

/** The option letters (A, B, ...) in the model's order (cards/letters.ts): a short name for a row, its heading on hover. */
export const optionLetterOf = (model: ViewModel | null, id: string): string => optionLetters(model).get(id) ?? '·'

/**
 * The positions (0..100) of each option's modelled band on ONE axis shared by the card's rows, from the served p10 / p50 / p90. A band the
 * axis cannot place (a non-finite number, or all rows the same point) is drawn as a point in the middle: never a made-up width. An option
 * core withheld has no band: it is drawn as its own dashed row, with core's reason.
 */
export function bandRowsOf(card: ViewCard, model: ViewModel | null): readonly BandRow[] {
  const held = new Set(withheldValues(card).map((w) => w.option))
  const values = (card.values ?? []).filter((v) => !held.has(v.option) && Number.isFinite(v.p10) && Number.isFinite(v.p90))
  if (values.length === 0) return []
  const min = Math.min(...values.map((v) => Math.min(v.p10, v.p50 ?? v.p10))), max = Math.max(...values.map((v) => Math.max(v.p90, v.p50 ?? v.p90)))
  const span = max - min
  const at = (n: number): number => (span > 0 ? ((n - min) / span) * 100 : 50)
  return values.map((v) => ({
    option: v.option, letter: optionLetterOf(model, v.option), heading: model?.cards.find((c) => c.id === v.option)?.heading ?? '',
    lo: at(Math.min(v.p10, v.p90)), mid: v.p50 === null ? null : at(v.p50), hi: at(Math.max(v.p10, v.p90)), text: v.text, olumi: v.olumi,
  }))
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
type StateLine = { readonly text: string; readonly title: string; readonly marks: Readonly<Record<string, string>> }

export function SimpleFace({ card, model, noted, notedWords, kind = cardKindOf(card, model), extra, scale, trying, below }: SimpleFaceProps): JSX.Element {
  const id = card.id
  const at = chanceAtOf(card), words = chanceWordsOf(card), h = card.family === 'option' ? card.headline ?? null : null
  const bands = card.family === 'option' ? [] : bandRowsOf(card, model)
  const held = card.family === 'option' ? [] : withheldValues(card)
  const hasFigure = card.figure != null && card.figure.text !== ''
  const nameOf = (aid: string | null | undefined, own?: string) => own ?? (aid == null ? '' : model?.cards.find((c) => c.id === aid)?.heading ?? '')
  let visual: ReactNode = null
  let state: StateLine | null = null
  if (card.family === 'option') {
    if (h !== null && h.state === 'chance' && at !== null) {
      // The chance: a gauge with core's own words for the number (Codex 006 #3); its qualifier, core's words after the number, is the state line, with Olumi's
      // mark beside the number where the chance rests on Olumi's figures (`rows[].olumi`). No figure is read from the words; none is dropped or reordered.
      const parts = words === null ? null : chanceParts(words), row = headlineChanceRow(card)
      visual = (
        <div className="min-w-0 basis-full" data-simple-face="gauge" title={h.title !== '' ? h.title : h.text}>
          <ChanceBand card={card} />
          <p className={`${SMALL} mt-1 min-w-0 break-words font-medium tabular-nums text-text-header`} data-simple-chance={id}>
            {parts === null ? `${Math.round(at * 100)}%` : parts.head}
            {row?.olumi == null ? null : <span className="ml-1 inline-flex align-middle"><OlumiMark words={row.olumi.title} size={12} /></span>}
          </p>
        </div>
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
      const { line, hover } = noChanceLineOf(h)
      state = { text: line, title: hover, marks: { 'data-simple-face': 'no-chance', 'data-simple-state': id } }
    }
  } else if (bands.length > 0 || held.length > 0) {
    const letters = optionLetters(model), headingOf = (option: string) => model?.cards.find((c) => c.id === option)?.heading ?? ''
    visual = (
      // ONE visual: each option's band is a thin bar of its own, stacked (up to 4, 4 px each) on the one shared axis; the letters and words are the hover.
      // The options core could not calculate are named by their letters after the bars (R6: no dashed track), core's reason the state line.
      <div className="grid min-w-0 basis-full gap-px" data-simple-face="range" title={bands.length === 0 ? undefined : bands.map((b) => `${b.letter} ${b.heading} · ${b.text}`).join('\n')}>
        {bands.slice(0, 4).map((b) => (
          <div key={b.option} title={`${b.heading} · ${b.text}`} className="flex items-center" data-simple-band={b.option}>
            <span className="relative block h-[4px] flex-1 rounded-full" style={{ background: 'var(--border-default)' }} role="img" aria-label={`${b.heading} · ${b.text}`}>
              {b.hi > b.lo ? <i className="absolute top-0 block h-full rounded-full" style={{ left: `${b.lo}%`, width: `${b.hi - b.lo}%`, background: `color-mix(in srgb, ${b.olumi ? BLUE : INK} 75%, transparent)` }} data-band-from={b.lo.toFixed(1)} data-band-to={b.hi.toFixed(1)} /> : null}
              {b.mid === null ? null : <i className="absolute -top-[1px] block h-[6px] w-[2px] rounded-sm" style={{ left: `${b.mid}%`, background: INK }} />}
            </span>
          </div>
        ))}
        {held.length === 0 ? null : (
          <div className="ok-withheld-row" data-simple-withheld-group={id} title={held.map((w) => [headingOf(w.option), w.text].filter((x) => x !== '').join(' · ')).join('\n')}>
            {held.map((w) => (
              <span key={w.option} title={[headingOf(w.option), w.text].filter((x) => x !== '').join(' · ')} data-simple-withheld={w.option}>
                {letters.has(w.option) ? <LetterChip letter={letters.get(w.option)!} words={headingOf(w.option)} /> : null}
              </span>
            ))}
          </div>
        )}
      </div>
    )
    if (held.length > 0) state = { text: held[0]!.text, title: held.map((w) => [headingOf(w.option), w.text].filter((x) => x !== '').join(' · ')).join('\n'), marks: { 'data-simple-withheld-why': held[0]!.option } }
  } else if (card.bound != null) {
    const olumi = card.bound.olumi != null
    // The aim's question opens its target figure's own editor, as the Detailed face does (core's `target`, targets.ts); none where core offers none.
    const target = model === null || model.edit_base === null ? null : targetCardOf(model, card)
    const bound = <span className="min-w-0 break-words text-text-header">{card.bound.text}</span>
    visual = (
      // The aim's mark is the diamond before its name (the look's); here its bound, core's words, as a quiet outlined pill.
      <p className={`${SMALL} flex min-w-0 basis-full items-center gap-1`} data-simple-face="target" title={card.bound.title !== '' ? card.bound.title : card.bound.text} style={{ color: card.bound.measured ? GOAL : undefined }}>
        <span className="ok-pill ok-bound min-w-0">
          {target === null ? bound : <FigureEdit id={target.id} edit={target.figure!.edit ?? null} place="view-aim" opener={bound} />}
          {olumi ? <OlumiMark words={card.bound.olumi!.title} size={12} /> : null}
        </span>
      </p>
    )
  } else if (card.figure?.state === 'waits') {
    // Canvas rule 5, pending, quiet (R6): a calculated figure that waits on an input says so in core's own "waits on …" words; what it waits on (core's
    // `needs`, fields.ts needsOf) is the hover, one per line, after core's title.
    const needs = needsOf(card).needs.map((n) => n.label)
    if (card.figure.text !== '') state = { text: card.figure.text, title: [card.figure.title !== '' ? card.figure.title : card.figure.text, ...needs].join('\n'), marks: { 'data-simple-face': 'pending', 'data-simple-pending': id } }
  } else if (figureRange(card) !== null && scale != null) {
    // A figure with a range: the range bar is its one visual (its ends labelled, its unit); core's words for the figure are the hover.
    visual = <div className="min-w-0 basis-full" data-simple-scale={id} title={card.figure?.title || card.figure?.text || undefined}>{scale}</div>
  } else if (hasFigure) {
    const estimate = card.olumi !== null && card.author?.by !== 'olumi'
    visual = <p className={`${typography.viewValue} min-w-0 basis-full break-words`} data-simple-face="figure" title={card.figure!.title !== '' ? card.figure!.title : card.figure!.text} style={{ color: card.author?.by === 'olumi' || estimate ? BLUE : INK }}>{card.figure!.text}</p>
  } else if (card.figure != null) {
    // An input not sized yet: core's own words for the gap ("not sized yet · …"), once (words.ts onceWords), whole on hover (R6). No empty track.
    const gap = unsizedWords(card)
    if (gap !== null) state = { text: onceWords(gap), title: gap, marks: { 'data-simple-face': 'no-figure', 'data-unsized': id, 'data-unsized-words': id } }
  }
  // The reason every option shares for having no chance on this aim, once, here (words.ts sharedNoChanceOf); the aim's own state stays in the hover.
  const once = card.family === 'option' ? null : sharedNoChanceOf(model, id)
  if (once !== null) state = { text: once.text, title: [noChanceLineOf(once).hover, state?.text].filter((x) => x != null && x !== '').join('\n'), marks: { 'data-simple-face': 'no-chance', 'data-simple-no-chance-once': id } }
  // Codex 006 (what-if): Simple drew only the SAVED figure while a different one was being tried, so the card and the what-if disagreed with
  // nothing to say why. While a figure is tried, its card says so in place, and names the saved figure beside it.
  if (trying !== undefined && card.family !== 'option') visual = <div className="min-w-0 basis-full">{trying}</div>
  // The card's own result or state is the one quiet line (a chance's condition, what a figure waits on, a withheld reason, the shared no-chance line): it is
  // never moved to the hover. Core's description is the line only where the card has no state to say, and is added to the hover where it has (Codex root, 1b9).
  const description = cardTitle(card).description
  const quiet: StateLine | null = state !== null
    ? (description === null ? state : { ...state, title: [state.title !== '' ? state.title : state.text, description].join('\n') })
    : description === null ? null : { text: description, title: description, marks: { 'data-simple-description': id } }
  // An option's other aims' gauges and its limits: one line each in core's own words, the card's hover (the visual shows the headline's aim only).
  const more = card.family !== 'option' ? [] : card.rows.filter((r) => (r.aim_id == null ? h === null : h === null || r.aim_id !== h.aim_id))
    .map((r) => { const row = r as { kind: string; aim_id?: string | null; aim?: string; value?: string; text?: string; state_text?: string }; return `${nameOf(row.aim_id, row.aim)} ${row.kind === 'none' ? row.state_text ?? row.text ?? '' : row.value ?? ''}`.trim() })
    .filter((t) => t !== '')
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1" data-simple-card={id} data-simple-more={more.length === 0 ? undefined : more.length} title={more.length === 0 ? undefined : more.join('\n')}>
      {visual}
      {kind.shape === 'assumption' ? <KindTag id={id} tag="assumption" /> : null}
      {quiet === null ? null : <p className="ok-quiet ok-one-line min-w-0 flex-1" title={quiet.title} {...quiet.marks}>{quiet.text}</p>}
      <div className="ml-auto flex flex-none items-center gap-1.5" data-simple-foot={id}>
        {card.family === 'option' && isBaseline(card) ? <BaselinePill id={id} /> : null}
        <AuthorGlyph card={card} />
        {card.challenged ? <span role="img" aria-label="Challenged" title="Challenged" className="h-2 w-2 flex-none rounded-full" style={{ background: ORANGE }} data-simple-challenged={id} /> : null}
        {/* An added card's "+" repeats its proposed frame: shown only for a change the frame does not say (16 Nov, Paul: less noise). */}
        {card.change == null || card.change.kind === 'added' ? null : <span role="img" aria-label={card.change.title} title={card.change.title} className="text-info" data-view={`${id}.change.glyph`}>{card.change.glyph}</span>}
        {noted ? <OlumiAsksMark id={id} words={notedWords} /> : null}
        <span className="ml-auto flex items-center gap-1 empty:hidden">{extra}</span>
      </div>
      {below == null ? null : <div className="min-w-0 basis-full" data-simple-below={id}>{below}</div>}
    </div>
  )
}
