/**
 * THE "TRADE-OFFS" KEY CARD: what one option gains and gives up, read along the links in the user's own model
 * (`tradeOffsModel.ts`; Paul, 19 Oct 2026: a pros and cons list "that actually allows the user to edit it and change
 * the data model").
 *
 * One option at a time (‹ › step through them; the canvas numbers the links on its routes and dims nothing). Each route is a chain of
 * the model's own elements, each marked with the way the option moves it, grouped by whether it moves the goal the way
 * the user wants, the other way, or cannot be sorted because a link on it has no direction. Picking a route opens its
 * links, each with its "Rests on" state and the link's own editor: the list is edited by editing the model, so the two
 * can never disagree. "Ask Olumi what's missing" asks the existing question for what the model does not have yet.
 *
 * Never a verdict: no count of pros against cons, no "best", nothing about how much a route matters (CLAUDE.md §4).
 */
import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, AlertCircle, MessageCircle } from 'lucide-react'
import { useCanvasStore } from '../store'
import { useIsViewer } from '../../lib/viewerMode'
import { typography } from '../../styles/typography'
import { action, ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { usePresentation } from '../../presentation/v10'
import { askAi } from '../conversation/askAi'
import { revealOlumiSurface } from '../conversation/revealOlumi'
import { ACTION_BAR_COPY } from '../conversation/actionBar/ActionBar'
import { canvasLinkOfTarget, useCanvasLight } from '../graphChanges/rowCanvasLink'
import { ASSUMPTION_MAP_COPY, RESTS_ON_ORDER, type AssumptionColumn, type AssumptionItem, type RestsOnMark } from './assumptionMapModel'
import { isUnsettled, restsOnMarkerLabel } from './RestsOnMarker'
import { FigureCard } from './FigureCard'
import { linkIsStructural } from '../edges/edgePresentation'
import { tradeOffLinkMarks, tradeOffRouteDrawing, tradeOffsForState, type ModelRisk, type Move, type OptionTradeOffs, type RouteEffect, type RouteStep, type TradeOffRoute } from './tradeOffsModel'

export const TRADE_OFFS_KEY_TESTID = 'trade-offs-key'

export const TRADE_OFFS_COPY = {
  against: (label: string) => `Compared with ${label}`,
  againstToday: 'Compared with each factor’s value today',
  group: {
    gains: (goal: string) => `Moves ${goal} the way you want`,
    gives_up: (goal: string) => `Moves ${goal} the other way`,
    not_set: 'A link on the way has no direction yet',
  } satisfies Record<RouteEffect, unknown>,
  unsorted: (goal: string) => `Moves ${goal}, but your goal has no target yet, so these are not sorted`,
  move: { up: 'rises', down: 'falls' } satisfies Record<Move, string>,
  noGoal: 'Your model has no goal yet, so there is nothing to weigh the options against.',
  noOptions: 'Your model has no option to weigh yet.',
  noChange: 'This option does not change anything in the model yet.',
  noRoute: (goal: string) => `What this option changes has no link to ${goal} yet.`,
  restsOn: (n: number) => `Rests on ${n} ${n === 1 ? 'link' : 'links'}`,
  /** Each state's count, said in a short list after "Rests on n links:", unsettled first. */
  linkStates: {
    missing: (n: number) => `${n} with no figure yet`,
    unchecked: (n: number) => `${n} Olumi ${n === 1 ? 'estimate' : 'estimates'} nobody has checked`,
    unknown: (n: number) => `${n} of unknown origin`,
    accepted: (n: number) => `${n} Olumi ${n === 1 ? 'estimate' : 'estimates'} you accepted`,
    yours: (n: number) => `${n} yours`,
  } satisfies Record<AssumptionColumn, (n: number) => string>,
  /** v10: the options as one segmented control (the stepper's ‹ › stay in the current design). */
  optionGroup: 'Option to read the trade-offs of',
  /** v10: what the route colours on the canvas mean, and what the grey is. */
  swatch: { gains: 'helps reach the goal', gives_up: 'works against it', rest: 'other links' },
  /** v10: the mark before each route, said to a screen reader. */
  sign: { gains: 'Helps reach the goal', gives_up: 'Works against the goal', not_set: 'Direction not set yet' } satisfies Record<RouteEffect, string>,
  previous: 'Previous option',
  next: 'Next option',
  alsoInModel: 'Also in your model, whichever option',
  limit: 'A limit on your goal',
  /** An option with gains and nothing given up reads as a verdict: say what the gap usually is (anchoring, 20 Oct plan step 2b). */
  nothingGivenUp: 'Your model holds nothing this option gives up yet. That usually means a cost or risk is missing, not that there is none.',
  ask: 'Ask Olumi what’s missing',
  // The goal's own words may end a sentence ("within three months."): never a second full stop after them.
  legend: (goal: string) => `In front: this option’s routes to ${String(goal).trim().replace(/[.!?…]+$/, '')}. Open the key to read each one.`,
  note: (goal: string) => `Each route follows the links in your model: which way it pushes ${goal}, not how much, and not which option to choose.`,
} as const

function askWhatsMissing(): void {
  const result = askAi({ intent: 'risks' })
  if (result === 'sent') revealOlumiSurface()
  if (result === 'none') {
    window.dispatchEvent(new CustomEvent('topbar:show-toast', { detail: { message: ACTION_BAR_COPY.noConversation, level: 'warning' } }))
  }
}

function MoveMark({ move }: { move: Move | null }) {
  if (move === null) return null
  const Icon = move === 'up' ? ArrowUp : ArrowDown
  return (
    <>
      <Icon aria-hidden="true" className="mx-0.5 inline h-3.5 w-3.5 flex-none align-[-2px] text-text-light" />
      <span className="sr-only">{TRADE_OFFS_COPY.move[move]}</span>
    </>
  )
}

/** "Pro plan price ↑ → Monthly new Pro subscribers ↓ → MRR ↓": the route as the model holds it. */
function Chain({ steps }: { steps: readonly RouteStep[] }) {
  return (
    <span className="min-w-0">
      {steps.map((step, i) => (
        <span key={`${step.nodeId}:${i}`} className="whitespace-normal">
          {i > 0 ? <span aria-hidden="true" className="px-1 text-text-light">→</span> : null}
          {step.label}
          <MoveMark move={step.move} />
        </span>
      ))}
    </span>
  )
}

/** "Rests on 3 links: 1 with no figure yet, 2 Olumi estimates nobody has checked", unsettled first. */
function restsOnLine(route: TradeOffRoute): string {
  const links = route.steps.filter((s) => s.edgeId !== null)
  const counts = new Map<AssumptionColumn, number>()
  for (const s of links) if (s.link) counts.set(s.link.column, (counts.get(s.link.column) ?? 0) + 1)
  const parts = RESTS_ON_ORDER.filter((c) => counts.has(c)).map((c) => TRADE_OFFS_COPY.linkStates[c](counts.get(c)!))
  return parts.length === 0 ? TRADE_OFFS_COPY.restsOn(links.length) : `${TRADE_OFFS_COPY.restsOn(links.length)}: ${parts.join(', ')}`
}

/** One link as its owner reads it: picking it finds it on the canvas; its figure card holds the link's own editor. */
/** The link's numbered pill, as the canvas draws it on the link: filled where the reasoning is unexamined. */
function LinkPill({ mark }: { mark: RestsOnMark }) {
  return (
    <span
      data-testid={`${TRADE_OFFS_KEY_TESTID}-pill`}
      data-n={mark.n}
      data-column={mark.column}
      title={restsOnMarkerLabel(mark)}
      className={`inline-flex h-4 min-w-4 flex-none items-center justify-center rounded-full border px-1 text-[10px] leading-none tabular-nums ${
        isUnsettled(mark.column) ? 'border-info/40 bg-info-light text-text-header' : 'border-panel-border bg-panel text-text-light'
      }`}
    >
      {mark.n}
    </span>
  )
}

/** A route's links as their pills, in route order; the counts in words stay for hover and screen readers. */
function RouteMarks({ route, marks }: { route: TradeOffRoute; marks: ReadonlyMap<string, RestsOnMark> }) {
  const line = restsOnLine(route)
  const pills = route.steps.flatMap((s) => (s.edgeId !== null && marks.has(s.edgeId) ? [marks.get(s.edgeId)!] : []))
  return (
    <span className="mt-1 flex flex-wrap items-center gap-1" title={line}>
      {pills.map((mark) => <LinkPill key={mark.n} mark={mark} />)}
      <span className="sr-only">{line}</span>
    </span>
  )
}

function LinkRow({ edgeId, label, item, mark = null }: { edgeId: string; label: string; item: AssumptionItem | null; mark?: RestsOnMark | null }) {
  const light = useCanvasLight()
  const link = canvasLinkOfTarget({ kind: 'edge', id: edgeId })
  return (
    // The link, then its figure card UNDER it: side by side in the 320px key, the card's buttons squeezed the link's name
    // to a few pixels and ran over it (served 22 Oct, "Also in your model").
    <li data-testid={`${TRADE_OFFS_KEY_TESTID}-link`} data-edge={edgeId} data-column={item?.column ?? ''} className="flex flex-col gap-1">
      <button
        type="button"
        className={`${typography.panelMeta} w-full rounded-lg px-1.5 py-1 text-left text-text-body hover:bg-panel-hover ${ACTION_FOCUS}`}
        onClick={() => link?.focus()}
        onMouseEnter={() => { if (link) light.on(link) }}
        onMouseLeave={light.off}
        onFocus={() => { if (link) light.on(link) }}
        onBlur={light.off}
      >
        <span className="flex items-center gap-1.5 text-text-header">{mark ? <LinkPill mark={mark} /> : null}{label}</span>
        {/* With a pill, its state is the pill's (words on hover); without one, said once here. */}
        {item && !mark ? <span className="block text-text-light">{ASSUMPTION_MAP_COPY.columns[item.column]}</span> : null}
      </button>
      {item ? <div className="px-1.5"><FigureCard item={item} /></div> : null}
    </li>
  )
}

function RouteLinks({ route, marks }: { route: TradeOffRoute; marks: ReadonlyMap<string, RestsOnMark> }) {
  return (
    <ul data-testid={`${TRADE_OFFS_KEY_TESTID}-links`} className="space-y-1.5 pb-1 pt-2">
      {route.steps.map((step, i) => step.edgeId === null ? null
        : <LinkRow key={step.edgeId} edgeId={step.edgeId} label={`${route.steps[i - 1].label} → ${step.label}`} item={step.link} mark={marks.get(step.edgeId) ?? null} />)}
    </ul>
  )
}

/** The risks and limits the model holds, shown as they are: never sorted into a gain or a give-up, never hidden. */
function AlsoInModel({ risks, limits }: { risks: readonly ModelRisk[]; limits: readonly { id: string; text: string }[] }) {
  if (risks.length === 0 && limits.length === 0) return null
  const line = `${typography.panelBody} px-1.5 text-text-body`
  return (
    <section data-testid={`${TRADE_OFFS_KEY_TESTID}-also`} className="space-y-1">
      <h3 className={`${typography.panelMeta} text-text-light`}>{TRADE_OFFS_COPY.alsoInModel}</h3>
      <ul className="space-y-1.5">
        {risks.flatMap((risk) => risk.links.length === 0
          ? [<li key={risk.id} data-testid={`${TRADE_OFFS_KEY_TESTID}-risk`} className={line}>{risk.label}</li>]
          : risk.links.map(({ toLabel, item }) => <LinkRow key={item.target.id} edgeId={item.target.id} label={`${risk.label} → ${toLabel}`} item={item} />))}
        {limits.map((limit) => (
          <li key={limit.id} data-testid={`${TRADE_OFFS_KEY_TESTID}-limit`} className={line}>
            {limit.text}<span className={`${typography.panelMeta} block text-text-light`}>{TRADE_OFFS_COPY.limit}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** v10: the route's mark, drawn as its colour on the canvas does: + helps, − works against, ? has no direction yet. */
const SIGN_GLYPH: Record<RouteEffect, { text: string; ring: string }> = {
  gains: { text: '+', ring: 'var(--edge-positive)' },
  gives_up: { text: '−', ring: 'var(--edge-negative)' },
  not_set: { text: '?', ring: 'var(--edge-neutral)' },
}

function RouteSign({ effect }: { effect: RouteEffect }) {
  const glyph = SIGN_GLYPH[effect]
  return (
    <span
      data-testid={`${TRADE_OFFS_KEY_TESTID}-sign`}
      data-effect={effect}
      title={TRADE_OFFS_COPY.sign[effect]}
      className={`${typography.panelMeta} inline-flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full bg-panel text-text-header`}
      style={{ border: `1.5px ${effect === 'not_set' ? 'dotted' : 'solid'} ${glyph.ring}` }}
    >
      <span aria-hidden="true">{glyph.text}</span>
      <span className="sr-only">{TRADE_OFFS_COPY.sign[effect]}</span>
    </span>
  )
}

/** v10: the options side by side. Ink marks the pressed one (the person's pick); the key never ranks them. */
function OptionPicker({ options, at, onPick }: { options: readonly OptionTradeOffs[]; at: number; onPick: (optionId: string) => void }) {
  return (
    <div
      role="group"
      aria-label={TRADE_OFFS_COPY.optionGroup}
      data-testid={`${TRADE_OFFS_KEY_TESTID}-options`}
      className="grid gap-px overflow-hidden rounded-[10px] border border-panel-border bg-panel-border"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))' }}
    >
      {options.map((o, i) => (
        <button
          key={o.optionId}
          type="button"
          data-testid={`${TRADE_OFFS_KEY_TESTID}-pick`}
          data-option={o.optionId}
          aria-pressed={i === at}
          title={o.label}
          className={`${typography.panelMeta} min-w-0 break-words px-2 py-2 text-center ${i === at ? 'bg-panel-hover text-text-header' : 'bg-panel text-text-body hover:bg-panel-hover'} ${ACTION_FOCUS}`}
          style={i === at ? { boxShadow: 'inset 0 0 0 1.5px var(--text-header)' } : undefined}
          onClick={() => onPick(o.optionId)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** v10: what the colours on the canvas mean. It names only what is drawn: a colour no link wears, or grey with no link left to wear it, is not listed. */
function RouteSwatches({ drawn, rest }: { drawn: ReadonlySet<'gains' | 'gives_up'>; rest: boolean }) {
  const line = (key: 'gains' | 'gives_up', stroke: string) => drawn.has(key) ? (
    <span key={key} className="inline-flex items-center gap-1.5">
      <svg aria-hidden="true" width="30" height="12" viewBox="0 0 40 12"><path d="M2 6 L38 6" fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" /></svg>
      {TRADE_OFFS_COPY.swatch[key]}
    </span>
  ) : null
  if (drawn.size === 0 && !rest) return null
  return (
    <p data-testid={`${TRADE_OFFS_KEY_TESTID}-swatches`} className={`${typography.panelMeta} flex flex-wrap gap-x-3 gap-y-1 text-text-body`}>
      {line('gains', 'var(--edge-positive)')}
      {line('gives_up', 'var(--edge-negative)')}
      {rest ? (
        <span className="inline-flex items-center gap-1.5">
          <svg aria-hidden="true" width="30" height="12" viewBox="0 0 40 12"><path d="M2 6 L38 6" fill="none" stroke="var(--edge-neutral)" strokeWidth="1.5" strokeLinecap="round" /></svg>
          {TRADE_OFFS_COPY.swatch.rest}
        </span>
      ) : null}
    </p>
  )
}

function RouteGroup({ heading, routes, picked, onPick, effect, flag = null, marks, v10 = false }: {
  heading: string
  /** v10: each route wears its mark. */
  v10?: boolean
  marks: ReadonlyMap<string, RestsOnMark>
  /** A mark beside the heading, its words on hover (Paul 22 Oct: icons over static text). */
  flag?: { testId: string; text: string } | null
  routes: readonly TradeOffRoute[]
  picked: string | null
  onPick: (key: string | null) => void
  effect: RouteEffect | 'unsorted'
}) {
  if (routes.length === 0) return null
  return (
    <section data-testid={`${TRADE_OFFS_KEY_TESTID}-group-${effect}`} className="space-y-1">
      <h3 className={`${typography.panelMeta} flex items-center gap-1 text-text-light`}>
        {heading}
        {flag ? (
          <span data-testid={flag.testId} title={flag.text} className="inline-flex text-warning">
            <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="sr-only">{flag.text}</span>
          </span>
        ) : null}
      </h3>
      <ul className="space-y-1">
        {routes.map((route) => {
          const open = route.key === picked
          return (
            <li key={route.key} className={`rounded-xl border ${open ? 'border-panel-border bg-panel-hover/40' : 'border-transparent'}`}>
              <button
                type="button"
                data-testid={`${TRADE_OFFS_KEY_TESTID}-route`}
                data-route={route.key}
                aria-expanded={open}
                className={`${typography.panelBody} w-full rounded-xl px-2 py-1.5 text-left text-text-body hover:bg-panel-hover ${ACTION_FOCUS}`}
                onClick={() => onPick(open ? null : route.key)}
              >
                {v10 ? (
                  <span className="flex items-start gap-2">
                    <RouteSign effect={route.effect} />
                    <span className="min-w-0 flex-1"><Chain steps={route.steps} /><RouteMarks route={route} marks={marks} /></span>
                  </span>
                ) : (
                  <>
                    <Chain steps={route.steps} />
                    <RouteMarks route={route} marks={marks} />
                  </>
                )}
              </button>
              {open ? <div className="px-2"><RouteLinks route={route} marks={marks} /></div> : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** `folded`: the option, its stepper and one legend line; the routes are on the model. */
export function TradeOffsKey({ folded = false }: { folded?: boolean }) {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const ceeAnalysisReady = useCanvasStore((s) => s.ceeAnalysisReady)
  const lastServerGraphHash = useCanvasStore(s => s.lastServerGraphHash)
  const outcomeNodeId = useCanvasStore((s) => s.outcomeNodeId)
  const goalConstraints = useCanvasStore((s) => s.goalConstraints)
  const servedBaselineOptions = useCanvasStore((s) => s.servedBaselineOptions)
  const pickedOptionId = useCanvasStore((s) => s.lens.selectedOptionId)
  const viewer = useIsViewer()
  const v10 = usePresentation() === 'v10'
  const [pickedRoute, setPickedRoute] = useState<string | null>(null)
  const read = useMemo(
    () => tradeOffsForState({ nodes, edges, ceeAnalysisReady, lastServerGraphHash, outcomeNodeId, goalConstraints, servedBaselineOptions }),
    [nodes, edges, ceeAnalysisReady, lastServerGraphHash, outcomeNodeId, goalConstraints, servedBaselineOptions],
  )

  const say = (text: string) => <p data-testid={TRADE_OFFS_KEY_TESTID} className={`${typography.panelBody} text-text-body`}>{text}</p>
  if (read.goalId === null || read.goalLabel === null) return say(TRADE_OFFS_COPY.noGoal)
  if (read.options.length === 0) return say(TRADE_OFFS_COPY.noOptions)
  const goal = read.goalLabel
  const at = Math.max(0, read.options.findIndex((o) => o.optionId === pickedOptionId))
  const option: OptionTradeOffs = read.options[at]
  // The lens's own option pick (the canvas numbers its route links); the route pick is this card's.
  const pick = (optionId: string) => {
    setPickedRoute(null)
    useCanvasStore.getState().setLens('tradeoffs', optionId)
  }
  const step = (by: 1 | -1) => pick(read.options[(at + by + read.options.length) % read.options.length].optionId)
  const of = (effect: RouteEffect) => option.routes.filter((r) => r.effect === effect)
  const marks = tradeOffLinkMarks(option)
  const unsorted = read.goalWants === null

  const header = (
      <div className={v10 ? 'space-y-2' : 'flex items-start gap-2'}>
        {v10 && read.options.length > 1 ? <OptionPicker options={read.options} at={at} onPick={pick} /> : null}
        <div className="min-w-0 flex-1">
          <p data-testid={`${TRADE_OFFS_KEY_TESTID}-option`} className={`${typography.panelQuestion} text-text-header`}>{option.label}</p>
          <p className={`${typography.panelMeta} text-text-light`}>
            {option.againstLabel ? TRADE_OFFS_COPY.against(option.againstLabel) : TRADE_OFFS_COPY.againstToday}
          </p>
        </div>
        {read.options.length > 1 && !v10 ? (
          <div className="flex flex-none items-center">
            <button type="button" data-testid={`${TRADE_OFFS_KEY_TESTID}-previous`} aria-label={TRADE_OFFS_COPY.previous} title={TRADE_OFFS_COPY.previous}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-body ${ACTION_FOCUS}`}
              onClick={() => step(-1)}>
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <button type="button" data-testid={`${TRADE_OFFS_KEY_TESTID}-next`} aria-label={TRADE_OFFS_COPY.next} title={TRADE_OFFS_COPY.next}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-body ${ACTION_FOCUS}`}
              onClick={() => step(1)}>
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
  )
  const empty = option.routes.length === 0 ? (
    <p data-testid={`${TRADE_OFFS_KEY_TESTID}-empty`} className={`${typography.panelBody} text-text-body`}>
      {option.changes > 0 ? TRADE_OFFS_COPY.noRoute(goal) : TRADE_OFFS_COPY.noChange}
    </p>
  ) : null
  // The same drawing the canvas reads (`useLensFilter`): the legend lists only the colours it actually paints.
  const drawing = v10 ? tradeOffRouteDrawing(read.options, option) : null
  const swatches = drawing !== null && drawing.size > 0 ? (
    <RouteSwatches
      drawn={new Set([...drawing.values()].filter((d): d is 'gains' | 'gives_up' => d !== 'none'))}
      rest={[...drawing.values()].includes('none') || edges.some((e) => !drawing.has(e.id) && !linkIsStructural(nodes.find((n) => n.id === e.source)?.type, nodes.find((n) => n.id === e.target)?.type, e.data))}
    />
  ) : null
  if (folded) {
    // A legend only for routes that are there: an option with none says why, folded or not (A/B 21 Oct).
    return (
      <div data-testid={TRADE_OFFS_KEY_TESTID} data-option={option.optionId} data-folded="" className="space-y-2">
        {header}
        {empty ?? <p data-testid={`${TRADE_OFFS_KEY_TESTID}-legend`} className={`${typography.panelBody} text-text-body`}>{TRADE_OFFS_COPY.legend(goal)}</p>}
        {swatches}
      </div>
    )
  }

  return (
    <div data-testid={TRADE_OFFS_KEY_TESTID} data-option={option.optionId} className="space-y-3">
      {header}
      {swatches}

      {empty !== null ? empty : unsorted ? (
        <RouteGroup v10={v10} marks={marks} heading={TRADE_OFFS_COPY.unsorted(goal)} routes={option.routes} picked={pickedRoute} onPick={setPickedRoute} effect="unsorted" />
      ) : (
        <div className="space-y-2.5">
          <RouteGroup v10={v10} marks={marks} heading={TRADE_OFFS_COPY.group.gains(goal)} routes={of('gains')} picked={pickedRoute} onPick={setPickedRoute} effect="gains"
            flag={of('gives_up').length === 0 ? { testId: `${TRADE_OFFS_KEY_TESTID}-nothing-given-up`, text: TRADE_OFFS_COPY.nothingGivenUp } : null} />
          <RouteGroup v10={v10} marks={marks} heading={TRADE_OFFS_COPY.group.gives_up(goal)} routes={of('gives_up')} picked={pickedRoute} onPick={setPickedRoute} effect="gives_up" />
          <RouteGroup v10={v10} marks={marks} heading={TRADE_OFFS_COPY.group.not_set} routes={of('not_set')} picked={pickedRoute} onPick={setPickedRoute} effect="not_set" />
        </div>
      )}

      <AlsoInModel risks={read.alsoInModel.risks} limits={read.alsoInModel.limits} />

      {!viewer ? (
        <button
          type="button"
          data-testid={`${TRADE_OFFS_KEY_TESTID}-ask`}
          className={`${typography.panelBody} ${action('secondary')} gap-1 rounded-full px-3`}
          onClick={askWhatsMissing}
        >
          <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />
          {TRADE_OFFS_COPY.ask}
        </button>
      ) : null}
      <p className={`${typography.panelMeta} text-text-light`}>{TRADE_OFFS_COPY.note(goal)}</p>
    </div>
  )
}
