/**
 * Lane 4 (P5): kebab-menu capabilities are REAL, and no kebab control lies.
 *
 * POC-DONE pass-condition 2: "no surface states an untruth" — a visible
 * control that does nothing is an untruth. These tests pin:
 *   1. Kebab -> Export opens the REAL Export Canvas dialog (was console.warn).
 *   2. Kebab -> Import opens the REAL Import Canvas dialog (required so the
 *      export dialog's own "re-importable" claim stays true).
 *   3. Kebab -> Snapshots opens the REAL Snapshot Manager.
 *   4. Kebab has NO "Replay tour" control (it dispatched into a flag-gated
 *      overlay that is off in every deploy context — removed lie).
 *   5. TopBar mounts the ScenarioSwitcher (scenario switching + scenario
 *      export/import reachable).
 *   6. The switcher's dropdown opens BELOW the trigger (TopBar is fixed at
 *      the top of the viewport; the toolbar-era default opened upward).
 *
 * Identity binding: menu items by EXACT accessible name (role=menuitem),
 * dialogs by their BottomSheet <h2> heading text, switcher by data-testid.
 * jsdom proves presence/wiring only, never pixels (trap 3) — the post-deploy
 * browser walk uses the testids listed in the lane report.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TopBar } from '../TopBar'
import { ToastProvider } from '../../../canvas/ToastContext'
import { ImportExportDialog } from '../../../canvas/components/ImportExportDialog'
import { useCanvasStore } from '../../../canvas/store'
import { exportCanvas as exportCanvasData } from '../../../canvas/persist'

function renderTopBar() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <TopBar
          scenarioTitle="Pricing Decision 2025"
          onTitleChange={vi.fn()}
          onSave={vi.fn()}
          onShare={vi.fn()}
        />
      </ToastProvider>
    </MemoryRouter>,
  )
}

function openKebab() {
  fireEvent.click(screen.getByRole('button', { name: 'More options' }))
}

describe('TopBar kebab capabilities (Lane 4 P5)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('kebab Export opens the real Export Canvas dialog', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    renderTopBar()
    openKebab()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Export' }))

    // The REAL dialog: BottomSheet with the exact "Export Canvas" heading
    // and the real export action button.
    expect(
      screen.getByRole('heading', { name: 'Export Canvas' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Export as JSON/ }),
    ).toBeInTheDocument()
    // And the old lie is gone: no console.warn('Export') stub.
    expect(warnSpy).not.toHaveBeenCalledWith('Export')
    warnSpy.mockRestore()
  })

  it('kebab has an Import entry that opens the real Import Canvas dialog', () => {
    renderTopBar()
    openKebab()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Import' }))

    expect(
      screen.getByRole('heading', { name: 'Import Canvas' }),
    ).toBeInTheDocument()
  })

  it('kebab has a Snapshots entry that opens the real Snapshot Manager', () => {
    renderTopBar()
    openKebab()

    fireEvent.click(screen.getByRole('menuitem', { name: 'Snapshots' }))

    expect(
      screen.getByRole('heading', { name: 'Snapshot Manager' }),
    ).toBeInTheDocument()
  })

  it('kebab does NOT offer a Replay tour control (removed lie)', () => {
    renderTopBar()
    openKebab()

    // The menu itself must be open for this absence assertion to see anything
    // (positive control against a vacuous pass — trap 13).
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(
      screen.queryByRole('menuitem', { name: 'Replay tour' }),
    ).toBeNull()
  })

  it('TopBar mounts the ScenarioSwitcher', () => {
    renderTopBar()
    expect(screen.getByTestId('scenario-switcher-trigger')).toBeInTheDocument()
  })

  it('ScenarioSwitcher dropdown opens BELOW the trigger in the TopBar', () => {
    renderTopBar()
    fireEvent.click(screen.getByTestId('scenario-switcher-trigger'))

    const menu = screen.getByTestId('scenario-switcher-menu')
    expect(menu.className).toContain('top-full')
    expect(menu.className).not.toContain('bottom-full')
  })
})

/**
 * F1 (adversarial review of PR #582, prescription CORRECTED by the delta
 * re-review): the newly-exposed Import path calls store.importCanvas, which
 * replaces the whole graph AND wipes undo history (store.ts:2467 —
 * past/future emptied), with no confirmation.
 *
 * The first prescription gated the confirm on `isDirty` — but that flag is
 * HOLLOW: the complete writer manifest shows ordinary node/edge edits and
 * CEE draft-apply never set it, so a dirty-gated confirm never fires on a
 * real drafted graph. Corrected gate: NON-EMPTY canvas
 * (nodes.length > 0 || edges.length > 0), with copy that states what
 * actually happens (replace canvas, clear undo) — the "unsaved changes"
 * copy would itself lie on a non-dirty canvas.
 *
 * These tests bind to the confirm's EXACT copy and assert the destructive
 * action is NOT taken until accepted.
 */
