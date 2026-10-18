/**
 * THE ASSUMPTION MAP: what the model rests on, beside the model (Paul's list, 18 Oct 2026: "assumption mapping —
 * evidence versus uncertainty matrix"; Paul, 18 Oct: "a much more beautiful, premium visual experience … not
 * interactive at all"). Every figure is one mark on a strip, in the confidence language, grouped by whether it is on a
 * path to the goal. A mark or row lights its element on the canvas; picking one selects it there and opens it in place
 * (`FigureCard`), where the user acts through the model's own controls. Picking an element on the canvas picks it here.
 *
 * It shows the owners' own words and adds no number, score or ranking of its own (`assumptionMapModel.ts`). It is a map
 * of SOURCE and CONNECTION, not of how much a figure matters, so it claims no priority: it opens on the first state
 * that has figures, the goal's path first.
 */
import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { useCanvasStore } from '../store'
import { resolveActiveGoalNodeId } from '../hooks/goalThresholdResolvers'
import { canvasLinkOfTarget, useCanvasLight } from '../graphChanges/rowCanvasLink'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { typography } from '../../styles/typography'
import {
  ASSUMPTION_MAP_COPY as COPY, assumptionMapOf,
  type AssumptionColumn, type AssumptionItem, type AssumptionRow,
} from './assumptionMapModel'
import { FIGURE_MARK, FIGURE_ORDER, FIGURE_SHORT, figureKey } from './figureMarks'
import { useArtefactStore } from './artefactStore'
import { FigureCard } from './FigureCard'

const ROWS: readonly AssumptionRow[] = ['on_path', 'off_path']
/** Where the map opens: the first state with figures, the ones the user has not settled first. */
const OPENING_ORDER: readonly AssumptionColumn[] = ['missing', 'unchecked', 'yours']

export const ASSUMPTION_MAP_STRIP_COPY = {
  summary: (yours: number, total: number) => `You stated or accepted ${yours} of the ${total} figures this model rests on.`,
  justSet: 'Yours just now',
} as const

/** The open model's assumption map, the one the strip, the list and the rail's count all read. */
export function useAssumptionMap() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const ceeAnalysisReady = useCanvasStore((s) => s.ceeAnalysisReady)
  const outcomeNodeId = useCanvasStore((s) => s.outcomeNodeId)
  const goalId = useMemo(() => resolveActiveGoalNodeId({ ceeAnalysisReady, outcomeNodeId, nodes }), [ceeAnalysisReady, outcomeNodeId, nodes])
  return useMemo(() => assumptionMapOf(nodes, edges, goalId), [nodes, edges, goalId])
}

/** The one element selected on the canvas, as a figure key, or null. */
function useCanvasPickKey(): string | null {
  return useCanvasStore((s) => {
    const { nodeIds, edgeIds } = s.selection
    if (nodeIds.size + edgeIds.size !== 1) return null
    const [node] = nodeIds
    const [edge] = edgeIds
    return node !== undefined ? `node:${node}` : `edge:${edge}`
  })
}

