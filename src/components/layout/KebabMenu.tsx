/**
 * KebabMenu — restructured "More" dropdown menu for the top bar.
 *
 * Groups: Decision (Rename, Export, Reset canvas) | View (Fullscreen) |
 * Help (Replay tour, Keyboard shortcuts, How influence works) |
 * Canvas settings (flattened toggles).
 */

import { useState, useCallback } from 'react'
import {
  MoreVertical,
  Pencil,
  Download,
  RotateCcw,
  Maximize,
  BookOpen,
  Keyboard,
  HelpCircle,
} from 'lucide-react'
import Tooltip from '../Tooltip'
import { ConfirmDialog } from '../../canvas/components/ConfirmDialog'
import { useSettingsStore } from '../../canvas/settingsStore'
import { useCanvasStore } from '../../canvas/store'
import styles from './TopBar.module.css'

interface KebabMenuProps {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onStartRename: () => void
  onShowOnboarding: () => void
  onShowKeyboardLegend: () => void
  onShowInfluenceExplainer: () => void
  menuRef: React.RefObject<HTMLDivElement | null>
}

export function KebabMenu({
  isOpen,
  onToggle,
  onClose,
  onStartRename,
  onShowOnboarding,
  onShowKeyboardLegend,
  onShowInfluenceExplainer,
  menuRef,
}: KebabMenuProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const resetCanvas = useCanvasStore(s => s.resetCanvas)

  const {
    showGrid,
    gridSize,
    snapToGrid,
    showAlignmentGuides,
    highContrastMode,
    setShowGrid,
    setGridSize,
    setSnapToGrid,
    setShowAlignmentGuides,
    setHighContrastMode,
  } = useSettingsStore()

  const handleExport = useCallback(() => {
    console.warn('Export')
    onClose()
  }, [onClose])

  const handleResetCanvas = useCallback(() => {
    setShowResetConfirm(true)
    onClose()
  }, [onClose])

  const handleConfirmReset = useCallback(() => {
    resetCanvas()
    setShowResetConfirm(false)
  }, [resetCanvas])

  const handleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
    onClose()
  }, [onClose])

  return (
    <>
      <div className={styles.menuDropdown} ref={menuRef}>
        <Tooltip content="More options">
          <button
            type="button"
            onClick={onToggle}
            className={styles.menuButton}
            aria-label="More options"
            aria-expanded={isOpen}
            aria-haspopup="true"
          >
            <MoreVertical size={14} aria-hidden="true" />
          </button>
        </Tooltip>

        {isOpen && (
          <div className={styles.dropdownMenu} role="menu">
            {/* Decision group */}
            <div className={styles.dropdownMenuLabel}>Decision</div>
            <button
              type="button"
              role="menuitem"
              className={styles.dropdownMenuButton}
              onClick={onStartRename}
            >
              <Pencil size={14} aria-hidden="true" />
              <span>Rename</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.dropdownMenuButton}
              onClick={handleExport}
            >
              <Download size={14} aria-hidden="true" />
              <span>Export</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={`${styles.dropdownMenuButton} hover:text-danger`}
              onClick={handleResetCanvas}
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>Reset canvas</span>
            </button>

            <hr className={styles.dropdownMenuDivider} />

            {/* View group */}
            <div className={styles.dropdownMenuLabel}>View</div>
            <button
              type="button"
              role="menuitem"
              className={styles.dropdownMenuButton}
              onClick={handleFullscreen}
            >
              <Maximize size={14} aria-hidden="true" />
              <span>Fullscreen</span>
            </button>

            <hr className={styles.dropdownMenuDivider} />

            {/* Help group */}
            <div className={styles.dropdownMenuLabel}>Help</div>
            <button
              type="button"
              role="menuitem"
              className={styles.dropdownMenuButton}
              onClick={onShowOnboarding}
            >
              <BookOpen size={14} aria-hidden="true" />
              <span>Replay tour</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.dropdownMenuButton}
              onClick={onShowKeyboardLegend}
            >
              <Keyboard size={14} aria-hidden="true" />
              <span>Keyboard shortcuts</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.dropdownMenuButton}
              onClick={onShowInfluenceExplainer}
            >
              <HelpCircle size={14} aria-hidden="true" />
              <span>How influence works</span>
            </button>

            <hr className={styles.dropdownMenuDivider} />

            {/* Canvas settings (flattened) */}
            <div className={styles.dropdownMenuLabel}>Canvas settings</div>

            <label htmlFor="kebab-show-grid" className={styles.settingsRow}>
              <span>Show grid</span>
              <input
                id="kebab-show-grid"
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                className={styles.settingsCheckbox}
              />
            </label>

            {showGrid && (
              <div className={styles.settingsSliderRow}>
                <label htmlFor="kebab-grid-size">Grid size: {gridSize}px</label>
                <input
                  id="kebab-grid-size"
                  type="range"
                  min="8"
                  max="24"
                  step="8"
                  value={gridSize}
                  onChange={(e) => setGridSize(Number(e.target.value) as 8 | 16 | 24)}
                  className={styles.settingsSlider}
                  aria-valuemin={8}
                  aria-valuemax={24}
                  aria-valuenow={gridSize}
                  aria-valuetext={`${gridSize} pixels`}
                />
                <div className={styles.settingsSliderLabels} aria-hidden="true">
                  <span>8px</span>
                  <span>16px</span>
                  <span>24px</span>
                </div>
              </div>
            )}

            <label htmlFor="kebab-snap-to-grid" className={styles.settingsRow}>
              <span>Snap to grid</span>
              <input
                id="kebab-snap-to-grid"
                type="checkbox"
                checked={snapToGrid}
                onChange={(e) => setSnapToGrid(e.target.checked)}
                className={styles.settingsCheckbox}
              />
            </label>

            <label htmlFor="kebab-alignment-guides" className={styles.settingsRow}>
              <span>Alignment guides</span>
              <input
                id="kebab-alignment-guides"
                type="checkbox"
                checked={showAlignmentGuides}
                onChange={(e) => setShowAlignmentGuides(e.target.checked)}
                className={styles.settingsCheckbox}
              />
            </label>

            <label htmlFor="kebab-high-contrast" className={styles.settingsRow}>
              <span>High contrast mode</span>
              <input
                id="kebab-high-contrast"
                type="checkbox"
                checked={highContrastMode}
                onChange={(e) => setHighContrastMode(e.target.checked)}
                className={styles.settingsCheckbox}
              />
            </label>
          </div>
        )}
      </div>

      {/* Reset canvas confirmation dialog */}
      {showResetConfirm && (
        <ConfirmDialog
          title="Reset canvas?"
          message="This will remove all nodes and edges. This cannot be undone."
          confirmLabel="Reset"
          cancelLabel="Cancel"
          onConfirm={handleConfirmReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </>
  )
}
