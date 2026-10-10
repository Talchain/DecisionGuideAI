/**
 * Reasoning adapter for the shared chat/Reasoning ActionBar.
 * Catalogue methods missing from CEE's current bar stay in the host menu:
 * implemented methods use runMethod; unsupported ones use the existing
 * unavailable treatment. Membership and press identity come from actionRegistry.
 * Workflow controls retain their existing owners, last in the overflow menu.
 */
import { ActionBar } from '../../../../canvas/conversation/actionBar/ActionBar'
import type { ActionBarV1 } from '../../../../canvas/conversation/actionBar/actionBarContract'
import { METHOD_STRIP_COPY, methodIcon, modelWorkflowIcon, useModelWorkflowActions } from './MethodStrip'
import { actionOfMethod, methodIsAvailable, METHOD_UNAVAILABLE_REASON } from '../../../../canvas/conversation/actionRegistry'
import { METHOD_CATALOGUE } from '../../decision-overview/actionsCatalogue'
import { runMethod } from '../runMethod'
import { typography } from '../../../../styles/typography'

/** The Reasoning tab's own text tokens (panel scale), handed to the shared bar. */
export const REASONING_TYPE = { body: typography.panelBody, meta: typography.panelMeta } as const

export const REASONING_ACTION_BAR_TEST_ID = 'reasoning-action-bar'

/** Catalogue methods absent from this bar, by registry action identity (never by wording). */
export function methodsTheBarDoesNotCarry(bar?: ActionBarV1): typeof METHOD_CATALOGUE {
  const offered = new Set(bar ? [...bar.priority, ...bar.standard, ...bar.more].map(o => o.action_id) : [])
  return METHOD_CATALOGUE.filter((method) => {
    const action = actionOfMethod(method.id)
    return action === undefined || !offered.has(action)
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
            items: methodsTheBarDoesNotCarry(bar).map((m) => ({
              id: m.id, label: m.title, Icon: methodIcon(m.id),
              disabledReason: methodIsAvailable(m.id) ? undefined : METHOD_UNAVAILABLE_REASON,
              onSelect: () => { runMethod(m) },
            })),
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
