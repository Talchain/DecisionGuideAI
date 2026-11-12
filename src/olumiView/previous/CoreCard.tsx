/**
 * SPIKE (UI restore, 11 Nov 2026; Paul: "having the previous UI but plugged into the alpha data model"). A CORE CARD ON THE PREVIOUS
 * PRODUCT'S CARD FRAME. The frame is the previous product's own (`BaseNode`: its box, kind mark, title, level-of-detail line, corner marks,
 * selection and handles). The BODY is core's View card, core's words verbatim: the previous cards' own bodies (FactorNode, OptionNode,
 * GoalNode, DecisionNode) read the previous data model and say things about it ("Needs input · Value not set yet", "No changes specified")
 * that are not true of a core model, so they are not mounted on this lane.
 *
 * Rulings applied here (output/ui-restore-20261111/RULINGS.md): an empty slot is silent unless core sends its own words for the gap; an
 * option's headline is core's chance of meeting the goal, verbatim; an outcome shows each option's worked-out value once; an aim or limit
 * shows its bound; only Olumi's cards say who they are from, in Olumi's blue; dashes mean core doubts it or it is proposed.
 * Nothing here formats, rounds, orders or works out a value.
 */
import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from '../../canvas/nodes/BaseNode'
import { NODE_REGISTRY, type NodeType } from '../../canvas/domain/nodes'
import { typography } from '../../styles/typography'
import type { ViewCard } from '../client'
import { CARD_WIDTH, drawKindOf, QUESTION, readingOf } from '../layout'
import { useViewStore } from '../store'
import { useDriverOf, usePreMortemOf, useRestsOnItem, useTriedOn, useTryOn } from '../lens'
import { failedOf, failedReasonOf } from '../k5'
import { clearWhatIf } from '../whatif'
import { WHAT_IF_COPY } from '../../canvas/artefacts/whatIfCopy'
import { optionBands, ViewDriverBadge, ViewOptionBand, ViewValuesBand } from '../v10'
import { CardEvidenceMarks, CardViewChips, CardViewInitials, OptionMarkLine } from '../RevealMarks'
import { StrategyChips } from '../strategy/StrategyChips'
import { FigureEdit, HeldEditOffer, useOpenFigureEdits } from '../FigureEdit'
import { Badge } from '../Badge'
import { StatedFigure } from '../StatedFigure'
import { nodeColors } from '../../canvas/nodes/colors'

/** One of core's marks (its glyph), with core's words for it as its hover and its accessible name: never a bare glyph. */
const Glyph = ({ at, mark, className = '' }: { at: string; mark: { glyph: string; title: string } | null | undefined; className?: string }) => (
  mark == null ? null : <span role="img" aria-label={mark.title} title={mark.title} className={className} data-view={`${at}.glyph`}>{mark.glyph}</span>
)

/**
 * What the retired card said only when opened (its aside: a person's author, a route's own line, its reason, an option's status). The face is
 * the same at rest, hovered and opened (DL 9 Nov), so on this card they are the body's hover, after core's detail. Core's words, verbatim.
 */
export function openedWordsOf(card: ViewCard): string[] {
  const theirs = card.author != null && card.author.by !== 'olumi' ? card.author : null
  return [
    theirs === null ? null : theirs.title === '' ? theirs.text : `${theirs.text} · ${theirs.title}`,
    card.family === 'option' ? card.face?.line?.text ?? null : null,
    card.status ?? null,
    card.figure === null && card.rows.length === 0 ? null : card.reason ?? null,
  ].filter((x): x is string => x != null && x !== '')
}

/** The one line beneath the name when zoomed out, and the body's lead line: core's own words for this card, the first it sends of these. */
export function leadLineOf(card: ViewCard): string | null {
  if (card.family === 'option') {
    // RULING 7: the chance of meeting the goal, core's words. Where core withholds it, core's own first line saying so, never a blank and
    // never a figure of the UI's.
    if (card.headline != null) return card.headline.text
    const first = card.rows[0]
    return first !== undefined && first.kind === 'none' ? first.text : null
  }
  const perOption = (card.values?.length ?? 0) > 1
  if (card.figure !== null && card.figure.text !== '' && !perOption) return card.figure.text
  if (card.bound != null) return card.bound.text
  if (perOption) return null
  return card.face?.line?.text ?? null
}

/** The one line beneath the name on the zoomed-out face: the lead line, or for a figure worked out per option core's own line of them all
 *  (the reduced face shows less of it, and the notice says so). */
