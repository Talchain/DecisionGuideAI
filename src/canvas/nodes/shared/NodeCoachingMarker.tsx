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
 *   - Shapes by the top item's producer `category` via the shared
 *     `guidanceCategoryIcon` — the SAME source the inspector card uses, so the
 *     marker's glyph matches the card it opens. (It used to take the card's
 *     TINT too; since contract v3.1 the canvas marker is muted at rest and Info
 *     on hover/focus — see "ONE CORNER-MARKER LANGUAGE" below.)
 *   - Caps at ONE marker per node (icon + a "+N" count when more than one item
 *     targets the node) — no badge soup on dense nodes.
 *   - On click, reuses the inspector's own open seam
 *     (InspectorGuidanceSection.tsx:266-268): select the node + open the
 *     inspector, then `setActiveGuidanceItem` — which scrolls the matching
 *     guidance card into view (its `isActive` effect) and pulses the node ring
 *     (useGuidancePulseHighlight). One route, the lightest existing one.
 *
 * ⭐⭐ THIS IS NOW THE NODE COACHING **SLOT**, WITH TWO SOURCES AND A RANKING.
 * PRODUCER FIRST, LOCAL STRUCTURE SECOND.
 *
 * The producer filter below is unchanged and still decides everything: where a
 * live `guidance_item` names this node, the producer's marker renders and nothing
 * else does. Where it does NOT — most nodes, most runs — the `!top` branch renders
 * `NodeStructuralMarker`, the client-derived channel: `computeStructuralAbsence`
 * read from the nodes and edges in the browser, with no producer stamp behind it
 * and none claimed.
 *
 * That ranking is NOT new. `hooks/__tests__/oneVoicePerNode.spec.ts` and
 * `hooks/useScienceIcons.ts:60-84` already ruled it for the other local channel:
 * the producer outranks a client-derived signal per node, and the local channel is
 * not deleted, because where the producer is silent the local observation is all
 * the reader gets and it is true. A structural finding is the same epistemic class,
 * so it inherits the same precedence. Applying it HERE, in the `!top` branch,
 * decides it in one place instead of at five call sites, and a node can never
 * carry two coaching voices.
 *
 * ⛔ THE FENCE THE `!top` BRANCH EXISTS TO RESPECT. The alternative route for a
 * client-derived finding is to synthesise a `GuidanceItem` with a `target_object`
 * and push it into `guidanceStore`. That fabricates producer provenance, and it
 * would also silence `useScienceIcons`'s `producerNamesThisNode` with a client-side
 * computation. Nothing of the kind happens: the structural finding never enters
 * `guidanceItems`, so the filter at :59 can never see it and no store consumer can
 * either. ⚠ LEAVE THAT FILTER BYTE-FOR-BYTE ALONE.
 *
 * ⚠ THE SLOT IS STILL ONE CORNER MEMBER. BaseNode's top-right stack is a
 * single-owner FIVE-MEMBER contract (`BaseNode.tsx:1206-1240`); the two sources here
 * are mutually exclusive, so this slot renders at most one glyph and the contract
 * is unchanged. A sixth sibling was rejected on exactly that ground.
 *
 * ⭐⭐ ONE CORNER-MARKER LANGUAGE — contract v3.1 (`.node .attention`,
 * `.icon-btn`; deltas PILL-07 / ICON-09 / T14(b), and PILL-08's colour half).
 * The marker was a raw-px `h-5` pill (13px at the 65% landing zoom, its count
 * text 7.8px — under the 10px canvas floor) with a shadow and a `scale-110`
 * hover bounce, the only transform on the card, and it painted must_fix /
 * should_fix in Danger red. Now, like its corner-stack siblings: the rail's
 * counter-scaled 20px box and 14px glyph, borderless and shadowless on a panel
 * fill, a background-tint hover and a focus ring, and the shared focusable
 * `Tooltip` rather than a native `title` (ED 02:31Z: native title is not
 * full-text recovery).
 *
 * COLOUR: muted at rest, Info on hover/focus — the coaching icon's own rule
 * (Paul 23 Sep pt 6), and Danger is the risk family's (pt 9), so a coaching cue
 * no longer carries warning styling. ⚠ The category is NOT lost and the glyph
 * is NOT swapped: SHAPE still says which of the four producer categories this
 * is (`guidanceCategoryIcon`, whose docblock rules shape = category so the
 * marker's glyph matches the inspector card it opens, WCAG 1.4.1), and the
 * inspector card keeps its tone. PILL-08's "render Lightbulb for must_fix" would
 * collapse must_fix onto the uncategorised glyph that ruling reserves, so it is
 * not taken. `data-guidance-category` still names the top item's category.
 *
 * ⭐ NORMAL ZOOM ONLY — contract v3.1 pt 6 (gap U6). The whole slot, producer
 * AND structural, renders at the `full` rung and at no other, on the same gate
 * as the rail's coaching icon (`selectRestingGlyphsShown`). At `quiet`/`line`
 * the producer's item stays reachable through selection and the inspector
 * (`InspectorGuidanceSection`), and the structural finding through its panel row.
 */

import { useCallback, useMemo } from 'react'
import {
  useGuidanceStore,
  compareGuidanceDisplayOrder,
  guidanceCategoryIcon,
  type GuidanceItem,
} from '../../stores/guidanceStore'
import { typography } from '../../../styles/typography'
import Tooltip from '../../../components/Tooltip'
import { openNodeInspector } from './openNodeInspector'
import { NODE_TOOLTIP_DELAY_MS } from './nodeTooltip'
import { NODE_RAIL_GLYPH_CLASSES, NODE_RAIL_GLYPH_PX } from './nodeCardRailStyles'
import { NodeStructuralMarker } from './NodeStructuralMarker'
import { useCanvasStore } from '../../store'
import { selectRestingGlyphsShown } from './restingGlyphRung'

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
  // Contract v3.1 pt 6: no coaching glyph at the quiet/line rungs.
  const shownAtThisRung = useCanvasStore(selectRestingGlyphsShown)

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
      openNodeInspector(nodeId)
      setActiveGuidanceItem(top.item_id)
    },
    [top, nodeId, setActiveGuidanceItem],
  )

  // No live item names this node → the slot falls through to the client-derived
  // channel, which self-gates and renders null unless THIS node is one the
  // structural finding's prescribed action names. Still never a permanently-empty
  // slot: when neither source applies, nothing renders.
  //
  // ⭐ THE PRECEDENCE IS THIS `if`. It reads the producer's own filter, so the
  // producer wins per node by construction — the `oneVoicePerNode` ruling applied
  // once here rather than restated at every call site.
  if (!shownAtThisRung) return null
  if (!top) return <NodeStructuralMarker nodeId={nodeId} />

  // SHAPE from the shared source of truth (the same one the inspector card
  // uses), so the marker's glyph matches the card it opens. Its tint is NOT
  // taken on the canvas: the marker is muted at rest and Info on hover/focus
  // (see the header — contract v3.1, Paul 23 Sep pts 6 and 9).
  const { Icon } = guidanceCategoryIcon(top.category)
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
    <Tooltip asChild delay={NODE_TOOLTIP_DELAY_MS} content={label}>
      <button
        type="button"
        data-testid={`node-coaching-marker-${nodeId}`}
        data-guidance-category={top.category ?? 'uncategorised'}
        data-guidance-count={count}
        data-node-tooltip="true"
        onClick={handleClick}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={label}
        // ⚠ LITERAL arbitrary values (no spaces), so Tailwind's scanner emits
        // them: a min-width box, because a "+N" count widens the marker.
        className="nodrag nopan inline-flex items-center justify-center gap-0.5 h-[calc(20px*var(--canvas-label-scale,1))] min-w-[calc(20px*var(--canvas-label-scale,1))] px-[calc(3px*var(--canvas-label-scale,1))] rounded bg-panel/90 text-text-light cursor-pointer hover:bg-info/10 hover:text-info focus-visible:bg-info/10 focus-visible:text-info focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
      >
        <Icon size={NODE_RAIL_GLYPH_PX} className={NODE_RAIL_GLYPH_CLASSES} aria-hidden="true" />
        {count > 1 && (
          <span className={`${typography.edgeLabel} font-semibold text-text-body tabular-nums leading-none`}>
            {count}
          </span>
        )}
      </button>
    </Tooltip>
  )
}
