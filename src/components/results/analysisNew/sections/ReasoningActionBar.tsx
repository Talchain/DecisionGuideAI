/**
 * The Reasoning tab's adapter for the ONE action bar (`ActionBar.tsx`).
 *
 * The bar's offers are CEE's and the tab decides nothing about them. The only
 * thing this surface adds is its own model-and-workflow controls (edit brief,
 * review inputs, re-run), which the method strip's menu used to hold and no CEE
 * action carries yet: they stay reachable, last in the ⋯ menu, from the same
 * hook the strip uses.
 *
 * ⛔ AND EVERY REASONING METHOD THE BAR DOES NOT CARRY (DL, 7 Oct 2026: "do not
 * drop the 5 prose methods until P12/P25 give them typed handlers"). The bar
 * replaces the method strip, and CEE offers only actions with a complete typed
 * contract, so reframe, opposite case, outside view, trade-offs and bias check
 * had no door at all once a bar arrived. They are listed under "Reasoning
 * methods" and press through `runMethod` (one chip turn) exactly as the strip
 * did. A method leaves this list by itself once the registry gives it a typed
 * handler (then CEE's bar carries it), so it is never offered twice.
 */
import { ActionBar } from '../../../../canvas/conversation/actionBar/ActionBar'
import type { ActionBarV1 } from '../../../../canvas/conversation/actionBar/actionBarContract'
import { METHOD_STRIP_COPY, methodIcon, modelWorkflowIcon, useModelWorkflowActions } from './MethodStrip'
import { ACTION_REGISTRY, actionOfMethod } from '../../../../canvas/conversation/actionRegistry'
import { METHOD_CATALOGUE } from '../../decision-overview/actionsCatalogue'
import { runMethod } from '../runMethod'
import { typography } from '../../../../styles/typography'

/** The Reasoning tab's own text tokens (panel scale), handed to the shared bar. */
export const REASONING_TYPE = { body: typography.panelBody, meta: typography.panelMeta } as const

export const REASONING_ACTION_BAR_TEST_ID = 'reasoning-action-bar'

/** The catalogue methods that only reach Olumi as a prose turn: no typed handler, so no CEE bar offer. */
export function methodsTheBarDoesNotCarry(): typeof METHOD_CATALOGUE {
  return METHOD_CATALOGUE.filter((method) => {
    const action = actionOfMethod(method.id)
    return action !== undefined && ACTION_REGISTRY[action].handler.kind === 'prose'
  })
}

export function ReasoningActionBar({ bar, canRerun }: { bar: ActionBarV1; canRerun: boolean }) {
  const { actions, run, toastElement } = useModelWorkflowActions(canRerun)
  return (
    <>
      <ActionBar
        bar={bar}
        surface="reasoning"
        typeScale={REASONING_TYPE}
        testId={REASONING_ACTION_BAR_TEST_ID}
        hostMenu={[
          {
            id: 'methods',
            label: METHOD_STRIP_COPY.methodsLabel,
            items: methodsTheBarDoesNotCarry().map((m) => ({ id: m.id, label: m.title, Icon: methodIcon(m.id), onSelect: () => { runMethod(m) } })),
          },
          {
            id: 'workflow',
            label: METHOD_STRIP_COPY.actionsLabel,
            items: actions.map((a) => ({ id: a.id, label: a.title, Icon: modelWorkflowIcon(a.id), onSelect: () => run(a) })),
          },
        ]}
      />
      {toastElement}
    </>
  )
}
