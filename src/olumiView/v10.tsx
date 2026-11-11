/**
 * The v10 design on the olumi-core lane (DL, 4 Nov): the features Paul approved on #/canvas2 (#3085–#3101), here drawn from the View.
 * The lane's own components stay current; v10 reaches them three ways, all from src/presentation:
 *
 * - **v10's CSS rulings** (`v10.css`, index.css `v10-lit`): the lane sets `data-presentation="v10"` on <html> while its canvas is up
 *   (`useV10Lane`). So the person's own primary buttons are ink and only Olumi's elements are blue, nothing on the canvas dims, and
 *   a lit card shows its ring. No JS behaviour changes with the attribute.
 * - **v10's card controls** (`ViewCardV10`): each View card is drawn inside `V10Scope`, so its quick actions drop their Olumi door and
 *   the card carries v10's Olumi corner (`NodeCornerOlumi`): a click puts "About <card>: " in the composer and sends nothing. The card
 *   face is DGAI's shell (`ViewCardNode`, the original look); v10 fills its named places (`VIEW_CARD_SLOTS`) by portal and changes
 *   nothing else on it: the corner in `olumi-badge`, the driver badge in `driver-badge`.
 * - **The ring** (`ringCards`): the cards a reply's next step is about (core's `chat[].answer.next.about`, the only place the View
 *   names records in the chat) are lit while that line is hovered or focused, and nothing else changes.
 *
 * - **What would change** (`ViewDriverBadge`, v10 #3098): an option card core gives a `driver` carries v10's driver badge on its corner,
 *   an icon at rest, in the shell's top-right place; hovering or focusing it says core's own sentence, verbatim, with Olumi's mark. Out
 *   of flow, so no card changes height; nothing dims. A card with no driver draws none.
 *
 * - **The outcome band** (`ViewOptionBand`, v10's band from #/canvas2): under an option's chance line, the aim's measured quantity under
 *   that option (core's `rows[].outcome` on its chance row), every option on ONE axis so the cards read side by side: the range as a
 *   bar, the median as a tick, and core's own line for it beneath. The numbers place the bar and nothing else; every word is core's.
 *
 * - **Proposed** (v10 boards 2 and 3): the shell decides which cards are ghosts and which pulse (DGAI's ViewCardNode, from core's
 *   `change.kind` and `version.changed`); v10's look for a ghost is dashed in Olumi's colour (v10.css, on `data-proposed-card`).
 *
 * The methods are v10's (`V10_METHODS`), the composer's icon row in ViewChat.tsx.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Activity } from 'lucide-react'
import Tooltip from '../components/Tooltip'
import { OlumiAiIcon } from '../components/results/analysisNew/OlumiAiIcon'
import { CANVAS_GLYPH_SIZE_CLASSES } from '../canvas/nodes/shared/canvasGlyphScale'
import { NODE_TOOLTIP_DELAY_MS } from '../canvas/nodes/shared/nodeTooltip'
import { V10_CHANGE_COPY } from '../presentation/V10ChangeLens'
import { VIEW_CARD_SLOTS, type ViewCardData } from '../canvas/nodes/ViewCardNode'
import type { NodeProps } from '@xyflow/react'
import { V10Scope } from '../presentation/v10'
export { ringCards } from './ring'
import { ViewCardNode } from '../canvas/nodes/ViewCardNode'
import { NodeCornerOlumi } from '../canvas/nodes/shared/NodeCornerOlumi'
import { useCanvasStore } from '../canvas/store'
import type { ViewCard, ViewModel } from './client'
import { useViewStore } from './store'
import { keyNamesBlueRange } from './layout'
import { CardEvidenceMarks, CardViewChips, CardViewInitials, OptionMarkLine } from './RevealMarks'
import { StrategyChips } from './strategy/StrategyChips'
import { useReveal } from './reveal'

/** v10's rulings for the whole lane while its canvas is up: the attribute v10's stylesheets are scoped to. */
export function useV10Lane(): void {
  useEffect(() => {
    const root = document.documentElement
    root.dataset.presentation = 'v10'
    return () => { delete root.dataset.presentation }
  }, [])
}

