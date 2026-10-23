/**
 * ONE FIGURE'S NUMBER ON THE MODEL in the "Rests on" lens: the same number the key card lists it under. The pill says
 * WHERE the reasoning is unexamined (view state: a figure nobody has checked, of unknown origin or not set yet stands
 * out; one the user stated or accepted steps back). It never grades the figure: "yours" is not "true", so the settled
 * pill is quieter, not greener. Origin is said in words, the owner's own (`ASSUMPTION_MAP_COPY.columns`), and the
 * card's or the link's own source mark stays where it is.
 *
 * Pressing it selects the figure, which opens it in the key card. It writes nothing.
 */
import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { typography } from '../../styles/typography'
import { ASSUMPTION_MAP_COPY, type AssumptionColumn, type RestsOnMark } from './assumptionMapModel'

export const RESTS_ON_MARKER_TESTID = 'rests-on-marker'

const UNSETTLED: ReadonlySet<AssumptionColumn> = new Set(['missing', 'unchecked', 'unknown'])

/** True for a figure the lens puts in front: no figure yet, Olumi's unchecked estimate, or origin not known. */
export const isUnsettled = (column: AssumptionColumn): boolean => UNSETTLED.has(column)

export const restsOnMarkerLabel = (mark: RestsOnMark): string =>
  mark.label ?? `Figure ${mark.n}: ${ASSUMPTION_MAP_COPY.columns[mark.column]}`

export function RestsOnMarker({ target, mark, onPick, Icon, className = '', style, picked = false }: {
  /** `node:<id>` or `edge:<id>`: the figure this number stands for (identity binding for every reader). */
  target: string
  mark: RestsOnMark
  onPick: () => void
  /** The link's own source mark, carried inside the pill so the line keeps one mark, not two. */
  Icon?: LucideIcon
  className?: string
  style?: CSSProperties
  picked?: boolean
}) {
  const unsettled = isUnsettled(mark.column)
  return (
    <button
      type="button"
      data-testid={RESTS_ON_MARKER_TESTID}
      data-target={target}
      data-column={mark.column}
      data-n={mark.n}
      aria-label={restsOnMarkerLabel(mark)}
      aria-pressed={picked}
      title={restsOnMarkerLabel(mark)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onPick()
      }}
      className={`nodrag nopan inline-flex h-[calc(20px*var(--canvas-label-scale,1))] min-w-[calc(20px*var(--canvas-label-scale,1))] items-center justify-center gap-1 rounded-full border px-1.5 tabular-nums shadow-1 transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-info ${typography.edgeLabel} ${
        unsettled ? 'border-info/40 bg-info-light text-text-header' : 'border-panel-border bg-panel text-text-light'
      } ${picked ? 'ring-2 ring-info ring-offset-1' : ''} ${className}`}
      style={style}
    >
      {Icon ? <Icon aria-hidden="true" className="h-[calc(10px*var(--canvas-label-scale,1))] w-[calc(10px*var(--canvas-label-scale,1))]" /> : null}
      {mark.n}
    </button>
  )
}
