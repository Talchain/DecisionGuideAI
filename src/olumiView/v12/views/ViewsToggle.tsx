import type { View } from '../../client'
import { OkIcon } from '../../look/icons'
import { HoverButton } from '../../look/Hover'
import { TOOLBAR_BAR_SEPARATOR, TOOLBAR_ICON } from '../../look/toolbar'
import { revealedForYou } from './differGroups'
import { useViewsMarks } from './viewsMarks'
import { useCompare } from './useCompare'
import { COMPARE_WORDS } from './WhereWeDiffer'
/**
 * The team's two canvas controls, as icons on the top control row (ViewLensBar's `extra`; Paul, 18 Nov: "one control row, no foot panel").
 * Drawn only once a reveal is authorised for this viewer, so they never hint that views exist before then.
 *  - "Views" (Eye): the one switch for the reveal marks on the cards (RevealMarks). Those marks are drawn only at Detailed (CoreCard), so at
 *    Simple the switch has nothing to show and is not drawn (`marks`).
 *  - "Compare views" (Columns3): opens and closes the comparison over the canvas (CompareViewsStage); pressed while open.
 */
export function ViewsToggle({ view, marks }: { view: View | null; /** The cards draw the reveal marks (Detailed). */ marks: boolean }): JSX.Element | null {
  const on = useViewsMarks((s) => s.on)
  const set = useViewsMarks((s) => s.set)
  const centred = useCompare((s) => s.open)
  if (view === null || !revealedForYou(view)) return null
  return (
    <>
      <span aria-hidden="true" className={TOOLBAR_BAR_SEPARATOR} />
      {marks ? (
        <HoverButton type="button" aria-pressed={on} aria-label="Views" data-testid="views-toggle" className={TOOLBAR_ICON}
          words={on ? 'Hide the marks for each person’s view' : 'Show each person’s view on the canvas'} onClick={() => set(!on)}>
          <OkIcon id="views" size={14} variant={on ? undefined : 'alt'} decorative inherit />
        </HoverButton>
      ) : null}
      <HoverButton type="button" aria-pressed={centred} aria-label={COMPARE_WORDS.control} data-testid="views-compare" className={TOOLBAR_ICON}
        words="Each person’s view side by side, then where you differ" onClick={() => (centred ? useCompare.getState().hide() : useCompare.getState().show())}>
        <OkIcon id="compare-views" size={14} decorative inherit />
      </HoverButton>
    </>
  )
}