/** v10's "What would change" badge for one card, from core's `driver`: its sentence verbatim on hover or focus, with Olumi's mark. */
export function ViewDriverBadge({ card }: { card: ViewCardData['card'] }) {
  if (card.driver === null) return null
  const disclosure = (
    <span className="inline-flex items-start gap-1.5">
      <OlumiAiIcon size={12} aria-hidden="true" data-testid={`view-driver-mark-${card.id}`} className={`mt-[2px] flex-none ${CANVAS_GLYPH_SIZE_CLASSES[12]}`} />
      <span data-view={`${card.id}.driver.text`}>{card.driver.text}</span>
    </span>
  )
  return (
    <Tooltip asChild content={disclosure} delay={NODE_TOOLTIP_DELAY_MS}>
      <span data-testid={`view-driver-${card.id}`} data-node-tooltip="true" role="img" tabIndex={0} aria-label={V10_CHANGE_COPY.driverAria}
        className="nodrag pointer-events-auto relative z-10 inline-grid h-5 w-5 place-items-center rounded-full border border-panel-border bg-panel text-text-light shadow-1">
        <Activity aria-hidden="true" className="h-3 w-3" />
      </span>
    </Tooltip>
  )
}

/** One option's band on the shared axis: percent positions, and core's line for it with its path in the View. */
export interface OptionBand {
  readonly leftPct: number; readonly widthPct: number; readonly medianPct: number | null; readonly text: string; readonly title: string; readonly at: string
  /** The person's aim on the same axis (core's `model.aim`), and the parts of this range that meet and miss it; null without an aim. */
  readonly aim: { readonly pct: number; readonly text: string; readonly meet: Seg | null; readonly miss: Seg | null } | null
}
type Seg = { readonly left: number; readonly width: number }
type Aim = NonNullable<ViewModel['aim']>

/** The part of [lo, hi] on one side of `at`, or null when the range has none there (percent positions). */
const seg = (lo: number, hi: number): Seg | null => (hi > lo ? { left: lo, width: hi - lo } : null)

const pct = (v: number, min: number, span: number) => Math.min(100, Math.max(0, ((v - min) / span) * 100))

/**
 * Every option's band on one axis, from core's `outcome` on each option card's chance row. None at all unless every option with a
 * band measures the same quantity in the same unit and the axis has width: two units on one axis would put a bar in the wrong place.
 */
export function optionBands(cards: readonly ViewCard[], aim: Aim | null = null): ReadonlyMap<string, OptionBand> {
  const found: { id: string; i: number; o: NonNullable<Extract<ViewCard['rows'][number], { kind: 'chance' }>['outcome']> }[] = []
  for (const c of cards) {
    if (c.family !== 'option') continue
    const i = c.rows.findIndex((r) => r.kind === 'chance' && r.outcome != null && Number.isFinite(r.outcome.low) && Number.isFinite(r.outcome.high))
    const row = c.rows[i]
    if (row?.kind === 'chance' && row.outcome) found.push({ id: c.id, i, o: row.outcome })
  }
  if (found.length === 0 || new Set(found.map((f) => f.o.unit)).size > 1) return new Map()
  // The aim goes on the axis only in the bands' own unit (core's aim is one point in its quantity's unit): never a line in the wrong place.
  const goal = aim !== null && Number.isFinite(aim.value) && aim.unit === found[0]!.o.unit ? aim : null
  // An aim beyond every range is still seen (every option falls short of it), so the axis reaches it.
  const ends = [...found.flatMap((f) => [f.o.low, f.o.high]), ...(goal === null ? [] : [goal.value])]
  const min = Math.min(...ends), span = Math.max(...ends) - min
  if (!(span > 0)) return new Map()
  return new Map(found.map(({ id, i, o }) => {
    const lo = pct(o.low, min, span), hi = pct(o.high, min, span), at = goal === null ? null : pct(goal.value, min, span)
    // The side of the aim that meets it: above it for "at least", below it for "at most".
    const below = at === null ? null : seg(lo, Math.min(hi, at)), above = at === null ? null : seg(Math.max(lo, at), hi)
    return [id, {
      leftPct: lo,
      widthPct: Math.max(2, hi - lo),
      medianPct: o.median === null || !Number.isFinite(o.median) ? null : pct(o.median, min, span),
      text: o.text, title: o.title, at: `${id}.rows.${i}.outcome.text`,
      aim: goal === null || at === null ? null : { pct: at, text: goal.text, meet: goal.side === 'at_least' ? above : below, miss: goal.side === 'at_least' ? below : above },
    }]
  }))
}

