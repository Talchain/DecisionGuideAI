/**
 * THE ONE CANVAS NODE ON THE OLUMI-CORE LANE (decision A): every card of the View's model, whatever its family, drawn by this one
 * component from its View card exactly as core wrote it (src/olumiView/canvas.ts puts them on the canvas). Each drawn string carries
 * `data-view`, the path to it (`<card id>.<field>`, as the chances block's), and each mark carries core's hover. A proposed change shows
 * core's mark, whose hover names every field the change moves, before → after (core's changedFields, 00047 #1): a person sees what they
 * would approve on the card it changes. The face is compact (glyph, heading, marks, figure, an option's rows, or what an assumption
 * says); the card's other words open beside it on selection. Links run top to bottom, as the causal graph reads. Text is in the canvas
 * tokens, which carry the zoom counter-scale.
 */
import { Handle, Position, useReactFlow, useStore, type NodeProps } from '@xyflow/react'
import { computeFitPadding } from '../utils/computeFitPadding'
import { paddingToInsets } from '../utils/cameraComfort'
import { SELECTED_RING } from '../../styles/selected'
import { panToKeepInView } from '../utils/keepInView'
import { ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ViewCard as Card, ViewReading, ViewRow } from '../../olumiView/client'
import { typography } from '../../styles/typography'
import { askKindOf, CARD_WIDTH, drawKindOf, ifApprovedMarkOf, leadChanceIndex, optionsNotYet, readingOf, sharedAimsOf, type RestsOnItem, type TryOnCard } from '../../olumiView/layout'
import { clearWhatIf } from '../../olumiView/whatif'
import { ifApprovedFieldOf } from '../../olumiView/standin'
import { NodeShapeIndicator } from './NodeShapeIndicator'
import { panelSide } from './panelSide'
import { cardBoxesOf, sameBoxes, type CardBox } from '../edges/ViewLinkEdge'
import { useCanvasStore } from '../store'
import { useViewStore } from '../../olumiView/store'
import { useLinkSides, useViewFocusCard } from '../../olumiView/canvas'
import { useDriverOf, useOptionHeading, usePreMortemOf, useRestsOnItem, useTriedOn, useTryOn } from '../../olumiView/lens'
import { WHAT_IF_COPY } from '../artefacts/whatIfCopy'
import { NodeQuickActions } from './shared/NodeQuickActions'
import { NodeCoachingMarker } from './shared/NodeCoachingMarker'
import { Badge } from '../../olumiView/Badge'
import { FigureEdit, HeldEditOffer, useOpenFigureEdits } from '../../olumiView/FigureEdit'
import { failedOf, failedReasonOf } from '../../olumiView/k5'
import { StatedFigure } from '../../olumiView/StatedFigure'

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
  mark === null ? null : <span className="font-normal" title={mark.title} aria-label={mark.title} data-view={`${at}.glyph`}>{mark.glyph}</span>
)

/** One row of an option card, as core wrote it: a chance, a limit, or why there is none yet. */
/** Core's ↻ "If approved" beside a Run-derived value while a pending proposal is shown (layout.ts ifApprovedMarkOf), bound to its key item. */
type IfApproved = { glyph: string; title: string; i: number } | null
const NO_AIMS: readonly string[] = []
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
  mark === null ? null : <span className="font-normal" title={mark.title} aria-label={mark.title} data-if-approved="" data-view={mark.at}>{mark.glyph}</span>
)

/** R18 fix 1: core's short companion words under a chance ("about 50% without Olumi's suggested risk"): muted, one line, cut short with core's
 *  full sentence on hover. R19: beside it, core's timing line for the same chance ("about 41% if 'Tech lead start delay' is 1 month; under 1% if 4
 *  months"), the same muted, one-line, cut-short look with `timing_title` on hover. Nothing formatted here; each absent on a core before it (and
 *  where the chance rests on no suggested risk, or no timing assumption moves it by 10 points). */
const Companion = ({ row, at }: { row: Extract<ViewRow, { kind: 'chance' }>; at: string }) => (
  <>
    {row.companion == null ? null : <span className={`${typography.viewLabel} block text-text-light`} title={row.companion_title ?? row.companion} data-row-companion={at}><span data-view={`${at}.companion`}>{row.companion}</span></span>}
    {row.timing == null ? null : <span className={`${typography.viewLabel} block text-text-light`} title={row.timing_title ?? row.timing} data-row-timing={at}><span data-view={`${at}.timing`}>{row.timing}</span></span>}
  </>
)

/**
 * A LINE THAT CAN CARRY A WHOLE RUN SENTENCE, drawn whole (Paul's visual gate, 8 Nov: nothing cut; supersedes R25's three-line clamp and its
 * Show all control). The row keeps its binding (`data-view-row`) and core's sentence as its hover.
 */
export function Disclosed({ at, className = '', title, children }: { at: string; className?: string; title?: string; children: ReactNode }) {
  return <div className={className} data-view-row={at}><div title={title}>{children}</div></div>
}

