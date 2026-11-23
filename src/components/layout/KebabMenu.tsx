/**
 * KebabMenu — restructured "More" dropdown menu for the top bar.
 *
 * Groups: Model (Rename, Export, Import, Snapshots, Start new scenario) |
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

import { HoverButton } from '../../olumiView/look/Hover'
import { TOOLBAR_ICON } from '../../olumiView/look/toolbar'
import { useState, useCallback } from 'react'
import { OkIcon } from '../../olumiView/look/icons'
import Tooltip from '../Tooltip'
import { ConfirmDialog } from '../../canvas/components/ConfirmDialog'
import { ImportExportDialog } from '../../canvas/components/ImportExportDialog'
import { SnapshotManager } from '../../canvas/components/SnapshotManager'
import { useSettingsStore } from '../../canvas/settingsStore'
import { useCanvasStore } from '../../canvas/store'
import styles from './TopBar.module.css'
import { typography } from '../../styles/typography'
import { coreLaneAllows, lanePreviousControl, isOlumiCoreLane } from '../../olumiCore/lane'
import { useViewStore } from '../../olumiView/store'
import { ScenarioTitleDialog } from '../../olumiView/ScenarioTitleDialog'

interface KebabMenuProps {
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onStartRename: () => void
  onShowKeyboardLegend: () => void
  onShowInfluenceExplainer: () => void
  menuRef: React.RefObject<HTMLDivElement | null>
}

const menuLabel = `${typography.viewPanelHeading} text-text-light`
const menuRow = 'flex w-full cursor-pointer items-center gap-1.5 rounded-md py-2.5 text-left text-text-body transition-colors hover:bg-panel-hover focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-info'
const settingsRow = 'flex cursor-pointer items-center justify-between rounded-md py-2.5 text-text-body hover:text-text-header'

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

  // THE OLUMI-CORE LANE (Paul, 16 Nov: the menu keeps every item that has a working path). Each item below is offered on the lane only
  // where core has a route or the setting is the page's own:
  //   Rename              core's own-title route (ScenarioTitleDialog); needs a scenario read from core.
  //   Export, Version history: not here. The bar draws the Summary (whose page downloads the Markdown) and the Version history control, so a row
  //                       here said each a second time (S4 pop-up lane, 20 Nov).
  //   Start new scenario  a blank brief (the old scenario stays in core and in My scenarios, so nothing is lost and nothing is confirmed).
  //   Import              no core route: not offered. Canvas settings: the lane's canvas (ViewCanvas) does not read them: not offered.
  const lane = isOlumiCoreLane()
  const coreSid = useViewStore((s) => s.sid)
  const [showTitle, setShowTitle] = useState(false)

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

  const handleLaneRename = useCallback(() => {
    setShowTitle(true)
    onClose()
  }, [onClose])

  const handleLaneStartNew = useCallback(() => {
    onClose()
    // The one "start fresh" is My scenarios' own; loaded on the press, so the bar does not carry that page (and its imports).
    void import('../../olumiCore/accounts/MyScenariosPage').then((m) => {
      m.startFreshScenario()
      // A HashRouter: the address names the scenario shown, so it moves to the blank brief with it (as TopBar's links do).
      window.location.hash = '#/canvas'
    })
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
        {lane ? (
          <HoverButton type="button" words="More options" onClick={onToggle} className={TOOLBAR_ICON}
            aria-label="More options" aria-expanded={isOpen} aria-haspopup="true">
            <OkIcon id="more" size={14} decorative inherit />
          </HoverButton>
        ) : (
          <Tooltip content="More options">
            <button
              type="button"
              onClick={onToggle}
              className={styles.menuButton}
              aria-label="More options"
              aria-expanded={isOpen}
              aria-haspopup="true"
            >
              <OkIcon id="more" decorative inherit />
            </button>
          </Tooltip>
        )}

        {isOpen && (
          <div className={`${typography.viewPanelMeta} absolute right-0 top-full z-50 mt-2 w-56 space-y-4 rounded-lg border border-panel-border bg-panel p-3 shadow-2`} role="menu">
            <div className="space-y-2">
              {/* Model group (Paul, 14 Aug 2026: "decision" -> "model") */}
              <div className={menuLabel}>Model</div>
              <div className="divide-y divide-panel-border">
                {coreLaneAllows('structure') && (
                  <button
                    type="button"
                    role="menuitem"
                    className={menuRow}
                    onClick={onStartRename}
                  >
                    <OkIcon id="edit" size={14} decorative inherit className="text-text-light" />
                    <span>Rename</span>
                  </button>
                )}
                {lane && coreSid !== null && (
                  <button
                    type="button"
                    role="menuitem"
                    className={menuRow}
                    onClick={handleLaneRename}
                    data-testid="kebab-rename-core"
                  >
                    <OkIcon id="edit" size={14} decorative inherit className="text-text-light" />
                    <span>Rename</span>
                  </button>
                )}
                {lane && (
                  <button
                    type="button"
                    role="menuitem"
                    className={menuRow}
                    onClick={handleLaneStartNew}
                    data-testid="kebab-start-new-core"
                  >
                    <OkIcon id="new-scenario" size={14} decorative inherit className="text-text-light" />
                    <span>Start new scenario</span>
                  </button>
                )}
                {lanePreviousControl('file') && (
                  <button
                    type="button"
                    role="menuitem"
                    className={menuRow}
                    onClick={handleExport}
                    data-testid="kebab-export"
                  >
                    <OkIcon id="export" size={14} decorative inherit className="text-text-light" />
                    <span>Export</span>
                  </button>
                )}
                {/* Import and Snapshots replace the canvas here, which core never sees: on the olumi-core lane the model is changed in the
                    chat, as a proposal (review 00003 ledger). */}
                {coreLaneAllows('structure') && lanePreviousControl('file') && (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className={menuRow}
                      onClick={handleImport}
                      data-testid="kebab-import"
                    >
                      <OkIcon id="import" size={14} decorative inherit className="text-text-light" />
                      <span>Import</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className={menuRow}
                      onClick={handleSnapshots}
                      data-testid="kebab-snapshots"
                    >
                      <OkIcon id="snapshot" size={14} decorative inherit className="text-text-light" />
                      <span>Snapshots</span>
                    </button>
                  </>
                )}
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
                {lanePreviousControl('startNew') && (
                  <button
                    type="button"
                    role="menuitem"
                    className={menuRow}
                    onClick={handleStartNewModel}
                    data-testid="kebab-start-new-model"
                  >
                    <OkIcon id="new-scenario" size={14} decorative inherit className="text-text-light" />
                    <span>Start new scenario</span>
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {/* View group */}
              <div className={menuLabel}>View</div>
              <div className="divide-y divide-panel-border">
                <button
                  type="button"
                  role="menuitem"
                  className={menuRow}
                  onClick={handleFullscreen}
                >
                  <OkIcon id="zoom-fit" size={14} decorative inherit className="text-text-light" />
                  <span>Fullscreen</span>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {/* Help group */}
              <div className={menuLabel}>Help</div>
              <div className="divide-y divide-panel-border">
                <button
                  type="button"
                  role="menuitem"
                  className={menuRow}
                  onClick={onShowKeyboardLegend}
                >
                  <OkIcon id="shortcuts" size={14} decorative inherit className="text-text-light" />
                  <span>Keyboard shortcuts</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={menuRow}
                  onClick={onShowInfluenceExplainer}
                >
                  <OkIcon id="explain-olumi" size={14} decorative inherit className="text-text-light" />
                  <span>How influence works</span>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {/* Canvas settings (flattened). On the olumi-core lane (Paul's audit, 17 Nov) ViewCanvas reads the grid, its size and snap; alignment
                  guides and high contrast belong to the previous canvas only, so they are not offered there. */}
              <div className={menuLabel}>Canvas settings</div>
              <div className="divide-y divide-panel-border">
                <label htmlFor="kebab-show-grid" className={settingsRow}>
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
                  <div className="flex flex-col space-y-2 py-2.5 text-text-body">
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
                    <div className={`${typography.viewPanelMeta} flex justify-between text-text-light`} aria-hidden="true">
                      <span>8px</span>
                      <span>16px</span>
                      <span>24px</span>
                    </div>
                  </div>
                )}

                <label htmlFor="kebab-snap-to-grid" className={settingsRow}>
                  <span>Snap to grid</span>
                  <input
                    id="kebab-snap-to-grid"
                    type="checkbox"
                    checked={snapToGrid}
                    onChange={(e) => setSnapToGrid(e.target.checked)}
                    className={styles.settingsCheckbox}
                  />
                </label>

                {!lane && (<>
                  <label htmlFor="kebab-alignment-guides" className={settingsRow}>
                    <span>Alignment guides</span>
                    <input
                      id="kebab-alignment-guides"
                      type="checkbox"
                      checked={showAlignmentGuides}
                      onChange={(e) => setShowAlignmentGuides(e.target.checked)}
                      className={styles.settingsCheckbox}
                    />
                  </label>

                  <label htmlFor="kebab-high-contrast" className={settingsRow}>
                    <span>High contrast mode</span>
                    <input
                      id="kebab-high-contrast"
                      type="checkbox"
                      checked={highContrastMode}
                      onChange={(e) => setHighContrastMode(e.target.checked)}
                      className={styles.settingsCheckbox}
                    />
                  </label>
                </>)}
              </div>
            </div>
          </div>
        )}
      </div>

      {lane && showTitle && <ScenarioTitleDialog onClose={() => setShowTitle(false)} />}

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
          title="Start a new scenario?"
          message="This clears the current model: every node and connection, any analysis results, and the AI assistant conversation. It cannot be undone — to keep a copy, cancel and choose Export first."
          confirmLabel="Start new scenario"
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
