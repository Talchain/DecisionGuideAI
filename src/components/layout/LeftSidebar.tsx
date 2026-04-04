import { useState, useEffect, useRef } from 'react'
import {
  Layers,
  Undo2,
  Redo2,
  MousePointer2,
} from 'lucide-react'
import Tooltip from '../Tooltip'
import styles from './LeftSidebar.module.css'
import { LensDropdown } from '../../canvas/components/LensDropdown'
import { LENS_TOGGLE_EVENT } from '../../canvas/hooks/useCanvasKeyboardShortcuts'
import { useCanvasStore } from '../../canvas/store'
import { isGraphLensEnabled } from '../../flags'

interface LeftSidebarProps {
  /** Current interaction mode (select vs hand/pan via keyboard) */
  interactionMode?: 'select' | 'hand'
  /** Called when user clicks select button to switch to select mode */
  onSelectClick?: () => void
  // Canvas control actions
  onUndoClick?: () => void
  onRedoClick?: () => void
  // Disabled states
  canUndo?: boolean
  canRedo?: boolean
}

export function LeftSidebar({
  interactionMode = 'select',
  onSelectClick,
  // Canvas controls
  onUndoClick,
  onRedoClick,
  canUndo = true,
  canRedo = true,
}: LeftSidebarProps) {
  const [lensOpen, setLensOpen] = useState(false)
  const viewBtnRef = useRef<HTMLButtonElement | null>(null)

  // Listen for L key toggle event from useCanvasKeyboardShortcuts
  useEffect(() => {
    const handler = () => setLensOpen(v => !v)
    window.addEventListener(LENS_TOGGLE_EVENT, handler)
    return () => window.removeEventListener(LENS_TOGGLE_EVENT, handler)
  }, [])

  // Close lens dropdown when comparison mode hides the chip
  const comparisonActive = useCanvasStore(s => s.comparisonMode.active)
  useEffect(() => {
    if (comparisonActive) setLensOpen(false)
  }, [comparisonActive])

  const lensEnabled = isGraphLensEnabled()

  return (
    <nav
      className={styles.sidebar}
      aria-label="Canvas tools"
    >
      {/* Build group */}
      <div className={styles.group}>
        <Tooltip content="Select mode (V)">
          <button
            type="button"
            className={interactionMode === 'select' ? styles.iconButtonActive : styles.iconButton}
            aria-label="Select mode"
            aria-pressed={interactionMode === 'select'}
            onClick={onSelectClick}
          >
            <MousePointer2 className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>

        {lensEnabled && (
          <Tooltip content="View (L)">
            <button
              ref={viewBtnRef}
              type="button"
              className={lensOpen ? styles.iconButtonActive : styles.iconButton}
              aria-label="Graph lens"
              aria-pressed={lensOpen}
              onClick={() => setLensOpen(v => !v)}
            >
              <Layers className={styles.icon} aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </div>

      {/* History group */}
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
      </div>

      {/* Lens dropdown — portaled, anchored to View button */}
      {lensEnabled && (
        <LensDropdown
          isOpen={lensOpen}
          onClose={() => setLensOpen(false)}
          onToggle={() => setLensOpen(v => !v)}
          anchorRef={viewBtnRef}
          hideChip
        />
      )}
    </nav>
  )
}