function Row({ id, row, i, ifApproved = null, lead = null, aimShown = false }: { id: string; row: ViewRow; i: number; ifApproved?: IfApproved; lead?: boolean | null; aimShown?: boolean }) {
  const at = `${id}.rows.${i}`
  const moved = valueMark(row, at, ifApproved)
  // The compact face (C1, 4 Nov: details on hover or selection), every word core's and verbatim, and every line whole (R25, Paul's finish
  // line: no cut text, after his 6 Nov test cut aims to "Crea…" and numbers mid-range). Each mark sits in its own column beside the value,
  // so it never wraps alone onto a line (R5's rule, kept by the column rather than a no-break space).
  switch (row.kind) {
    case 'chance': {
      const marks = row.olumi !== null || row.likely !== null || moved !== null
      const markSpan = marks ? (
        <span className="flex-none whitespace-nowrap" data-row-marks={at}>
          {row.olumi === null ? null : <Mark at={`${at}.olumi`} mark={row.olumi} />}
          {row.likely === null ? null : <>{row.olumi === null ? null : NBSP}<Mark at={`${at}.likely`} mark={row.likely} /></>}
          {moved === null ? null : <>{NBSP}<IfApprovedMark mark={moved} /></>}
        </span>
      ) : null
      // The previous PoC's face (Paul's item 1, option a2): the option's first aim is one big chance with the aim's target mark, its aim in the
      // DOM for readers and on hover; every other aim is one small line, the aim cut short before its chance, whole on hover. Words are core's.
      if (lead === true) return (
        <div title={`${row.aim} · ${row.title}`} data-view-row={at}>
        {/* With more than one aim, the lead chance names its aim on the face too, as every other aim's line does (DL/PL 7 Nov, Paul: "can't
            tell which aim a chance is for"); its ◎ moves to the aim's line so it never stands twice. With one aim: for readers and on hover. */}
        {aimShown ? <p className="text-text-light"><span aria-hidden="true" style={{ color: 'var(--goal)' }}>◎</span> <span data-view={`${at}.aim`}>{row.aim}</span></p> : null}
        <div className="flex items-baseline gap-1">
          {aimShown ? null : <span className="sr-only" data-view={`${at}.aim`}>{row.aim}</span>}
          {/* R25 (Paul's finding C1, "about 13% / chance" on two lines; DL 7 Nov): one line. Core's qualifier (`approx`, its own field) and
              the ◎ are reading size; core's value is the 18px headline, set tight so "about 49% chance" fits one line beside its marks
              in the 220px card (measured: 165px plain, 158px tight, 162px free); a long conditional one still wraps inside the card. */}
          {aimShown ? null : <span aria-hidden="true" style={{ color: 'var(--goal)' }} className={typography.viewValue}>◎</span>}
          <span className="min-w-0 text-text-header" data-row-value={at}>{row.approx === '' ? null : <span className={typography.viewValue} data-view={`${at}.approx`}>{row.approx}</span>}<span className={`${typography.viewHeadline} tracking-tight`} data-view={`${at}.value`}>{row.value}</span></span>
          {markSpan}
        </div>
        <Companion row={row} at={at} />
        </div>
      )
      if (lead === false) return (
        <div title={`${row.aim} · ${row.title}`} data-view-row={at}>
        {/* R25 (Paul's 6 Nov test: aims cut to "Crea…"): the aim whole, its ◎ inline so it never stands alone on a line; then the chance on its
            own line, whole, its marks beside it (a long one, core's conditional wording, wraps inside the card, never cut). */}
        <p className="text-text-light"><span aria-hidden="true" style={{ color: 'var(--goal)' }}>◎</span> <span data-view={`${at}.aim`}>{row.aim}</span></p>
        <div className="flex items-baseline gap-x-1">
          <span className={`${typography.viewValue} min-w-0 text-text-body`} data-row-value={at}>{row.approx === '' ? null : <span data-view={`${at}.approx`}>{row.approx}</span>}<span data-view={`${at}.value`}>{row.value}</span></span>
          {markSpan}
        </div>
        <Companion row={row} at={at} />
        </div>
      )
      return (
        <div title={row.title} data-view-row={at}>
          <span className="block" data-view={`${at}.aim`}>{row.aim}</span>
          <span className="flex items-baseline gap-1">
            <span className={`${typography.viewValue} min-w-0`} data-row-value={at}>{row.approx === '' ? null : <span data-view={`${at}.approx`}>{row.approx}</span>}<span data-view={`${at}.value`}>{row.value}</span></span>
            {marks ? (
              <span className="flex-none whitespace-nowrap" data-row-marks={at}>
                {row.olumi === null ? null : <Mark at={`${at}.olumi`} mark={row.olumi} />}
                {row.likely === null ? null : <>{row.olumi === null ? null : NBSP}<Mark at={`${at}.likely`} mark={row.likely} /></>}
                {moved === null ? null : <>{NBSP}<IfApprovedMark mark={moved} /></>}
              </span>
            ) : null}
          </span>
          <Companion row={row} at={at} />
        </div>
      )
    }
    case 'limit':
      return (
        <div className="flex flex-wrap items-baseline gap-x-1 text-text-light" title={`${row.aim} · ${row.title}`} data-view-row={at}>
          {/* The limit and its value both whole (R25: no cut text); a long value wraps inside the card. */}
          <span className="min-w-0" data-view={`${at}.aim`}>{row.aim}</span> <span className={`${typography.viewValue} flex-none max-w-[65%] text-text-body`} data-row-value={at}><span data-view={`${at}.value`}>{row.value}</span></span>
          {row.olumi === null ? null : <span className="flex-none whitespace-nowrap" data-row-marks={at}><Mark at={`${at}.olumi`} mark={row.olumi} /></span>}
        </div>
      )
    case 'none': {
      // a core before view-dock serves no `text`: the row says its title, as before (00058 P1)
      const text = row.text == null
        ? <Disclosed at={at}><span data-view={`${at}.title`}>{row.title}</span></Disclosed>
        : <Disclosed at={at} title={row.title}><span data-view={`${at}.text`}>{row.text}</span></Disclosed>
      // R20: core's timing sweep under a none row's words ("Under these timing assumptions: about X% if …"), drawn as the chance row's timing line is; absent on a core before it
      return row.timing == null ? text : (
        <>
          {text}
          <span className={`${typography.viewLabel} block text-text-light`} title={row.timing_title ?? row.timing} data-row-timing={at}><span data-view={`${at}.timing`}>{row.timing}</span></span>
        </>
      )
    }
  }
}

