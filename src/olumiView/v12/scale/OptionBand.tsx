import { useEffect, useId } from 'react'
import { NodeShapeIndicator } from '../../../canvas/nodes/NodeShapeIndicator'
import { typography } from '../../../styles/typography'
import { OptionRow } from '../../port/OptionRow'
import { ringFrom } from '../../reasoning/tabRing'
import type { VisualV3 } from '../../visual'

/** One option's likely range on its aim's axis: a band from low to high and a tick at the middle; one value is a single mark. */
export function OptionBand({ left, width, mid }: { left: number; width: number; mid: number | null }) {
  const point = width < 0.5
  return (
    <svg className="block h-3 w-full overflow-visible" aria-hidden="true" data-form="CH-bands" data-testid="analysis-outcome-track">
      <rect x="0" y="4" width="100%" height="2" rx="1" className="fill-panel-border" />
      {point
        ? <circle cx={`${left}%`} cy="5" r="3" className="fill-text-body transition-all duration-fast motion-reduce:transition-none" data-outcome-point={left} />
        : <rect x={`${left}%`} y="1" width={`${width}%`} height="8" rx="4" className="fill-option transition-all duration-fast motion-reduce:transition-none" data-outcome-band={`${left}:${left + width}`} />}
      {point || mid === null ? null : <line x1={`${mid}%`} x2={`${mid}%`} y1="0" y2="10" strokeWidth="1.5" className="stroke-text-header" data-outcome-mid={mid} />}
    </svg>
  )
}

/**
 * CH-bands in a reply (V-3): Core's `turn.answer.visual` drawn as it comes. The heading, letters, labels and text are Core's, verbatim, in Core's order;
 * the percentiles only place each option's band (the OptionBand above) on one shared axis. A withheld option is an empty dashed track beside Core's text.
 */
export function BandsChart({ payload }: { payload: VisualV3 }) {
  const ring = useId()
  useEffect(() => () => ringFrom(ring, []), [ring])
  const marks = payload.options.flatMap((option) => ('withheld' in option ? [] : [option.p10, option.p90, option.p50]))
  const low = Math.min(0, ...marks), high = Math.max(0, ...marks)
  const at = (value: number) => (high === low ? 0 : (100 * (value - low)) / (high - low))
  return (
    <div className="grid w-full min-w-0 gap-1" data-form="CH-bands" data-quantity={payload.quantity} data-band-tier="full">
      <p className={`${typography.viewPanelMeta} m-0 break-words text-text-light`} data-band-heading="">{payload.label}</p>
      <ul className="m-0 grid min-w-0 list-none gap-1 p-0">
        {payload.options.map((lane, index) => {
          const known = !('withheld' in lane)
          const left = known ? at(Math.min(lane.p10, lane.p90)) : 0
          const right = known ? at(Math.max(lane.p10, lane.p90)) : 0
          return (
            <li key={`${lane.option}:${index}`} className="min-w-0" data-band-option={lane.option} data-band-state={known ? 'value' : 'withheld'}>
              <OptionRow id={lane.option} ring={ring} words={lane.label} className="nodrag nopan grid w-full min-w-0 grid-cols-3 items-center gap-2 px-1 py-1">
                <span className={`${typography.viewLabel} flex min-w-0 items-center gap-1 text-text-header`}>
                  <NodeShapeIndicator nodeKind="option" size={12} />
                  <span data-band-letter>{lane.letter}</span>
                  <span className="min-w-0 break-words" data-band-label>{lane.label}</span>
                </span>
                {known
                  ? <span className="block min-w-0" data-band-track><OptionBand left={left} width={right - left} mid={at(lane.p50)} /></span>
                  : <span className="ok-scale-withheld h-3 w-full min-w-0" aria-hidden="true" data-band-track data-band-withheld-track />}
                <span className={`${typography.viewLabel} min-w-0 break-words tabular-nums ${known ? 'text-text-body' : 'text-text-light'}`} data-band-words>{lane.text}</span>
              </OptionRow>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default OptionBand
