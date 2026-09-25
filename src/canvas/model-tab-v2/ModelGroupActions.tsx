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
 *
 * ⚠ ONE OF THOSE SIX CITATIONS IS NOW OUT OF DATE, AND IT IS THE ONLY ONE THAT
 * WAS EVER REACHABLE (10 Sep 2026). The five `*Section.tsx` originals are inside
 * `ModelTabBody`'s `LEGACY_DETAILED_EDITOR_MOUNTED = false` gate and are dark.
 * `ModelHealthSection`'s is NOT — it mounts in `model-scientific-transparency`,
 * outside that gate — so it stayed clickable with a `title` as its only name AND
 * with no fronting on its send. It now carries `MODELCARD_DISCUSS_LABEL` as a
 * real `aria-label` and routes through `createOlumiHandOff`. The five dark ones
 * are untouched and still read as described above.
 * The label is the same DS idiom the v1 STRUCTURAL CTAs already use, so this is
 * conformance to the existing visual language rather than a new one — no new
 * token, no new size, no new colour.
 *
 * ⭐⭐ SUPERSEDED FOR `discuss`, 23 Sep 2026 (Paul: repeated text becomes icons;
 * R3: every hand-to-Olumi act is `MessageCircle`). The sentence repeated once
 * per open group — five times with every group open — and said the same act
 * each time. It is now the shared `IconBtn`, and the objection above is met
 * rather than ignored: the sentence is a real `aria-label` (not a `title`),
 * and the hover/focus text is the panel's `Tooltip`. What is genuinely lost is
 * the words for a SIGHTED TOUCH reader before they tap — stated, not hidden.
 * `sectionWriterNotice` still quotes the sentence; it is the button's name and
 * tooltip, so a voice user can still say it.
 *
 * ⚠ STRUCTURAL acts keep their words — they are distinct per group ("Add a
 * factor", "Add a relationship") — and lead with the DS Tier-2 `Plus` glyph in
 * place of a typed "+ " (DS v5 §9: no unicode symbol used as an icon).
 */

import { MessageCircle, Plus } from 'lucide-react'
import { typography } from '../../styles/typography'
import { IconBtn } from '../components/pre-analysis/primitives/IconBtn'
import { icon } from '../../components/results/analysisNew/panelSurfaces'
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
      {actions.map(action =>
        action.intent === 'discuss' ? (
          <IconBtn
            key={action.id}
            icon={MessageCircle}
            tooltip={action.label}
            ariaLabel={action.label}
            testId={`model-action-v2-${action.id}`}
            dataAttrs={{ 'data-intent': action.intent }}
            onClick={() => onAction(action, action.message(context))}
          />
        ) : (
        <button
          key={action.id}
          type="button"
          data-testid={`model-action-v2-${action.id}`}
          data-intent={action.intent}
          onClick={() => onAction(action, action.message(context))}
          className={`${typography.panelMeta} inline-flex items-center gap-1 cursor-pointer hover:underline text-info`}
        >
          {/* C6, 23 Sep 2026: the DS Tier-2 `Plus`, not a typed "+ ". Only the
              structural acts reach this arm now — `discuss` is the icon button
              above — so the old per-intent colour branch is gone with it. */}
          <Plus className={`${icon('row')} shrink-0`} aria-hidden="true" />
          {action.label}
        </button>
        ),
      )}
    </div>
  )
}
