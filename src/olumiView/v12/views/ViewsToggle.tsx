import type { View } from '../../client'
import { OkIconButton } from '../../look/icons'
import { revealedForYou } from './differGroups'
import { useViewsMarks } from './viewsMarks'
import { useCompare } from './useCompare'
import { COMPARE_WORDS } from './WhereWeDiffer'
import { ACTION_FOCUS } from '../../../components/results/analysisNew/panelSurfaces'

/** Sized as the lens buttons beside them (ViewLensBar), so the row reads as one; as they do, only an unpressed one changes colour on hover, so a
 *  pressed one keeps its pressed colour. */
const rowButton = (pressed: boolean) => `h-full min-w-8 rounded-full px-2 transition-colors duration-200 ${pressed ? '' : 'hover:text-text-body'} ${ACTION_FOCUS}`

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
      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-panel-border" />
      {marks ? <OkIconButton id="views" variant={on ? undefined : 'alt'} active={on} pressed={on} words="Views" testid="views-toggle" className={rowButton(on)}
        hover={on ? 'Hide the marks for each person’s view' : 'Show each person’s view on the canvas'} onClick={() => set(!on)} /> : null}
      <OkIconButton id="compare-views" active={centred} pressed={centred} words={COMPARE_WORDS.control} testid="views-compare" className={rowButton(centred)}
        hover="Each person’s view side by side, then where you differ" onClick={() => (centred ? useCompare.getState().hide() : useCompare.getState().show())} />
    </>
  )
}
