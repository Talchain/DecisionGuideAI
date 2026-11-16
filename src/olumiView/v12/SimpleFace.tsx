/**
 * V12 Simple level: a card drawn as visuals, with the words behind hover (Paul, 16 Nov: "the graph should be visualisations, icons, graphs,
 * colour systems"; coaching text belongs in the AI panel). Every card and link stays; only the sentences go. Nothing here is worked out:
 *  - an option's chance is a gauge bar with core's own value text (`rows[chance].value`) and its position (`rows[chance].chance`); core's
 *    words after the number are the qualifier, on their own line, with Olumi's mark where the chance rests on Olumi's figures;
 *  - a withheld chance is "?" and a dashed, empty track with core's real reason under it (canvas rule 4), whole on hover;
 *  - a figure with a modelled band (`values[]`: p10 / p50 / p90) is a range bar per option on one shared axis, positions only; an option
 *    core could not calculate (contract.ts withheldValues) is a dashed row with core's reason;
 *  - a figure with a stated value shows core's words, one line; one that waits or has no value is a dashed, empty bar with core's words;
 *  - an aim or limit shows its bound (core's words, one line), in the goal's colour where it is measured;
 *  - authorship is a mark (Olumi's, or a person's), the words on hover; Olumi's question is its mark in a ring on its card.
 * The marks and shapes are v12/cards (marks.tsx, kind.ts); the card's own outline by kind is the look's (look/olumiLook.css).
 */
import type { ReactNode } from 'react'
import type { ViewCard, ViewModel } from '../client'
import { typography } from '../../styles/typography'
import { chanceAtOf } from '../resultRange'
import { ChanceBand } from '../ResultBand'
import { FigureEdit } from '../FigureEdit'
import { targetCardOf } from '../model/targets'
import { isBaseline, withheldValues } from './contract'
import { cardKindOf, type CardKind } from './cards/kind'
import { optionLetters } from './cards/letters'
import { AuthorMark, BaselinePill, EmptyTrack, KindTag, LetterChip, OlumiAsksMark, OlumiMark, UnsizedFigure, WithheldChance } from './cards/marks'
import { chanceParts, headlineChanceRow, unsizedWords, withheldField, withheldWords } from './cards/words'

/** Olumi's blue, the person's ink, the goal's colour and the challenge colour: the board's own tokens. */
/** Type on a compact card, by DS role: 14 for figures and reading text, 12 for state words (typography tokens). */
const SMALL = typography.viewValue, SMALL_META = typography.viewLabel
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

type RowLike = { kind: 'chance' | 'limit' | 'none'; aim_id?: string | null; aim?: string; value?: string; chance?: number | null; title?: string; text?: string; state_text?: string }

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
  /** A withheld chance's "Why not" press (CoreCard `WithheldWords`), so Simple never shows the bare "No chance yet" where core gives a reason. */
  readonly withheld?: ReactNode
  /** The figure tried on a copy (What if), drawn in place of the saved figure with the saved one named beside it (CoreCard). */
  readonly trying?: ReactNode
}

