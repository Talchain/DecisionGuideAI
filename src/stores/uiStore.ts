/**
 * UI Store — Cross-component UI state (Zustand)
 *
 * E1: Enables programmatic tab switching from results components
 * (tornado chart, driver rows) to the Model tab.
 *
 * Task C: Right-panel orchestration — only one right-side panel is visible
 * at a time. Opening a panel auto-closes any other open panel.
 */
import { create } from 'zustand'

/** Must match OutputsDockTab in OutputsDock.tsx exactly */
export type OutputTab = 'results' | 'compare' | 'diagnostics' | 'journey' | 'olumi'

/**
 * Right-panel modes. Only one right-side panel can be open at a time.
 * - 'results': OutputsDock (analysis, compare, model tabs)
 * - 'provenance': ProvenanceHubTab
 * - 'clarifier': AI Clarifier chat
 * - null: no right panel open
 */
export type RightPanelMode = 'results' | 'provenance' | 'clarifier' | null

/**
 * OVERLAY SURFACES — transient, anchored, self-dismissing UI (menus, pop-ups,
 * coach-marks). A THIRD concept, deliberately not folded into either existing
 * one, because the three answer different questions (trap 21 — name the
 * concepts apart rather than bolting a conjunct onto a predicate with readers):
 *   - `activeOutputTab`      — which tab is fronted INSIDE the dock?
 *   - `activeRightPanel`     — which PERSISTENT right-side region owns the slot?
 *   - `activeOverlaySurface` — which TRANSIENT overlay is currently raised?
 *
 * WHY THEY LIVE HERE AT ALL. `applyV5State` executes the AI's `ui_directive`
 * verbs at a once-per-envelope, NON-RENDER side-effect site whose only reach
 * into the UI is `useUIStore.getState()`. While a menu's open-state was
 * `useState` inside its component, no assistant gesture could ever raise it —
 * menus, pop-ups and coach-marks were structurally unreachable, not merely
 * unimplemented. Lifting the state is the whole unblock.
 *
 * ONE SLOT, SO EXCLUSION IS STRUCTURAL: raising a surface lowers any other.
 * (Surfaces still owned by their components — LeftSidebar's lens menu,
 * UserAvatarMenu — coordinate over the `menu:exclusive` window event; the
 * lifted surfaces keep honouring it, so lifting one at a time does not create
 * two competing exclusivity mechanisms.)
 */
export const OVERLAY_SURFACE_IDS = ['top_bar_menu'] as const

export type OverlaySurfaceId = (typeof OVERLAY_SURFACE_IDS)[number]

/**
 * WHO raised the current surface. P4 provenance: a surface the assistant put
 * on screen is distinguishable from one the user opened, so the UI can
 * attribute it rather than appearing to move on its own.
 */
export type OverlaySurfaceOrigin = 'user' | 'assistant'

/** Derived membership test. The canonical list above is the only source. */
function isOverlaySurfaceId(value: unknown): value is OverlaySurfaceId {
  return (
    typeof value === 'string' &&
    (OVERLAY_SURFACE_IDS as ReadonlyArray<string>).includes(value)
  )
}

export interface UIStoreState {
  /** Current active tab in the OutputsDock (synced bidirectionally) */
  activeOutputTab: OutputTab
  /** Monotonic version counter for forceActivateOutputTab. Bumped on every
   *  force-activate call so OutputsDock's sync effect fires even when the
   *  tab value didn't change (e.g. global already 'results' but dock had
   *  another tab persisted in localStorage). */
  activeOutputTabVersion: number
  /** Task C: Which right-side panel is currently open (mutual exclusion) */
  activeRightPanel: RightPanelMode
  /**
   * Cross-panel handoff: the section ID a navigator wants the Model tab to
   * focus + auto-expand on its next render. Cleared by the consumer once it
   * has acted. Null when no navigation is pending.
   */
  pendingModelTabSection: string | null
  /** Which transient overlay surface is raised right now. Null when none. */
  activeOverlaySurface: OverlaySurfaceId | null
  /** Who raised it. Null exactly when no surface is raised. */
  overlaySurfaceOrigin: OverlaySurfaceOrigin | null
}

