/**
 * V7GuidanceSection — "What to do next" (V7 Lane L6, spec rows 8 + 9).
 *
 * Renders the guidance store's items, ordered by the ONE canonical
 * display-order doctrine (severity `category` major → producer `priorityRank`
 * → coarse `priority`; see buildV7Guidance / compareGuidanceDisplayOrder). The
 * top item shows open; the rest are counted behind a "Show N more" toggle
 * (spec: "one open, rest counted").
 *
 * Category is conveyed by an OUTLINED count-style badge (DS v5 §22.3) — a
 * complete four-sided border whose COLOUR carries severity, never a
 * `border-l-*` accent, never a filled or `text-{colour}` pill. An ABSENT
 * producer category suppresses the badge (honest — never a synthesised
 * severity).
 *
 * Each item's `primary_action` maps to its honest affordance (spec row 9):
 *   · open_inspector → Focus (centres the node on canvas)
 *   · discuss        → Work through it (opens the Ask-Olumi drawer)
 *   · run_exercise   → Try a … (sends the exercise command)
 *   · approve_patch  → promoted to the held-proposal card, never listed here
 *   · anything else  → NO affordance (fail closed, no guessing)
 *
 * PASSTHROUGH only, no flags, additive, COMPLETE borders. Reads the shared
 * guidance store with STABLE selectors (never an inline object selector — the
 * Zustand inline-selector landmine); the ordering happens in a memo, never in
 * the selector.
 */

import { useMemo, useState } from 'react'
import { Crosshair, MessageCircle, FlaskConical } from 'lucide-react'
import { typography } from '@/styles/typography'
import {
  useGuidanceStore,
  selectGuidanceItems,
  type GuidanceItem,
  type GuidanceCategory,
} from '../../../canvas/stores/guidanceStore'
import { openAskOlumi } from '../coaching/askOlumiStore'
import { buildV7Guidance, deriveGuidanceAffordance } from './buildV7Guidance'
import { V7_GUIDANCE_COPY } from './v7GuidanceCopy'
import { V7HeldProposalCard } from './V7HeldProposalCard'

const C = V7_GUIDANCE_COPY.guidance

export interface V7GuidanceSectionProps {
  onFocusNode?: (nodeId: string) => void
  onSendMessage?: (text: string) => void
}

/** Outlined category badge — colour on ALL four sides (complete border),
 *  never a one-sided accent, never a filled or text-{colour} pill. */
function categoryBorderClass(cat: GuidanceCategory): string {
  switch (cat) {
    case 'must_fix':
      return 'border-danger/30'
    case 'should_fix':
      return 'border-warning/30'
    case 'could_fix':
      return 'border-info/30'
    case 'technique':
      return 'border-panel-border'
  }
}

function CategoryBadge({ category }: { category?: GuidanceCategory }) {
  // Absent producer category → no badge (never a synthesised severity).
  if (!category) return null
  return (
    <span
      data-testid="v7-guidance-badge"
      data-category={category}
      className={`flex-none rounded-full border ${categoryBorderClass(category)} bg-transparent px-1.5 py-0 ${typography.panelMeta} text-text-body`}
    >
      {C.categoryLabel[category]}
    </span>
  )
}

