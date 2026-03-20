/**
 * ArtefactHeader -- Header bar for AI-generated artefact blocks.
 *
 * Shows an icon (mapped by artefact_type), title, optional description,
 * and an expand button. Keyboard accessible (Enter/Space on expand).
 */

import { memo, useCallback } from 'react'
import {
  Grid3x3,
  Columns3,
  BarChart3,
  Target,
  FileText,
  Sparkles,
  Maximize2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import type { ArtefactBlock } from '../../canvas/conversation/types'
import styles from './Artefact.module.css'

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  decision_matrix: Grid3x3,
  comparison: Columns3,
  chart: BarChart3,
  exercise: Target,
  brief_section: FileText,
}

function getIcon(artefactType: string) {
  return ICON_MAP[artefactType] ?? Sparkles
}

interface ArtefactHeaderProps {
  block: ArtefactBlock
  collapsed: boolean
  onToggleCollapse: () => void
  onMaximise: () => void
  expandBtnRef?: React.Ref<HTMLButtonElement>
}

export const ArtefactHeader = memo(function ArtefactHeader({
  block,
  collapsed,
  onToggleCollapse,
  onMaximise,
  expandBtnRef,
}: ArtefactHeaderProps) {
  const Icon = getIcon(block.artefact_type)
  const CollapseIcon = collapsed ? ChevronRight : ChevronDown

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onToggleCollapse()
      }
    },
    [onToggleCollapse],
  )

  const handleExpandKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onMaximise()
      }
    },
    [onMaximise],
  )

  return (
    <div
      className={styles.header}
      role="button"
      tabIndex={0}
      aria-expanded={!collapsed}
      onClick={onToggleCollapse}
      onKeyDown={handleKeyDown}
      data-testid="artefact-header"
    >
      <div className={styles.headerLeft}>
        <CollapseIcon size={14} className={styles.headerCollapseIcon} />
        <Icon size={16} className={styles.headerIcon} />
        <span className={styles.headerTitle}>{block.title}</span>
        {block.description && (
          <span className={styles.headerDescription}>{block.description}</span>
        )}
      </div>
      <button
        ref={expandBtnRef}
        type="button"
        className={styles.headerExpandBtn}
        onClick={(e) => {
          e.stopPropagation()
          onMaximise()
        }}
        onKeyDown={handleExpandKeyDown}
        aria-label="Expand artefact"
        data-testid="artefact-expand-btn"
      >
        <Maximize2 size={14} />
      </button>
    </div>
  )
})
