/**
 * The ideas kept on this scenario, in the Olumi panel (V12 Solo-Return), as ONE pointer to where they are drawn. The canvas draws every kept idea,
 * with where it came from and who kept it, in its ideas band (v12/bands/extras.ts, IdeaPanel.tsx); the panel never repeats a card (PANEL-SPEC 3),
 * so it says how many there are and a press takes the canvas to the first. Nothing is drawn with no ideas. The words are the panel's chrome.
 */
import { Lightbulb } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { focusNodeById } from '../../../canvas/utils/focusHelpers'
import { useViewStore } from '../../store'
import { IDEA_PREFIX } from '../bands/bands'
import { keptIdeasOf } from '../ideas'

export const KEPT_IDEAS_HEADING = 'Your kept ideas'
/** "2 kept ideas, on the canvas": a count before a list (contract §2), the list itself being the canvas's. */
export const keptIdeasWords = (n: number): string => `${n} kept ${n === 1 ? 'idea' : 'ideas'}, on the canvas`

export function KeptIdeas(): JSX.Element | null {
  const view = useViewStore((s) => s.view)
  const ideas = keptIdeasOf(view)
  if (ideas.length === 0) return null
  return (
    <section aria-label={KEPT_IDEAS_HEADING} className={typography.viewPanelBody} data-testid="view-kept-ideas">
      <button type="button" onClick={() => focusNodeById(IDEA_PREFIX + ideas[0]!.id)} data-testid="view-kept-ideas-pointer" data-idea={ideas[0]!.id}
        className={`${typography.viewPanelHeading} inline-flex min-h-[24px] items-center gap-1.5 text-text-body hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-text-header`}>
        <Lightbulb className="h-3.5 w-3.5 flex-none text-text-light" strokeWidth={1.75} aria-hidden="true" />{keptIdeasWords(ideas.length)}
      </button>
    </section>
  )
}
