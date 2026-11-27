import '../../look/olumiLook.css'
import type { ViewRun } from '../../client'
import { trackPct } from '../../resultRange'

type Figure = NonNullable<ViewRun['rests'][number]['figures']>[number]
const WHOSE_FILL: Record<Figure['whose'], string> = { olumi: 'ok-scale-share-olumi', theirs: 'fill-text-header', mixed: 'fill-text-light' }

/** One figure's share of a rest's uncertainty: a bar to core's fraction (geometry only; core's line says the number), coloured by whose figure it is. */
export function ShareBar({ f }: { f: Figure }) {
  const w = trackPct(f.share)
  return (
    <svg className="block h-1.5 w-full" aria-hidden="true" data-form="CH-rests" data-testid="reasoning-share-bar" data-share={w} data-whose={f.whose}>
      <rect x="0" y="0" width="100%" height="6" rx="3" className="fill-panel-border" />
      <rect x="0" y="0" width={`${w}%`} height="6" rx="3" className={WHOSE_FILL[f.whose]} />
    </svg>
  )
}

export function ShareKeyMark({ whose }: { whose: Figure['whose'] }) {
  return <svg className="h-2 w-2"><rect width="8" height="8" rx="2" className={WHOSE_FILL[whose]} /></svg>
}

export default ShareBar
