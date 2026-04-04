import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Eye,
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

/** Custom event: request all open menus to close (except the source). */
export const MENU_EXCLUSIVE_EVENT = 'menu:exclusive'

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

  // Standard/Detailed view toggle
  const viewMode = useCanvasStore(s => s.viewMode)
  const setViewMode = useCanvasStore(s => s.setViewMode)

  const lensEnabled = isGraphLensEnabled()

  // Toggle lens + dispatch mutual exclusion event (used by both click and L key)
  const handleLensToggle = useCallback(() => {
    setLensOpen(prev => {
      const next = !prev
      if (next) {
        window.dispatchEvent(new CustomEvent(MENU_EXCLUSIVE_EVENT, { detail: { source: 'lens' } }))
      }
      return next
    })
  }, [])

  // Listen for L key toggle event from useCanvasKeyboardShortcuts
  useEffect(() => {
    window.addEventListener(LENS_TOGGLE_EVENT, handleLensToggle)
    return () => window.removeEventListener(LENS_TOGGLE_EVENT, handleLensToggle)
  }, [handleLensToggle])

  // Close lens dropdown when comparison mode hides the chip
  const comparisonActive = useCanvasStore(s => s.comparisonMode.active)
  useEffect(() => {
    if (comparisonActive) setLensOpen(false)
  }, [comparisonActive])

  // Close lens dropdown when another menu claims exclusivity
  useEffect(() => {
    const handler = (e: Event) => {
      const source = (e as CustomEvent).detail?.source
      if (source !== 'lens') setLensOpen(false)
    }
    window.addEventListener(MENU_EXCLUSIVE_EVENT, handler)
    return () => window.removeEventListener(MENU_EXCLUSIVE_EVENT, handler)
  }, [])

  const isDetailed = viewMode === 'expert'

  return (
    <nav
      className={styles.sidebar}
      aria-label="Canvas tools"
    >
      {/* Manipulation group: Select, Undo, Redo */}
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

      {/* View group: Lens, Standard/Detailed */}
      <div className={styles.group}>
        {lensEnabled && (
          <Tooltip content="View (L)">
            <button
              ref={viewBtnRef}
              type="button"
              className={lensOpen ? styles.iconButtonActive : styles.iconButton}
              aria-label="Graph lens"
              aria-pressed={lensOpen}
              onClick={handleLensToggle}
            >
              <Layers className={styles.icon} aria-hidden="true" />
            </button>
          </Tooltip>
        )}

        <Tooltip content={isDetailed ? 'Detailed view' : 'Standard view'}>
          <button
            type="button"
            className={isDetailed ? styles.iconButtonActive : styles.iconButton}
            aria-label={isDetailed ? 'Detailed view' : 'Standard view'}
            aria-pressed={isDetailed}
            onClick={() => setViewMode(isDetailed ? 'standard' : 'expert')}
          >
            <Eye className={styles.icon} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      {/* Lens dropdown — portaled, anchored to View button */}
      {lensEnabled && (
        <LensDropdown
          isOpen={lensOpen}
          onClose={() => setLensOpen(false)}
          onToggle={handleLensToggle}
          anchorRef={viewBtnRef}
          hideChip
        />
      )}
    </nav>
  )
}