export function SimpleFace({ card, model, noted, notedWords, kind = cardKindOf(card, model), extra, withheld, trying }: SimpleFaceProps): JSX.Element {
  const id = card.id
  const at = chanceAtOf(card), words = chanceWordsOf(card), h = card.family === 'option' ? card.headline ?? null : null
  const bands = card.family === 'option' ? [] : bandRowsOf(card, model)
  const held = card.family === 'option' ? [] : withheldValues(card)
  const hasFigure = card.figure != null && card.figure.text !== ''
  const aim = card.bound != null
  let body: ReactNode = null
  if (card.family === 'option') {
    // Every chance row of the option, one compact gauge per aim (the headline's first, as the Detailed face leads with it), then its limits:
    // structure is never dropped, only the sentences. A withheld or odd state shows core's own state words, core's reason on hover.
    const headAim = h === null ? null : h.aim_id
    const rest = card.rows.map((r, i) => ({ r: r as RowLike, i })).filter(({ r }) => r.aim_id == null ? h === null : r.aim_id !== headAim || h === null)
    const nameOf = (aid: string | null | undefined, own?: string) => own ?? (aid == null ? '' : model?.cards.find((c) => c.id === aid)?.heading ?? '')
    const lead = h === null ? null : h.state === 'chance' && at !== null ? (() => {
      // Codex 006 #3: core's value words can be a qualified sentence ("about 31% chance, on Olumi's assumption for '…'"). The track takes the
      // card's width; under it core's words, verbatim: the number's own words, then core's qualifier on its own line (V12: "in this model,
      // on … timing"), with Olumi's mark where the chance rests on Olumi's figures (`rows[].olumi`). Two lines at most; the whole basis is
      // the hover. No figure is read from the words, and none of them is dropped or reordered (the ", " between the parts is kept, unseen).
      const parts = words === null ? null : chanceParts(words), row = headlineChanceRow(card)
      const mark = row?.olumi == null ? null : <OlumiMark words={row.olumi.title} size={12} />
      return (
        <div className="min-w-0" data-simple-face="gauge" title={h.title !== '' ? h.title : h.text}>
          <ChanceBand card={card} />
          <p className={`${SMALL} mt-1 line-clamp-2 min-w-0 break-words font-medium tabular-nums text-text-header`} data-simple-chance={id}>
            {parts === null ? `${Math.round(at * 100)}%` : parts.head}
            {parts === null || parts.qualifier === null ? (mark === null ? null : <span className="ml-1 inline-flex align-middle">{mark}</span>) : <>
              <span className="sr-only">, </span>
              <span className="ok-simple-qual block" data-simple-qual={id}>{mark}{parts.qualifier}</span>
            </>}
          </p>
        </div>
      )
    })() : h.state === 'fixed' ? (
      <p className={`${SMALL} line-clamp-2 text-text-body`} data-simple-face="fixed" title={h.title !== '' ? h.title : h.text}>{h.text}</p>
    ) : h.state === 'none' ? (() => {
      // Canvas rule 4: a withheld chance is "?" and a dashed, empty track, with core's real reason at rest under it (two lines, whole on
      // hover, with core's own next step for it); "Why not" stays for the long form. Where core sends no reason, its own state words.
      const reason = withheldField(h) === 'text' ? null : withheldWords(h)
      const press = reason === null ? undefined : withheld === undefined ? undefined : <span className="flex-none" data-simple-state={id}>{withheld}</span>
      return (
        <div className="min-w-0" data-simple-face="no-chance" title={[reason ?? h.text, h.add].filter((x) => x != null && x !== '').join('\n')}>
          <WithheldChance id={id} state={h.text} reason={reason} press={press} />
          {reason !== null ? null : <span className={`${SMALL_META} block text-text-light`} data-simple-state={id}>{withheld ?? h.text}</span>}
        </div>
      )
    })() : (
      // A chance the card cannot place on the track: core's own words in full, one short line, and a small dashed bar beside it.
      <div className="flex items-center gap-2" data-simple-face="no-chance" title={h.title !== '' ? h.title : h.text}>
        <span className={`${SMALL_META} flex-none whitespace-nowrap text-text-light`} data-simple-state={id}>{h.text}</span>
        <span className="w-8 flex-none"><EmptyTrack testid={`${id}-empty-bar`} /></span>
      </div>
    )
    // ONE visual row (compact face): the headline gauge. The other aims' gauges and limits are the row's hover, in core's own words, one line each.
    const more = rest.map(({ r }) => `${nameOf(r.aim_id, r.aim)} ${r.kind === 'none' ? r.state_text ?? r.text ?? '' : r.value ?? ''}`.trim()).filter((t) => t !== '')
    body = (
      <div className="min-w-[7rem] flex-1" data-simple-more={more.length === 0 ? undefined : more.length} title={more.length === 0 ? undefined : more.join('\n')}>
        {lead}
      </div>
    )
  } else if (bands.length > 0 || held.length > 0) {
    const letters = optionLetters(model), headingOf = (option: string) => model?.cards.find((c) => c.id === option)?.heading ?? ''
    body = (
      // ONE visual row: each option's band is a thin bar of its own, stacked (up to 4, 4 px each) on the one shared axis; the letters and words are the hover.
      <div className="grid min-w-0 flex-1 gap-px" data-simple-face="range" title={bands.length === 0 ? undefined : bands.map((b) => `${b.letter} ${b.heading} · ${b.text}`).join('\n')}>
        {bands.slice(0, 4).map((b) => (
          <div key={b.option} title={`${b.heading} · ${b.text}`} className="flex items-center" data-simple-band={b.option}>
            <span className="relative block h-[4px] flex-1 rounded-full" style={{ background: 'var(--panel-hover, #F2F0EC)' }} role="img" aria-label={`${b.heading} · ${b.text}`}>
              {b.hi > b.lo ? <i className="absolute top-0 block h-full rounded-full" style={{ left: `${b.lo}%`, width: `${b.hi - b.lo}%`, background: b.olumi ? BLUE : INK, opacity: 0.75 }} data-band-from={b.lo.toFixed(1)} data-band-to={b.hi.toFixed(1)} /> : null}
              {b.mid === null ? null : <i className="absolute -top-[1px] block h-[6px] w-[2px] rounded-sm" style={{ left: `${b.mid}%`, background: INK }} />}
            </span>
          </div>
        ))}
        {/* Canvas rules 4 and 5: an option core could not calculate is its own dashed row (its letter, an empty track), with core's real reason. */}
        {held.map((w) => (
          <div key={w.option} className="ok-withheld mt-0.5" title={[headingOf(w.option), w.text].filter((x) => x !== '').join(' · ')} data-simple-withheld={w.option}>
            <div className="ok-withheld-row">
              {letters.has(w.option) ? <LetterChip letter={letters.get(w.option)!} words={headingOf(w.option)} /> : null}
              <EmptyTrack testid={`${id}-${w.option}-empty-bar`} />
            </div>
            <p className="ok-caption ok-caption-one" data-simple-withheld-why={w.option}>{w.text}</p>
          </div>
        ))}
      </div>
    )
  } else if (aim) {
    const olumi = card.bound!.olumi != null
    // The aim's question opens its target figure's own editor, as the Detailed face does (core's `target`, targets.ts); none where core offers none.
    const target = model === null || model.edit_base === null ? null : targetCardOf(model, card)
    const words = <span className="line-clamp-1 min-w-0 text-text-header">{card.bound!.text}</span>
    body = (
      // The aim's mark is the diamond before its name (the look's); here its bound, core's words, as a quiet outlined pill.
      <p className={`${SMALL} flex min-w-[7rem] flex-1 items-center gap-1`} data-simple-face="target" title={card.bound!.title !== '' ? card.bound!.title : card.bound!.text} style={{ color: card.bound!.measured ? GOAL : undefined }}>
        <span className="ok-pill ok-bound min-w-0">
          {target === null ? words : <FigureEdit id={target.id} edit={target.figure!.edit ?? null} place="view-aim" opener={words} />}
          {olumi ? <OlumiMark words={card.bound!.olumi!.title} size={12} /> : null}
        </span>
      </p>
    )
  } else if (card.figure?.state === 'waits') {
    // Canvas rule 5, pending: a calculated figure that waits on an input is a dashed, empty bar with core's own "waits on …" words.
    body = (
      <div className="ok-unsized min-w-[7rem] flex-1" data-simple-face="pending" title={card.figure.title !== '' ? card.figure.title : card.figure.text}>
        <EmptyTrack testid={`${id}-empty-bar`} />
        {card.figure.text === '' ? null : <p className="ok-caption ok-caption-one" data-simple-pending={id}>{card.figure.text}</p>}
      </div>
    )
  } else if (hasFigure) {
    const estimate = card.olumi !== null && card.author?.by !== 'olumi'
    body = <p className={`${typography.viewValue} line-clamp-2 min-w-[7rem] flex-1 break-words font-semibold`} data-simple-face="figure" title={card.figure!.title !== '' ? card.figure!.title : card.figure!.text} style={{ color: card.author?.by === 'olumi' || estimate ? BLUE : INK }}>{card.figure!.text}</p>
  } else if (card.figure != null) {
    // An input not sized yet: a dashed, empty bar and core's own words for the gap ("not sized yet · …"), one line, whole on hover.
    body = <div className="min-w-[7rem] flex-1" data-simple-face="no-figure"><UnsizedFigure id={id} words={unsizedWords(card)} /></div>
  }
  // Codex 006 (what-if): Simple drew only the SAVED figure while a different one was being tried, so the card and the what-if disagreed with
  // nothing to say why. While a figure is tried, its card says so in place, and names the saved figure beside it.
  if (trying !== undefined && card.family !== 'option') body = trying
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5" data-simple-card={id}>
      {kind.shape === 'assumption' ? <KindTag id={id} tag="assumption" /> : null}
      {body}
      <div className="ml-auto flex flex-none items-center gap-1.5" data-simple-foot={id}>
        {card.family === 'option' && isBaseline(card) ? <BaselinePill id={id} /> : null}
        <AuthorGlyph card={card} />
        {card.challenged ? <span role="img" aria-label="Challenged" title="Challenged" className="h-2 w-2 flex-none rounded-full" style={{ background: ORANGE }} data-simple-challenged={id} /> : null}
        {card.change == null ? null : <span role="img" aria-label={card.change.title} title={card.change.title} className="text-info" data-view={`${id}.change.glyph`}>{card.change.glyph}</span>}
        {noted ? <OlumiAsksMark id={id} words={notedWords} /> : null}
        <span className="ml-auto flex items-center gap-1 empty:hidden">{extra}</span>
      </div>
    </div>
  )
}
