/**
 * The Reasoning tab's adapter for the ONE action bar (`ActionBar.tsx`).
 *
 * The bar's offers are CEE's and the tab decides nothing about them. The only
 * thing this surface adds is its own model-and-workflow controls (edit brief,
 * review inputs, re-run), which the method strip's menu used to hold and no CEE
 * action carries yet: they stay reachable, last in the ⋯ menu, from the same
 * hook the strip uses.
 */
import { ActionBar } from '../../../../canvas/conversation/actionBar/ActionBar'
import type { ActionBarV1 } from '../../../../canvas/conversation/actionBar/actionBarContract'
import { METHOD_STRIP_COPY, modelWorkflowIcon, useModelWorkflowActions } from './MethodStrip'

export const REASONING_ACTION_BAR_TEST_ID = 'reasoning-action-bar'

export function ReasoningActionBar({ bar, canRerun }: { bar: ActionBarV1; canRerun: boolean }) {
  const { actions, run, toastElement } = useModelWorkflowActions(canRerun)
  return (
    <>
      <ActionBar
        bar={bar}
        surface="reasoning"
        testId={REASONING_ACTION_BAR_TEST_ID}
        hostMenu={{
          label: METHOD_STRIP_COPY.actionsLabel,
          items: actions.map((a) => ({ id: a.id, label: a.title, Icon: modelWorkflowIcon(a.id), onSelect: () => run(a) })),
        }}
      />
      {toastElement}
    </>
  )
}
