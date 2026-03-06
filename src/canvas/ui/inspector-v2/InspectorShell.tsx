/**
 * InspectorShell — 340px panel shell for all inspector panels
 * DS v4: bg-panel, rounded-xl, shadow-1, border-panel-border
 * 3px coloured top bar, header with shape/label/pill/badge/tech toggle/close
 */

import { memo, useCallback, type KeyboardEvent } from 'react'
import { X, Code2 } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { NodeShapeIndicator } from '../../nodes/NodeShapeIndicator'
import type { InspectorShellProps } from './types'
import { EditableLabel } from './shared/EditableLabel'

export const InspectorShell = memo(function InspectorShell({
  topBarColor,
  nodeKind,
  label,
  onLabelChange,
  typePill,
  typePillColor,
  confidenceBadge,
  techMode,
  onTechToggleChange,
  onClose,
  children,
}: InspectorShellProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [onClose])

  return (
    <div
      className="w-[340px] bg-panel rounded-xl border border-panel-border shadow-1 overflow-hidden font-sans"
      role="region"
      aria-label="Inspector panel"
      onKeyDown={handleKeyDown}
    >
      {/* 3px coloured top bar */}
      <div className="h-[3px]" style={{ background: topBarColor }} />

      {/* Header */}
      <div className="px-4 pt-3.5 pb-3 border-b border-panel-border">
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {nodeKind && <NodeShapeIndicator nodeKind={nodeKind} size={22} />}
            <div className="flex-1 min-w-0">
              <EditableLabel
                value={label}
                onSave={onLabelChange}
                maxLength={500}
                className={`${typography.panelHeader} text-text-header`}
              />
              <div className="flex gap-1.5 mt-1 items-center flex-wrap">
                {/* Type pill — outlined only per DS v4 §8.5 */}
                <span
                  className={`${typography.panelMeta} font-medium inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-transparent text-text-body`}
                  style={{ border: `1px solid ${typePillColor ?? 'var(--color-factor)'}4D` }}
                >
                  {typePill}
                </span>
                {confidenceBadge}
              </div>
            </div>
          </div>

          {/* Tech toggle + Close */}
          <div className="flex gap-1 items-center flex-shrink-0">
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

      {/* Scrollable body */}
      <div className="px-4 pb-4 max-h-[520px] overflow-y-auto">
        {children}
      </div>
    </div>
  )
})