function GuidanceAffordance({
  item,
  onFocusNode,
  onSendMessage,
}: {
  item: GuidanceItem
  onFocusNode?: (nodeId: string) => void
  onSendMessage?: (text: string) => void
}) {
  const affordance = deriveGuidanceAffordance(item)

  const chipClass = `inline-flex items-center gap-1.5 rounded-full border border-panel-border bg-transparent px-2.5 py-1 ${typography.panelMeta} text-text-body hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`

  switch (affordance.kind) {
    case 'focus':
      if (!onFocusNode) return null
      return (
        <button
          type="button"
          data-testid="v7-guidance-action-focus"
          onClick={() => onFocusNode(affordance.nodeId)}
          className={chipClass}
        >
          <Crosshair aria-hidden="true" className="h-3 w-3 flex-none text-info" />
          {C.action.focus}
        </button>
      )
    case 'work_through':
      return (
        <button
          type="button"
          data-testid="v7-guidance-action-work-through"
          onClick={() =>
            openAskOlumi({ context: item.title, draft: affordance.prompt, label: C.action.workThrough })
          }
          className={chipClass}
        >
          <MessageCircle aria-hidden="true" className="h-3 w-3 flex-none text-info" />
          {C.action.workThrough}
        </button>
      )
    case 'run_exercise':
      if (!onSendMessage) return null
      return (
        <button
          type="button"
          data-testid="v7-guidance-action-run-exercise"
          onClick={() => onSendMessage(`/exercise ${affordance.exercise}`)}
          className={chipClass}
        >
          <FlaskConical aria-hidden="true" className="h-3 w-3 flex-none text-info" />
          {C.action.runExercise(affordance.exercise)}
        </button>
      )
    // 'none' — unknown / navigate / promoted approve_patch: render NO
    // affordance (fail closed). The item still shows its title + category.
    case 'none':
      return null
  }
}

function GuidanceRow({
  item,
  open,
  onFocusNode,
  onSendMessage,
}: {
  item: GuidanceItem
  open: boolean
  onFocusNode?: (nodeId: string) => void
  onSendMessage?: (text: string) => void
}) {
  return (
    <div className="space-y-1" data-testid="v7-guidance-item" data-item-id={item.item_id}>
      <div className="flex items-start gap-2">
        <CategoryBadge category={item.category} />
        <p className={`${typography.panelBody} min-w-0 flex-1 text-text-body`}>{item.title}</p>
      </div>
      {open && item.detail && (
        <p className={`${typography.panelMeta} text-text-light`}>{item.detail}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        <GuidanceAffordance item={item} onFocusNode={onFocusNode} onSendMessage={onSendMessage} />
      </div>
    </div>
  )
}

export function V7GuidanceSection({ onFocusNode, onSendMessage }: V7GuidanceSectionProps) {
  // STABLE selector — the stored array reference. Ordering/splitting happens in
  // the memo below, NEVER in the selector (inline-selector landmine).
  const guidanceItems = useGuidanceStore(selectGuidanceItems)
  const [showAll, setShowAll] = useState(false)

  const { guidance, heldProposals } = useMemo(() => buildV7Guidance(guidanceItems), [guidanceItems])

  // Nothing to guide AND no held proposal → render nothing (never a shell).
  if (guidance.length === 0 && heldProposals.length === 0) return null

  const top = guidance[0]
  const rest = guidance.slice(1)
  const moreCount = rest.length

  return (
    <section
      data-testid="v7-guidance-section"
      className="rounded-lg border border-panel-border bg-panel px-3 py-2.5 space-y-2.5"
    >
      {/* Held proposals (approve_patch) — the ONLY L6 surface for a proposal,
          a display-only pointer to the single live confirm in chat. Rendered
          above the next-steps list so a pending change reads first. */}
      {heldProposals.map((item) => (
        <V7HeldProposalCard key={item.item_id} item={item} />
      ))}

      {guidance.length > 0 && (
        <div className="space-y-2">
          <div>
            <h3 className={`${typography.panelHeader} text-text-header`}>{C.heading}</h3>
            <p className={`${typography.panelMeta} text-text-light`}>{C.subtitle}</p>
          </div>

          {/* Top item — shown open. */}
          <GuidanceRow item={top} open onFocusNode={onFocusNode} onSendMessage={onSendMessage} />

          {/* The rest — counted, revealed on demand. */}
          {moreCount > 0 && (
            <>
              {showAll && (
                <div className="space-y-2 border-t border-panel-border pt-2">
                  {rest.map((item) => (
                    <GuidanceRow
                      key={item.item_id}
                      item={item}
                      open={false}
                      onFocusNode={onFocusNode}
                      onSendMessage={onSendMessage}
                    />
                  ))}
                </div>
              )}
              <button
                type="button"
                data-testid="v7-guidance-toggle"
                onClick={() => setShowAll((s) => !s)}
                className={`${typography.panelMeta} text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              >
                {showAll ? C.showFewer : C.showMore(moreCount)}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}

export default V7GuidanceSection
