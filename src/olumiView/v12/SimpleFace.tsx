import type { ReactNode } from 'react'
import { isOlumiCoreLane } from '../../olumiCore/lane'
import { useAnchoredTip } from '../look/Tip'
import { Hover } from '../look/Hover'
import type { ViewCard, ViewModel, ViewRow } from '../client'
import { typography } from '../../styles/typography'
import { chanceForDots } from '../resultRange'
import { ChanceDots } from './scale/ChanceDots'
import { RangeBar } from './scale/RangeBar'
import { FigureEdit } from '../FigureEdit'
import { targetCardOf } from '../model/targets'
import { barCardOf } from '../layout'
import { figureRange, isBaseline, limitLeadOf } from './contract'
import { cardKindOf, type CardKind } from './cards/kind'
import { GoalMeasureLine, waitingMeasureQuestion } from './cards/GoalMeasureLine'
import { optionLetters } from './cards/letters'
import { AuthorMark, BaselinePill, CardMarks, ChangeGlyph, ConditionTag, KindTag, LimitTag, OlumiAsksMark, OlumiMark, cardMarksOf, whoseOf } from './cards/marks'
import { chanceParts, headlineChanceRow, headlineWithheldRowIndex, noChanceLineOf, sharedNoChanceOf, tipsLineOf, unsizedWords, withheldCardIds } from './cards/words'
import { useWithheldRing } from './detailed/marks'
import { cardKind, cardTitle, needsOf } from './fields/fields'
import { BandsChart } from './scale/OptionBand'
import { visualOfCard, type VisualV3 } from '../visual'

/**
 * ONE TYPE SCALE ON A SIMPLE CARD (Paul, 17 Nov: no big bold text on a card): the title (BaseNode's) and the card's one headline, an option's
 * chance or an aim's bound, are 14 / 500 (`typography.viewValue`; design findings section 4: "one headline per card"); every other word on the
 * card is 12 / 400 (`typography.viewLabel`, the card's small text), a figure's digits tabular.
 */
const FIGURE = `${typography.viewLabel} tabular-nums`
// The quiet status can grow beside other card marks.
export const QUIET_BASIS = 'flex-[1_1_7rem]'
export const optionLetterOf = (model: ViewModel | null, id: string): string => optionLetters(model).get(id) ?? '·'

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
  readonly bands?: VisualV3 | null
  readonly olumiLook?: boolean
  /** Olumi's note sits beside this card (core's `next.at`): Olumi's mark in a ring here, the words in the panel. */
  readonly noted: boolean
  /** Core's own label for that step (`next.label`), the mark's name; the fixed name where core sends none. */
  readonly notedWords?: string | null
  /** The card's kind, where the caller has worked it out with the whole View (cards/kind.ts); else read from the model here. */
  readonly kind?: CardKind
  /** The card's count and disagreement marks, plus the edit control in the older look. */
  readonly extra?: ReactNode
  /** The figure tried on a copy (What if), drawn in place of the saved figure with the saved one named beside it (CoreCard). */
  readonly trying?: ReactNode
  /** A full-width row under the foot (what the card rests on, v12/cards/RestsOn): its lines wrap within the card, never run out of it. */
  readonly below?: ReactNode
}

type FaceMarkKind = 'chance' | 'track' | 'bound'

export function FaceMark({ kind }: { kind: FaceMarkKind }): JSX.Element {
  return <span className={`ok-face-mark ok-face-mark-${kind}`} data-face-mark={kind} aria-hidden="true" />
}

const hoverLines = (...lines: (string | null | undefined)[]): string => lines.filter(Boolean).join('\n')

export function noResultWords(card: ViewCard): string {
  const { line, hover } = noChanceLineOf(card.headline!)
  const row = card.rows[headlineWithheldRowIndex(card)]
  return hoverLines(line, hover, row?.kind === 'none' ? row.tips : null)
}

export function waitingFigureWords(card: ViewCard): string {
  return hoverLines(card.figure?.text, card.figure?.title, ...needsOf(card).needs.map((need) => need.label))
}

export function sharedResultWords(headline: NonNullable<ViewCard['headline']>): string {
  return hoverLines(headline.text, noChanceLineOf(headline).hover)
}

