/**
 * ModelGroupActions — the group-level affordances of the canonical outline.
 *
 * A PURE PROJECTION, like every other render component in this directory: it
 * takes the actions and a callback and renders buttons. It performs no fronting,
 * sends no turn and reads no store — `ModelTabV2Panel` owns the hand-off, and
 * `ModelTabBody` (the one file here allowed to touch the live app) owns the
 * sender. Three layers, one write path, no shortcut.
 *
 * ⚠ WHY THE `discuss` CONTROLS CARRY VISIBLE TEXT. Their v1 originals were
 * ICON-ONLY — a 14px `MessageCircle` whose only accessible name was a `title`
 * attribute (`GoalSection.tsx:243`, `OptionsSection.tsx:521`,
 * `FactorsSection.tsx:745`, `RelationshipsSection.tsx:827`,
 * `RisksSection.tsx:143`, `ModelHealthSection.tsx:328`). A `title` is not an
 * accessible name a screen reader announces reliably and is invisible on touch.
 * The label is the same DS idiom the v1 STRUCTURAL CTAs already use, so this is
 * conformance to the existing visual language rather than a new one — no new
 * token, no new size, no new colour.
 */

import { typography } from '../../styles/typography'
import type { GroupAction, GroupActionContext } from './groupActions'
import type { ModelGroupId } from './types'

export interface ModelGroupActionsProps {
  groupId: ModelGroupId
  actions: readonly GroupAction[]
  context: GroupActionContext
  /**
   * Absent when no conversation can receive a turn.
   *
   * ⚠ THE CALLER PASSES NOTHING RATHER THAN A NO-OP, and this component renders
   * nothing in response. That is the v1 `{onSendMessage && …}` guard preserved:
   * an affordance whose turn cannot be delivered must not be on screen at all
   * (preamble P8). A no-op callback here would put every button back and make
   * each one a dead end.
   */
  onAction?: (action: GroupAction, message: string) => void
}

export function ModelGroupActions({
  groupId,
  actions,
  context,
  onAction,
}: ModelGroupActionsProps) {
  if (!onAction || actions.length === 0) return null

  return (
    <div
      data-testid={`model-group-v2-${groupId}-actions`}
      className="flex flex-wrap items-center gap-3 px-4 py-1.5"
    >
      {actions.map(action => (
        <button
          key={action.id}
          type="button"
          data-testid={`model-action-v2-${action.id}`}
          data-intent={action.intent}
          onClick={() => onAction(action, action.message(context))}
          className={`${typography.panelMeta} cursor-pointer hover:underline ${
            action.intent === 'structural' ? 'text-info' : 'text-text-light hover:text-info'
          }`}
        >
          {action.intent === 'structural' ? `+ ${action.label}` : action.label}
        </button>
      ))}
    </div>
  )
}
