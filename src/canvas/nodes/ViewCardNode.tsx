/**
 * THE ONE CANVAS NODE ON THE OLUMI-CORE LANE (decision A): every card of the View's model, whatever its family, drawn by this one
 * component from its View card exactly as core wrote it (src/olumiView/canvas.ts puts them on the canvas). Each drawn string carries
 * `data-view`, the path to it (`<card id>.<field>`, as the chances block's), and each mark carries core's hover. A proposed change shows
 * core's mark, whose hover names every field the change moves, before → after (core's changedFields, 00047 #1): a person sees what they
 * would approve on the card it changes. The face is compact (glyph, heading, marks, figure, an option's rows, or what an assumption
 * says); the card's other words open beside it on selection. Links run top to bottom, as the causal graph reads. Text is in the canvas
 * tokens, which carry the zoom counter-scale.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ChevronDown } from 'lucide-react'
import { useMemo } from 'react'
import type { ViewCard as Card, ViewRow } from '../../olumiView/client'
import { typography } from '../../styles/typography'
import { askKindOf, CARD_WIDTH, drawKindOf, ifApprovedMarkOf, type RestsOnItem } from '../../olumiView/layout'
import { ifApprovedFieldOf } from '../../olumiView/standin'
import { NodeShapeIndicator } from './NodeShapeIndicator'
import { useCanvasStore } from '../store'
import { useViewStore } from '../../olumiView/store'
import { useCardNumber, useDriverOf, useRestsOnItem, useTriedOn } from '../../olumiView/lens'
import { WHAT_IF_COPY } from '../artefacts/whatIfCopy'
import { NodeQuickActions } from './shared/NodeQuickActions'
import { NodeCoachingMarker } from './shared/NodeCoachingMarker'
import { Badge } from '../../olumiView/Badge'
import { FigureEdit } from '../../olumiView/FigureEdit'
import { failedOf, failedReasonOf } from '../../olumiView/k5'

export type ViewCardData = { card: Card }

/**
 * The original card's places, kept as named, empty mount points (DL 4 Nov) for the v10 features the design lead puts back on this shell:
 * each is a `data-slot` element (the outline is the card's own `data-slot-outline`), drawn empty and taking no room.
 */
export const VIEW_CARD_SLOTS = {
  olumiBadge: 'olumi-badge', // the bottom-right corner
  driverBadge: 'driver-badge', // the top-right corner, option cards
  outcomeBand: 'outcome-band', // under status line 2, option cards
  titleMark: 'title-mark', // the title line: Olumi's inline mark, the only blue
  figureSide: 'figure-side', // beside the figure's value line: the what-if Try and the Rests-on glyph
  valuesBand: 'values-band', // a block under the figure's value line: cards[].values, one bar per option on the card's own axis (v10)
  marks: 'marks', // the bottom marks row
  rail: 'rail', // below the card
} as const
const Slot = ({ name, className = '' }: { name: string; className?: string }) => <span data-slot={name} className={className} />

const NBSP = '\u00a0'
const Mark = ({ at, mark }: { at: string; mark: { glyph: string; title: string } | null }) => (
  mark === null ? null : <span title={mark.title} aria-label={mark.title} data-view={`${at}.glyph`}>{mark.glyph}</span>
)

/** One row of an option card, as core wrote it: a chance, a limit, or why there is none yet. */
/** Core's ↻ "If approved" beside a Run-derived value while a pending proposal is shown (layout.ts ifApprovedMarkOf), bound to its key item. */
type IfApproved = { glyph: string; title: string; i: number } | null
type ValueMark = { glyph: string; title: string; at: string } | null
/**
 * The mark beside one value: R5 core's own (`if_approved` on the value, only where the proposal moves it, its words verbatim), and on a core
 * before R5 (no key) the R4 rule, every Run-derived value while a proposal is shown (`blanket`).
 */
function valueMark(x: object, at: string, blanket: IfApproved): ValueMark {
  const core = ifApprovedFieldOf(x)
  if (core !== undefined) return core === null ? null : { glyph: core.glyph, title: core.title, at: `${at}.if_approved.glyph` }
  return blanket === null ? null : { glyph: blanket.glyph, title: blanket.title, at: `key.${blanket.i}.glyph` }
}
const IfApprovedMark = ({ mark }: { mark: ValueMark }) => (
  mark === null ? null : <span title={mark.title} aria-label={mark.title} data-if-approved="" data-view={mark.at}>{mark.glyph}</span>
)