type StateLine = { readonly text?: string; readonly title: string; readonly marks: Readonly<Record<string, string>>; readonly shape?: FaceMarkKind; readonly isValue?: true }

export function SimpleFace({ card, model, bands = visualOfCard(model, card, null), noted, notedWords, olumiLook = false, kind = cardKindOf(card, model), extra, trying, below }: SimpleFaceProps): JSX.Element {
  const id = card.id
  const words = chanceWordsOf(card), h = card.family === 'option' ? card.headline ?? null : null
  const limit = card.family === 'option' ? limitLeadOf(card) : null
  const description = cardTitle(card).description
  const chance = h?.state === 'chance' ? chanceParts(words ?? h.text) : null
  const hasQualifier = chance?.qualifier != null
  const shared = card.family === 'option' ? null : sharedNoChanceOf(model, id, 'typed')
  const hasFigure = card.figure != null && card.figure.text !== ''
  const tight = olumiLook ? 'ok-card-gap-tight' : 'gap-1'
  const stack = olumiLook ? 'ok-card-gap-stack' : 'gap-2'
  const nameOf = (aid: string | null | undefined, own?: string) => own ?? (aid == null ? '' : model?.cards.find((c) => c.id === aid)?.heading ?? '')
  let visual: ReactNode = null
  let state: StateLine | null = null
  let withheldRows: readonly (ViewRow | undefined)[] = []
  if (card.family === 'option') {
    if (h?.state === 'chance' && chance !== null) {
      const row = headlineChanceRow(card)
      visual = (
        <Hover as="div" focusable={hasQualifier} className={`flex min-w-0 basis-full flex-wrap items-center ${olumiLook ? 'ok-card-gap-chance' : 'gap-x-2 gap-y-1'}`}
          data-simple-face="chance" data-simple-qual={hasQualifier ? id : undefined}
          words={hasQualifier ? hoverLines(chance.head, chance.qualifier, h.title, description) : h.title || h.text}>
          <p className={`${typography.viewValue} min-w-0 break-words text-text-header`} data-simple-chance={id}>
            {chance.head}
            {row?.olumi == null ? null : <span className={`inline-flex align-middle ${olumiLook ? 'ok-card-mark-after' : 'ml-1'}`}><OlumiMark words={row.olumi.title} /></span>}
          </p>
          <ChanceDots chance={chanceForDots(row)} />
        </Hover>
      )
    } else if (h?.state === 'fixed') {
      state = { text: h.text, title: h.title || h.text, marks: { 'data-simple-face': 'fixed' } }
    } else if (h?.state === 'none' && sharedNoChanceOf(model, h.aim_id, 'typed') === null) {
      const tip = tipsLineOf(card, h)
      withheldRows = [card.rows[headlineWithheldRowIndex(card)]]
      state = {
        ...(limit === null ? { shape: 'chance' } : { text: limit.value, isValue: true }),
        title: limit === null ? noResultWords(card) : hoverLines(nameOf(limit.aim_id), limit.value, limit.title, noResultWords(card)),
        marks: {
          'data-simple-face': 'no-chance',
          'data-simple-state': id,
          ...(limit === null ? {} : { 'data-simple-limit': id }),
          ...(tip === null ? {} : {
            'data-view': `${id}.rows.${tip.i}.tips_face`,
            ...(tip.label === null ? {} : { 'data-simple-tips-whatif': id }),
            ...(tip.conditional ? { 'data-simple-tips-conditional': id } : {}),
          }),
        },
      }
    }
  } else if (bands !== null) {
    visual = <BandsChart payload={bands} tier="glance" />
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
    if (card.bound.measured === false || shared !== null) {
      visual = (
        <div className={`flex min-w-0 basis-full items-center ${tight}`} data-simple-face="target" data-simple-bound-state={id}>
          {shared !== null ? null : <Hover words={hoverLines(card.bound.text, card.bound.title)} className="inline-flex items-center">
            <FaceMark kind="bound" />
          </Hover>}
          {target === null || (question !== null && bar === null) ? null : <FigureEdit id={target.id} edit={target.figure!.edit ?? null} place="view-aim" glyph words={false} />}
          {question === null ? null : <GoalMeasureLine question={question} className="ok-quiet min-w-0 flex-1 break-words" />}
          {mark}
        </div>
      )
    } else {
      visual = (
        <Hover focusable={false} as="p" words={card.bound.title || card.bound.text}
          className={card.bound.measured ? `${typography.viewValue} ok-tone-goal flex min-w-0 basis-full items-center ${tight}` : `ok-quiet flex min-w-0 basis-full items-center ${tight}`}
          data-simple-face="target" data-simple-bound-state={card.bound.measured ? undefined : id}>
          {card.bound.measured ? <span className="ok-pill ok-bound min-w-0">
            {target === null ? bound : <FigureEdit id={target.id} edit={target.figure!.edit ?? null} place="view-aim" opener={bound} />}
            {mark}
          </span> : <>
            {target === null ? quietBound : <FigureEdit id={target.id} edit={target.figure!.edit ?? null} place="view-aim" opener={quietBound} />}
            {mark}
          </>}
        </Hover>
      )
    }
  } else if (card.figure?.state === 'waits') {
    state = { shape: 'track', title: waitingFigureWords(card), marks: { 'data-simple-face': 'pending', 'data-simple-pending': id } }
  } else if (figureRange(card) !== null) {
    // A figure with a range: core's own words for the figure first, at rest (UI reviewer #27, 17 Nov: testers read the axis end "50,000 GBP" as a £30,000
    // limit), coloured by whose it is as the plain figure line is; the range bar under it, its end labels the axis only. Nothing is worked out here.
    const estimate = card.olumi !== null && card.author?.by !== 'olumi', words = card.figure?.text ?? ''
    visual = (
      <Hover focusable={false} words={card.figure?.title || words || undefined} className={`flex min-w-0 basis-full flex-col ${tight}`} data-simple-scale={id}>
        {words === '' ? null : <p className={`${FIGURE} ${card.author?.by === 'olumi' || estimate ? 'ok-tone-info' : 'ok-tone-ink'} min-w-0 break-words`} data-simple-figure-text={id}>{words}</p>}
        <RangeBar card={card} view={{ model }} showFlat={olumiLook} />
      </Hover>
    )
  } else if (hasFigure) {
    const estimate = card.olumi !== null && card.author?.by !== 'olumi'
    visual = <Hover focusable={false} as="p" words={card.figure!.title !== '' ? card.figure!.title : card.figure!.text} className={`${FIGURE} ${card.author?.by === 'olumi' || estimate ? 'ok-tone-info' : 'ok-tone-ink'} min-w-0 basis-full break-words`} data-simple-face="figure">{card.figure!.text}</Hover>
  } else if (card.figure != null) {
    const gap = unsizedWords(card)
    if (gap !== null) state = { shape: 'track', title: gap, marks: { 'data-simple-face': 'no-figure', 'data-unsized': id, 'data-unsized-words': id } }
  }
  if (shared !== null) {
    withheldRows = model!.cards
      .filter((c) => c.family === 'option' && c.headline?.aim_id === id)
      .map((c) => c.rows[headlineWithheldRowIndex(c)])
    state = {
      shape: 'chance',
      title: hoverLines(sharedResultWords(shared), state?.text, state?.title, card.bound?.text, card.bound?.title),
      marks: { 'data-simple-face': 'no-chance', 'data-simple-no-chance-once': id },
    }
  }
  if (trying !== undefined && card.family !== 'option') visual = <div className="min-w-0 basis-full">{trying}</div>
  // An option's other aims' gauges and its limits, the card's hover (the visual shows the headline's aim only): each result's name and short value, then core's
  // whole sentence for it (`title`) where core sends one, so a condition the sentence carries (a result that uses an approximate figure as given, 17 Nov) is
  // reachable here and not only the short value.
  const more = card.family !== 'option' ? [] : card.rows.filter((r) => (r.aim_id == null ? h === null : h === null || r.aim_id !== h.aim_id))
    .map((r) => {
      const row = r as { kind: string; aim_id?: string | null; aim?: string; value?: string; text?: string; state_text?: string; title?: string }
      if (limit !== null && row.kind === 'limit' && row.aim_id === limit.aim_id) {
        return hoverLines(nameOf(row.aim_id), row.value, row.title)
      }
      const short = `${nameOf(row.aim_id, row.aim)} ${row.kind === 'none' ? row.state_text ?? row.text ?? '' : row.value ?? ''}`.trim()
      return [short, row.title != null && row.title !== '' && row.title !== short ? row.title : null].filter((x) => x != null && x !== '').join('\n')
    })
    .filter((t) => t !== '')
  // The card's other results, one per line, on the one Tip (150 ms, keyboard focus too): the card holds a stop only where there are words to reach.
  const cardWords = hoverLines(state === null && !hasQualifier ? description : null, ...more)
  const moreTip = useAnchoredTip(cardWords || undefined)
  const blockerIds = isOlumiCoreLane() ? withheldCardIds(model, withheldRows) : []
  const ring = useWithheldRing(blockerIds)
  const moreHandlers = {
    ...moreTip.handlers,
    onFocus: (e: Parameters<typeof ring.focus.onFocus>[0]) => { if (e.target === e.currentTarget) moreTip.handlers.onFocus(e); ring.focus.onFocus(e) },
    onBlur: (e: Parameters<typeof ring.focus.onBlur>[0]) => { moreTip.handlers.onBlur(); ring.focus.onBlur(e) },
  }
  const baseline = card.family === 'option' && isBaseline(card)
  const assumption = kind.shape === 'assumption'
  const condition = card.family === 'condition'
  const limitMark = kind.shape === 'aim' && cardKind(card, model).aim === 'limit'
  const changed = card.change != null && card.change.kind !== 'added'
  const whose = whoseOf(card)
  const footAuthor = whose !== null && (!olumiLook || whose !== 'person')
  const hasFoot = !olumiLook || baseline || assumption || condition || limitMark || changed || noted ||
    footAuthor || extra != null || cardMarksOf(card).length > 0

  // A card core no longer holds as live (`status`, e.g. "ruled out") is marked for the look: its name draws in the light ink (olumiLook.css).
  return (
    <>
    <div className={`flex flex-wrap items-center ${olumiLook ? stack : 'gap-x-2 gap-y-2'}`} data-simple-card={id} data-simple-set-aside={card.status != null && card.status !== '' ? '' : undefined} data-simple-more={more.length === 0 ? undefined : more.length}
      data-simple-description={state === null && !hasQualifier && description !== null ? id : undefined}
      {...(cardWords === '' ? {} : { tabIndex: 0, 'aria-describedby': moreTip.describedBy, ...moreHandlers })}>
      {visual}
      {state === null ? null : (
        <Hover as="p" focusable={state.text === undefined || state.isValue === true}
          className={state.isValue ? `${typography.viewValue} min-w-0 break-words text-text-header` : state.shape === 'track' ? 'min-w-0 basis-full' : state.shape === undefined ? `ok-quiet ok-two-lines min-w-0 ${QUIET_BASIS}` : 'inline-flex min-w-0 items-center'}
          words={hoverLines(state.title, description)} {...state.marks}
          {...(blockerIds.length === 0 ? {} : { ...ring.pointer, ...ring.focus })}>
          {state.shape === undefined ? state.text : <FaceMark kind={state.shape} />}
        </Hover>
      )}
      {/* State and count marks first, then authorship. The Olumi look moves person-only authorship to the corner. */}
      {hasFoot ? <div className={`ml-auto flex flex-none items-center ${stack}`} data-simple-foot={id}>
        {baseline ? <BaselinePill id={id} /> : null}
        {assumption ? <KindTag id={id} model={model} /> : null}
        {condition ? <ConditionTag id={id} /> : null}
        {limitMark ? <LimitTag id={id} model={model} /> : null}
        {/* The card's state marks, capped (cards/marks.tsx): an option's corner driver badge takes one of the three places. */}
        <CardMarks card={card} taken={card.driver != null ? 1 : 0} />
        {/* An added card's "+" repeats its proposed frame: shown only for a change the frame does not say (16 Nov, Paul: less noise). */}
        {changed ? <ChangeGlyph card={card} /> : null}
        {noted ? <OlumiAsksMark id={id} words={notedWords} /> : null}
        {extra}
        {footAuthor ? <AuthorGlyph card={card} /> : null}
      </div> : null}
      {below == null ? null : <div className="min-w-0 basis-full" data-simple-below={id}>{below}</div>}
    </div>
    {moreTip.tip}
    </>
  )
}
