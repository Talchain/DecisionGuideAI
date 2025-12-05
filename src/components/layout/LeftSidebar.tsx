import {
  Sparkles,
  Plus,
  PanelsTopLeft,
  Play,
  BarChart3,
  Layers,
  Maximize2,
  HelpCircle,
  Undo2,
  Redo2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  Download,
  Type,
  Binary,
} from 'lucide-react'
import Tooltip from '../Tooltip'
import styles from './LeftSidebar.module.css'
import { useEdgeLabelMode } from '../../canvas/store/edgeLabelMode'

interface LeftSidebarProps {
  onAiClick?: () => void
  onAddNodeClick?: () => void
  onTemplatesClick?: () => void
  onRunClick?: () => void
  onCompareClick?: () => void
  onEvidenceClick?: () => void
  onFitClick?: () => void
  onHelpClick?: () => void
  // Canvas control actions (new)
  onUndoClick?: () => void
  onRedoClick?: () => void
  onResetClick?: () => void
  onZoomInClick?: () => void
  onZoomOutClick?: () => void
  onAutoArrangeClick?: () => void
  onExportClick?: () => void
  // Disabled states
  canUndo?: boolean
  canRedo?: boolean
  /** Optional left offset, e.g. `calc(var(--dock-left-offset, 0rem) + 8px)` */
  leftOffset?: string
}

export function LeftSidebar({
  onAiClick,
  onAddNodeClick,
  onTemplatesClick,
  onRunClick,
  onCompareClick,
  onEvidenceClick,
  onFitClick,
  onHelpClick,
  // Canvas controls (new)
  onUndoClick,
  onRedoClick,
  onResetClick,
  onZoomInClick,
  onZoomOutClick,
  onAutoArrangeClick,
  onExportClick,
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
      {/* AI & Creation Group */}
      <div className={styles.group}>
        <Tooltip content="Quick Draft AI assistant (describe your decision)">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Open Quick Draft assistant"
            onClick={onAiClick}
          >
            <Sparkles className={styles.icon} aria-hidden="true" />
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

      {/* Canvas Controls Group (New) */}
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

      {/* Run & Analysis Group */}
      <div className={styles.group}>
        <Tooltip content="Run analysis (⌘⏎)">
          <button
            type="button"
            className={styles.iconButtonPrimary}
            aria-label="Run analysis"
            onClick={onRunClick}
          >
            <Play className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

        <Tooltip content="Compare runs">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Open compare view"
            onClick={onCompareClick}
          >
            <BarChart3 className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

        <Tooltip content="Evidence & provenance">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Open evidence panel"
            onClick={onEvidenceClick}
          >
            <Layers className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

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

        <Tooltip content="Export / Download">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Export canvas"
            onClick={onExportClick}
          >
            <Download className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      {/* Help Group */}
      <div className={styles.group}>
        <Tooltip content="Keyboard shortcuts & help">
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Open help and keyboard shortcuts"
            onClick={onHelpClick}
          >
            <HelpCircle className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </nav>
  )
}
