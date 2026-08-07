/**
 * StaleBanner — panel-level "this coaching may be out of date" notice.
 *
 * FIXTURE-ONLY this phase. The UI never derives staleness (F.6); the banner is
 * shown only when the panel is explicitly told to (a fixture/prop). When CEE
 * provides a real staleness signal, this becomes a render of that field.
 *
 * DS: bg-panel + outlined warning border (never bg-warning-light); no side border.
 */
import { AlertTriangle } from 'lucide-react'
import { typography } from '@/styles/typography'
import { COACHING_COPY } from './constants'

export function StaleBanner() {
  return (
    <div
      className="flex items-center gap-2 rounded-md border border-warning/30 bg-panel px-3 py-2"
      data-testid="coaching-stale-banner"
    >
      <AlertTriangle className="h-4 w-4 flex-none text-warning" aria-hidden="true" />
      <span className={`${typography.panelBody} text-text-body`}>{COACHING_COPY.staleBanner}</span>
    </div>
  )
}

export default StaleBanner
