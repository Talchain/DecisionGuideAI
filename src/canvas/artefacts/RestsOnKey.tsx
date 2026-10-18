/**
 * THE "RESTS ON" KEY CARD: the same numbers as the model, grouped by who each figure came from.
 *
 * It opens on where the reasoning is unexamined, never on a score: "This model rests on 13 figures. 7 are Olumi's
 * estimates nobody has checked." (Paul's principle §4, challenging hardest where it is consequential; PL, 18 Oct:
 * authorship is not confidence, so "yours" is never counted as done or true.) The groups run unsettled first
 * (`RESTS_ON_ORDER`), each figure under the number it carries on the canvas.
 *
 * The key is compact, so the model stays in view: each state lists its numbers, and the canvas carries the same numbers
 * on the cards and links. Picking a number here selects the figure and centres it in the visible frame; picking it on
 * the canvas selects it too. Either way the picked figure opens here (`FigureCard`), with its own controls. The pick IS the canvas
 * selection, so there is no second record of it. A figure the user settles while the lens is open keeps its row and
 * says so: "Set by you just now", or "Olumi's estimate, accepted just now" (accepting never makes it yours).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCanvasStore } from '../store'
import { resolveActiveGoalNodeId } from '../hooks/goalThresholdResolvers'
import { canvasLinkOfTarget, useCanvasLight } from '../graphChanges/rowCanvasLink'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { action, ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { typography } from '../../styles/typography'
import {
  ASSUMPTION_MAP_COPY, RESTS_ON_ORDER, assumptionMapOf, restsOnKey, restsOnNumbered,
  type AssumptionColumn, type AssumptionItem,
} from './assumptionMapModel'
import { isUnsettled } from './RestsOnMarker'
import { FigureCard } from './FigureCard'

export const RESTS_ON_KEY_TESTID = 'rests-on-key'

export const RESTS_ON_COPY = {
  restsOn: (n: number) => `This model rests on ${n} ${n === 1 ? 'figure' : 'figures'}.`,
  unchecked: (n: number) => `${n} ${n === 1 ? 'is an Olumi estimate' : 'are Olumi’s estimates'} nobody has checked`,
  missing: (n: number) => `${n} ${n === 1 ? 'has' : 'have'} no figure yet`,
  unknown: (n: number) => `${n} ${n === 1 ? 'has' : 'have'} no known origin`,
  allSettled: 'Each one is yours, or an estimate of Olumi’s you accepted.',
  offPath: 'Not linked to your goal',
  pick: 'Pick a number, here or on the model, to open its figure.',
  previous: 'Previous figure',
  next: 'Next figure',
  all: 'All figures',
  justNow: { yours: 'Set by you just now', accepted: 'Olumi’s estimate, accepted just now' },
} as const

/** "7 are Olumi's estimates nobody has checked, 4 have no figure yet." The unsettled parts only, largest claim first. */
export function restsOnHeadline(counts: Readonly<Record<AssumptionColumn, number>>): string {
  const parts = [
    counts.unchecked > 0 ? RESTS_ON_COPY.unchecked(counts.unchecked) : null,
    counts.missing > 0 ? RESTS_ON_COPY.missing(counts.missing) : null,
    counts.unknown > 0 ? RESTS_ON_COPY.unknown(counts.unknown) : null,
  ].filter((p): p is string => p !== null)
  if (parts.length === 0) return RESTS_ON_COPY.allSettled
  const sentence = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return `${sentence}.`
}

type Numbered = AssumptionItem & { readonly n: number }

/** The canvas selection as one figure key, or null when nothing or several things are selected. */
export function usePickedKey(): string | null {
  return useCanvasStore((s) => {
    const { nodeIds, edgeIds } = s.selection
    if (nodeIds.size === 1 && edgeIds.size === 0) return `node:${[...nodeIds][0]}`
    if (edgeIds.size === 1 && nodeIds.size === 0) return `edge:${[...edgeIds][0]}`
    return null
  })
}

