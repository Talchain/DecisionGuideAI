/**
 * THE ASSUMPTION MAP: what the model rests on, beside the model (Paul's list, 18 Oct 2026: "assumption mapping —
 * evidence versus uncertainty matrix"). A 2 × 3 matrix of counts first; pressing a cell lists its figures, each of
 * which lights its element on the canvas and focuses it on press. Read only: it shows the owners' own words and adds
 * no number, score or ranking of its own (`assumptionMapModel.ts`). It is a map of SOURCE and CONNECTION, not of how
 * much a figure matters, so it opens on the first non-empty cell on the goal's path and claims no priority.
 */
import { useMemo, useState } from 'react'
import { useCanvasStore } from '../store'
import { resolveActiveGoalNodeId } from '../hooks/goalThresholdResolvers'
import { canvasLinkOfTarget, useCanvasLight } from '../graphChanges/rowCanvasLink'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { typography } from '../../styles/typography'
import {
  ASSUMPTION_MAP_COPY as COPY, assumptionMapOf,
  type AssumptionColumn, type AssumptionItem, type AssumptionRow,
} from './assumptionMapModel'

const ROWS: readonly AssumptionRow[] = ['on_path', 'off_path']
const COLUMNS: readonly AssumptionColumn[] = ['yours', 'unchecked', 'missing']
type CellKey = `${AssumptionRow}:${AssumptionColumn}`
/** Where the map opens: the first non-empty cell, the goal's path first and the figures the user has not settled first. */
const OPENING_ORDER: readonly CellKey[] = [
  'on_path:missing', 'on_path:unchecked', 'on_path:yours', 'off_path:missing', 'off_path:unchecked', 'off_path:yours',
]

export function AssumptionMap() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const ceeAnalysisReady = useCanvasStore((s) => s.ceeAnalysisReady)
  const outcomeNodeId = useCanvasStore((s) => s.outcomeNodeId)
  const goalId = useMemo(() => resolveActiveGoalNodeId({ ceeAnalysisReady, outcomeNodeId, nodes }), [ceeAnalysisReady, outcomeNodeId, nodes])
  const map = useMemo(() => assumptionMapOf(nodes, edges, goalId), [nodes, edges, goalId])
  const rows: readonly AssumptionRow[] = map.hasGoal ? ROWS : ['off_path']
  const rowLabel = (r: AssumptionRow) => (map.hasGoal ? COPY.rows[r] : COPY.inModel)
  const cells = useMemo(() => {
    const out = new Map<CellKey, AssumptionItem[]>()
    for (const item of map.items) {
      const key: CellKey = `${item.row}:${item.column}`
      out.set(key, [...(out.get(key) ?? []), item])
    }
    return out
  }, [map])
  const firstWithItems = OPENING_ORDER.find((key) => (cells.get(key)?.length ?? 0) > 0) ?? null
  const [picked, setPicked] = useState<CellKey | null>(null)
  const selected = picked !== null && (cells.get(picked)?.length ?? 0) > 0 ? picked : firstWithItems
  const light = useCanvasLight()

  if (map.items.length === 0) {
    return <p data-testid="assumption-map" className={`${typography.panelBody} text-text-body`}>{COPY.empty}</p>
  }
  const listed = selected === null ? [] : cells.get(selected) ?? []
  return (
    <div data-testid="assumption-map" className="space-y-3">
      {!map.hasGoal ? <p className={`${typography.panelBody} text-text-body`}>{COPY.noGoal}</p> : null}
      <div role="grid" aria-label={COPY.title} className="grid grid-cols-[minmax(0,1.1fr)_repeat(3,minmax(0,1fr))] gap-1">
        <span aria-hidden="true" />
        {COLUMNS.map((c) => (
          <span key={c} role="columnheader" className={`${typography.panelMeta} text-text-light`}>{COPY.columns[c]}</span>
        ))}
        {rows.map((r) => (
          <div key={r} role="row" className="contents">
            <span role="rowheader" className={`${typography.panelMeta} self-center text-text-light`}>{rowLabel(r)}</span>
            {COLUMNS.map((c) => {
              const key: CellKey = `${r}:${c}`
              const count = cells.get(key)?.length ?? 0
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  data-testid={`assumption-map-cell-${r}-${c}`}
                  data-count={count}
                  aria-pressed={selected === key}
                  disabled={count === 0}
                  onClick={() => setPicked(key)}
                  className={`${typography.panelBody} min-h-[40px] rounded border px-2 py-1 text-left tabular-nums text-text-body disabled:text-text-light border-panel-border ${selected === key ? 'bg-panel-hover' : ''} ${ACTION_FOCUS}`}
                >
                  {count}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      {selected !== null ? (
        <section aria-live="polite" className="space-y-1">
          <h3 className={`${typography.panelMeta} text-text-light`}>
            {rowLabel(selected.split(':')[0] as AssumptionRow)} · {COPY.columns[selected.split(':')[1] as AssumptionColumn]}
          </h3>
          <ul className="space-y-1">
            {listed.map((item) => {
              const link = canvasLinkOfTarget(item.target)
              return (
                <li key={`${item.target.kind}:${item.target.id}`}>
                  <button
                    type="button"
                    data-testid="assumption-map-item"
                    data-target={item.target.id}
                    className={`w-full rounded px-1 py-0.5 text-left hover:bg-panel-hover ${ACTION_FOCUS}`}
                    onClick={() => link?.focus()}
                    onMouseEnter={() => { if (link) light.on(link) }}
                    onMouseLeave={light.off}
                    onFocus={() => { if (link) light.on(link) }}
                    onBlur={light.off}
                  >
                    <span className={`${typography.panelBody} block text-text-body`}>{item.label}</span>
                    <span className={`${typography.panelMeta} block text-text-light`}>{item.source}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
      <p className={`${typography.panelMeta} text-text-light`}>{COPY.optionsNote}</p>
    </div>
  )
}
