/**
 * The one quiet "Worth reviewing" marker (locked Canvas design, 23 Sep 2026).
 *
 * A ring in the warning family — the same family as the edited-since-run dot —
 * so it reads as "look here", never as an error. Hover/focus names the
 * producer reasons; click selects the node and opens the EXISTING inspector
 * (`openNodeInspector`), never a new panel. Lucide-free on purpose: a ring
 * scales with `--canvas-label-scale` without becoming an illegible glyph.
 */
import type { MouseEvent } from 'react'
import type { AttentionReason } from './nodeAttention'
import { openNodeInspector } from './openNodeInspector'

export const WORTH_REVIEWING = 'Worth reviewing'

export function attentionAccessibleName(reasons: readonly AttentionReason[]): string {
  return `${WORTH_REVIEWING}: ${reasons.map((r) => r.label).join(' · ')}`
}

export function NodeAttentionMarker({
  nodeId,
  reasons,
}: {
  nodeId: string
  reasons: readonly AttentionReason[]
}) {
  const name = attentionAccessibleName(reasons)
  return (
    <button
      type="button"
      data-testid={`attention-marker-${nodeId}`}
      aria-label={name}
      title={name}
      onClick={(e: MouseEvent) => {
        e.stopPropagation()
        openNodeInspector(nodeId)
      }}
      className="nodrag nopan shrink-0 grid place-items-center rounded-full bg-panel text-warning hover:bg-warning/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-info"
      style={{
        width: 'calc(18px * var(--canvas-label-scale, 1))',
        height: 'calc(18px * var(--canvas-label-scale, 1))',
      }}
    >
      <span
        aria-hidden="true"
        className="block rounded-full border-2 border-current"
        style={{
          width: 'calc(9px * var(--canvas-label-scale, 1))',
          height: 'calc(9px * var(--canvas-label-scale, 1))',
          boxShadow: '0 0 0 3px color-mix(in srgb, currentColor 12%, transparent)',
        }}
      />
    </button>
  )
}
