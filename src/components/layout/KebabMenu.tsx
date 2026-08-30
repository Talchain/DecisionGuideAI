/**
 * KebabMenu — restructured "More" dropdown menu for the top bar.
 *
 * Groups: Model (Rename, Export, Import, Snapshots, Start new model) |
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
  Pencil,
  Download,
  Upload,
  Camera,
  FilePlus,
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

interface KebabMenuProps {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onStartRename: () => void
  onShowKeyboardLegend: () => void
  onShowInfluenceExplainer: () => void
  menuRef: React.RefObject<HTMLDivElement | null>
}

export function KebabMenu({
  isOpen,
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

  const handleStartNewModel = useCallback(() => {
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
            {/* Model group (Paul, 14 Aug 2026: "decision" -> "model") */}
            <div className={styles.dropdownMenuLabel}>Model</div>
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
            {/* NAMED BY INTENT, NOT BY MECHANISM (30 Aug 2026).
                This item was named for the mechanism — a destructive wipe — in
                the vocabulary of the implementation rather than the user's. It
                is the product's ONLY route to a blank canvas: `CanvasToolbar`
                is production-unmounted and `ReactFlowGraph`'s copy of the sheet
                sits behind a `showResetConfirm` never set true. So an
                unsupervised tester wanting to model their own decision had
                exactly this control and no reason to recognise it as the one.

                The danger hover went with the old name. The hazard is real, but
                stating it is the CONFIRMATION's job, and it does: a red route
                plus a red confirmation is a control people decline rather than
                one they use carefully. A rename that dropped the disclosure
                would be the worse trade, so both halves are pinned together in
                `KebabMenu.startNewModel.spec.tsx`. */}
            <button
              type="button"
              role="menuitem"
              className={styles.dropdownMenuButton}
              onClick={handleStartNewModel}
              data-testid="kebab-start-new-model"
            >
              <FilePlus size={14} aria-hidden="true" />
              <span>Start new model</span>
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

      {/* Start-new-model confirmation dialog.

          ⚠ THE MESSAGE LISTED ONLY THE GRAPH. This is the UNGATED reset —
          CanvasToolbar disables its button on an empty canvas, this menu item
          does not — so it is the one most likely to be reached with a real
          conversation in play, and it was the one that named the fewest
          consequences. The other two sheets already list the conversation; this
          now matches them.

          ⚠⚠ IT THEN PROMISED A RECOVERY THAT DOES NOT EXIST, and this is the
          most destructive control in the top bar. The message used to end
          "Undo (Ctrl+Z / Cmd+Z) can bring the graph back. The conversation
          cannot be recovered." — a contrast that inverted the truth for the
          half a user is most likely to act on. Every route it implied is shut:

            · ⌘Z / Ctrl+Z are dead on the canvas. `useKeyboardShortcuts` gates
              the undo and redo branches on `hasServerGraphAuthority(
              CANONICAL_EDIT_AUTHORITY.canvasSemanticMutations)`, and that
              authority is `'disabled'`.
            · `resetCanvas` pushes an UNLABELLED history entry, so the history
              toast never announces it either — that toast fires only on a label.
            · `resetCanvas` calls `scenarios.clearAutosave()`, destroying the
              localStorage copy the canvas would otherwise reload from.

          So the graph cannot be brought back by any route the product offers.
          Do not restore a recovery promise here unless one exists. */}
      {showResetConfirm && (
        <ConfirmDialog
          title="Start a new model?"
          message="This clears the current model: every node and connection, any analysis results, and the AI assistant conversation. It cannot be undone — to keep a copy, cancel and choose Export first."
          confirmLabel="Start new model"
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