export interface UIStoreActions {
  setActiveOutputTab: (tab: OutputTab) => void
  /** Force OutputsDock to open AND activate the given tab on the next render,
   *  regardless of whether `activeOutputTab` actually changes value. Used by
   *  auto-dock and Dock-back when we cannot rely on a value-diff to trigger
   *  the sync. */
  forceActivateOutputTab: (tab: OutputTab) => void
  /** Open a right panel (closes any other). Pass null to close all. */
  openRightPanel: (mode: RightPanelMode) => void
  /** Close the active right panel */
  closeRightPanel: () => void
  /** Request the Model tab to focus + auto-expand a section on next render. */
  requestModelTabSection: (sectionId: string | null) => void
  /**
   * USER-driven overlay control: open a surface, or pass null to close.
   * The user may always both raise and lower. This is the action a click,
   * Escape, or a click-outside runs.
   */
  setOverlaySurface: (surface: OverlaySurfaceId | null) => void
  /**
   * ASSISTANT-driven overlay control — RAISE ONLY, by construction.
   *
   * `close_panel` / `close_inspector` were deliberately REJECTED from the
   * ui_directive design: the assistant taking surfaces AWAY from the user
   * inverts the channel's charter. Lifting overlay state into a globally
   * reachable store is exactly the change that could make AI-driven closing
   * possible BY ACCIDENT, so this action cannot express one:
   *   - the parameter type admits no null/undefined, so a close does not
   *     typecheck;
   *   - at runtime any value outside `OVERLAY_SURFACE_IDS` is REJECTED with
   *     the state left UNTOUCHED — never cleared. A malformed or
   *     newer-producer id therefore cannot dismiss a menu the user opened.
   *
   * Returns whether the surface was raised, so the ui_directive dispatcher can
   * record `applied` vs `deferred` truthfully instead of assuming success.
   */
  requestOverlaySurface: (surface: OverlaySurfaceId) => boolean
}

/**
 * The narrowed handle `applyV5State`'s ui_directive site holds.
 *
 * Every member RAISES a surface. The closing actions (`closeRightPanel`,
 * `openRightPanel(null)`, `setOverlaySurface(null)`) are absent, so the
 * assistant seam cannot express a close even by mistake — the rule is carried
 * by the type rather than by discipline. `requestModelTabSection` is narrowed
 * to a non-null section here: clearing a pending section is the CONSUMER's job
 * (ModelTabBody clears it once it has acted), never a gesture.
 */
export interface AssistantUiSurfaceActions {
  forceActivateOutputTab: (tab: OutputTab) => void
  requestModelTabSection: (sectionId: string) => void
  requestOverlaySurface: (surface: OverlaySurfaceId) => boolean
}

export const useUIStore = create<UIStoreState & UIStoreActions>((set) => ({
  activeOutputTab: 'results',
  activeOutputTabVersion: 0,
  activeRightPanel: null,
  pendingModelTabSection: null,
  activeOverlaySurface: null,
  overlaySurfaceOrigin: null,

  setActiveOutputTab: (tab) => set({ activeOutputTab: tab }),
  forceActivateOutputTab: (tab) =>
    set((s) => ({ activeOutputTab: tab, activeOutputTabVersion: s.activeOutputTabVersion + 1 })),
  openRightPanel: (mode) => set({ activeRightPanel: mode }),
  closeRightPanel: () => set({ activeRightPanel: null }),
  requestModelTabSection: (sectionId) => set({ pendingModelTabSection: sectionId }),

  setOverlaySurface: (surface) =>
    set(
      surface === null
        ? { activeOverlaySurface: null, overlaySurfaceOrigin: null }
        : { activeOverlaySurface: surface, overlaySurfaceOrigin: 'user' },
    ),

  requestOverlaySurface: (surface) => {
    // Fail-closed on ANYTHING that is not a known surface. Deliberately a
    // no-op rather than a clear: rejecting a bad id must never be a way to
    // close what the user has open.
    if (!isOverlaySurfaceId(surface)) return false
    set({ activeOverlaySurface: surface, overlaySurfaceOrigin: 'assistant' })
    return true
  },
}))

// Selectors
export const selectActiveOutputTab = (s: UIStoreState) => s.activeOutputTab
export const selectActiveRightPanel = (s: UIStoreState) => s.activeRightPanel
export const selectActiveOverlaySurface = (s: UIStoreState) => s.activeOverlaySurface
export const selectOverlaySurfaceOrigin = (s: UIStoreState) => s.overlaySurfaceOrigin