function Row({ id, row, i, ifApproved = null }: { id: string; row: ViewRow; i: number; ifApproved?: IfApproved }) {
  const at = `${id}.rows.${i}`
  const moved = valueMark(row, at, ifApproved)
  switch (row.kind) {
    case 'chance':
      return (
        // Inline, never a flex row: each mark follows the value's last word after a no-break space, so it wraps with that word and never
        // alone (R5, the real capacity board: a lone ◆ after "…does not happen").
        <p title={row.title} data-view-row={at}>
          <span data-view={`${at}.aim`}>{row.aim}</span>{' '}
          <span className={typography.nodeValue}>{row.approx === '' ? null : <span data-view={`${at}.approx`}>{row.approx}</span>}<span data-view={`${at}.value`}>{row.value}</span>
            {row.olumi === null ? null : <>{NBSP}<Mark at={`${at}.olumi`} mark={row.olumi} /></>}
            {row.likely === null ? null : <>{NBSP}<Mark at={`${at}.likely`} mark={row.likely} /></>}
            {moved === null ? null : <>{NBSP}<IfApprovedMark mark={moved} /></>}
          </span>
        </p>
      )
    case 'limit':
      return <p title={row.title} data-view-row={at}><span data-view={`${at}.aim`}>{row.aim}</span> <span className={typography.nodeValue} data-view={`${at}.value`}>{row.value}</span> <Mark at={`${at}.olumi`} mark={row.olumi} /></p>
    case 'none':
      // a core before view-dock serves no `text`: the row says its title, as before (00058 P1)
      return row.text == null
        ? <p data-view-row={at}><span data-view={`${at}.title`}>{row.title}</span></p>
        : <p title={row.title} data-view-row={at}><span data-view={`${at}.text`}>{row.text}</span></p>
  }
}

/** One option's row on a worked-out figure card: the option's number (O1, …) as the canvas numbers it, then core's line, two lines at most, whole on hover. */
function OptionValueRow({ at, option, text, mark = null }: { at: string; option: string; text: string; mark?: ValueMark }) {
  const n = useCardNumber(option)
  return (
    <p className="line-clamp-2" title={text} data-value-row={option}>
      {n === null ? null : <><span className="text-text-light font-normal tabular-nums" data-card-number={n}>{n}</span>{' '}</>}
      <span data-view={at}>{text}</span>{mark === null ? null : <>{NBSP}<IfApprovedMark mark={mark} /></>}
    </p>
  )
}