/**
 * One option's row on a worked-out figure card: the option's number (O1, …) as the canvas numbers it, then core's line on one line, cut
 * short and whole on hover (option a2). The ↻ mark keeps its own column, so the cut never hides it.
 */
function OptionValueRow({ at, option, text, mark = null }: { at: string; option: string; text: string; mark?: ValueMark }) {
  // The row names its option by core's heading, whole, on its own line (no card codes on the canvas: DL 8 Nov, the V11 audit).
  const name = useOptionHeading(option)
  return (
    <div title={text} data-value-row={option}>
    {name === null ? null : <p className={`${typography.viewLabel} text-text-body font-normal`} data-value-option={option}>{name}</p>}
    <p className="flex items-baseline gap-1">
      {/* R25 (Paul's 6 Nov test: "6.73 months (2.61 …"): an option's value wraps whole, never cut mid-number. */}
      <span className="min-w-0" data-view={at}>{text}</span>{mark === null ? null : <span className="flex-none"><IfApprovedMark mark={mark} /></span>}
    </p>
    </div>
  )
}

/** One View card, pure: a test draws it from a golden View. */
export function ViewCard({ card, selected = false, side = 'right', restsOn = null, driverOf = null, tried = null, pulsed = false, kind = askKindOf(card.family), ifApproved = null, reading = null, shared = NO_AIMS, notYet = false , tryOn = null, version = null}: ViewCardData & { tryOn?: TryOnCard | null; version?: number | null; reading?: ViewReading | null; shared?: readonly string[]; notYet?: boolean; selected?: boolean; side?: 'right' | 'left'; restsOn?: RestsOnItem | null; driverOf?: readonly Card[] | null; tried?: string | null; pulsed?: boolean; kind?: ReturnType<typeof drawKindOf>; ifApproved?: IfApproved }) {
  const id = card.id, lead = leadChanceIndex(card)
  // A figure card core marks as Olumi's (its ◆, or ◐ for a person's figure Olumi reads as a range) reads at a glance as Olumi's estimate:
  // the figure in Olumi's colour, its hover core's mark, and the way to give yours always shown (core L1/L2: "give yours with ✎").
  // K5 (R3): Olumi's failure stories resting on this card, and an option's story most within the team's control (./k5.ts, ahead of core).
  const failed = failedOf(card), reason = failedReasonOf(card)
  const estimate = card.family === 'quantity' && card.olumi !== null && card.figure !== null
  // Pre-screen row 6: this card's editor, if it is open, with the edit core offered when it opened (kept while a proposal is held).
  const keptEdit = useOpenFigureEdits((o) => o.open.get(card.id) ?? null)
  // J1 step 3: who or what this card is from, core's words on its face (author.text: "Olumi's estimate", "Stated by Tom"), its source on
  // hover; a card Olumi inferred is drawn dashed in Olumi's colour. Olumi's own mark beside the heading says the same, so it is for readers.
  const author = card.author ?? null, inferred = author?.by === 'olumi'
  // A card with no figure and no rows (an assumption, a condition) says what it holds in its reason: that stays on the face, one line
  // and whole on hover (DL 4 Nov). Any other card's reason opens with its other words.
  const says = card.figure === null && card.rows.length === 0 && card.reason !== null
  // A card Olumi's proposal adds (core's change `kind: 'added'`; the View's model is the proposal's while one is held): drawn as the original canvas's
  // proposal ghost (ProposalGhostLayer: translucent, a solid 1px info border, never dashed, which means doubt), with core's own words
  // for it ("Proposed addition") as its caption. Approving stays the Proposal card's in the chat.
  const ghost = card.change?.kind === 'added'
  // A card the proposal changes (core's change `kind: 'changed'`): told apart at rest from a proposed addition and a kept card (plan v3
  // finish line: proposed, changed, Olumi's and approved distinguishable without hover) by the proposal's info border on an opaque card,
  // beside core's ↻; core's words for what changes (its change title, "figure 0 → 4") open with the card's other words.
  const changed = card.change?.kind === 'changed'
  // A worked-out figure with a line per option (core's `values`, two or more) is drawn a row per option, not as one run-on sentence that
  // grows the card past the screen (R3 pristine: OC1 on the capacity model ran 8 lines).
  const perOption = card.figure !== null && (card.values?.length ?? 0) > 1
  // An aim's or limit's target is on its face (below), so it no longer opens the card's other words.
  // Core's option face (card-face, 8 Nov: core owns the dedupe): an option card with core's `headline` draws that one line on its face,
  // core's `headline.title` on hover, and its rows only when opened. A View without a headline keeps its rows on the face.
  // A headline core marks `shared` (every option says the same, "No chance yet"), or any option's "no chance yet" while no option has a
  // chance (layout.ts optionsNotYet), is the panel's to say, once (J1 step 3): not on each card.
  const optionFace = card.family === 'option' && card.headline != null && card.headline.text !== '' && card.headline.shared !== true && !(notYet && card.headline.state === 'none') ? card.headline : null
  const more = card.status !== null || (card.reason !== null && !says) || card.premises.length > 0 || changed || (optionFace !== null && card.rows.length > 0)
  // More than one aim (an option's chance rows, one per aim): its lead chance names its aim on the face too (Paul: "can't tell which aim a
  // chance is for"; DL/PL 7 Nov). With one aim it stays for readers and on hover (fitA2).
  const aims = card.rows.filter((r) => r.kind === 'chance').length
  // Who or what the card is from (core's `author.text`), one pill: on a figure card it shares the figure's line, so the face stays compact
  // (J1 gate: the board whole at 1232 at full size); on any other card it leads the marks band.
  // Design owner, 8 Nov (strategy canvas audit): at rest only Olumi's cards say who they are from ("Olumi’s estimate"); a person's card
  // keeps its author for the card's hover title and the opened card (the board is the team's own unless marked otherwise).
  // DL ruling 9 Nov (rehearsal fbd2 step 5): THE FACE IS THE SAME AT REST, HOVERED, FOCUSED AND OPENED. The canvas lays out at drawn heights,
  // so a line shown on hover or focus moved every card below it. What a card says only when asked goes in its opened words beside it (`aside`).
  const faceTitle = card.face?.title ?? null, faceLine = card.face?.line ?? null
  const provenance = author === null || !inferred ? null : (
    <span className={`${typography.viewPanelMeta} inline-block max-w-full rounded-[11px] border border-info/30 px-2 py-0.5 font-medium text-text-body`} data-provenance={id} data-provenance-at-rest
      title={card.olumi === null ? author.title : `${author.title}\n${card.olumi.title}`} data-view={`${id}.author.text`}>{author.text}</span>
  )
  const theirs = author !== null && !inferred ? author : null
  // A route's line (an option's face line), a person's author and an open badge's fold-back: said in the opened card, never on the face.
  const aside = (faceLine !== null && card.family === 'option') || theirs !== null || (card.badge !== null && card.badge.open)
  // The rows as core sends them (each chance, limit or reason), drawn on the face, or in the opened card where core gives a face line.
  const rowsDrawn = (
    <>
      {card.rows.map((row, i) => (
        <span key={i} className="contents">
          {/* A reason every option shares (core's `run.shared_blockers`, `shared` here, by aim id and option id) is the panel's to say, once
              (SC-01 preview): the option card shows its title until a figure exists. A reason that is this option's own stays on its card. */}
          {/* J1 step 3: while no option has a chance yet (layout.ts optionsNotYet), the panel says so once; no option card repeats it. */}
          {row.kind === 'none' && ((row.aim_id !== null && shared.includes(row.aim_id)) || (notYet && card.family === 'option')) ? null
            : <Row id={id} row={row} i={i} ifApproved={ifApproved} lead={card.family !== 'option' || row.kind !== 'chance' ? null : i === lead} aimShown={aims > 1} />}
          {card.family === 'option' && i === Math.min(1, card.rows.length - 1) ? <Slot name={VIEW_CARD_SLOTS.outcomeBand} className="block empty:hidden" /> : null}
        </span>
      ))}
    </>
  )
  return (
    // Core's marks on the card itself (00057 #4): Olumi points at it (`focus`), it is challenged, or core doubts it (dashed). The opened card
    // carries the comp's ink ring (`.card.sel`, V11 pixel pass 9 Nov): the one selection cue, never blue (blue is Olumi's).
    // Hover (DL round 6, the re-score's #4): one neutral lift on every card, never a ring (the ink ring is selection, the blue one Olumi's).
    <div
      style={{ width: CARD_WIDTH }}
      className={`group relative text-[length:calc(14px*var(--canvas-label-scale,1))] leading-[18px] font-sans text-text-body rounded-xl border ${ghost || inferred ? 'bg-panel' : 'bg-panel shadow-[0_2px_4px_rgba(37,37,32,0.02)]'} px-3 py-2.5 space-y-1.5 ${card.doubt || inferred ? 'border-dashed' : ''} ${card.challenged || card.family === 'risk' ? 'border-[var(--olumi-mark-orange)]' : ghost || changed || inferred ? 'border-info' : card.family === 'goal' ? 'border-goal' : 'border-factor'} ${card.focus ? 'shadow-[0_0_0_3px_rgba(39,122,157,0.14)]' : pulsed ? 'ring-4 ring-info/60 ai-highlight-pulse' : driverOf !== null ? 'ring-[3px] ring-text-header' : ''} ${selected && !pulsed && driverOf === null ? SELECTED_RING : ''} ${card.focus || pulsed || driverOf !== null ? '' : 'transition-shadow duration-fast hover:shadow-2'}`}
      data-view-card={id} data-proposed-card={ghost || undefined} data-changed-card={changed || undefined} data-pulsed={pulsed || undefined} data-focus={card.focus || undefined} data-challenged={card.challenged || undefined} data-doubt={card.doubt || undefined} data-inferred={inferred || undefined}
      data-slot-outline="next-step" data-driver-of={driverOf === null ? undefined : driverOf.map((o) => o.id).join(' ')}
      // What would change: the ring says this figure is one an option's chance moves most with; its options' driver words on hover. The
      // options themselves carry v10's driver badge (DL 4 Nov: one representation, no chip here).
      title={driverOf !== null ? driverOf.map((o) => o.driver!.title).join('\n') : theirs === null ? undefined : `${theirs.text} · ${theirs.title}`}
    >
      {restsOn === null ? null : (
        // The Rests on lens: this card's number, in Olumi's blue when core marks it Olumi's (one to check or set), its hover core's mark.
        <span className={`absolute -left-2 -top-2 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border bg-panel px-1 tabular-nums ${typography.viewLabel} ${restsOn.olumi ? 'border-info text-info' : 'border-border text-text-body'}`}
          title={restsOn.olumi && card.olumi ? card.olumi.title : undefined} data-rests-on={restsOn.n} data-rests-on-olumi={restsOn.olumi || undefined}>{restsOn.n}</span>
      )}
      {tried === null ? null : (
        // What if: the figure tried on a copy, as the person typed it, on its card's corner, out of flow so no card moves (legacy
        // WhatIfMarkLayer's "What if: …"); the lens's key card holds core's words for it and what each option gives.
        <span className={`absolute -right-2 -top-2 z-10 max-w-[180px] truncate rounded border border-info bg-panel px-2 py-0.5 text-text-header ${typography.viewLabel}`}
          title={tried} data-whatif-mark={card.id}>{WHAT_IF_COPY.whatIf}: {tried}</span>
      )}
      {/* R25 (DL 7 Nov, Paul's rule: visual indicators, not default text): a proposed addition is shown by its info-coloured border on a
          translucent card (solid, never dashed: dashed means core doubts it) and core's + mark; core's words for it ("Proposed addition") are
          for readers and the mark's hover, never a printed line. */}
      {ghost ? <p className="sr-only" data-view={`${id}.change.title`}>{card.change!.title}</p> : null}
      {/* One block of inline words, so a wrapped title returns to the card's left edge under its number, as the original's did (R3 pristine). */}
      {/* An option core gives a driver carries v10's 20 px driver badge at right-1 top-1, 12 px into this row: the title keeps that room;
          so does any other card's title for its ⌄ (plan v3: controls get reserved space). */}
      <p data-view-title={id} className={(card.family === 'option' && card.driver !== null) || (card.family !== 'option' && more) ? 'pr-4' : undefined}>
        <span className="sr-only" data-view={`${id}.glyph`}>{card.glyph}</span>
        {/* J1 gate (the prototype's card): the card's kind as its shape, inline before its heading. */}
        <span className="mr-1.5 inline-flex align-[-2px] leading-none" aria-hidden="true" data-card-shape={id}><NodeShapeIndicator nodeKind={kind} size={14} /></span>
        {/* Core's detail ("… · quantity · Theirs: …") is its page's hover text, not a line: on the heading, whole (DL 4 Nov, Paul's rule). */}
        {/* FL1 (core `face`): the face's title, said once (their words, Olumi's, or the card's own name); `heading` stays the whole label,
            read by a screen reader where the title is shorter. A core before `face` draws the heading as before. */}
        {faceTitle === null || faceTitle.text === card.heading
          ? <span className={`${typography.viewTitle} font-medium text-text-header`} title={card.detail === '' ? undefined : card.detail} data-view={`${id}.heading`}>{card.heading}</span>
          : <><span className={`${typography.viewTitle} font-medium text-text-header`} title={card.detail === '' ? card.heading : card.detail} data-face-words={faceTitle.words} data-view={`${id}.face.title.text`}>{faceTitle.text}</span>
            <span className="sr-only" data-view={`${id}.heading`}>{card.heading}</span></>}
        {card.olumi === null ? null : author !== null ? <span className="sr-only"><Mark at={`${id}.olumi`} mark={card.olumi} /></span> : <>{' '}<Mark at={`${id}.olumi`} mark={card.olumi} /></>}
        {card.change === null ? null : <>{' '}<Mark at={`${id}.change`} mark={card.change} /></>}
        <Slot name={VIEW_CARD_SLOTS.titleMark} className="ml-1 empty:hidden" />
      </p>
      {card.family === 'option' ? <Slot name={VIEW_CARD_SLOTS.driverBadge} className="absolute right-1 top-1 empty:hidden" />
        // The original's ⌄ on a card with more to say: a press selects the card, which opens its other words beside it.
        : more ? <ChevronDown aria-hidden="true" data-more-cue="" className="absolute right-1.5 top-2 h-3.5 w-3.5 text-text-light" /> : null}
      {faceLine === null || card.family === 'option' ? null : (
        // FL1: the face's one short line under the title, core's words whole (never clamped), as the prototype's card sentence.
        // A route's line is its own quote from the brief: in its opened words (`aside`), so the column of routes stays whole at 1232 (FL1:
        // these lines are optional). Every other card's line is on its face at rest.
        <p className={`${typography.viewLabel} text-text-body`} data-face-words={faceLine.words} data-view={`${id}.face.line.text`}>{faceLine.text}</p>
      )}
      {says ? <Disclosed at={`${id}.reason-line`} title={card.reason!}><span data-view={`${id}.reason`}>{card.reason}</span></Disclosed> : null}
      {card.bound === null ? null : (
        // An aim's or limit's target, core's own words from its target record ("at least 10%"), on the face under the heading, as the
        // previous PoC's "Target: …" line (DL 6 Nov: a label names the outcome alone, so the number is never hidden behind a selection).
        <p className={typography.viewValue} title={card.bound.title}><span data-view={`${id}.bound.text`}>{card.bound.text}</span>
          {card.bound.olumi === null ? null : <> <Mark at={`${id}.bound.olumi`} mark={card.bound.olumi} /></>}</p>
      )}
      {reading === null ? null : (
        // R19: how the Run reads this aim over its window, core's sentence once, under the target. Olumi's own reading is Olumi's colour (it is a
        // proposal the person can change); one their words state, or one that contradicts them, is quiet. Whole on the face (R25: no cut text).
        <p className={`${typography.viewLabel} ${reading.source === 'proposal' ? 'text-info' : 'text-text-light'}`} title={reading.text} data-reading={reading.source} data-view={`${id}.reading`}>{reading.text}</p>
      )}
      {/* A figure with no value (asked, unsized, unsupported: core's `figure.text` '', its words in `figure.title` and `detail`, DL 10 Nov)
          and nothing else to hold (no ✎, no Olumi pill, no held proposal to set aside) takes no row, not an empty one. */}
      {card.figure === null || (card.figure.text === '' && !perOption && !card.figure.edit && provenance === null && ifApproved === null) ? null : (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
          {perOption ? (
            // One row per option, core's own line for it (`values[].text`), after the option's number as the canvas numbers it: the face stays
            // compact, every row whole (R25: no cut text); core's sentence for every option stays the hover of the rows (R3 pristine).
            // The rows take the card's whole width (never a narrow column beside the ✎ and the author pill, which wrapped a row one word
            // to a line: V11 rehearsal, 9 Nov); the ✎ and the pill follow on the next line.
            <div className={`${typography.viewValue} min-w-0 basis-full space-y-0.5 ${estimate ? 'text-info' : ''}`} title={estimate ? `${card.figure.title} · ${card.olumi!.title}` : card.figure.title}
              data-olumi={estimate || undefined} data-view-values={id}>
              <StatedFigure id={id} card={card} />
              {card.values!.map((v, i) => <OptionValueRow key={v.option} at={`${id}.values.${i}.text`} option={v.option} text={v.text} mark={valueMark(v, `${id}.values.${i}`, ifApproved)} />)}
            </div>
          ) : (
            <p className={`${typography.viewValue} ${estimate ? 'text-info' : ''}`} title={estimate ? `${card.figure.title} · ${card.olumi!.title}` : card.figure.title}
              data-olumi={estimate || undefined} data-view={`${id}.figure.text`}>{card.figure.text}</p>
          )}
          <Slot name={VIEW_CARD_SLOTS.figureSide} className="empty:hidden" />
          {/* R25 (Paul's 6 Nov test: "I can't find manual editing"): wherever core offers an edit, the ✎ shows at rest as the cue, on the
              figure's own line (J1 gate); its words are its label and hover (never a line that appears: DL 9 Nov, the face never changes
              height). Never hidden, so an open editor or its Set button can never be hidden either (R4 witness run 3). */}
          {card.figure.edit ?? keptEdit ? <span data-figure-edit-wrap=""><FigureEdit id={card.id} edit={card.figure.edit ?? keptEdit ?? null} glyph="✎" label={estimate ? 'Give yours' : 'Change figure'} words={false} /></span>
            // While a proposal is held core offers no edit: ✎ offers to set it aside and edit (R25), on a figure the approved model has
            // that the person sets (never an outcome core works out from others, which core never offers to edit).
            : card.change?.kind !== 'added' && kind !== 'outcome' ? <span data-figure-edit-wrap=""><HeldEditOffer id={card.id} label={estimate ? 'Give yours' : 'Change figure'} /></span> : null}
          {provenance === null ? null : <span className="ml-auto">{provenance}</span>}
        </div>
      )}
      {card.figure === null ? null : <Slot name={VIEW_CARD_SLOTS.valuesBand} className="block empty:hidden" />}
      {tryOn?.kind !== 'tried' ? null : (
        // TM-27: the figure tried, as the person typed it, in place on its card (core's words for the edit on hover); core's own sentence
        // when the copy could not run; and the way back, which drops the try (nothing was saved). The person's act: ink, never Olumi's blue.
        <div className="nodrag grid gap-1 rounded-lg bg-panel-hover px-2 py-1.5" data-card-try={id}>
          <p className={`${typography.viewValue} font-semibold text-text-header`} title={tryOn.words}>{WHAT_IF_COPY.trying(tryOn.typed)}</p>
          {tryOn.said === null ? null : <p className={`${typography.viewLabel} text-text-body`} data-card-try-said={id}>{tryOn.said}</p>}
          <button type="button" onClick={clearWhatIf} data-testid={`card-try-back-${id}`}
            className={`${typography.viewLabel} inline-flex min-h-[24px] w-fit cursor-pointer items-center text-text-body underline underline-offset-2 hover:text-text-header`}>{WHAT_IF_COPY.back(version)}</button>
        </div>
      )}
      {/* Core's honesty line (card.unused, candidate 2a283a4f): a figure Olumi's analysis does not use yet says so, once, under it, in
          core's words. The figure stays editable. */}
      {card.unused == null || card.unused === '' ? null : <p className={`${typography.viewPanelMeta} text-text-body`} data-testid="view-card-unused" data-view={`${id}.unused`}>{card.unused}</p>}
      {optionFace !== null
        ? <p className={`${typography.viewHeadline} tracking-tight text-text-header`} title={optionFace.title} data-option-face={id} data-view={`${id}.headline.text`}>{optionFace.text}</p>
        : rowsDrawn}
      {tryOn?.kind !== 'option' ? null : (
        // TM-27: the try's chance for this option under its saved one, in core's row words; core's words for the edit and the row on hover.
        <p className={`${typography.viewLabel} text-text-body`} title={`${tryOn.words}\n${tryOn.row.title}`} data-option-try={id}>
          {WHAT_IF_COPY.whatIf}: <span className={`${typography.viewValue} font-semibold text-text-header`} data-view={`whatif.${id}.chance`}>{tryOn.row.value}</span>
        </p>
      )}
      {/* An open badge takes no line on the face: what it folded is on the board. Its fold-back is in the opened card's words (`aside`). */}
      {/* An option the team committed to (olumi.view/3 `committed`, the newest commitment naming it): who, in the marks row; when, on hover. */}
      <span data-slot={VIEW_CARD_SLOTS.marks} className="flex flex-wrap items-center gap-1 empty:hidden">
        {/* DL 7 Nov, the strategy session's rule on V11's card: a badge is on the face at rest, one compact 12px line in the marks band, first
            of the card's status signals: core's face (DL 10 Nov: whole words within the card, its words whole on hover), else core's words
            or text. A badge drawn only on hover held an invisible 24px line at rest (UI lane's measure, 10 Nov), and the face never changes
            height on hover or focus (DL 9 Nov), so there is none. An open badge's fold-back is in the opened card's words (`aside`). */}
        {card.badge === null || card.badge.open ? null
          : <span className={`${typography.viewPanelMeta} whitespace-nowrap`} data-badge-at-rest={id}><Badge cardId={id} badge={card.badge} at={id} /></span>}
        {card.figure === null ? provenance : null}
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
      {more || aside ? (
        // The card's other words (its status, reason and premises), every one core's, beside the card while it is selected: the
        // face stays compact so the causal graph reads (Paul 4 Nov), and opening them never changes the card's drawn height. A card's
        // Rename is in the dock's "Selected:" row (SelectedRename.tsx), so a card with nothing more opens nothing over its neighbour.
        <div hidden={!selected} data-panel-side={side} className={`absolute ${side === 'left' ? 'right-full mr-2' : 'left-full ml-2'} top-0 z-10 space-y-1 rounded-lg border border-border bg-panel p-3 shadow-sm ${typography.viewLabel}`}
          style={{ width: CARD_WIDTH }} data-view-more={id}>
          {faceLine === null || card.family !== 'option' ? null : <p className="text-text-body" data-face-words={faceLine.words} data-view={`${id}.face.line.text`}>{faceLine.text}</p>}
          {theirs === null ? null : <p className={`${typography.viewPanelMeta} font-medium`} data-provenance={id} title={theirs.title} data-view={`${id}.author.text`}>{theirs.text}</p>}
          {card.badge === null || !card.badge.open ? null : <p className={`text-right ${typography.viewPanelMeta}`} data-badge-open={id}><Badge cardId={id} badge={card.badge} at={id} /></p>}
          {optionFace === null ? null : <div className="space-y-1" data-option-rows={id}>{rowsDrawn}</div>}
          {/* Core writes the change a line per field ("Proposed change\nlow 10 → 15\n…"): its lines kept. */}
          {changed ? <p className="whitespace-pre-line" data-view={`${id}.change.title`}>{card.change!.title}</p> : null}
          {card.status === null ? null : <p data-view={`${id}.status`}>{card.status}</p>}
          {card.reason === null || says ? null : <p data-view={`${id}.reason`}>{card.reason}</p>}
          {card.premises.map((p, j) => (
            // Whole, the glyph first (plan v3: full text on selection or keyboard focus, not hover only); these words show only with the
            // card open, beside it, so a premise shared by several options never lengthens a card at rest (DL 4 Nov).
            <p key={j} title={p.title} data-premise-row={`${id}.${j}`}><span data-view={`${id}.premises.${j}.glyph`}>{p.glyph}</span> <span data-view={`${id}.premises.${j}.text`}>{p.text}</span>{(p.olumi ?? null) === null ? null : <>{' '}<span title={p.olumi!.title} aria-label={p.olumi!.title} data-view={`${id}.premises.${j}.olumi.glyph`}>{p.olumi!.glyph}</span></>}</p>
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
/**
 * ⛔ AN OPEN EDITOR STAYS ON SCREEN (R5, github-3c on Paul's "visible through canvas reflow"; set-visible.mjs check 3: the card grew near the
 * window's foot and Set ended 29 px below it). While this card's editor form is open, the canvas pans just enough to keep the whole form in
 * the free canvas (the window less the camera's own insets: top bar, lens bar, dock), once per change of the form's place (its growth, or a
 * re-layout that moves the card). Only the viewport moves: never the pointer, never focus.
 */
function useOpenEditorInView(): React.RefObject<HTMLDivElement> {
  const rf = useReactFlow()
  const box = useRef<HTMLDivElement>(null), last = useRef('')
  const keep = useCallback(() => {
    const form = box.current?.querySelector('form[data-testid^="view-figure-form-"]')
    if (!form) { last.current = ''; return }
    const r = form.getBoundingClientRect(), key = [r.left, r.top, r.right, r.bottom].map((v) => Math.round(v)).join(',')
    if (key === last.current) return
    last.current = key
    const flow = document.querySelector('.react-flow'), f = flow?.getBoundingClientRect() ?? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
    const pad = paddingToInsets(computeFitPadding(flow))
    const { dx, dy } = panToKeepInView(r, { left: f.left + pad.left, top: f.top + pad.top, right: f.right - pad.right, bottom: f.bottom - pad.bottom })
    if (dx === 0 && dy === 0) return
    const v = rf.getViewport()
    void rf.setViewport({ x: v.x + dx, y: v.y + dy, zoom: v.zoom })
  }, [rf])
  // After every render (a re-layout moves the card); an unchanged form place bails out
  useLayoutEffect(() => { keep() })
  // The form opening or growing (core's refusal under it, a wrapped line) is the editor's own state, with no render of this node.
  useEffect(() => {
    const el = box.current
    if (el === null) return
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => keep())
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => keep())
    mo?.observe(el, { childList: true, subtree: true })
    ro?.observe(el)
    return () => { mo?.disconnect(); ro?.disconnect() }
  }, [keep])
  return box
}

const NO_BOXES: CardBox[] = []
const noBoxes = (): CardBox[] => NO_BOXES

export function ViewCardNode({ id, data, selected }: NodeProps) {
  const { card } = data as ViewCardData
  const inView = useOpenEditorInView()
  const restsOn = useRestsOnItem(id)
  const driverOf = useDriverOf(id)
  // If it failed: a card Olumi's stories rest on stands in front, the rest recede (core's `failed`; View only).
  const preMortem = usePreMortemOf(id)
  const tried = useTriedOn(id)
  const tryOn = useTryOn(card)
  // The applied-edit pulse (pulseArrivals.ts, appliedEditPulse.ts): the original card's ring on a card an approval or edit just applied.
  const pulsed = useCanvasStore((st) => st.highlightedNodes.has(id))
  // The card's role in core's model (`drawKindOf`): its shape on the canvas, the same on every version.
  const view = useViewStore((st) => st.view)
  const model = view?.model ?? null
  const kind = model === null ? askKindOf(card.family) : drawKindOf(card, model)
  // While core's View shows a pending proposal, its Run is the proposal's: each Run-derived line says "If approved" (DL ruling, R4).
  const ifApproved = useMemo(() => ifApprovedMarkOf(view), [view])
  // The aims whose shared reason the panel says once for this option (layout.ts sharedAimsOf): its card leaves those rows to it.
  const shared = useMemo(() => sharedAimsOf(view?.model?.run, id), [view, id])
  const notYet = useMemo(() => optionsNotYet(view?.model), [view])
  const noted = useCanvasStore((st) => st.olumiAttention?.nodeIds?.[0] === id)
  // Keyboard focus on the card (or inside it) opens its other words as selection does (plan v3: full text on selection or keyboard focus).
  // Only while the page's focus really is there: a control removed after its save (an editor, a rename) moves focus to the page with no
  // blur, which left a card open beside another (DL 7 Nov, run 0717 shot 4c).
  const root = useRef<HTMLDivElement | null>(null)
  const named = useViewFocusCard((f) => f.id === id)
  const here = typeof document === 'undefined' ? null : document.activeElement
  const focused = named && here !== null && root.current !== null && (root.current.contains(here) || root.current.closest('.react-flow__node') === here)
  const open = selected === true || focused
  const attach = useCallback((el: HTMLDivElement | null) => { root.current = el; (inView as React.MutableRefObject<HTMLDivElement | null>).current = el }, [inView])
  // Open, its words go on the side with room (panelSide.ts, DL 7 Nov): every card's box is read only while this one is open.
  const boxes = useStore(open ? cardBoxesOf : noBoxes, sameBoxes)
  const [panelH, setPanelH] = useState(0)
  const [near, setNear] = useState(false)
  const sides = useLinkSides()
  useLayoutEffect(() => { if (open) setPanelH(root.current?.querySelector<HTMLElement>('[data-view-more]')?.offsetHeight ?? 0) }, [open, card])
  const side = useMemo(() => {
    const me = boxes.find((b) => b.id === id)
    return me === undefined ? 'right' : panelSide(me, { w: CARD_WIDTH, h: panelH > 0 ? panelH : me.h }, boxes.filter((b) => b.id !== id))
  }, [boxes, id, panelH])
  return (
    <div ref={attach} className={`group/vcard relative${preMortem === 'other' ? ' opacity-40' : ''}`} data-premortem={preMortem ?? undefined}
      onMouseEnter={() => setNear(true)} onMouseLeave={() => setNear(false)} onFocus={() => setNear(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setNear(false) }}>
      {/* UI restore stage 1: a link enters a card on the side its causes are on and leaves on the other, for the layout's direction. */}
      <Handle type="target" position={sides.into as Position} isConnectable={false} className="!opacity-0" />
      <ViewCard card={card} reading={model === null ? null : readingOf(model, id)} selected={open} side={side} restsOn={restsOn} driverOf={driverOf} tried={tryOn?.kind === 'tried' ? null : tried} tryOn={tryOn} version={view?.version?.n ?? null} pulsed={pulsed} kind={kind} ifApproved={ifApproved} shared={shared} notYet={notYet} />
      <div className="absolute left-3 bottom-2"><NodeCoachingMarker nodeId={id} /></div>
      {/* Olumi's corner controls at rest only on the card Olumi's note is about; on any card while hovered or selected. */}
      {/* J1 gate: nothing on the board sits below full strength at rest, so the controls are not drawn at rest (they were there at
          opacity 0); pointer over the card, focus inside it, selection or Olumi's note about it draws them. */}
      {selected === true || noted || near ? (
        <div data-olumi-controls="">
          <NodeQuickActions nodeId={id} nodeType={askKindOf(card.family)} label={card.heading} placement="below" alwaysVisible menu={false} />
        </div>
      ) : null}
      <Slot name={VIEW_CARD_SLOTS.rail} className="absolute left-0 top-full empty:hidden" />
      <Handle type="source" position={sides.out as Position} isConnectable={false} className="!opacity-0" />
    </div>
  )
}
