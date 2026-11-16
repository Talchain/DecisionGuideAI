import { Users } from 'lucide-react'
import type { View } from '../../client'
import { typography } from '../../../styles/typography'
import { revealedForYou } from './differGroups'
import { useViewsMarks } from './viewsMarks'

/**
 * A small floating "Views" switch for the canvas: when on, each revealed view is marked on the card it concerns (RevealMarks). Drawn only
 * once a reveal is authorised for this viewer, so it never hints that views exist before then. Place it with the canvas's other small
 * floating controls; it carries no position of its own beyond `className`.
 */
export function ViewsToggle({ view, className = '' }: { view: View | null; className?: string }): JSX.Element | null {
  const on = useViewsMarks((s) => s.on)
  const set = useViewsMarks((s) => s.set)
  if (view === null || !revealedForYou(view)) return null
  return (
    <button type="button" data-testid="views-toggle" aria-pressed={on} title={on ? 'Hide the marks for each person’s view' : 'Show each person’s view on the canvas'}
      onClick={() => set(!on)}
      className={`inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-full border border-panel-border bg-panel px-3 text-text-body shadow-sm hover:bg-panel-hover ${typography.viewPanelMeta} ${on ? 'text-text-header' : ''} ${className}`}>
      <Users strokeWidth={1.75} aria-hidden="true" className="h-3.5 w-3.5" />Views
    </button>
  )
}