/** Figures that became the user's (or accepted) while the lens was open: the signature, until the lens closes. */
function useSettledJustNow(items: readonly Numbered[]): ReadonlyMap<string, 'yours' | 'accepted'> {
  const previous = useRef<Map<string, AssumptionColumn> | null>(null)
  const [settled, setSettled] = useState<ReadonlyMap<string, 'yours' | 'accepted'>>(new Map())
  useEffect(() => {
    const now = new Map(items.map((item) => [restsOnKey(item.target), item.column]))
    const before = previous.current
    previous.current = now
    if (before === null) return
    const moved: Array<[string, 'yours' | 'accepted']> = []
    now.forEach((column, key) => {
      const was = before.get(key)
      if (was !== undefined && was !== column && (column === 'yours' || column === 'accepted')) moved.push([key, column])
    })
    if (moved.length > 0) setSettled((held) => new Map([...held, ...moved]))
  }, [items])
  return settled
}

/** `folded`: only the attention sentence shows, so the model stays in view; the numbers are on the model. */
export function RestsOnKey({ folded = false }: { folded?: boolean }) {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const ceeAnalysisReady = useCanvasStore((s) => s.ceeAnalysisReady)
  const outcomeNodeId = useCanvasStore((s) => s.outcomeNodeId)
  const goalId = useMemo(() => resolveActiveGoalNodeId({ ceeAnalysisReady, outcomeNodeId, nodes }), [ceeAnalysisReady, outcomeNodeId, nodes])
  const map = useMemo(() => assumptionMapOf(nodes, edges, goalId), [nodes, edges, goalId])
  const items = useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    return restsOnNumbered(map.items, edges, (id) => byId.get(id)?.position ?? null)
  }, [map, nodes, edges])
  const counts = useMemo(() => {
    const out: Record<AssumptionColumn, number> = { yours: 0, accepted: 0, unchecked: 0, unknown: 0, missing: 0 }
    for (const item of items) out[item.column] += 1
    return out
  }, [items])
  const picked = usePickedKey()
  const settledJustNow = useSettledJustNow(items)
  const light = useCanvasLight()

  if (items.length === 0) {
    return <p data-testid={RESTS_ON_KEY_TESTID} className={`${typography.panelBody} text-text-body`}>{ASSUMPTION_MAP_COPY.empty}</p>
  }
  const pickedAt = items.findIndex((item) => restsOnKey(item.target) === picked)
  const pickedItem = pickedAt >= 0 ? items[pickedAt] : null
  const pickedJustNow = pickedItem ? settledJustNow.get(restsOnKey(pickedItem.target)) : undefined
  // Numbers run in reading order, so stepping walks the model the way the eye does.
  const step = (by: 1 | -1) => {
    const next = items[(pickedAt + by + items.length) % items.length]
    canvasLinkOfTarget(next.target)?.focus()
  }
  const chip = (item: Numbered) => {
    const key = restsOnKey(item.target)
    const link = canvasLinkOfTarget(item.target)
    const name = `${item.n}: ${item.label}`
    return (
      <li key={key}>
        <button
          type="button"
          data-testid={`${RESTS_ON_KEY_TESTID}-row`}
          data-target={key}
          aria-label={name}
          title={name}
          className={`${typography.panelMeta} inline-flex h-7 min-w-[28px] items-center justify-center rounded-full border px-2 tabular-nums transition-colors duration-200 ${
            isUnsettled(item.column) ? 'border-info/40 bg-info-light text-text-header' : 'border-panel-border text-text-body'
          } ${settledJustNow.has(key) ? 'ring-2 ring-info/40' : ''} ${ACTION_FOCUS}`}
          onClick={() => link?.focus()}
          onMouseEnter={() => { if (link) light.on(link) }}
          onMouseLeave={light.off}
          onFocus={() => { if (link) light.on(link) }}
          onBlur={light.off}
        >
          {item.n}
        </button>
      </li>
    )
  }
  const headline = (
    <div className="space-y-1">
      <p data-testid={`${RESTS_ON_KEY_TESTID}-headline`} className={`${typography.panelQuestion} text-text-header`}>
        {RESTS_ON_COPY.restsOn(items.length)}
      </p>
      <p className={`${typography.panelBody} text-text-body`}>{restsOnHeadline(counts)}</p>
      {!map.hasGoal && !folded ? <p className={`${typography.panelMeta} text-text-light`}>{ASSUMPTION_MAP_COPY.noGoal}</p> : null}
    </div>
  )
  if (folded) return <div data-testid={RESTS_ON_KEY_TESTID} data-folded="">{headline}</div>
  return (
    <div data-testid={RESTS_ON_KEY_TESTID} className="space-y-3">
      {headline}
      {pickedItem ? (
        <div data-testid={`${RESTS_ON_KEY_TESTID}-picked`} className="rounded-xl border border-panel-border px-3 pb-2 pt-2.5">
          <div className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={`${typography.panelMeta} mt-px inline-flex h-5 min-w-[20px] flex-none items-center justify-center rounded-full border px-1 tabular-nums ${
                isUnsettled(pickedItem.column) ? 'border-info/40 bg-info-light text-text-header' : 'border-panel-border text-text-light'
              }`}
            >
              {pickedItem.n}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`${typography.panelBody} text-text-header`}>{pickedItem.label}</p>
              <p className={`${typography.panelMeta} text-text-light`}>
                {ASSUMPTION_MAP_COPY.columns[pickedItem.column]} · {pickedItem.source}
                {map.hasGoal && pickedItem.row === 'off_path' ? ` · ${RESTS_ON_COPY.offPath}` : ''}
              </p>
              {pickedJustNow ? (
                <span
                  data-testid={`${RESTS_ON_KEY_TESTID}-just-now`}
                  className={`${typography.panelMeta} mt-1 inline-flex rounded-full border border-info/30 px-2 py-0.5 text-text-body`}
                >
                  {RESTS_ON_COPY.justNow[pickedJustNow]}
                </span>
              ) : null}
            </div>
            {items.length > 1 ? (
              <div className="flex flex-none items-center">
                <button type="button" data-testid={`${RESTS_ON_KEY_TESTID}-previous`} aria-label={RESTS_ON_COPY.previous} title={RESTS_ON_COPY.previous}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-body ${ACTION_FOCUS}`}
                  onClick={() => step(-1)}>
                  <ChevronLeft aria-hidden="true" className="h-4 w-4" />
                </button>
                <button type="button" data-testid={`${RESTS_ON_KEY_TESTID}-next`} aria-label={RESTS_ON_COPY.next} title={RESTS_ON_COPY.next}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-body ${ACTION_FOCUS}`}
                  onClick={() => step(1)}>
                  <ChevronRight aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
          <FigureCard item={pickedItem} />
          <button
            type="button"
            data-testid={`${RESTS_ON_KEY_TESTID}-all`}
            className={`${typography.panelMeta} ${action('quiet')} px-0 no-underline hover:text-text-body`}
            onClick={() => useCanvasStore.getState().clearSelection()}
          >
            {RESTS_ON_COPY.all}
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            {RESTS_ON_ORDER.map((column) => {
              const group = items.filter((item) => item.column === column)
              if (group.length === 0) return null
              return (
                <section key={column} data-testid={`${RESTS_ON_KEY_TESTID}-group-${column}`} className="flex items-start gap-2">
                  <h3 className={`${typography.panelMeta} w-[104px] flex-none pt-1.5 text-text-light`}>{ASSUMPTION_MAP_COPY.columns[column]}</h3>
                  <ul className="flex min-w-0 flex-1 flex-wrap gap-1">{group.map(chip)}</ul>
                </section>
              )
            })}
          </div>
          <p className={`${typography.panelMeta} text-text-light`}>{RESTS_ON_COPY.pick} {ASSUMPTION_MAP_COPY.optionsNote}</p>
        </>
      )}
    </div>
  )
}
