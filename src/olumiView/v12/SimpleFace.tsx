/**
 * V12 Simple level: a card drawn as visuals, with the words behind hover (Paul, 16 Nov: "the graph should be visualisations, icons, graphs,
 * colour systems"; coaching text belongs in the AI panel). Every card and link stays; only the sentences go. Nothing here is worked out:
 *  - an option's chance is a gauge bar with core's own value text (`rows[chance].value`) and its position (`rows[chance].chance`);
 *    no chance yet is a dashed, empty bar (core's reason is the hover);
 *  - a figure with a modelled band (`values[]`: p10 / p50 / p90) is a range bar per option on one shared axis, positions only;
 *  - a figure with a stated value shows core's words, one line; one with none is a dashed, empty bar;
 *  - an aim or limit shows its bound (core's words, one line) beside a target mark, in the goal's colour where it is measured;
 *  - authorship is a glyph (Olumi's mark, or a person), the words on hover; Olumi's note is a blue badge on its card.
 */
import { Sparkles, Target, User, MessageCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ViewCard, ViewModel } from '../client'
import { typography } from '../../styles/typography'
import { chanceAtOf } from '../resultRange'
import { ChanceBand } from '../ResultBand'
import { FigureEdit } from '../FigureEdit'
import { targetCardOf } from '../model/targets'

/** Olumi's blue, the person's ink, the goal's colour and the challenge colour: the board's own tokens. */
/** Type on a compact card: a fixed 13 px (BaseNode compact), so 10.4 px on screen at Simple's 0.8 floor. */
const SMALL = 'text-[13px] font-sans leading-[1.3]'
const BLUE = 'var(--semantic-info)', INK = 'var(--text-header)', GOAL = 'var(--edge-positive)', ORANGE = 'var(--olumi-mark-orange)', QUIET = 'var(--text-light)'

export type BandRow = { readonly option: string; readonly letter: string; readonly heading: string; readonly lo: number; readonly mid: number | null; readonly hi: number; readonly text: string; readonly olumi: boolean }

/** The option letters (A, B, ...) in the model's order: a short name for a row, its heading on hover. */
export const optionLetterOf = (model: ViewModel | null, id: string): string => {
  const i = (model?.cards ?? []).filter((c) => c.family === 'option').findIndex((c) => c.id === id)
  return i < 0 ? '·' : String.fromCharCode(65 + (i % 26))
}

/**
 * The positions (0..100) of each option's modelled band on ONE axis shared by the card's rows, from the served p10 / p50 / p90. A band the
 * axis cannot place (a non-finite number, or all rows the same point) is drawn as a point in the middle: never a made-up width.
 */
export function bandRowsOf(card: ViewCard, model: ViewModel | null): readonly BandRow[] {
  const values = (card.values ?? []).filter((v) => Number.isFinite(v.p10) && Number.isFinite(v.p90))
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
  const h = card.headline
  if (card.family !== 'option' || h == null || h.state !== 'chance') return null
  const row = card.rows.find((r) => r.kind === 'chance' && r.aim_id === h.aim_id) as { value?: string } | undefined
  return row?.value != null && row.value !== '' ? row.value : null
}

const Dashed = ({ title, testid }: { title?: string; testid: string }) => (
  <span className="block h-[6px] w-full rounded-full border border-dashed" style={{ borderColor: QUIET }} title={title} data-testid={testid} aria-hidden={title === undefined ? 'true' : undefined} />
)

/** The Olumi / person mark: Olumi's own glyph where core sends one; the words on hover. */
export function AuthorGlyph({ card }: { card: ViewCard }): JSX.Element | null {
  const a = card.author
  if (a == null && card.olumi == null) return null
  const olumi = a?.by === 'olumi' || (a == null && card.olumi != null)
  const words = [a?.text, a?.title].filter((x) => x != null && x !== '').join(' · ') || card.olumi?.title || undefined
  return (
    <span role={words === undefined ? undefined : 'img'} aria-label={words} aria-hidden={words === undefined ? true : undefined} title={words} data-simple-author={olumi ? 'olumi' : 'person'} className="inline-flex h-4 w-4 flex-none items-center justify-center"
      style={{ color: olumi ? BLUE : INK }}>
      {olumi ? (card.olumi?.glyph ? <span aria-hidden="true">{card.olumi.glyph}</span> : <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />) : <User aria-hidden="true" className="h-3.5 w-3.5" />}
    </span>
  )
}