/** One View card, pure: a test draws it from a golden View. */
export function ViewCard({ card, selected = false, restsOn = null, driverOf = null, number = null, tried = null, pulsed = false, kind = askKindOf(card.family), ifApproved = null }: ViewCardData & { selected?: boolean; restsOn?: RestsOnItem | null; driverOf?: readonly Card[] | null; number?: string | null; tried?: string | null; pulsed?: boolean; kind?: ReturnType<typeof drawKindOf>; ifApproved?: IfApproved }) {
  const id = card.id
  // A figure card core marks as Olumi's (its ◆, or ◐ for a person's figure Olumi reads as a range) reads at a glance as Olumi's estimate:
  // the figure in Olumi's colour, its hover core's mark, and the way to give yours always shown (core L1/L2: "give yours with ✎").
  // K5 (R3): Olumi's failure stories resting on this card, and an option's story most within the team's control (./k5.ts, ahead of core).
  const failed = failedOf(card), reason = failedReasonOf(card)
  const estimate = card.family === 'quantity' && card.olumi !== null && card.figure !== null
  // A card with no figure and no rows (an assumption, a condition) says what it holds in its reason: that stays on the face, one line
  // and whole on hover (DL 4 Nov). Any other card's reason opens with its other words.
  const says = card.figure === null && card.rows.length === 0 && card.reason !== null
  // A card Olumi's proposal adds (core's change `kind: 'added'`; the View's model is the proposal's while one is held): drawn as the original canvas's
  // proposal ghost (ProposalGhostLayer: translucent, a solid 1px info border, never dashed, which means doubt), with core's own words
  // for it ("Proposed addition") as its caption. Approving stays the Proposal card's in the chat.
  const ghost = card.change?.kind === 'added'
  // A worked-out figure with a line per option (core's `values`, two or more) is drawn a row per option, not as one run-on sentence that
  // grows the card past the screen (R3 pristine: OC1 on the capacity model ran 8 lines).
  const perOption = card.figure !== null && (card.values?.length ?? 0) > 1
  const more = card.status !== null || (card.reason !== null && !says) || card.bound !== null || card.premises.length > 0
  return (
    // Core's marks on the card itself (00057 #4): Olumi points at it (`focus`), it is challenged, or core doubts it (dashed).
    <div
      style={{ width: CARD_WIDTH }}
      className={`group relative text-[length:calc(12px*var(--canvas-label-scale,1))] leading-[1.35] font-sans text-text-body rounded-md border ${ghost ? 'bg-panel/80' : 'bg-panel'} px-3 pb-3 pt-3.5 space-y-1 shadow-sm ${card.doubt ? 'border-dashed' : ''} ${card.challenged ? 'border-[var(--olumi-mark-orange)]' : ghost ? 'border-info' : 'border-border'} ${card.focus ? 'ring-2 ring-info' : pulsed ? 'ring-4 ring-info/60 ai-highlight-pulse' : driverOf !== null ? 'ring-[3px] ring-text-header' : ''}`}
      data-view-card={id} data-proposed-card={ghost || undefined} data-pulsed={pulsed || undefined} data-focus={card.focus || undefined} data-challenged={card.challenged || undefined} data-doubt={card.doubt || undefined}
      data-slot-outline="next-step" data-driver-of={driverOf === null ? undefined : driverOf.map((o) => o.id).join(' ')}
      // What would change: the ring says this figure is one an option's chance moves most with; its options' driver words on hover. The
      // options themselves carry v10's driver badge (DL 4 Nov: one representation, no chip here).
      title={driverOf === null ? undefined : driverOf.map((o) => o.driver!.title).join('\n')}
    >
      {restsOn === null ? null : (
        // The Rests on lens: this card's number, in Olumi's blue when core marks it Olumi's (one to check or set), its hover core's mark.
        <span className={`absolute -left-2 -top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border bg-panel px-1 tabular-nums ${typography.nodeLabel} ${restsOn.olumi ? 'border-info text-info' : 'border-border text-text-body'}`}
          title={restsOn.olumi && card.olumi ? card.olumi.title : undefined} data-rests-on={restsOn.n} data-rests-on-olumi={restsOn.olumi || undefined}>{restsOn.n}</span>
      )}
      {tried === null ? null : (
        // What if: the figure tried on a copy, as the person typed it, on its card's corner, out of flow so no card moves (legacy
        // WhatIfMarkLayer's "What if: …"); the lens's key card holds core's words for it and what each option gives.
        <span className={`absolute -right-2 -top-2 z-10 max-w-[180px] truncate rounded border border-info bg-panel px-2 py-0.5 text-text-header ${typography.nodeLabel}`}
          title={tried} data-whatif-mark={card.id}>{WHAT_IF_COPY.whatIf}: {tried}</span>
      )}
      {/* The original canvas's connector glyph: the card's kind as its shape, on the top edge where its links arrive. */}
      <span className="absolute -top-[10px] left-1/2 -translate-x-1/2 leading-none" aria-hidden="true">
        <NodeShapeIndicator nodeKind={kind} size={18} stroke="var(--bg-panel)" strokeWidth={0.6} />
      </span>
      {ghost ? <p className="text-text-light" data-view={`${id}.change.title`}>{card.change!.title}</p> : null}
      {/* One block of inline words, so a wrapped title returns to the card's left edge under its number, as the original's did (R3 pristine). */}
      <p data-view-title={id}>
        <span className="sr-only" data-view={`${id}.glyph`}>{card.glyph}</span>
        {number === null ? null : <><span className="text-text-light font-normal" data-card-number={number}>{number}</span>{' '}</>}
        {/* Core's detail ("… · quantity · Theirs: …") is its page's hover text, not a line: on the heading, whole (DL 4 Nov, Paul's rule). */}
        <span className={`${typography.nodeTitle} font-semibold text-text-header`} title={card.detail === '' ? undefined : card.detail} data-view={`${id}.heading`}>{card.heading}</span>
        {card.olumi === null ? null : <>{' '}<Mark at={`${id}.olumi`} mark={card.olumi} /></>}
        {card.change === null ? null : <>{' '}<Mark at={`${id}.change`} mark={card.change} /></>}
        <Slot name={VIEW_CARD_SLOTS.titleMark} className="ml-1 empty:hidden" />
      </p>
      {card.family === 'option' ? <Slot name={VIEW_CARD_SLOTS.driverBadge} className="absolute right-1 top-1 empty:hidden" />
        // The original's ⌄ on a card with more to say: a press selects the card, which opens its other words beside it.
        : more ? <ChevronDown aria-hidden="true" data-more-cue="" className="absolute right-1.5 top-2 h-3.5 w-3.5 text-text-light" /> : null}
      {says ? <p className="line-clamp-2" title={card.reason!} data-view={`${id}.reason`}>{card.reason}</p> : null}
      {card.figure === null ? null : (
        <div className="flex items-baseline gap-1">
          {perOption ? (
            // One row per option, core's own line for it (`values[].text`), after the option's number as the canvas numbers it: the face stays
            // compact, two lines a row at most, the whole row on hover; core's sentence for every option stays the hover of the rows (R3 pristine).
            <div className={`${typography.nodeValue} min-w-0 flex-1 space-y-0.5 ${estimate ? 'text-info' : ''}`} title={estimate ? `${card.figure.title} · ${card.olumi!.title}` : card.figure.title}
              data-olumi={estimate || undefined} data-view-values={id}>
              {card.values!.map((v, i) => <OptionValueRow key={v.option} at={`${id}.values.${i}.text`} option={v.option} text={v.text} mark={valueMark(v, `${id}.values.${i}`, ifApproved)} />)}
            </div>
          ) : (
            <p className={`${typography.nodeValue} ${estimate ? 'text-info' : ''}`} title={estimate ? `${card.figure.title} · ${card.olumi!.title}` : card.figure.title}
              data-olumi={estimate || undefined} data-view={`${id}.figure.text`}>{card.figure.text}</p>
          )}
          <Slot name={VIEW_CARD_SLOTS.figureSide} className="empty:hidden" />
        </div>
      )}
      {card.figure === null ? null : <Slot name={VIEW_CARD_SLOTS.valuesBand} className="block empty:hidden" />}
      {card.figure?.edit ? <span className={selected ? '' : 'invisible group-hover:visible'} data-at-rest-hidden=""><FigureEdit id={card.id} edit={card.figure.edit} {...(estimate ? { glyph: '✎', label: 'Give yours' } : {})} quiet={!selected} /></span> : null}
      {card.rows.map((row, i) => (
        <span key={i} className="contents">
          <Row id={id} row={row} i={i} ifApproved={ifApproved} />
          {card.family === 'option' && i === Math.min(1, card.rows.length - 1) ? <Slot name={VIEW_CARD_SLOTS.outcomeBand} className="block empty:hidden" /> : null}
        </span>
      ))}
      {card.badge === null ? null : <p className={selected ? '' : 'invisible group-hover:visible'} data-at-rest-hidden=""><Badge cardId={id} badge={card.badge} at={id} /></p>}
      {/* An option the team committed to (olumi.view/3 `committed`, the newest commitment naming it): who, in the marks row; when, on hover. */}
      <span data-slot={VIEW_CARD_SLOTS.marks} className="flex gap-1 empty:hidden">
        {card.committed == null ? null : <span className="text-text-light" title={`Committed by: ${card.committed.by} · ${card.committed.at}`} data-committed={id}>Committed by: <span data-view={`${id}.committed.by`}>{card.committed.by}</span></span>}
        {/* K5 "If it failed" (R3): one badge per pre-mortem story resting on this card, core's number with Olumi's mark, the story in
            Olumi's words on hover; on an option, the story most within the team's control, in core's words. All Olumi's (./k5.ts). */}
        {failed.map((f, j) => (
          <span key={`f${f.n}`} className="text-info" title={`${f.olumi.title} · ${f.title}`} aria-label={`${f.olumi.title} · ${f.title}`} data-failed={`${id}.${f.n}`}>
            <span data-view={`${id}.failed.${j}.olumi.glyph`}>{f.olumi.glyph}</span><span>{f.n}</span>
          </span>
        ))}
        {reason === null ? null : (
          <span className="text-info" title={`${reason.olumi.title} · ${reason.title}`} aria-label={`${reason.olumi.title} · ${reason.text} · ${reason.title}`} data-failed-reason={id}>
            <span data-view={`${id}.failed_reason.olumi.glyph`}>{reason.olumi.glyph}</span> <span data-view={`${id}.failed_reason.text`}>{reason.text}</span>
          </span>
        )}
      </span>
      <Slot name={VIEW_CARD_SLOTS.olumiBadge} className="absolute bottom-1 right-1 empty:hidden" />
      {more ? (
        // The card's other words (its status, reason, bound and premises), every one core's, beside the card while it is selected: the
        // face stays compact so the causal graph reads (Paul 4 Nov), and opening them never changes the card's drawn height.
        <div hidden={!selected} className={`absolute left-full top-0 z-10 ml-2 space-y-1 rounded-lg border border-border bg-panel p-3 shadow-sm ${typography.nodeLabel}`}
          style={{ width: CARD_WIDTH }} data-view-more={id}>
          {card.status === null ? null : <p data-view={`${id}.status`}>{card.status}</p>}
          {card.reason === null || says ? null : <p data-view={`${id}.reason`}>{card.reason}</p>}
          {card.bound === null ? null : (
            <p title={card.bound.title}><span data-view={`${id}.bound.text`}>{card.bound.text}</span>
              {card.bound.olumi === null ? null : <> <Mark at={`${id}.bound.olumi`} mark={card.bound.olumi} /></>}</p>
          )}
          {card.premises.map((p, j) => (
            // One line each, cut with an ellipsis, the glyph first and the whole on hover, as core's page draws a premise (.premise: nowrap,
            // ellipsis): a premise shared by several options otherwise repeated in full on each card (DL 4 Nov).
            <p key={j} title={p.title} className="truncate" data-premise-row={`${id}.${j}`}><span data-view={`${id}.premises.${j}.glyph`}>{p.glyph}</span> <span data-view={`${id}.premises.${j}.text`}>{p.text}</span></p>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * The React Flow node: the card, with the handles its links attach to, and the Olumi controls every canvas card carries (review 00063
 * #3): Ask Olumi and Challenge (which on this lane reach core: a challenge on core's own challenge route for this card, through the
 * Olumi tab, src/olumiView/ViewChat.tsx), and the card's coaching marker.
 */
export function ViewCardNode({ id, data, selected }: NodeProps) {
  const { card } = data as ViewCardData
  const restsOn = useRestsOnItem(id)
  const driverOf = useDriverOf(id)
  const number = useCardNumber(id)
  const tried = useTriedOn(id)
  // The applied-edit pulse (pulseArrivals.ts, appliedEditPulse.ts): the original card's ring on a card an approval or edit just applied.
  const pulsed = useCanvasStore((st) => st.highlightedNodes.has(id))
  // The card's role in core's model (`drawKindOf`): its shape on the canvas, the same on every version.
  const view = useViewStore((st) => st.view)
  const model = view?.model ?? null
  const kind = model === null ? askKindOf(card.family) : drawKindOf(card, model)
  // While core's View shows a pending proposal, its Run is the proposal's: each Run-derived line says "If approved" (DL ruling, R4).
  const ifApproved = useMemo(() => ifApprovedMarkOf(view), [view])
  const noted = useCanvasStore((st) => st.olumiAttention?.nodeIds?.[0] === id)
  return (
    <div className="group/vcard relative">
      <Handle type="target" position={Position.Top} isConnectable={false} className="!opacity-0" />
      <ViewCard card={card} selected={selected === true} restsOn={restsOn} driverOf={driverOf} number={number} tried={tried} pulsed={pulsed} kind={kind} ifApproved={ifApproved} />
      <div className="absolute left-3 bottom-2"><NodeCoachingMarker nodeId={id} /></div>
      {/* Olumi's corner controls at rest only on the card Olumi's note is about; on any card while hovered or selected. */}
      <div className={selected === true || noted ? '' : 'opacity-0 group-hover/vcard:opacity-100 focus-within:opacity-100'} data-olumi-controls="">
        <NodeQuickActions nodeId={id} nodeType={askKindOf(card.family)} label={card.heading} placement="below" alwaysVisible={selected === true || noted} />
      </div>
      <Slot name={VIEW_CARD_SLOTS.rail} className="absolute left-0 top-full empty:hidden" />
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="!opacity-0" />
    </div>
  )
}