/** The bands of the cards on the canvas now: one axis for exactly the options drawn. */
export function useOptionBands(): ReadonlyMap<string, OptionBand> {
  const nodes = useCanvasStore((s) => s.nodes)
  const aim = useViewStore((s) => s.view?.model?.aim ?? null)
  return useMemo(() => optionBands(nodes.flatMap((n) => {
    const card = (n.data as Partial<ViewCardData> | undefined)?.card
    return card?.family === 'option' ? [card] : []
  }), aim), [nodes, aim])
}

/** v10's outcome band (#/canvas2's look), drawn from core: the bar and tick on the shared axis, and core's line beneath, its hover core's. */
export function ViewOptionBand({ id, band }: { id: string; band: OptionBand }) {
  return (
    <div className="mt-1 min-w-0" data-testid={`view-option-band-${id}`} title={band.title === '' ? band.text : `${band.text}\n${band.title}`}>
      <div className="relative" role="img" aria-label={band.text} style={{ height: 6, background: 'var(--factor-light)', borderRadius: 3 }}>
        {band.aim === null ? (
          <div className="absolute top-0 h-full" data-testid={`view-option-band-range-${id}`}
            style={{ left: `${band.leftPct}%`, width: `${band.widthPct}%`, background: 'var(--option)', borderRadius: 3 }} />
        ) : (
          // With an aim, the range in two parts (v10 board 4): the part that meets the aim solid, the part that misses it lighter.
          <>
            {band.aim.miss === null ? null : <div className="absolute top-0 h-full" data-testid={`view-option-band-miss-${id}`}
              style={{ left: `${band.aim.miss.left}%`, width: `${band.aim.miss.width}%`, background: 'var(--option)', opacity: 0.35, borderRadius: 3 }} />}
            {band.aim.meet === null ? null : <div className="absolute top-0 h-full" data-testid={`view-option-band-meet-${id}`}
              style={{ left: `${band.aim.meet.left}%`, width: `${band.aim.meet.width}%`, background: 'var(--option)', borderRadius: 3 }} />}
            <div className="absolute" data-testid={`view-option-band-aim-${id}`} title={band.aim.text}
              style={{ left: `${band.aim.pct}%`, top: -3, bottom: -3, width: 2, marginLeft: -1, background: 'var(--goal)' }} />
          </>
        )}
        {band.medianPct === null ? null : (
          <div className="absolute" data-testid={`view-option-band-median-${id}`}
            style={{ left: `${band.medianPct}%`, top: -1, bottom: -1, width: 2, marginLeft: -1, background: 'var(--text-header)', borderRadius: 1 }} />
        )}
      </div>
      {/* The band's words on hover (first in the wrapper's title, core's hover after them), as the bar's label and in the DOM for readers, not a
          line on the face (option a2). */}
      <span className="sr-only" data-view={band.at}>{band.text}</span>
    </div>
  )
}

/** One option's range on a worked-out figure card's own axis (core's `cards[].values`): percent positions and core's line for it. */
export interface ValueBar { readonly option: string; readonly leftPct: number; readonly widthPct: number; readonly medianPct: number | null; readonly text: string; readonly olumi: boolean }

/**
 * A worked-out figure's range under each option, on the card's own axis (v10's band, one bar per option), from core's `values`. The numbers
 * place the bars and nothing else; core's line for each is its hover. None when core gives no values, or every option's range is one point.
 * A bar that rests on a figure Olumi proposed (`values[].olumi`) is in Olumi's blue only while core's key names that colour
 * (`keyNamesBlueRange`); otherwise, and for every other bar, the option colour, so the blue is never unexplained.
 */
export function valueBars(card: ViewCard): readonly ValueBar[] {
  const vs: NonNullable<ViewCard['values']> = []
  for (const v of card.values ?? []) if (Number.isFinite(v.p10) && Number.isFinite(v.p90)) vs.push(v)
  if (vs.length === 0) return []
  const min = Math.min(...vs.map((v) => v.p10)), span = Math.max(...vs.map((v) => v.p90)) - min
  if (!(span > 0)) return []
  return vs.map((v) => ({
    option: v.option, leftPct: pct(v.p10, min, span), widthPct: Math.max(2, pct(v.p90, min, span) - pct(v.p10, min, span)),
    medianPct: v.p50 === null || !Number.isFinite(v.p50) ? null : pct(v.p50, min, span), text: v.text, olumi: v.olumi,
  }))
}

