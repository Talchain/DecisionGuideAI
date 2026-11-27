import { useEffect, useId } from 'react'
import { NodeShapeIndicator } from '../../../canvas/nodes/NodeShapeIndicator'
import { typography } from '../../../styles/typography'
import { Hover } from '../../look/Hover'
import { OptionRow } from '../../port/OptionRow'
import { ringFrom } from '../../reasoning/tabRing'
import type { VisualV3 } from '../../visual'

export const BANDS_DRAFT = 'draft'

/** The same axis and lane order on the canvas, in a reply and in Analysis. Core's numbers only place marks. */
export default function BandsChart({ payload }: { payload: VisualV3 }) {
  const ring = useId()
  useEffect(() => () => ringFrom(ring, []), [ring])
  const marks = payload.lanes.flatMap((lane) => lane.state === 'value' ? [lane.p10, lane.p90, ...(lane.p50 === null ? [] : [lane.p50])] : [])
  const low = Math.min(0, ...marks), high = Math.max(0, ...marks)
  const scale = Math.max(Math.abs(low), high) || 1
  const at = (value: number) => high === low ? 0 : 100 * ((value / scale - low / scale) / (high / scale - low / scale))

  return (
    <div className="grid w-full min-w-0 gap-1" data-form="CH-bands" data-quantity={payload.quantity}>
      <p className={`${typography.viewPanelMeta} m-0 break-words text-text-light`} data-band-version>
        {payload.binding.kind === 'version' ? payload.binding.label : BANDS_DRAFT}
      </p>
      <ul className="m-0 grid min-w-0 list-none gap-1 p-0">
        {payload.lanes.map((lane) => {
          const known = lane.state === 'value'
          const provenance = known ? lane.provenance : null
          const basis = provenance?.kind === 'olumi' ? provenance.basis : provenance?.author?.title
          const left = known ? at(Math.min(lane.p10, lane.p90)) : 0
          const right = known ? at(Math.max(lane.p10, lane.p90)) : 0
          const mid = known && lane.p50 !== null ? at(lane.p50) : null
          const point = known && lane.p10 === lane.p90
          return (
            <li key={lane.option} className="min-w-0" data-band-option={lane.option} data-band-state={lane.state} onClick={(event) => event.stopPropagation()}>
              <OptionRow id={lane.option} ring={ring} words={known ? lane.title ?? basis ?? lane.label : lane.label}
                className="nodrag nopan grid w-full min-w-0 grid-cols-[var(--space-10)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 px-1 py-1">
                <span className={`${typography.viewLabel} flex min-w-0 items-center gap-1 text-text-header`}>
                  <NodeShapeIndicator nodeKind="option" size={12} />
                  <span data-band-letter>{lane.letter}</span>
                  <span className="sr-only">{lane.label}</span>
                </span>
                {known ? (
                  <svg className="block h-3 w-full min-w-0 overflow-visible" aria-hidden="true" data-band-track>
                    <rect x="0" y="4" width="100%" height="2" rx="1" className="fill-panel-border" />
                    {point
                      ? <circle cx={`${left}%`} cy="5" r="3" className={provenance?.kind === 'olumi' ? 'ok-scale-olumi-fill' : 'fill-text-body'} data-band-point />
                      : <rect x={`${left}%`} y="1" width={`${right - left}%`} height="8" rx="4" className={provenance?.kind === 'olumi' ? 'ok-scale-olumi-fill' : 'fill-option'} data-band-range />}
                    {point || mid === null ? null : <line x1={`${mid}%`} x2={`${mid}%`} y1="0" y2="10" strokeWidth="1.5" className="stroke-text-header" data-band-middle />}
                  </svg>
                ) : null}
                <span className={`${typography.viewLabel} min-w-0 break-words tabular-nums ${known ? 'text-text-body' : 'col-span-2 text-text-light'}`}>
                  <span data-band-words>{known ? lane.text : lane.reason}</span>
                  {known && lane.if_approved !== null ? <Hover focusable={false} words={lane.if_approved.title} className="ml-1 text-text-light" role="img" aria-label={lane.if_approved.title} data-band-if-approved>{lane.if_approved.glyph}</Hover> : null}
                </span>
              </OptionRow>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export { BandsChart }
