/**
 * InspectorShell — 340px panel shell for all inspector panels
 * DS v4: bg-panel, rounded-xl, shadow-1, border-panel-border
 * Header: type label with shape icon at top, then element name below.
 * Header is the drag surface when dragHandlers are provided.
 */

import { memo, useState, useCallback, type KeyboardEvent } from 'react'
import { X, Code2, Spline, HelpCircle, ArrowLeft } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { NodeShapeIndicator } from '../../nodes/NodeShapeIndicator'
import { useCanvasStore } from '../../store'
import { isAiPanelV2Enabled } from '../../../flags'
import type { InspectorShellProps } from './types'
import { EditableLabel } from './shared/EditableLabel'

export const InspectorShell = memo(function InspectorShell({
  topBarColor,
  nodeKind,
  nodeId,
  label,
  onLabelChange,
  typePill,
  typePillColor,
  confidenceBadge,
  confidenceLevel,
  techMode,
  onTechToggleChange,
  onClose,
  dragHandlers,
  children,
}: InspectorShellProps) {
  const rationale = useCanvasStore((s) => nodeId ? s.nodeRationales?.[nodeId] : undefined)
  const [showRationale, setShowRationale] = useState(false)

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [onClose])

  const isDragging = dragHandlers?.isDragging ?? false
  const entityColor = typePillColor ?? topBarColor ?? 'var(--factor)'

  // Confidence-coded border colour (30% opacity) — falls back to panel-border
  const borderColorMap = {
    high: 'rgba(103,200,158,0.30)',   // success at 30%
    medium: 'rgba(255,166,86,0.30)',  // warning at 30%
    low: 'rgba(234,123,75,0.30)',     // danger at 30%
  } as const
  const shellBorder = confidenceLevel
    ? `1px solid ${borderColorMap[confidenceLevel]}`
    : undefined

  return (
    <div
      className={`w-[340px] bg-panel rounded-xl shadow-1 overflow-hidden font-sans ${!confidenceLevel ? 'border border-panel-border' : ''}`}
      style={shellBorder ? { border: shellBorder } : undefined}
      role="region"
      aria-label="Inspector panel"
      onKeyDown={handleKeyDown}
    >
      {/* Header — draggable when dragHandlers provided */}
      <div
        className={`px-4 pt-3.5 pb-3 border-b border-panel-border select-none ${
          dragHandlers ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        {...(dragHandlers ? {
          onPointerDown: dragHandlers.onPointerDown,
          onPointerMove: dragHandlers.onPointerMove,
          onPointerUp: dragHandlers.onPointerUp,
          onPointerCancel: dragHandlers.onPointerCancel,
        } : {})}
      >
        {/* Type row: shape icon + type label — top of header */}
        <div className="flex items-center gap-1.5 mb-2">
          {nodeKind ? (
            <NodeShapeIndicator nodeKind={nodeKind} size={22} />
          ) : (
            <Spline size={22} style={{ color: entityColor }} aria-hidden="true" />
          )}
          <span
            className={`${typography.panelMeta} font-semibold`}
            style={{ color: entityColor }}
          >
            {typePill}
          </span>
        </div>

        <div className="flex items-start justify-between gap-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <EditableLabel
                value={label}
                onSave={onLabelChange}
                maxLength={500}
                className={`${typography.panelHeader} text-text-header`}
              />
              {rationale && (
                <button
                  onClick={() => setShowRationale(v => !v)}
                  title="Why this element was included"
                  aria-label="Why this element was included"
                  aria-expanded={showRationale}
                  className="p-0.5 rounded hover:bg-panel-hover transition-colors shrink-0"
                >
                  <HelpCircle size={16} className="text-text-light" />
                </button>
              )}
            </div>
            {showRationale && rationale && (
              <p className={`${typography.panelMeta} text-text-light mt-1`}>{rationale}</p>
            )}
            {confidenceBadge && (
              <div className="mt-1">
                {confidenceBadge}
              </div>
            )}
          </div>

          {/* Back to results (FF v2) + Tech toggle + Close. The "Back to
              results" affordance is the brief §8 link surfaced when the
              inspector replaces analysis content in the embedded top zone
              (correction #5). Strictly FF-gated so the legacy inspector
              chrome is unchanged when FF off. */}
          <div className="flex gap-1 items-center flex-shrink-0">
            {isAiPanelV2Enabled() && (
              <button
                onClick={onClose}
                title="Back to results"
                aria-label="Back to results"
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-info hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info ${typography.panelMeta}`}
                data-testid="inspector-back-to-results"
              >
                <ArrowLeft size={12} aria-hidden="true" />
                <span>Back to results</span>
              </button>
            )}
            <button
              onClick={() => onTechToggleChange(!techMode)}
              title={techMode ? 'Hide technical detail' : 'Show technical detail'}
              aria-label={techMode ? 'Hide technical detail' : 'Show technical detail'}
              className="p-1 rounded hover:bg-panel-hover transition-colors"
            >
              <Code2
                size={14}
                className={techMode ? 'text-info' : 'text-text-light'}
              />
            </button>
            <button
              onClick={onClose}
              aria-label="Close inspector"
              title="Close inspector"
              className="p-1 rounded hover:bg-panel-hover transition-colors"
            >
              <X size={16} className="text-text-light" />
            </button>
          </div>
        </div>
      </div>

      {/* Body — scrollable when content exceeds panel max height */}
      <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: 560 }}>
        {children}
      </div>
    </div>
  )
})
