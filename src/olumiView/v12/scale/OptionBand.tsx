import { useEffect, useId } from 'react'
import { NodeShapeIndicator } from '../../../canvas/nodes/NodeShapeIndicator'
import { typography } from '../../../styles/typography'
import { Hover } from '../../look/Hover'
import { OptionRow } from '../../port/OptionRow'
import { ringFrom } from '../../reasoning/tabRing'
import type { CardBands, VisualV3 } from '../../visual'

export { OptionBand } from './OutcomeBand'

/** CH-bands on the canvas and in a reply. Core's numbers only place marks. */
export default function BandsChart({ payload, tier }: { payload: VisualV3 | CardBands; tier: 'glance' | 'full' }) {
  const full = tier === 'full'
  const reply = 'kind' in payload
  const ring = useId()
  useEffect(() => () => ringFrom(ring, []), [ring])
  const marks = payload.options.flatMap((option) => 'withheld' in option ? [] : [option.p10, option.p90, option.p50 ?? option.p10])
  const low = Math.min(0, ...marks), high = Math.max(0, ...marks)
  const scale = Math.max(Math.abs(low), high) || 1
  const at = (value: number) => high === low ? 0 : 100 * ((value / scale - low / scale) / (high / scale - low / scale))

  return (
    <div className="grid w-full min-w-0 gap-1" data-form="CH-bands" data-quantity={payload.quantity} data-band-tier={tier}>
      <p className={`${typography.viewPanelMeta} m-0 break-words text-text-light`} data-band-heading={reply ? '' : undefined} data-band-version={reply ? undefined : ''}>
        {reply ? payload.label : payload.versionLabel ?? 'draft'}
      </p>
      <ul className="m-0 grid min-w-0 list-none gap-1 p-0">
        {payload.options.map((lane, index) => {
          const known = !('withheld' in lane)
          const olumi = 'olumi' in lane && lane.olumi
          const approvalMark = 'approvalMark' in lane ? lane.approvalMark : null
          const hasTrack = known || reply
          const left = known ? at(Math.min(lane.p10, lane.p90)) : 0
          const right = known ? at(Math.max(lane.p10, lane.p90)) : 0
          const mid = known && lane.p50 !== null ? at(lane.p50) : null
          const point = known && lane.p10 === lane.p90
          return (
            <li key={`${lane.option}:${index}`} className="min-w-0" data-band-option={lane.option} data-band-state={known ? 'value' : 'withheld'} onClick={(event) => event.stopPropagation()}>
              <OptionRow id={lane.option} ring={ring} words={full ? ('hover' in lane ? lane.hover : lane.label) : lane.text}
                className={`nodrag nopan grid w-full min-w-0 items-center gap-2 px-1 py-1 ${reply ? 'grid-cols-3' : full ? 'grid-cols-[var(--space-10)_minmax(0,1fr)_minmax(0,1fr)]' : 'grid-cols-[var(--space-10)_minmax(0,1fr)]'}`}>
                <span className={`${typography.viewLabel} flex min-w-0 items-center gap-1 text-text-header`}>
                  <NodeShapeIndicator nodeKind="option" size={12} />
                  <span data-band-letter>{lane.letter}</span>
                  <span className={reply ? 'min-w-0 break-words' : 'sr-only'} data-band-label>{lane.label}</span>
                </span>
                {known ? (
                  <svg className="block h-3 w-full min-w-0 overflow-visible" aria-hidden="true" data-band-track>
                    <rect x="0" y="4" width="100%" height="2" rx="1" className="fill-panel-border" />
                    {point
                      ? <circle cx={`${left}%`} cy="5" r="3" className={olumi ? 'ok-scale-olumi-fill' : 'fill-text-body'} data-band-point />
                      : <rect x={`${left}%`} y="1" width={`${right - left}%`} height="8" rx="4" className={olumi ? 'ok-scale-olumi-fill' : 'fill-option'} data-band-range />}
                    {point || mid === null ? null : <line x1={`${mid}%`} x2={`${mid}%`} y1="0" y2="10" strokeWidth="1.5" className="stroke-text-header" data-band-middle />}
                  </svg>
                ) : reply ? (
                  <span className="ok-scale-withheld h-3 w-full min-w-0" aria-hidden="true" data-band-track data-band-withheld-track />
                ) : null}
                {full ? <span className={`${typography.viewLabel} min-w-0 break-words tabular-nums ${known ? 'text-text-body' : 'text-text-light'} ${hasTrack ? '' : 'col-span-2'}`}>
                  <span data-band-words>{lane.text}</span>
                  {approvalMark !== null ? <Hover focusable={false} words={approvalMark.title} className="ml-1 text-text-light" role="img" aria-label={approvalMark.title} data-band-if-approved>{approvalMark.glyph}</Hover> : null}
                </span> : null}
              </OptionRow>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export { BandsChart }