export function AssumptionMap() {
  const map = useAssumptionMap()
  const picked = useArtefactStore((s) => s.picked)
  const pick = useArtefactStore((s) => s.pick)
  const settled = useArtefactStore((s) => s.settled)
  const seen = useArtefactStore((s) => s.seen)
  const light = useCanvasLight()
  const canvasPick = useCanvasPickKey()
  const byKey = useMemo(() => new Map(map.items.map((item) => [figureKey(item), item])), [map])
  const counts = useMemo(() => {
    const out: Record<AssumptionColumn, number> = { yours: 0, unchecked: 0, missing: 0 }
    for (const item of map.items) out[item.column] += 1
    return out
  }, [map])
  const opening = OPENING_ORDER.find((column) => counts[column] > 0) ?? 'yours'
  const [chosen, setChosen] = useState<AssumptionColumn | null>(null)
  const column = chosen !== null && counts[chosen] > 0 ? chosen : opening

  // The list follows the picked figure: once its value or strength is set, it moves to "yours" and stays in view there.
  const pickedColumn = picked !== null ? byKey.get(picked)?.column : undefined
  useEffect(() => {
    if (pickedColumn !== undefined) setChosen(pickedColumn)
  }, [pickedColumn])

  // Two-way: an element picked on the canvas is picked here, with its state's list in view.
  useEffect(() => {
    if (canvasPick === null) return
    const item = byKey.get(canvasPick)
    if (!item) return
    pick(canvasPick)
    setChosen(item.column)
  }, [canvasPick, byKey, pick])

  if (map.items.length === 0) {
    return <p data-testid="assumption-map" className={`${typography.panelBody} text-text-body`}>{COPY.empty}</p>
  }

  const rowLabel = (r: AssumptionRow) => (map.hasGoal ? COPY.rows[r] : COPY.inModel)
  const rows: readonly AssumptionRow[] = map.hasGoal ? ROWS : ['off_path']
  const inRow = (r: AssumptionRow) => map.items.filter((item) => (map.hasGoal ? item.row === r : true))
  const sorted = (items: readonly AssumptionItem[]) =>
    [...items].sort((a, b) => FIGURE_ORDER.indexOf(a.column) - FIGURE_ORDER.indexOf(b.column))
  const lightProps = (item: AssumptionItem) => {
    const link = canvasLinkOfTarget(item.target)
    const enter = () => {
      seen(figureKey(item))
      if (link) light.on(link)
    }
    return { onMouseEnter: enter, onFocus: enter, onMouseLeave: light.off, onBlur: light.off }
  }
  const choose = (item: AssumptionItem) => {
    const key = figureKey(item)
    seen(key)
    setChosen(item.column)
    if (picked === key) {
      pick(null)
      return
    }
    pick(key)
    canvasLinkOfTarget(item.target)?.focus()
  }

  return (
    <div data-testid="assumption-map" className="space-y-4">
      <section aria-label={COPY.title} className="space-y-3">
        <p className={`${typography.panelQuestion} tabular-nums text-text-header`}>
          {ASSUMPTION_MAP_STRIP_COPY.summary(counts.yours, map.items.length)}
        </p>
        {!map.hasGoal ? <p className={`${typography.panelBody} text-text-body`}>{COPY.noGoal}</p> : null}
        <div className="flex items-end gap-4">
          {rows.map((r) => {
            const items = sorted(inRow(r))
            if (items.length === 0) return null
            return (
              <div key={r} className="min-w-0 space-y-1.5" style={{ flex: `${items.length} 1 0%` }}>
                <div className="flex h-10 items-end gap-[3px]">
                  {items.map((item) => {
                    const key = figureKey(item)
                    const isPicked = picked === key
                    return (
                      <button
                        key={key}
                        type="button"
                        data-testid="assumption-map-mark"
                        data-target={item.target.id}
                        data-column={item.column}
                        aria-label={`${item.label}: ${COPY.columns[item.column]}`}
                        aria-pressed={isPicked}
                        onClick={() => choose(item)}
                        {...lightProps(item)}
                        className={`h-8 min-w-[4px] flex-1 rounded-[4px] transition-[transform,box-shadow] duration-200 ease-out ${FIGURE_MARK[item.column]} ${isPicked ? '-translate-y-1 ring-2 ring-info ring-offset-2 ring-offset-panel' : 'hover:-translate-y-0.5'} ${settled.includes(key) && !isPicked ? 'ring-2 ring-success ring-offset-2 ring-offset-panel' : ''} ${ACTION_FOCUS}`}
                      />
                    )
                  })}
                </div>
                <p className={`${typography.panelMeta} truncate tabular-nums text-text-light`}>
                  {rowLabel(r)} · {items.length}
                </p>
              </div>
            )
          })}
        </div>
        <div role="group" aria-label={COPY.title} className="flex flex-wrap gap-1.5">
          {FIGURE_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              data-testid={`assumption-map-filter-${c}`}
              data-count={counts[c]}
              aria-pressed={column === c}
              title={COPY.columns[c]}
              disabled={counts[c] === 0}
              onClick={() => setChosen(c)}
              className={`${typography.panelMeta} inline-flex min-h-[28px] items-center gap-1.5 rounded-full border px-2.5 tabular-nums transition-colors duration-200 disabled:opacity-40 ${column === c ? 'border-info bg-panel-hover text-text-header' : 'border-panel-border text-text-body hover:border-info/60'} ${ACTION_FOCUS}`}
            >
              <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-[3px] ${FIGURE_MARK[c]}`} />
              {counts[c]} {FIGURE_SHORT[c]}
            </button>
          ))}
        </div>
      </section>

      <section aria-live="polite" aria-label={COPY.columns[column]} className="space-y-3">
        {rows.map((r) => {
          const listed = inRow(r).filter((item) => item.column === column)
          if (listed.length === 0) return null
          return (
            <div key={r} className="space-y-1">
              <h3 className={`${typography.panelMeta} text-text-light`}>{rowLabel(r)} · {COPY.columns[column]}</h3>
              <ul className="space-y-0.5">
                {listed.map((item) => {
                  const key = figureKey(item)
                  const isPicked = picked === key
                  const isSettled = settled.includes(key)
                  return (
                    <li key={key} className={`rounded-xl transition-colors duration-200 ${isPicked ? 'bg-panel-hover' : ''}`}>
                      <button
                        type="button"
                        data-testid="assumption-map-item"
                        data-target={item.target.id}
                        aria-expanded={isPicked}
                        onClick={() => choose(item)}
                        {...lightProps(item)}
                        className={`flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left ${isPicked ? '' : 'hover:bg-panel-hover'} ${ACTION_FOCUS}`}
                      >
                        <span aria-hidden="true" className={`mt-[3px] h-2.5 w-2.5 flex-none rounded-[3px] ${FIGURE_MARK[item.column]}`} />
                        <span className="min-w-0 flex-1">
                          <span className={`${typography.panelBody} block font-medium text-text-header`}>{item.label}</span>
                          <span className={`${typography.panelMeta} block text-text-light`}>{item.source}</span>
                        </span>
                        {isSettled ? (
                          <span data-testid="assumption-map-settled" className={`${typography.panelMeta} inline-flex flex-none items-center gap-1 rounded-full border border-success px-2 py-0.5 text-text-body`}>
                            <Check aria-hidden="true" className="h-3 w-3 text-success" />
                            {ASSUMPTION_MAP_STRIP_COPY.justSet}
                          </span>
                        ) : null}
                      </button>
                      {isPicked ? <FigureCard item={item} /> : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </section>
      <p className={`${typography.panelMeta} text-text-light`}>{COPY.optionsNote}</p>
    </div>
  )
}