type RowLike = { kind: 'chance' | 'limit' | 'none'; aim_id?: string | null; aim?: string; value?: string; chance?: number | null; title?: string; text?: string; state_text?: string }

export type SimpleFaceProps = {
  readonly card: ViewCard
  readonly model: ViewModel | null
  /** Olumi's note sits beside this card (core's `next.at`): a badge here, the words in the panel. */
  readonly noted: boolean
  /** The card's own controls that stay (the figure's edit, core's fold badge). */
  readonly extra?: ReactNode
}

export function SimpleFace({ card, model, noted, extra }: SimpleFaceProps): JSX.Element {
  const id = card.id
  const at = chanceAtOf(card), words = chanceWordsOf(card), h = card.family === 'option' ? card.headline ?? null : null
  const bands = card.family === 'option' ? [] : bandRowsOf(card, model)
  const hasFigure = card.figure != null && card.figure.text !== ''
  const aim = card.bound != null
  let body: ReactNode = null
  if (card.family === 'option') {
    // Every chance row of the option, one compact gauge per aim (the headline's first, as the Detailed face leads with it), then its limits:
    // structure is never dropped, only the sentences. A withheld or odd state shows core's own state words, core's reason on hover.
    const headAim = h === null ? null : h.aim_id
    const rest = card.rows.map((r, i) => ({ r: r as RowLike, i })).filter(({ r }) => r.aim_id == null ? h === null : r.aim_id !== headAim || h === null)
    const nameOf = (aid: string | null | undefined, own?: string) => own ?? (aid == null ? '' : model?.cards.find((c) => c.id === aid)?.heading ?? '')
    const lead = h === null ? null : h.state === 'chance' && at !== null ? (
      // Codex 006 #3: core's value words can be a qualified sentence ("about 31% chance, on Olumi's assumption for '…'"), and printed as one
      // unshrinkable line beside the track they ran across the canvas. The track takes the card's width; core's words, verbatim, wrap under it
      // in two lines at most, so the figure and its qualification stay on the face; the whole basis is the hover. No figure is read from the words.
      <div className="min-w-0" data-simple-face="gauge" title={h.title !== '' ? h.title : h.text}>
        <ChanceBand card={card} />
        <p className={`${SMALL} mt-1 line-clamp-2 min-w-0 break-words font-medium tabular-nums text-text-header`} data-simple-chance={id}>{words ?? `${Math.round(at * 100)}%`}</p>
      </div>
    ) : h.state === 'fixed' ? (
      <p className={`${SMALL} line-clamp-2 text-text-body`} data-simple-face="fixed" title={h.title !== '' ? h.title : h.text}>{h.text}</p>
    ) : (
      // Withheld, or a chance state the card cannot place: core's own state words in full, one short line, and a small dashed bar beside it; core's reason on hover; never "no chance".
      <div className="flex items-center gap-2" data-simple-face="no-chance" title={(h.why ?? '') !== '' ? h.why! : h.title !== '' ? h.title : h.text}>
        <span className={`${SMALL} flex-none whitespace-nowrap text-text-light`} data-simple-state={id}>{h.text}</span>
        <span className="w-8 flex-none"><Dashed testid={`${id}-empty-bar`} /></span>
      </div>
    )
    // ONE visual row (compact face): the headline gauge. The other aims' gauges and limits are the row's hover, in core's own words, one line each.
    const more = rest.map(({ r }) => `${nameOf(r.aim_id, r.aim)} ${r.kind === 'none' ? r.state_text ?? r.text ?? '' : r.value ?? ''}`.trim()).filter((t) => t !== '')
    body = (
      <div className="min-w-[7rem] flex-1" data-simple-more={more.length === 0 ? undefined : more.length} title={more.length === 0 ? undefined : more.join('\n')}>
        {lead}
      </div>
    )
  } else if (bands.length > 0) {
    body = (
      // ONE visual row: each option's band is a thin bar of its own, stacked (up to 4, 4 px each) on the one shared axis; the letters and words are the hover.
      <div className="grid min-w-0 flex-1 gap-px" data-simple-face="range" title={bands.map((b) => `${b.letter} ${b.heading} · ${b.text}`).join('\n')}>
        {bands.slice(0, 4).map((b) => (
          <div key={b.option} title={`${b.heading} · ${b.text}`} className="flex items-center" data-simple-band={b.option}>
            <span className="relative block h-[4px] flex-1 rounded-full" style={{ background: 'var(--panel-hover, #F2F0EC)' }} role="img" aria-label={`${b.heading} · ${b.text}`}>
              {b.hi > b.lo ? <i className="absolute top-0 block h-full rounded-full" style={{ left: `${b.lo}%`, width: `${b.hi - b.lo}%`, background: b.olumi ? BLUE : INK, opacity: 0.75 }} data-band-from={b.lo.toFixed(1)} data-band-to={b.hi.toFixed(1)} /> : null}
              {b.mid === null ? null : <i className="absolute -top-[1px] block h-[6px] w-[2px] rounded-sm" style={{ left: `${b.mid}%`, background: INK }} />}
            </span>
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
      <p className={`${SMALL} flex min-w-[7rem] flex-1 items-center gap-1`} data-simple-face="target" title={card.bound!.title !== '' ? card.bound!.title : card.bound!.text} style={{ color: card.bound!.measured ? GOAL : undefined }}>
        <Target aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
        {target === null ? words : <FigureEdit id={target.id} edit={target.figure!.edit ?? null} place="view-aim" opener={words} />}
        {olumi ? <span role="img" aria-label={card.bound!.olumi!.title} title={card.bound!.olumi!.title} style={{ color: BLUE }}>{card.bound!.olumi!.glyph}</span> : null}
      </p>
    )
  } else if (hasFigure) {
    const estimate = card.olumi !== null && card.author?.by !== 'olumi'
    body = <p className={`${typography.nodeValue} line-clamp-2 min-w-[7rem] flex-1 break-words font-semibold`} data-simple-face="figure" title={card.figure!.title !== '' ? card.figure!.title : card.figure!.text} style={{ color: card.author?.by === 'olumi' || estimate ? BLUE : INK }}>{card.figure!.text}</p>
  } else if (card.figure != null) {
    body = <div className="min-w-0 flex-1" data-simple-face="no-figure" title={card.figure.title !== '' ? card.figure.title : undefined}><Dashed testid={`${id}-empty-bar`} /></div>
  }
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5" data-simple-card={id}>
      {body}
      <div className="ml-auto flex flex-none items-center gap-1.5" data-simple-foot={id}>
        <AuthorGlyph card={card} />
        {card.challenged ? <span role="img" aria-label="Challenged" title="Challenged" className="h-2 w-2 flex-none rounded-full" style={{ background: ORANGE }} data-simple-challenged={id} /> : null}
        {card.change == null ? null : <span role="img" aria-label={card.change.title} title={card.change.title} className="text-info" data-view={`${id}.change.glyph`}>{card.change.glyph}</span>}
        {noted ? <span role="img" aria-label="Olumi has a note on this" title="Olumi has a note on this: it is in the panel" data-simple-note={id} className="inline-flex h-4 w-4 flex-none items-center justify-center rounded-full" style={{ background: BLUE, color: '#fff', boxShadow: '0 0 0 3px color-mix(in srgb, var(--semantic-info) 22%, transparent)' }}><MessageCircle aria-hidden="true" className="h-2.5 w-2.5" /></span> : null}
        <span className="ml-auto flex items-center gap-1 empty:hidden">{extra}</span>
      </div>
    </div>
  )
}
