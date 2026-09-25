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
 */

import { Plus } from 'lucide-react'
import { typography } from '../../styles/typography'
import { OlumiAiIcon } from '../../components/results/analysisNew/OlumiAiIcon'
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
      // ⭐ MODEL-7: px-0. This block sat at +16 against the outline's +8 rows
      // and +0 header — one more of the five left edges the sweep removes.
      className="flex flex-wrap items-center gap-3 px-0 py-1.5"
    >
      {actions.map(action => (
        <button
          key={action.id}
          type="button"
          data-testid={`model-action-v2-${action.id}`}
          data-intent={action.intent}
          onClick={() => onAction(action, action.message(context))}
          /**
           * ⭐⭐ V2 GAP 33 — `min-h-[24px] inline-flex items-center gap-1`:
           * WCAG 2.2 AA §2.5.8's 24px floor. Measured on served `4549b66b`:
           * these links rendered at 15px tall (`typography.panelMeta` alone,
           * no geometry), below every OTHER act tier on the panel.
           */
          className={`${typography.panelMeta} inline-flex items-center gap-1 min-h-[24px] cursor-pointer hover:underline ${
            action.intent === 'structural' ? 'text-info' : 'text-text-light hover:text-info'
          }`}
        >
          {action.intent === 'structural' ? (
            // A typed "+ " read as plain punctuation, not a glyph a reader
            // recognises as "add". A Lucide `Plus` at row scale (`icon('row')`
            // in `panelSurfaces.ts`, 14px) matches the outline's own icon
            // scale instead of inventing a fourth size.
            <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            // Every AI hand-off on the panel must carry the Olumi AI glyph
            // (`FIDELITY-GAPS-INDEX-20260924.txt` #33) — none did, under
            // `src/canvas`. `text-info` regardless of the link's own tone: the
            // glyph is what marks the act as an AI interaction, not a repaint
            // of the link's rest state.
            <OlumiAiIcon size={14} className="text-info shrink-0" aria-hidden="true" />
          )}
          {action.label}
        </button>
      ))}
    </div>
  )
}
