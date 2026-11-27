import { trackPct } from '../../resultRange'

/** One option's track: the bar to its chance, and the whisker between its low and high chances where core sends them. */
export function ChanceTrack({ chance, range }: { chance: number; range: { low: number; high: number } | null }) {
  const at = trackPct(chance)
  const lo = range === null ? null : trackPct(Math.min(range.low, range.high)), hi = range === null ? null : trackPct(Math.max(range.low, range.high))
  return (
    <svg className="block h-4 w-full overflow-visible" aria-hidden="true" data-form="CH-chance" data-testid="analysis-chance-track">
      <rect x="0" y="0" width="100%" height="6" rx="3" className="fill-panel-border" />
      <rect x="0" y="0" width={`${at}%`} height="6" rx="3" className="fill-option transition-all duration-fast motion-reduce:transition-none" data-chance-bar={at} />
      {/* The whisker sits under the bar, never over it, so the chance stays the first thing read. */}
      {range === null || lo === null || hi === null ? null : (
        <g data-chance-range={`${trackPct(range.low)}:${trackPct(range.high)}`}>
          <line x1={`${lo}%`} x2={`${hi}%`} y1="12" y2="12" strokeWidth="2" className="stroke-text-body" data-chance-whisker />
          <circle cx={`${trackPct(range.low)}%`} cy="12" r="3" strokeWidth="1.5" className="fill-panel stroke-text-body transition-all duration-fast motion-reduce:transition-none" data-chance-low />
          <circle cx={`${trackPct(range.high)}%`} cy="12" r="3" className="fill-text-body transition-all duration-fast motion-reduce:transition-none" data-chance-high />
        </g>
      )}
    </svg>
  )
}

export function ChanceKeyMark({ kind }: { kind: 'low' | 'high' }) {
  return kind === 'low'
    ? <svg className="h-2.5 w-2.5" data-chance-key={kind}><circle cx="50%" cy="50%" r="3" strokeWidth="1.5" className="fill-panel stroke-text-body" /></svg>
    : <svg className="h-2.5 w-2.5" data-chance-key={kind}><circle cx="50%" cy="50%" r="3" className="fill-text-body" /></svg>
}

export default ChanceTrack
