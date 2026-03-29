import {
  Plus,
  PanelsTopLeft,
  Maximize2,
  Undo2,
  Redo2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  Type,
  Binary,
  MousePointer2,
  Hand,
} from 'lucide-react'
import Tooltip from '../Tooltip'
import styles from './LeftSidebar.module.css'
import { useEdgeLabelMode } from '../../canvas/store/edgeLabelMode'

interface LeftSidebarProps {
  // Interaction mode (select vs hand/pan)
  interactionMode?: 'select' | 'hand'
  onModeChange?: (mode: 'select' | 'hand') => void
  // Node/canvas actions
  onAddNodeClick?: () => void
  onTemplatesClick?: () => void
  onFitClick?: () => void
  // Canvas control actions
  onUndoClick?: () => void
  onRedoClick?: () => void
  onResetClick?: () => void
  onZoomInClick?: () => void
  onZoomOutClick?: () => void
  onAutoArrangeClick?: () => void
  // Disabled states
  canUndo?: boolean
  canRedo?: boolean
  /** Optional left offset, e.g. `calc(var(--dock-left-offset, 0rem) + 8px)` */
  leftOffset?: string
}

export function LeftSidebar({
  interactionMode = 'select',
  onModeChange,
  onAddNodeClick,
  onTemplatesClick,
  onFitClick,
  // Canvas controls
  onUndoClick,
  onRedoClick,
  onResetClick,
  onZoomInClick,
  onZoomOutClick,
  onAutoArrangeClick,
  canUndo = true,
  canRedo = true,
  leftOffset,
}: LeftSidebarProps) {
  // Edge label mode toggle
  const edgeLabelMode = useEdgeLabelMode(state => state.mode)
  const setEdgeLabelMode = useEdgeLabelMode(state => state.setMode)
  const isNumericMode = edgeLabelMode === 'numeric'

  const handleEdgeLabelToggle = () => {
    setEdgeLabelMode(isNumericMode ? 'human' : 'numeric')
  }

  return (
    <nav
      className={styles.sidebar}
      aria-label="Canvas tools"
      style={leftOffset ? { left: leftOffset } : undefined}
    >
      {/* Mode Toggle & Creation Group */}
      <div className={styles.group}>
        <Tooltip content={interactionMode === 'select' ? 'Switch to Hand mode (H)' : 'Switch to Select mode (V)'}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={interactionMode === 'select' ? 'Currently in Select mode, click for Hand mode' : 'Currently in Hand mode, click for Select mode'}
            onClick={() => onModeChange?.(interactionMode === 'select' ? 'hand' : 'select')}
          >
            {interactionMode === 'select' ? (
              <MousePointer2 className={styles.icon} aria-hidden="true" />
            ) : (
              <Hand className={styles.icon} aria-hidden="true" />
            )}
          </button>
        </Tooltip>

        <Tooltip content="Add node to canvas">
          <button
            type="button"
            className={styles.iconButtonPrimary}
            aria-label="Add node to canvas"
            onClick={onAddNodeClick}
          >
            <Plus className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

        <Tooltip content="Browse templates (T)">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Open templates panel"
            onClick={onTemplatesClick}
          >
            <PanelsTopLeft className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      {/* Canvas Controls Group */}
      <div className={styles.group}>
        <Tooltip content="Undo (⌘Z)">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Undo"
            onClick={onUndoClick}
            disabled={!canUndo}
          >
            <Undo2 className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

        <Tooltip content="Redo (⌘⇧Z)">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Redo"
            onClick={onRedoClick}
            disabled={!canRedo}
          >
            <Redo2 className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

        <Tooltip content="Reset canvas">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Reset canvas"
            onClick={onResetClick}
          >
            <RotateCcw className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

        <Tooltip content="Auto-arrange layout">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Auto-arrange layout"
            onClick={onAutoArrangeClick}
          >
            <LayoutGrid className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      {/* Display Group */}
      <div className={styles.group}>
        <Tooltip content={isNumericMode ? 'Switch to human-readable labels' : 'Switch to numeric labels'}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={`Edge labels: ${isNumericMode ? 'Numeric' : 'Human-readable'}. Click to toggle.`}
            onClick={handleEdgeLabelToggle}
          >
            {isNumericMode ? (
              <Binary className={styles.icon} aria-hidden="true" />
            ) : (
              <Type className={styles.icon} aria-hidden="true" />
            )}
          </button>
        </Tooltip>
      </div>

      {/* View Controls Group */}
      <div className={styles.group}>
        <Tooltip content="Zoom in (⌘+)">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Zoom in"
            onClick={onZoomInClick}
          >
            <ZoomIn className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

        <Tooltip content="Zoom out (⌘-)">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Zoom out"
            onClick={onZoomOutClick}
          >
            <ZoomOut className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

        <Tooltip content="Fit view to all nodes (⌘0)">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Fit all nodes in view"
            onClick={onFitClick}
          >
            <Maximize2 className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </nav>
  )
}
