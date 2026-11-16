import { Columns3, Users } from 'lucide-react'
import type { View } from '../../client'
import { typography } from '../../../styles/typography'
import { revealedForYou } from './differGroups'
import { useViewsMarks } from './viewsMarks'
import { useCompare } from './useCompare'
import { COMPARE_WORDS } from './WhereWeDiffer'

/**
 * A small floating "Views" switch for the canvas: when on, each revealed view is marked on the card it concerns (RevealMarks). Drawn only
 * once a reveal is authorised for this viewer, so it never hints that views exist before then. Place it with the canvas's other small
 * floating controls; it carries no position of its own beyond `className`.
 */
export function ViewsToggle({ view, className = '' }: { view: View | null; className?: string }): JSX.Element | null {
  const on = useViewsMarks((s) => s.on)
  const set = useViewsMarks((s) => s.set)
  const centred = useCompare((s) => s.open)
  if (view === null || !revealedForYou(view)) return null
  // Beside the marks switch, the way into the main-workspace comparison (each member's view side by side, then where they differ). Pressed while open.
  const pill = `inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-full border border-panel-border bg-panel px-3 text-text-body shadow-sm hover:bg-panel-hover ${typography.viewPanelMeta} ${className}`
  return (
    <>
    <button type="button" data-testid="views-toggle" aria-pressed={on} title={on ? 'Hide the marks for each person’s view' : 'Show each person’s view on the canvas'}
      onClick={() => set(!on)}
      className={`inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 rounded-full border border-panel-border bg-panel px-3 text-text-body shadow-sm hover:bg-panel-hover ${typography.viewPanelMeta} ${on ? 'text-text-header' : ''} ${className}`}>
      <Users strokeWidth={1.75} aria-hidden="true" className="h-3.5 w-3.5" />Views
    </button>
    <button type="button" data-testid="views-compare" aria-pressed={centred} title="Each person’s view side by side, then where you differ"
      onClick={() => (centred ? useCompare.getState().hide() : useCompare.getState().show())} className={`${pill} ${centred ? 'text-text-header' : ''}`}>
      <Columns3 strokeWidth={1.75} aria-hidden="true" className="h-3.5 w-3.5" />{COMPARE_WORDS.control}
    </button>
    </>
  )
}
