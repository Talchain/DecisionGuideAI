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

export default OptionBand
