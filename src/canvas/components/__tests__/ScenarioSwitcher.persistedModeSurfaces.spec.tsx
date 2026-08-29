/**
 * ON THE AUTHENTICATED PATH THE SWITCHER IS A SECOND, BROKEN STEERING WHEEL.
 *
 * `ScenarioSwitcher` mounts unconditionally in the TopBar, and on a persisted
 * (signed-in) session every one of its scenario-collection controls is wrong —
 * not merely redundant:
 *
 *   LIST     — `loadScenarios()` reads localStorage ONLY. A signed-in user's
 *              decisions live in Supabase and `loadSupabaseScenario` never
 *              writes a localStorage row, so this list shows the wrong set:
 *              empty, or leftover guest-session records.
 *   SWITCH   — `store.loadScenario` is the localStorage load path. Asked to
 *              open a Supabase decision it finds no record at all.
 *   DELETE   — `store.deleteScenario` removes a localStorage record. It does
 *              not delete the user's decision; it deletes a local artefact,
 *              while reporting success.
 *
 * So the control shows the wrong list and deletes the wrong thing. The answer
 * is not to make the localStorage twin correct — it is to take the second
 * steering wheel off, leaving `ScenarioListPage` as the single switch/delete
 * surface with one clear owner.
 *
 * The NAME and RENAME half is genuinely correct on both paths (it commits
 * through `onRename` to the framing title) and is deliberately kept.
 *
 * ── BINDING ─────────────────────────────────────────────────────────────────
 * The guest-mode twin below is what stops this becoming "removed the feature":
 * it asserts the same controls are still THERE for the session they actually
 * work for. Both directions, or the gate is just a deletion.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ScenarioSwitcher } from '../ScenarioSwitcher'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'

vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))

vi.mock('../../store/scenarios', () => ({
  loadScenarios: vi.fn(() => []),
  getScenario: vi.fn(),
  createScenario: vi.fn(),
  updateScenario: vi.fn(),
  deleteScenario: vi.fn(),
}))

const LOCAL_ONLY_NAME = 'A localStorage-only decision'
/**
 * The TopBar mount passes the name it derives, so the trigger does NOT read the
 * localStorage record. Kept DISTINCT from `LOCAL_ONLY_NAME` on purpose: the
 * record's name then appears in exactly one place — the dropdown LIST — so an
 * assertion about the list cannot be satisfied by the trigger's rename button.
 * (Without this the "no list" assertion passes on the trigger text and proves
 * nothing — trap 19: bind to the object, not to a string another element
 * shares.)
 */
const DISPLAY_NAME = 'The open decision'

/** Assertions about the list are scoped to the menu, never the whole document. */
function menu() {
  return within(screen.getByTestId('scenario-switcher-menu'))
}

const mockDeleteScenario = vi.fn()
const mockLoadScenarioAction = vi.fn()

function renderSwitcher(props: Record<string, unknown> = {}) {
  return render(
    <ToastProvider>
      <ScenarioSwitcher displayName={DISPLAY_NAME} {...props} />
    </ToastProvider>,
  )
}

function openMenu() {
  fireEvent.click(screen.getByTestId('scenario-switcher-trigger'))
}

beforeEach(() => {
  vi.clearAllMocks()

  vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
    const state = {
      currentScenarioId: 'scenario-1',
      isDirty: false,
      isSaving: false,
      lastSavedAt: null,
      saveCurrentScenario: vi.fn(),
      loadScenario: mockLoadScenarioAction,
      duplicateCurrentScenario: vi.fn(),
      renameCurrentScenario: vi.fn(),
      deleteScenario: mockDeleteScenario,
    }
    return selector(state)
  })

  vi.mocked(scenarios.loadScenarios).mockReturnValue([
    {
      id: 'scenario-1',
      name: LOCAL_ONLY_NAME,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      graph: { nodes: [], edges: [] },
    },
  ] as never)
  vi.mocked(scenarios.getScenario).mockReturnValue({
    id: 'scenario-1',
    name: LOCAL_ONLY_NAME,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    graph: { nodes: [], edges: [] },
  } as never)
})

// ---------------------------------------------------------------------------
// PERSISTED SESSION — the broken controls must be gone
// ---------------------------------------------------------------------------

describe('persisted session: the localStorage scenario collection is not steerable here', () => {
  it('does not list localStorage scenarios', () => {
    renderSwitcher({ isPersisted: true })
    openMenu()

    // Bound by the record's own NAME — "no list rendered" asserted against the
    // exact item the localStorage source would have produced.
    expect(menu().queryByText(LOCAL_ONLY_NAME)).toBeNull()
    expect(menu().queryByText('Recent')).toBeNull()
  })

  it('does not offer the localStorage delete', () => {
    renderSwitcher({ isPersisted: true })
    openMenu()

    expect(menu().queryByTitle('Delete')).toBeNull()
  })

  it('points at the surface that does own decisions', () => {
    // Removing a control silently is its own small confusion. Say where the
    // real list lives.
    renderSwitcher({ isPersisted: true })
    openMenu()

    expect(screen.getByTestId('scenario-switcher-persisted-notice')).toBeTruthy()
  })

  it('keeps the name and rename control', () => {
    renderSwitcher({ isPersisted: true })
    expect(screen.getByTestId('scenario-name-button')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// GUEST SESSION — the opposite-direction twin
// ---------------------------------------------------------------------------

describe('guest session: the controls still work and are still offered', () => {
  it('lists localStorage scenarios', () => {
    // Guards against "fixed it by deleting the feature". For a guest,
    // localStorage IS the store of record and every one of these controls is
    // correct.
    renderSwitcher({ isPersisted: false })
    openMenu()

    expect(menu().getByText(LOCAL_ONLY_NAME)).toBeTruthy()
    expect(menu().getByText('Recent')).toBeTruthy()
  })

  it('offers the delete', () => {
    renderSwitcher({ isPersisted: false })
    openMenu()

    expect(menu().getByTitle('Delete')).toBeTruthy()
  })

  it('does not show the persisted-mode notice', () => {
    renderSwitcher({ isPersisted: false })
    openMenu()

    expect(screen.queryByTestId('scenario-switcher-persisted-notice')).toBeNull()
  })

  it('defaults to guest behaviour when the prop is absent', () => {
    // The toolbar mount passes no prop. Defaulting to "persisted" would blank
    // the list for the sessions the control is FOR.
    renderSwitcher()
    openMenu()

    expect(menu().getByText(LOCAL_ONLY_NAME)).toBeTruthy()
  })
})