export function farLineOf(card: ViewCard): string | null {
  return leadLineOf(card) ?? (card.figure !== null && card.figure.text !== '' ? card.figure.text : null)
}

/** The hover that goes with `leadLineOf`: core's own title for the same thing (the goal, conditions and precision behind a chance; the bound's and
 *  the figure's own), verbatim. Null where core sends none. */
export function leadTitleOf(card: ViewCard): string | null {
  if (card.family === 'option') return card.headline != null && card.headline.title !== '' ? card.headline.title : null
  const perOption = (card.values?.length ?? 0) > 1
  if (card.figure !== null && card.figure.text !== '' && !perOption) return card.figure.title !== '' ? card.figure.title : null
  if (card.bound != null) return card.bound.title !== '' ? card.bound.title : null
  return null
}

function CoreCardImpl(props: NodeProps): JSX.Element {
  const id = props.id
  const model = useViewStore((s) => s.view?.model ?? null)
  // The card is the one the node carries (canvas.ts drawViewCanvas: core's own card, never a copy), else the View's: one snapshot with the node.
  const carried = (props.data as { card?: ViewCard }).card
  const card = id === QUESTION ? null : carried ?? model?.cards.find((c) => c.id === id) ?? null
  // On the lane's own canvas the node carries core's card or question (canvas.ts drawViewCanvas), no kind: the kind is the one the board
  // draws it as (layout.ts drawKindOf), the name core's heading or question, and the width the one the lane's layout placed it at.
  const hosted = (props.data as { kind?: string }).kind === undefined
  const kind = ((props.data as { kind?: string }).kind ?? (id === QUESTION ? 'decision' : card !== null && model !== null ? drawKindOf(card, model) : 'factor')) as NodeType
  const width = (props.data as { width?: number }).width
  const label = id === QUESTION ? model?.question.text ?? '' : card?.heading ?? ''
  // Core's face title (FL1: the person's words, Olumi's caption, or the name), as the retired card drew it; the heading stays the card's
  // accessible name and its quick actions' label (`label`). Where core sends none, or the same words, the heading.
  const faceTitle = card?.face?.title?.text ?? ''
  const titleOverride = faceTitle !== '' && faceTitle !== label ? faceTitle : undefined
  const question = id === QUESTION ? model?.question ?? null : null
  const data = useMemo(() => (hosted ? { ...props.data, label, kind, type: kind, core: true } : props.data), [hosted, props.data, label, kind])
  const headingOf = (option: string): string => model?.cards.find((c) => c.id === option)?.heading ?? ''
  const lead = card === null ? null : leadLineOf(card)
  const olumi = card?.author?.by === 'olumi'
  // The frame says three things, each on its own channel, as the retired cards did: dashes only where core doubts it; Olumi's blue where
  // Olumi proposes it (the card, or the question); core's orange where it is challenged (RULING 6's link rule, on the card).
  const proposed = card?.change != null || question?.proposed === true
  // DL ruling (12 Nov, A13d): one meaning everywhere: dashed = provisional (core doubts it, or Olumi proposes it and it is not yet the
  // person's), solid = settled or the person's own. The card's words already say which ("Proposed by Olumi", "not yet sized").
  const doubt = card?.doubt === true || (card?.change != null && card.author?.by === 'olumi'), challenged = card?.challenged === true
  const frame = doubt || proposed || challenged
    ? `${challenged ? 'border-[var(--olumi-mark-orange)]' : proposed ? 'border-info' : (nodeColors[kind as keyof typeof nodeColors] ?? nodeColors.factor).frame} ${doubt ? 'border-dashed' : ''}`
    : undefined
  // The lenses mark the cards they are about (RULING 5): the Rests on number, in Olumi's blue where core marks the figure Olumi's; the
  // ring of What would change. Both are core's (lens.ts); null off those lenses.
  const restsOn = useRestsOnItem(id), driverOf = useDriverOf(id)
  // If it failed (K5): the cards Olumi's stories rest on stand in front, the rest recede; What if (TM-27): the figure tried, on its card.
  const preMortem = usePreMortemOf(id), tried = useTriedOn(id)
  const tryOn = useTryOn(card)
  const versionN = useViewStore((s) => s.view?.version?.n ?? null)
  // The figure's own edit (R25, as the lane's card): wherever core offers one, the ✎ is on the figure's line, and core takes the figure
  // through its own route as the person's. While a proposal is held core offers none; the ✎ then offers to set the proposal aside first.
  const keptEdit = useOpenFigureEdits((o) => o.open.get(id) ?? null)
  const estimate = card?.family === 'quantity' && card.olumi !== null && card.figure !== null
  // The reading of this aim over its window (R19, DL P1 10 Nov: said once, on the aim's own card), and the core marks on the face.
  const reading = card === null || model === null ? null : readingOf(model, id)
  const edit = card === null || card.figure === null ? null : card.figure.edit ?? keptEdit
  // An option's outcome band, every option on one axis: cards and aim from the ONE model read above (inventory G21b: never two stores).
  const band = useMemo(() => (card?.family === 'option' && model !== null ? optionBands(model.cards, model.aim ?? null).get(id) ?? null : null), [card, model, id])
  const restsInk = restsOn === null ? '' : restsOn.olumi ? 'border-info text-info' : 'border-text-light text-text-body'
  // G3 (Paul's "do now", 11 Nov): zoomed out the body is blanked and only the far line shows, so the Rests on number is also drawn beside the
  // far line (BaseNode `lodMark`), at the line's own counter-scaled size; the lens then marks its cards on the whole-board first open too.
  // Core's badge: the records it folded behind this card or the question ("Show 6 notes behind this"), its face words verbatim; pressing
  // it opens them (Badge.tsx). The retired ViewCardNode and ViewQuestionNode drew it; this card did not, so on the lane every fold was
  // unseen (Paul's A11 board, 12 Nov: the question held his "1.3 million", the 12-month runway and two challenges, none on the board).
  const badge = id === QUESTION ? model?.question.badge ?? null : card?.badge ?? null
  // Core's change mark (+ added, ↻ changed), its words for the change on hover: at the end of a line the card already draws (Olumi's
  // author line, else the lead line, else the badge's), never a row of its own (DL, A13d: on a pending first model every card is an
  // addition, and its "+" took a row on all of them).
  const changeMark = card?.change == null ? null : <>{' '}<Glyph at={`${id}.change`} mark={card.change} className="text-info" /></>
  const changeOn = changeMark === null ? null : olumi ? 'author' : lead !== null ? 'lead' : badge !== null ? 'badge' : 'band'
  const badgeLine = badge === null ? null
    : <p className={`${typography.nodeLabel} text-text-body`} data-core-badge={id}><Badge cardId={id} badge={badge} at={id === QUESTION ? 'question' : id} />{changeOn === 'badge' ? changeMark : null}</p>
  // The question's date (core's `decide_by`): its words, core's hover, Olumi's blue where Olumi set it.
  const decideBy = question?.decide_by == null ? null
    : <p className={`${typography.nodeLabel} ${question.decide_by.olumi ? 'text-info' : 'text-text-body'}`} title={question.decide_by.title} data-olumi={question.decide_by.olumi || undefined} data-view="question.decide_by.text">{question.decide_by.text}</p>
  // The figure's ✎ (R25): on the figure's own line, as the retired card drew it. A figure with no value yet (Olumi's question, not yet
  // sized) has no line of its own, so the ✎ sits at the end of Olumi's author line; only where neither exists does it take a row (DL-183:
  // "a stray pencil glyph on a row of its own").
  const editCue = card === null || card.figure === null ? null : edit !== null
    ? <span className="nodrag inline-flex align-middle" data-figure-edit-wrap=""><FigureEdit id={id} edit={edit} glyph="✎" label={estimate ? 'Give yours' : 'Change figure'} words={false} /></span>
    : card.change?.kind !== 'added' && kind !== 'outcome'
      ? <span className="nodrag inline-flex align-middle" data-figure-edit-wrap=""><HeldEditOffer id={id} label={estimate ? 'Give yours' : 'Change figure'} /></span> : null
  const cueOnLead = editCue !== null && card !== null && lead !== null && lead === card.figure?.text
  const cueOnAuthor = editCue !== null && !cueOnLead && olumi
  // The figure tried on a copy, as the person typed it, on the card's corner (out of flow, no card moves), where it is not drawn in place.
  const triedMark = tried === null || tryOn?.kind === 'tried' ? null
    : <span className={`max-w-[180px] truncate rounded border border-info bg-panel px-2 py-0.5 text-text-header ${typography.nodeLabel}`} title={tried} data-whatif-mark={id}>{WHAT_IF_COPY.whatIf}: {tried}</span>
  const restsFar = restsOn === null ? null
    : <span className={`inline-flex flex-none items-center justify-center rounded-full border bg-panel px-1 !leading-tight tabular-nums ${typography.nodeLabel} ${restsInk}`} title={restsOn.olumi && card?.olumi ? card.olumi.title : undefined} data-rests-on={restsOn.n} data-rests-on-far="">{restsOn.n}</span>
  return (
    // The wrapper takes no box (`contents`) unless the If it failed lens recedes this card: no card moves, its handles and ring unchanged.
    <div className={preMortem === 'other' ? 'opacity-40 transition-opacity' : 'contents'} data-premortem={preMortem ?? undefined}>
    <BaseNode {...props} data={data} maxWidth={hosted ? (id === QUESTION ? width : CARD_WIDTH) : undefined} nodeType={kind} icon={NODE_REGISTRY[kind].icon} incompleteStatedOnCard lodMetric={card === null ? null : farLineOf(card)} cornerSlot={card !== null && card.driver != null ? <ViewDriverBadge card={card} /> : triedMark ?? undefined}
      lodMark={restsFar}
      titleOverride={titleOverride} borderClassOverride={frame}>
      {card === null ? <>{decideBy}{badgeLine}</> : (
        <div className={`flex flex-col gap-1 ${driverOf !== null ? 'rounded ring-2 ring-text-header ring-offset-4' : ''}`} data-core-card={id} title={driverOf !== null ? driverOf.map((o) => o.driver!.title).join('\n') : [card.figure !== null && card.figure.text === '' && card.figure.title !== '' ? `${card.figure.title} · ${card.detail}` : card.detail, ...openedWordsOf(card)].join('\n')} data-driver-of={driverOf === null ? undefined : ''}>
          {restsOn === null ? null : <span className={`inline-flex h-[18px] min-w-[18px] items-center justify-center self-start rounded-full border bg-panel px-1 tabular-nums ${typography.nodeLabel} ${restsInk}`} title={restsOn.olumi && card.olumi ? card.olumi.title : undefined} data-rests-on={restsOn.n}>{restsOn.n}</span>}
          {lead === null ? null : (
            // A figure core marks Olumi's estimate reads as Olumi's (its blue, core's mark on hover) whoever the card is from; Olumi's own
            // card says so in its author line, so its mark is not said twice. A bound's own mark beside it.
            <div className={`${typography.nodeValue} ${(olumi || estimate) && card.family !== 'option' ? 'text-info' : 'text-text-header'}`} data-core-lead={id}
              title={[card.family === 'option' ? lead : null, leadTitleOf(card), estimate && lead === card.figure?.text ? card.olumi!.title : null].filter((x) => x != null && x !== '').join(' · ') || undefined}>
              {/* An option's line is core's, whole, but at most two lines on the face; the rest on hover (DL, live draft: a setting question
                  made one option card twice its neighbours' height). */}
              {card.family === 'option' ? <span className="line-clamp-2" data-core-lead-clamp={id}>{lead}</span> : lead}
              {estimate && !olumi && lead === card.figure?.text ? <>{' '}<Glyph at={`${id}.olumi`} mark={card.olumi} /></> : null}
              {card.bound != null && lead === card.bound.text ? <>{' '}<Glyph at={`${id}.bound.olumi`} mark={card.bound.olumi} /></> : null}
              {changeOn === 'lead' ? changeMark : null}
              {cueOnLead ? <>{' '}{editCue}</> : null}
            </div>
          )}
          {reading === null ? null : <p className={`${typography.nodeLabel} ${reading.source === 'proposal' ? 'text-info' : 'text-text-light'}`} title={reading.text} data-reading={reading.source} data-view={`${id}.reading`}>{reading.text}</p>}
          {(card.values?.length ?? 0) > 1 ? <>
            <StatedFigure id={id} card={card} />
            {card.values!.map((v, i) => (
              <p key={v.option} className={`${typography.nodeLabel} text-text-body`} data-core-value={`${id}.${v.option}`}>
                <span className="text-text-light">{headingOf(v.option)}</span> <span data-view={`${id}.values.${i}.text`}>{v.text}</span>
                {v.if_approved == null ? null : <>{' '}<Glyph at={`${id}.values.${i}.if_approved`} mark={v.if_approved} /></>}
              </p>
            ))}
          </> : null}
          {/* Core's honesty line (card.unused): a figure Olumi's analysis does not use yet says so, once, under it, in core's words. */}
          {card.unused == null || card.unused === '' ? null : <p className={`${typography.nodeLabel} text-text-body`} data-view={`${id}.unused`}>{card.unused}</p>}
          {tryOn?.kind !== 'tried' ? null : (
            // TM-27: the figure tried, as the person typed it, in place on its card (core's words for the edit on hover); core's own sentence
            // when the copy could not run; and the way back, which drops the try (nothing was saved). The person's act: ink, never Olumi's blue.
            <div className="nodrag grid gap-1 rounded-lg bg-panel-hover px-2 py-1.5" data-card-try={id}>
              <p className={`${typography.nodeValue} font-semibold text-text-header`} title={tryOn.words}>{WHAT_IF_COPY.trying(tryOn.typed)}</p>
              {tryOn.said === null ? null : <p className={`${typography.nodeLabel} text-text-body`} data-card-try-said={id}>{tryOn.said}</p>}
              <button type="button" onClick={clearWhatIf} data-testid={`card-try-back-${id}`}
                className={`${typography.nodeLabel} inline-flex min-h-[24px] w-fit cursor-pointer items-center text-text-body underline underline-offset-2 hover:text-text-header`}>{WHAT_IF_COPY.back(versionN)}</button>
            </div>
          )}
          {tryOn?.kind !== 'option' ? null : (
            // TM-27: the try's chance for this option under its saved one, in core's row words; core's words for the edit and the row on hover.
            <p className={`${typography.nodeLabel} text-text-body`} title={`${tryOn.words}\n${tryOn.row.title}`} data-option-try={id}>
              {WHAT_IF_COPY.whatIf}: <span className="font-semibold text-text-header" data-view={`whatif.${id}.chance`}>{tryOn.row.value}</span>
            </p>
          )}
          {card.family === 'option' ? <>{band === null ? null : <ViewOptionBand id={id} band={band} />}<OptionMarkLine card={id} /></> : <ViewValuesBand card={card} />}
          {/* The team's revealed views, its evidence and core's strategy mark on the card they are about (./RevealMarks, ./strategy). */}
          <span className="flex flex-wrap items-center gap-1 empty:hidden">
            {/* Core's change mark, here only where no other line can carry it (changeOn, above). */}
            {changeOn === 'band' ? changeMark : null}
            {card.committed == null ? null : <span className={`${typography.nodeLabel} text-text-light`} title={`Committed by: ${card.committed.by} · ${card.committed.at}`} data-committed={id}>Committed by: <span data-view={`${id}.committed.by`}>{card.committed.by}</span></span>}
            {/* K5 If it failed: one mark per Olumi failure story resting on this card, core's number with Olumi's glyph, the story on hover; on an
                option, the story most within the team's control, in core's words. All Olumi's (../k5.ts). */}
            {failedOf(card).map((f, j) => (
              <span key={`f${f.n}`} className={`${typography.nodeLabel} text-info`} title={`${f.olumi.title} · ${f.title}`} aria-label={`${f.olumi.title} · ${f.title}`} data-failed={`${id}.${f.n}`}>
                <span data-view={`${id}.failed.${j}.olumi.glyph`}>{f.olumi.glyph}</span>{f.n}
              </span>
            ))}
            {(() => { const r = failedReasonOf(card); return r === null ? null : (
              <span className={`${typography.nodeLabel} text-info`} title={`${r.olumi.title} · ${r.title}`} aria-label={`${r.olumi.title} · ${r.text} · ${r.title}`} data-failed-reason={id}>
                <span data-view={`${id}.failed_reason.olumi.glyph`}>{r.olumi.glyph}</span> <span data-view={`${id}.failed_reason.text`}>{r.text}</span>
              </span>
            ) })()}
            <CardViewInitials card={id} /><CardEvidenceMarks card={id} /><CardViewChips card={id} /><StrategyChips card={id} /></span>
          {/* A figure with no value takes no row (DL 10 Nov, as ViewCardNode: core's words for it are `figure.title` and `detail`, the hover). */}
          {editCue === null || cueOnLead || cueOnAuthor ? null : <span className="self-start">{editCue}</span>}
          {olumi ? <div className={`${typography.nodeLabel} text-info`} data-core-author={id}><span title={card.author!.title}>{card.author!.text}</span>{changeOn === 'author' ? changeMark : null}{cueOnAuthor ? <>{' '}{editCue}</> : null}</div> : null}
          {badgeLine}
        </div>
      )}
    </BaseNode>
    </div>
  )
}
export const CoreCard = memo(CoreCardImpl)
