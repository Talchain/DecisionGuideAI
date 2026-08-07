/**
 * EntityTarget — the entity-navigation cue for a coaching signal.
 *
 * Shape is the PRIMARY cue (NodeShapeIndicator, the codebase's shape-first
 * identity channel); entity colour is SECONDARY outlined support on the label
 * text only. Unknown/absent `target_kind` degrades to a neutral marker — never
 * a raw technical string (UX amendment 3). No side borders, no light fills.
 */
import { typography } from '@/styles/typography'
import type { NodeType } from '@/canvas/domain/nodes'
import { NodeShapeIndicator } from '@/canvas/nodes/NodeShapeIndicator'
import { KNOWN_ENTITY_KINDS, ENTITY_COLOUR } from './constants'

interface EntityTargetProps {
  targetKind?: string
  /** Human label for the entity (user-facing). Only rendered when `showLabel`. */
  label?: string
  /** Show the label text beside the shape. Default false (shape-only, e.g. in row headers). */
  showLabel?: boolean
  className?: string
}

function isKnownKind(kind?: string): kind is NodeType {
  return kind != null && (KNOWN_ENTITY_KINDS as readonly string[]).includes(kind)
}

export function EntityTarget({ targetKind, label, showLabel = false, className = '' }: EntityTargetProps) {
  const known = isKnownKind(targetKind)
  const labelColour = (targetKind && ENTITY_COLOUR[targetKind]) || 'text-text-body'

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {known ? (
        <NodeShapeIndicator nodeKind={targetKind} size={12} />
      ) : (
        // Neutral marker for unknown/absent kind — a hollow dot (no entity
        // fill, no technical string). Outlined, consistent with the DS ethos.
        <span
          className="inline-block h-2.5 w-2.5 rounded-full border border-text-light/50 bg-transparent"
          aria-hidden="true"
        />
      )}
      {showLabel && label && (
        <span className={`${typography.panelMeta} ${labelColour}`}>{label}</span>
      )}
    </span>
  )
}

export default EntityTarget