/** One bar's row: the option's number as the canvas numbers it (O1, …), and its range; Olumi's blue where `blue` (core's key names it). */
function ValueBarRow({ cardId, bar, blue }: { cardId: string; bar: ValueBar; blue: boolean }) {
  return (
    <div className="flex items-center gap-1.5" title={bar.text} role="img" aria-label={bar.text} data-testid={`view-values-${cardId}-${bar.option}`} data-olumi={blue || undefined}>
      <div className="relative flex-1" style={{ height: 4, background: 'var(--factor-light)', borderRadius: 2 }}>
        <div className="absolute top-0 h-full" data-values-range style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%`, background: blue ? 'var(--info)' : 'var(--option)', borderRadius: 2 }} />
        {bar.medianPct === null ? null : <div className="absolute" style={{ left: `${bar.medianPct}%`, top: -1, bottom: -1, width: 2, marginLeft: -1, background: 'var(--text-header)', borderRadius: 1 }} />}
      </div>
    </div>
  )
}

/** v10's values band: under a worked-out figure's value line, one bar per option on the card's own axis. */
export function ViewValuesBand({ card }: { card: ViewCard }) {
  const bars = valueBars(card), keyed = useViewStore((s) => keyNamesBlueRange(s.view?.model?.key))
  if (bars.length === 0) return null
  return <div className="mt-1 space-y-0.5" data-testid={`view-values-${card.id}`}>{bars.map((b) => <ValueBarRow key={b.option} cardId={card.id} bar={b} blue={keyed && b.olumi} />)}</div>
}

type Places = { readonly olumi: Element | null; readonly driver: Element | null; readonly band: Element | null; readonly values: Element | null; readonly marks: Element | null; readonly rail: Element | null }

/** A View card as v10 draws its controls: DGAI's card, with the Olumi corner and the driver badge in the card's own named places. */
export function ViewCardV10(props: NodeProps) {
  const box = useRef<HTMLDivElement>(null)
  const [places, setPlaces] = useState<Places>({ olumi: null, driver: null, band: null, values: null, marks: null, rail: null })
  const band = useOptionBands().get(props.id) ?? null
  // V11: the card whose chip is open carries the one selection ring (approved v2.1), in the header ink (the person's act, never Olumi's blue).
  const opened = useReveal((s) => s.card === props.id)
  // The card draws its places; v10 finds them each time the card is drawn from new data (a card that changes family gains or loses its
  // driver place).
  useLayoutEffect(() => {
    const at = (name: string) => box.current?.querySelector(`[data-slot="${name}"]`) ?? null
    const olumi = at(VIEW_CARD_SLOTS.olumiBadge), driver = at(VIEW_CARD_SLOTS.driverBadge), band = at(VIEW_CARD_SLOTS.outcomeBand)
    const values = at(VIEW_CARD_SLOTS.valuesBand), marks = at(VIEW_CARD_SLOTS.marks), rail = at(VIEW_CARD_SLOTS.rail)
    setPlaces((p) => (p.olumi === olumi && p.driver === driver && p.band === band && p.values === values && p.marks === marks && p.rail === rail ? p
      : { olumi, driver, band, values, marks, rail }))
  }, [props.data])
  return (
    <V10Scope>
      <div ref={box} data-testid="view-card-v10" data-reveal-open={opened || undefined}
        className={opened ? 'rounded-md ring-2 ring-text-header ring-offset-2 ring-offset-canvas' : undefined}>
        <ViewCardNode {...props} />
        {places.olumi === null ? null : createPortal(<NodeCornerOlumi nodeId={props.id} selected={props.selected === true} restHidden />, places.olumi)}
        {places.driver === null ? null : createPortal(<ViewDriverBadge card={(props.data as ViewCardData).card} />, places.driver)}
        {places.band === null || band === null ? null : createPortal(<ViewOptionBand id={props.id} band={band} />, places.band)}
        {places.band === null ? null : createPortal(<OptionMarkLine card={props.id} />, places.band)}
        {places.values === null ? null : createPortal(<ViewValuesBand card={(props.data as ViewCardData).card} />, places.values)}
        {/* V11: the team's revealed views on the card they are about (./reveal.ts): initials in the marks row, the disagreement below; the
            team's evidence on the cards it concerns (./evidence.ts), beside the initials. */}
        {places.marks === null ? null : createPortal(<><CardViewInitials card={props.id} /><CardEvidenceMarks card={props.id} /></>, places.marks)}
        {/* Strategy lane (7 Nov, by agreement): core's strategy mark beside the reveal's, in the same rail portal; null when the reveal marks the card. */}
        {places.rail === null ? null : createPortal(<><CardViewChips card={props.id} /><StrategyChips card={props.id} /></>, places.rail)}
      </div>
    </V10Scope>
  )
}
