/**
 * KebabMenu — restructured "More" dropdown menu for the top bar.
 *
 * Groups: Decision (Rename, Export, Import, Snapshots, Reset canvas) |
 * View (Fullscreen) | Help (Keyboard shortcuts, How influence works) |
 * Canvas settings (flattened toggles).
 *
 * Lane 4 (P5): Export routes to the REAL ImportExportDialog (it was a
 * console.warn stub — a visible control that did nothing). Import ships
 * alongside it so the export dialog's own "editable and re-importable"
 * claim stays true, and Snapshots reconnects SnapshotManager (previously
 * only reachable from the production-unmounted CanvasToolbar). "Replay
 * tour" was REMOVED: it dispatched into an overlay gated on a flag that is
 * off in every deploy context, and the tour content itself describes
 * surfaces that do not exist in the deployed UI.
 *
 * Requires ToastProvider in an ancestor (the dialogs use useToast).
 */

import { useState, useCallback } from 'react'
import {
  MoreVertical,
  Sparkles,
  Pencil,
  Download,
  Upload,
  Camera,
  RotateCcw,
  Maximize,
  Keyboard,
  HelpCircle,
} from 'lucide-react'
import Tooltip from '../Tooltip'
import { ConfirmDialog } from '../../canvas/components/ConfirmDialog'
import { ImportExportDialog } from '../../canvas/components/ImportExportDialog'
import { SnapshotManager } from '../../canvas/components/SnapshotManager'
import { useSettingsStore } from '../../canvas/settingsStore'
import { useCanvasStore } from '../../canvas/store'
import styles from './TopBar.module.css'

/**
 * The complete sentence this menu is allowed to make about its own origin.
 *
 * WHO, and HOW TO TAKE IT BACK — never WHY. There is no reachable reason at
 * this tip: `ui_directive.note` is the only free-text carrier on the 0.39.0
 * wire and nothing in src/ reads it, so any rationale rendered here would be
 * invented. A fabricated "why" on the provenance channel is worse than no
 * badge at all, because this is the one channel whose entire purpose is
 * truthfulness. If a reason ever becomes available, it arrives as a new
 * field and this constant grows a parameter — it does not get guessed.
 *
 * The dismissal hint is a VERIFIED fact, not reassurance: TopBar's Escape
 * handler runs `closeMenu()` unconditionally on origin, so Escape genuinely
 * takes the surface back from the assistant.
 */
export const OVERLAY_ATTRIBUTION_TEXT = 'Opened by Olumi'
export const OVERLAY_DISMISS_HINT = 'Esc to dismiss'

interface KebabMenuProps {
  isOpen: boolean
  /**
   * Who raised THIS menu — `'assistant'` only when the AI put it on screen.
   * Null whenever the menu is the user's own (or not raised at all), so the
   * attribution cannot outlive the fact it describes.
   */
  raisedBy?: 'user' | 'assistant' | null
  onToggle: () => void
  onClose: () => void
  onStartRename: () => void
  onShowKeyboardLegend: () => void
  onShowInfluenceExplainer: () => void
  menuRef: React.RefObject<HTMLDivElement | null>
}

export function KebabMenu({
  isOpen,
  raisedBy = null,
  onToggle,
  onClose,
  onStartRename,
  onShowKeyboardLegend,
  onShowInfluenceExplainer,
  menuRef,
}: KebabMenuProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [activeDialog, setActiveDialog] = useState<
    'export' | 'import' | 'snapshots' | null
  >(null)

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
    setActiveDialog('export')
    onClose()
  }, [onClose])

  const handleImport = useCallback(() => {
    setActiveDialog('import')
    onClose()
  }, [onClose])

  const handleSnapshots = useCallback(() => {
    setActiveDialog('snapshots')
    onClose()
  }, [onClose])

  const closeDialog = useCallback(() => setActiveDialog(null), [])

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
          <div
            className={styles.dropdownMenu}
            role="menu"
            // The visible badge below is a plain <div>: inside `role="menu"`
            // only menuitems are reliably announced, so a screen-reader user —
            // the person MOST disoriented by a menu that appears unprompted —
            // would get nothing. The menu's accessible NAME carries it instead,
            // and is left undefined (falling back to the trigger) when the user
            // opened the menu themselves, so nothing is announced that is not
            // true.
            aria-label={
              raisedBy === 'assistant'
                ? `More options — ${OVERLAY_ATTRIBUTION_TEXT}`
                : undefined
            }
          >
            {/* PROVENANCE, not decoration. A surface the assistant raised must
                say so, inside the surface itself — the answer sits where the
                question ("why did this open?") is asked, rather than somewhere
                the user has to hunt for it. Deliberately non-interactive, no
                animation, no focus steal, no colour alarm: a user who did not
                notice the menu open should not be startled by the explanation
                of it. */}
            {raisedBy === 'assistant' && (
              <div className={styles.overlayOriginRow} data-testid="overlay-origin-badge">
                <span className={styles.overlayOriginBadge} data-testid="overlay-origin-label">
                  <Sparkles size={11} aria-hidden="true" />
                  {OVERLAY_ATTRIBUTION_TEXT}
                </span>
                <span
                  className={styles.overlayOriginHint}
                  data-testid="overlay-origin-dismiss-hint"
                >
                  {OVERLAY_DISMISS_HINT}
                </span>
              </div>
            )}

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
              data-testid="kebab-export"
            >
              <Download size={14} aria-hidden="true" />
              <span>Export</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.dropdownMenuButton}
              onClick={handleImport}
              data-testid="kebab-import"
            >
              <Upload size={14} aria-hidden="true" />
              <span>Import</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.dropdownMenuButton}
              onClick={handleSnapshots}
              data-testid="kebab-snapshots"
            >
              <Camera size={14} aria-hidden="true" />
              <span>Snapshots</span>
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

      {/* Lane 4 (P5): the real capability dialogs, portal-rendered by
          BottomSheet. Each renders null while closed. */}
      <ImportExportDialog
        isOpen={activeDialog === 'export'}
        onClose={closeDialog}
        mode="export"
      />
      <ImportExportDialog
        isOpen={activeDialog === 'import'}
        onClose={closeDialog}
        mode="import"
      />
      <SnapshotManager
        isOpen={activeDialog === 'snapshots'}
        onClose={closeDialog}
      />
    </>
  )
}
