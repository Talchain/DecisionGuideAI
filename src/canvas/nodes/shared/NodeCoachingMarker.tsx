/**
 * NodeCoachingMarker — on-canvas coaching marker bound to a graph node.
 *
 * Replaces the permanently-empty CEE/ISL NodeBadge slot (23-Jul capability
 * audit G3): the old badge read per-node `useCEEInsights()` / `useISLValidation()`
 * whose `analyze()`/`validate()` were never called, so it rendered nothing, ever.
 *
 * This marker instead reads the LIVE guidance store — the same `guidance_items`
 * the inspector's `InspectorGuidanceSection` renders — and shows a small, honest
 * badge on any node a live guidance item NAMES via `target_object.id`. It:
 *
 *   - Appears ONLY while a live item targets this node. No items → renders null
 *     (no permanently-empty UI). Producer-named targets only: a target id that
 *     names no node simply never mounts a marker (fail-closed by construction,
 *     the #451 resolver doctrine — the marker lives inside the node whose id it
 *     matches, so an unresolvable id can never surface one).
 *   - Colours by the top item's producer `category` via the shared
 *     `guidanceCategoryTone` (colour = state, DS v5) — the SAME source the
 *     inspector card uses, so the marker's tint matches the card it opens.
 *   - Caps at ONE marker per node (icon + a "+N" count when more than one item
 *     targets the node) — no badge soup on dense nodes.
 *   - On click, reuses the inspector's own open seam
 *     (InspectorGuidanceSection.tsx:266-268): select the node + open the
 *     inspector, then `setActiveGuidanceItem` — which scrolls the matching
 *     guidance card into view (its `isActive` effect) and pulses the node ring
 *     (useGuidancePulseHighlight). One route, the lightest existing one.
 */

import { useCallback, useMemo } from 'react'
import {
  useGuidanceStore,
  compareGuidanceDisplayOrder,
  guidanceCategoryTone,
  guidanceCategoryIcon,
  type GuidanceItem,
} from '../../stores/guidanceStore'
import { useCanvasStore } from '../../store'
import { typography } from '../../../styles/typography'

interface NodeCoachingMarkerProps {
  /** The canvas node id this marker sits on. */
  nodeId: string
}

export function NodeCoachingMarker({ nodeId }: NodeCoachingMarkerProps) {
  // Subscribe to the raw array (stable Zustand reference) then derive locally —
  // an inline selector returning a filtered array trips the "getSnapshot should
  // be cached" loop (see InspectorGuidanceSection's identical note).
  const allItems = useGuidanceStore((s) => s.guidanceItems)
  const setActiveGuidanceItem = useGuidanceStore((s) => s.setActiveGuidanceItem)

  // Producer-named targets only: an item counts iff its target_object names THIS
  // node. Identical filter to InspectorGuidanceSection so the marker and the
  // card it opens agree exactly. Sorted by the shared display-order doctrine so
  // the marker's tone/title come from the highest-severity item.
  const items = useMemo(
    () =>
      allItems
        .filter((i) => i.target_object?.id === nodeId)
        .sort(compareGuidanceDisplayOrder),
    [allItems, nodeId],
  )

  const top: GuidanceItem | undefined = items[0]

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!top) return
      // Reuse the inspector's own open seam (InspectorGuidanceSection.tsx open_inspector
      // fallback): select the node + show the inspector, where the guidance card
      // for this node renders; setActiveGuidanceItem then scrolls it into view and
      // pulses the node ring (useGuidancePulseHighlight).
      const canvas = useCanvasStore.getState()
      canvas.selectNodeWithoutHistory(nodeId)
      canvas.setShowInspectorPanel(true)
      setActiveGuidanceItem(top.item_id)
    },
    [top, nodeId, setActiveGuidanceItem],
  )

  // No live item names this node → no marker (never a permanently-empty slot).
  if (!top) return null

  const tone = guidanceCategoryTone(top.category)
  // Icon + tint from the shared source of truth (same one the inspector card
  // uses) so the marker's icon matches the card it opens. Border still rides the
  // tone channel directly.
  const { Icon, tintClass: iconColour } = guidanceCategoryIcon(top.category)
  const borderColour = tone === 'danger' ? 'border-danger/30' : 'border-info/30'
  const count = items.length

  const label =
    count > 1
      ? `${count} coaching suggestions for this node. Top: ${top.title}`
      : `Coaching suggestion: ${top.title}`

  // Positioning is owned by BaseNode's top-right corner STACK — this marker
  // renders as a static flex child there (alongside the sensitivity-rank badge)
  // so the two never collide (Codex P1-5). It carries no `absolute`/offset of
  // its own; only its intrinsic pill styling.
  return (
    <button
      type="button"
      data-testid={`node-coaching-marker-${nodeId}`}
      data-guidance-category={top.category ?? 'uncategorised'}
      data-guidance-count={count}
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
      title={label}
      aria-label={label}
      className={`
        nodrag nopan
        inline-flex items-center gap-0.5 h-5 min-w-5 px-1
        rounded-full bg-panel border ${borderColour} shadow-1
        cursor-pointer hover:scale-110 transition-transform
      `}
    >
      <Icon className={`w-3.5 h-3.5 ${iconColour}`} aria-hidden="true" />
      {count > 1 && (
        <span className={`${typography.caption} font-semibold text-text-body tabular-nums leading-none`}>
          {count}
        </span>
      )}
    </button>
  )
}