describe('ImportExportDialog import confirmation (F1)', () => {
  const IMPORT_CONFIRM_COPY =
    'Import this file? This will replace your current canvas and clear undo history.'

  const existingNode = {
    id: 'n-existing-1',
    type: 'decision',
    position: { x: 10, y: 10 },
    data: { label: 'Existing node', type: 'decision' },
  }
  const importedNode = {
    id: 'n-imported-1',
    type: 'decision',
    position: { x: 0, y: 0 },
    // data.type is the discriminant of AnyNodeDataSchema (v2 snapshot Zod) —
    // without it the import path rejects the file (v2-parse-failed).
    data: { label: 'Imported node F1', type: 'decision' },
  }
  // Build the file with the REAL exporter so the fixture cannot drift from
  // the format the import path validates.
  const validImportJson = exportCanvasData({ nodes: [importedNode] as never, edges: [] })

  function resetStore() {
    useCanvasStore.setState({ nodes: [], edges: [], isDirty: false })
  }

  beforeEach(() => {
    localStorage.clear()
    resetStore()
  })

  afterEach(() => {
    resetStore()
    vi.restoreAllMocks()
  })

  async function renderImportDialogWithFile() {
    const onClose = vi.fn()
    render(
      <ToastProvider>
        <ImportExportDialog isOpen onClose={onClose} mode="import" />
      </ToastProvider>,
    )
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).not.toBeNull()
    const file = new File([validImportJson], 'canvas.json', { type: 'application/json' })
    // jsdom 24's File lacks Blob.text(); polyfill on the instance so the
    // dialog's `await file.text()` resolves to the fixture content.
    if (typeof (file as { text?: unknown }).text !== 'function') {
      Object.defineProperty(file, 'text', {
        value: () => Promise.resolve(validImportJson),
      })
    }
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
    })
    await screen.findByText('Import As-Is')
    return onClose
  }

  it('with existing work on the canvas, declining the confirm leaves the canvas untouched', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    // NOT dirty — the gate must fire on canvas CONTENT, not the hollow
    // isDirty flag (which real edits and CEE draft-apply never set).
    useCanvasStore.setState({ nodes: [existingNode] as never })
    const onClose = await renderImportDialogWithFile()

    fireEvent.click(screen.getByText('Import As-Is'))

    expect(confirmSpy).toHaveBeenCalledWith(IMPORT_CONFIRM_COPY)
    // Destructive action NOT taken: the existing graph survives, dialog open.
    const labels = useCanvasStore.getState().nodes.map(n => n.data?.label)
    expect(labels).toEqual(['Existing node'])
    expect(onClose).not.toHaveBeenCalled()
  })

  it('with existing work on the canvas, accepting the confirm replaces the graph', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    useCanvasStore.setState({ nodes: [existingNode] as never })
    const onClose = await renderImportDialogWithFile()

    fireEvent.click(screen.getByText('Import As-Is'))

    expect(confirmSpy).toHaveBeenCalledWith(IMPORT_CONFIRM_COPY)
    // Identity: the imported node (exact label) replaced the existing graph.
    const labels = useCanvasStore.getState().nodes.map(n => n.data?.label)
    expect(labels).toContain('Imported node F1')
    expect(labels).not.toContain('Existing node')
    expect(onClose).toHaveBeenCalled()
  })

  it('on an EMPTY canvas, import proceeds without a prompt', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onClose = await renderImportDialogWithFile()

    fireEvent.click(screen.getByText('Import As-Is'))

    // Empty canvas = nothing to clobber, no friction.
    expect(confirmSpy).not.toHaveBeenCalled()
    const labels = useCanvasStore.getState().nodes.map(n => n.data?.label)
    expect(labels).toContain('Imported node F1')
    expect(onClose).toHaveBeenCalled()
  })
})
