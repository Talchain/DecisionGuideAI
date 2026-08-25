/**
 * THE WORKSPACE DOCK'S PRIMARY NAVIGATION HAS NO TAB SEMANTICS — pinned.
 *
 * ── WHAT WAS MEASURED, AND WHERE IT CAME FROM ─────────────────────────────
 * The affordance sweep of 18 Aug 2026
 * (`olumi-docs/feedback-2026-08-16/AFFORDANCE-SWEEP-2026-08-18.md`,
 * cross-cutting observation 7) recorded, and this suite re-derived at the
 * deployed tip `463fc931`:
 *
 *   "The dock tabs carry no role="tab" / aria-selected, so there is no
 *    programmatic or assistive signal of which tab is active."
 *
 * Derived at the bytes rather than inherited. `WorkspaceShellTabStrip.tsx`
 * renders a `<nav>` of plain `<button>`s; `OutputsDock.tsx` renders a SECOND
 * `<nav>` of plain icon `<button>`s for the collapsed rail. Neither carries
 * `role="tablist"`, `role="tab"` or `aria-selected`, and the active tab is
 * distinguished ONLY by `text-info` + a coloured bottom border + a
 * `color-mix` background.
 *
 * ⚠ THE CONTRAST CONTROL THAT PROVES THIS IS A REAL ABSENCE AND NOT A BLIND
 * SEARCH: the same repo DOES implement the WAI-ARIA tabs pattern elsewhere —
 * `src/components/results/analysis-hero/HeroLensTabs.tsx` carries
 * `role="tablist"` with a roving tabindex and arrow-key selection, and
 * `ComparisonCanvasLayout.tsx`, `ScenarioListPage.tsx`, `ModelRowView.tsx`
 * and `DebugPanelV2.tsx` all carry `aria-selected`. So the search instrument
 * can see these attributes in this tree; it found none on the dock. The
 * product's SECONDARY lens switcher is a proper tablist while its PRIMARY
 * workspace navigation is not.
 *
 * ── WHY THIS IS A TRUTHFULNESS DEFECT, NOT ONLY AN ACCESSIBILITY ONE ──────
 * "Which panel am I looking at?" is state the product knows and does not
 * publish. A user driving by keyboard tabs across `Olumi`, `Analysis` and
 * `Model` and hears three identical "button" announcements — the active one
 * is indistinguishable from the other two. The dock ALSO fronts itself
 * without user action (the run-start auto-switch, `runReturnSignal.ts`, and
 * the assistant's `open_panel` directive), so a user can be relocated
 * between panels with the active-panel state conveyed by colour alone.
 *
 * ── THE TWO INSTANCES, KEPT APART ─────────────────────────────────────────
 * The same defect ships TWICE, on two different elements, and this suite
 * binds to each SEPARATELY by its own testid so that fixing one cannot make
 * the other's case pass. That separation is what the discriminating mutant
 * pair in the PR body exercises: breaking the expanded strip must RED the
 * expanded cases and leave the rail cases GREEN, and vice versa. A suite that
 * asserted "some tab somewhere has aria-selected" would pass on either half
 * and prove neither (CLAUDE.md trap 19 — bind by identity, never by a
 * predicate another object could satisfy).
 *
 * ── MOUNT PATH IS ASSERTED, NOT ASSUMED ───────────────────────────────────
 * Every case here drives `OutputsDock`, the surface the deployed flags mount,
 * rather than rendering `WorkspaceShellTabStrip` in isolation. `aiPanelV2` is
 * mocked ON EXPLICITLY (it is `defaultValue: true` AND
 * `VITE_FEATURE_AI_PANEL_V2 = "true"` in `netlify.toml`, and the rail was
 * observed rendering on staging) so this suite REDs loudly if that posture
 * ever moves, instead of passing vacuously against a strip nothing renders.
 * `assertsTheMountPath` below pins that the tabs under test are the shell's
 * own — `outputs-dock-tab-*`, the testids `WorkspaceShellTabStrip` and the
 * rail author — so a future refactor that swaps in a different strip fails
 * here rather than silently moving the surface out from under the assertions.
 */

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// OutputsDock's import chain pulls in supabase + dompurify, which break under
// the test env. Stub both before any module evaluation.
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
  },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: vi.fn(() => vi.fn()) }
})

// Spread the real module: a hand-listed factory silently drops every export
// added later, and this repo has shipped that failure (CLAUDE.md trap 12).
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return {
    ...actual,
    isAiPanelV2Enabled: () => true,
    isJourneyTabEnabled: () => false,
    isTelemetryEnabled: () => false,
  }
})

// The real readiness hook fetches a relative URL on mount, which jsdom rejects
// with "Invalid URL" as an unhandled rejection. Nothing here asserts readiness.
vi.mock('../../hooks/useGraphReadiness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useGraphReadiness')>()
  return {
    ...actual,
    useGraphReadiness: () => ({ readiness: null, loading: false, error: null, refresh: vi.fn() }),
  }
})

// The real pre-run panel calls `useShowToast()`, which THROWS outside a
// `<ToastProvider>`. Nothing here asserts its contents — these cases are about
// the tab strip above it, so the stub is a marker, not a fixture standing in
// for behaviour under test.
vi.mock('../pre-analysis', () => ({
  PreAnalysisPanel: () => <div data-testid="stub-pre-run" />,
}))
vi.mock('../pre-analysis-v3', () => ({
  default: () => <div data-testid="stub-pre-run-v3" />,
}))

import { OutputsDock } from '../OutputsDock'
import { useUIStore } from '../../../stores/uiStore'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { ConversationProvider } from '../../conversation/ConversationContext'

function renderDock() {
  return render(
    <ConversationProvider>
      <OutputsDock />
    </ConversationProvider>,
  )
}

function ensureMatchMedia() {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      }),
    })
  }
}

/**
 * Expand the dock. Deliberately tolerant of BOTH starting states — the dock's
 * open flag is module-level and can survive a previous case — and asserts only
 * its POSTCONDITION, which is the precondition every expanded case needs.
 */
async function expandDock() {
  const control = await screen.findByTestId('dock-collapse-control')
  if (control.getAttribute('aria-label') === 'Expand outputs dock') {
    fireEvent.click(control)
  }
  await waitFor(() => {
    expect(screen.getByTestId('outputs-dock-tab-results')).toBeInTheDocument()
  })
}

/** Collapse the dock to its rail. Same tolerance, same postcondition rule. */
async function collapseDock() {
  const control = await screen.findByTestId('dock-collapse-control')
  if (control.getAttribute('aria-label') === 'Collapse outputs dock') {
    fireEvent.click(control)
  }
  await waitFor(() => {
    expect(screen.getByTestId('outputs-dock-rail-tab-results')).toBeInTheDocument()
  })
}

/**
 * Put the rail in a KNOWN selection state: front `Analysis` on the expanded
 * strip, then collapse.
 *
 * ⚠ WHY NOT JUST COLLAPSE AND ASSERT. Measured, not theorised: these two cases
 * PASSED IN ISOLATION and FAILED IN THE FULL-FILE RUN. The dock's active tab is
 * module-level state that survives `cleanup()` and is not reset by clearing
 * storage, so whichever tab the PREVIOUS case happened to leave fronted is the
 * one the rail shows. Asserting "results is selected" was therefore asserting a
 * fact about test ORDER, and it would have been a guard whose evidence came
 * from its neighbours (CLAUDE.md trap 13b).
 *
 * ⚠ AND WHY NOT CLICK THE RAIL ICON DIRECTLY: activating a rail tab EXPANDS the
 * dock — that is the A2 fix, deliberate — so it cannot be used to set up a
 * collapsed-rail state. Fronting while expanded and then collapsing is the one
 * route that leaves the rail collapsed with a selection this case chose.
 *
 * ⚠⚠ AND THE PRECONDITION IS READ FROM THE STORE, NOT FROM `aria-selected`.
 * The first version of this helper waited on the EXPANDED tab's
 * `aria-selected` before collapsing. That coupled the rail's cases to the
 * expanded strip's attribute — and the mutant battery caught it: removing
 * `aria-selected` from the EXPANDED strip turned the two RAIL cases RED for a
 * SETUP reason, so M1 appeared to break the rail as well and the pair proved
 * nothing about where the rail's assertions bind. `handleTabClick` calls
 * `useUIStore.getState().setActiveOutputTab(tab)` (`OutputsDock.tsx`), which is
 * an INDEPENDENT authority for "which tab is fronted" — a setup step must never
 * wait on the very attribute the case is about.
 */
async function frontAnalysisThenCollapse() {
  await expandDock()
  fireEvent.click(screen.getByTestId('outputs-dock-tab-results'))
  await waitFor(() => {
    expect(useUIStore.getState().activeOutputTab).toBe('results')
  })
  await collapseDock()
}

/** The three expanded tabs, bound BY TESTID — never by label or by position. */
const EXPANDED = {
  olumi: 'outputs-dock-tab-olumi',
  results: 'outputs-dock-tab-results',
  model: 'outputs-dock-tab-diagnostics',
} as const

/** The three rail tabs, bound BY TESTID — a separate identity from EXPANDED. */
const RAIL = {
  olumi: 'outputs-dock-rail-tab-olumi',
  results: 'outputs-dock-rail-tab-results',
  model: 'outputs-dock-rail-tab-diagnostics',
} as const

describe('the workspace dock publishes which panel is active (affordance sweep cross-cutting 7)', () => {
  beforeEach(() => {
    // EXPLICIT unmount. A case that ended inside `waitFor` can leave the
    // previous tree alive long enough for `document.querySelector` — which,
    // unlike `screen`, is not scoped to the current container — to find the
    // wrong strip.
    cleanup()
    ensureMatchMedia()
    // ⚠ sessionStorage, NOT localStorage alone. `useDockState` persists the
    // dock's `{isOpen, activeTab}` under `OUTPUTS_DOCK_STORAGE_KEY` in
    // **sessionStorage**; clearing only localStorage leaves the dock open from
    // the previous case and the collapsed rail simply does not render, which
    // reads as a broken test and is in fact leaked state. Both are cleared
    // because the component reads both.
    sessionStorage.clear()
    localStorage.clear()
    useUIStore.setState({
      activeOutputTab: 'results',
      activeOutputTabVersion: 0,
      outputSurfaceOrigin: null,
      outputSurfaceOriginSeq: 0,
      outputSurfaceOriginAt: null,
    })
    useFloatingPanelState.getState().close()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  // ── MOUNT PATH ──────────────────────────────────────────────────────────

  it('assertsTheMountPath: the tabs under test are the shell strip OutputsDock actually renders', async () => {
    renderDock()
    await expandDock()

    // The expanded strip is the shell's own: all three testids present, inside
    // a single tablist, and that tablist is a descendant of the dock. If a
    // future refactor swaps the strip, this fails here rather than letting the
    // semantic assertions below drift onto some other element.
    const tablist = screen.getByTestId('outputs-dock-tablist')
    for (const testid of Object.values(EXPANDED)) {
      const tab = screen.getByTestId(testid)
      expect(tablist).toContainElement(tab)
    }
    expect(screen.getByTestId('outputs-dock-body')).toBeInTheDocument()
  })

  // ── THE EXPANDED STRIP ──────────────────────────────────────────────────

  it('theExpandedStripIsATablist: the dock tab row exposes role="tablist" with a name', async () => {
    renderDock()
    await expandDock()

    const tablist = screen.getByTestId('outputs-dock-tablist')
    expect(tablist).toHaveAttribute('role', 'tablist')
    expect(tablist).toHaveAccessibleName()
  })

  it('theExpandedTabsAreTabs: every dock tab carries role="tab"', async () => {
    renderDock()
    await expandDock()

    for (const testid of Object.values(EXPANDED)) {
      expect(screen.getByTestId(testid)).toHaveAttribute('role', 'tab')
    }
  })

  it('theActiveExpandedTabDeclaresItself: the fronted tab carries aria-selected="true"', async () => {
    renderDock()
    await expandDock()
    fireEvent.click(screen.getByTestId(EXPANDED.results))

    await waitFor(() => {
      expect(screen.getByTestId(EXPANDED.results)).toHaveAttribute('aria-selected', 'true')
    })
  })

  /**
   * OPPOSITE-DIRECTION TWIN of the case above.
   *
   * `aria-selected="true"` on the active tab is only half the signal. If the
   * inactive tabs simply OMIT the attribute, a user cannot distinguish "not
   * selected" from "this control does not report selection" — and, worse, a
   * naive fix that stamped `aria-selected="true"` on every tab would pass the
   * positive case above while telling the user all three panels are showing.
   * This case is what makes that impossible.
   */
  it('theInactiveExpandedTabsDeclareThemselvesToo: non-fronted tabs carry aria-selected="false", not an absent attribute', async () => {
    renderDock()
    await expandDock()
    fireEvent.click(screen.getByTestId(EXPANDED.results))

    await waitFor(() => {
      expect(screen.getByTestId(EXPANDED.results)).toHaveAttribute('aria-selected', 'true')
    })
    expect(screen.getByTestId(EXPANDED.olumi)).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId(EXPANDED.model)).toHaveAttribute('aria-selected', 'false')
  })

  it('exactlyOneExpandedTabIsSelected: the strip never reports two panels showing at once', async () => {
    renderDock()
    await expandDock()

    for (const testid of [EXPANDED.olumi, EXPANDED.results, EXPANDED.model]) {
      fireEvent.click(screen.getByTestId(testid))
      await waitFor(() => {
        expect(screen.getByTestId(testid)).toHaveAttribute('aria-selected', 'true')
      })
      const selected = Object.values(EXPANDED).filter(
        id => screen.getByTestId(id).getAttribute('aria-selected') === 'true',
      )
      expect(selected).toEqual([testid])
    }
  })

  it('theExpandedStripRovesTabindex: only the active tab is in the tab order', async () => {
    renderDock()
    await expandDock()
    fireEvent.click(screen.getByTestId(EXPANDED.results))

    await waitFor(() => {
      expect(screen.getByTestId(EXPANDED.results)).toHaveAttribute('tabindex', '0')
    })
    expect(screen.getByTestId(EXPANDED.olumi)).toHaveAttribute('tabindex', '-1')
    expect(screen.getByTestId(EXPANDED.model)).toHaveAttribute('tabindex', '-1')
  })

  it('arrowRightMovesSelectionAlongTheExpandedStrip', async () => {
    renderDock()
    await expandDock()
    fireEvent.click(screen.getByTestId(EXPANDED.olumi))
    await waitFor(() => {
      expect(screen.getByTestId(EXPANDED.olumi)).toHaveAttribute('aria-selected', 'true')
    })

    fireEvent.keyDown(screen.getByTestId(EXPANDED.olumi), { key: 'ArrowRight' })

    await waitFor(() => {
      expect(screen.getByTestId(EXPANDED.results)).toHaveAttribute('aria-selected', 'true')
    })
  })

  /**
   * SELECTION AND FOCUS ARE TWO CLAIMS, AND ONLY ONE OF THEM WAS PINNED.
   *
   * The case above proves the arrow key moves the SELECTION. It says nothing
   * about focus — and because the strip roves `tabIndex`, the newly-selected
   * tab is the only one left in the tab order, so a user whose focus stayed
   * behind on the now-`tabIndex={-1}` tab is stranded: the next arrow key
   * steps from the wrong place and Tab leaves the strip entirely. The line
   * that prevents this is `tabRefs.current.get(next.id)?.focus()` in
   * `WorkspaceShellTabStrip`, and deleting it left the suite fully green.
   *
   * ⚠ THE PRECONDITION IS PINNED IN-TEST AND IS LOAD-BEARING. Focus is put on
   * `olumi` explicitly (`fireEvent.click` does not focus in jsdom) and the
   * target is asserted NOT to hold focus first. Without that, this case would
   * pass on a tree where focus never moved at all — or worse, one where focus
   * happened to start on the destination — which is a guard agreeing with
   * itself rather than observing the roving-focus behaviour.
   */
  it('arrowRightMovesFocusAndNotOnlySelectionAlongTheExpandedStrip', async () => {
    renderDock()
    await expandDock()
    fireEvent.click(screen.getByTestId(EXPANDED.olumi))
    await waitFor(() => {
      expect(screen.getByTestId(EXPANDED.olumi)).toHaveAttribute('aria-selected', 'true')
    })

    screen.getByTestId(EXPANDED.olumi).focus()
    expect(screen.getByTestId(EXPANDED.olumi)).toHaveFocus()
    expect(screen.getByTestId(EXPANDED.results)).not.toHaveFocus()

    fireEvent.keyDown(screen.getByTestId(EXPANDED.olumi), { key: 'ArrowRight' })

    await waitFor(() => {
      expect(screen.getByTestId(EXPANDED.results)).toHaveFocus()
    })
  })

  /**
   * OPPOSITE-DIRECTION TWIN of the arrow-key case.
   *
   * A handler that moved selection on ANY keystroke would satisfy the case
   * above and destroy ordinary typing/shortcut behaviour on the strip. This
   * pins that an unrelated key is inert — the handler must discriminate, not
   * merely fire.
   */
  it('anUnrelatedKeyDoesNotMoveTheExpandedStripSelection', async () => {
    renderDock()
    await expandDock()
    // ⚠⚠ THE STARTING TAB IS LOAD-BEARING, AND THE MUTANT BATTERY PROVED IT.
    // This case originally started on `olumi`, the FIRST tab. A mutant that
    // made the key handler stop discriminating — `default: return surfaces[0]`
    // instead of `return null` — SURVIVED, because from the first tab
    // "fall back to the first tab" and "do nothing" are the same observable.
    // The mutant was never equivalent in general (pressing an unrelated key on
    // `Analysis` would have jumped the user to `Olumi`); the TEST simply could
    // not see it. Starting on a NON-first tab is what gives this case its
    // discrimination, so do not "tidy" it back to the first tab.
    fireEvent.click(screen.getByTestId(EXPANDED.results))
    await waitFor(() => {
      expect(screen.getByTestId(EXPANDED.results)).toHaveAttribute('aria-selected', 'true')
    })

    fireEvent.keyDown(screen.getByTestId(EXPANDED.results), { key: 'a' })

    // Settle, then assert nothing moved. `waitFor` on a NEGATIVE would pass
    // instantly and prove nothing, so the positive anchor is re-asserted.
    await waitFor(() => {
      expect(screen.getByTestId(EXPANDED.results)).toHaveAttribute('aria-selected', 'true')
    })
    expect(screen.getByTestId(EXPANDED.olumi)).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId(EXPANDED.model)).toHaveAttribute('aria-selected', 'false')
  })

  it('homeAndEndJumpToTheFirstAndLastExpandedTab', async () => {
    renderDock()
    await expandDock()
    fireEvent.click(screen.getByTestId(EXPANDED.results))
    await waitFor(() => {
      expect(screen.getByTestId(EXPANDED.results)).toHaveAttribute('aria-selected', 'true')
    })

    fireEvent.keyDown(screen.getByTestId(EXPANDED.results), { key: 'End' })
    await waitFor(() => {
      expect(screen.getByTestId(EXPANDED.model)).toHaveAttribute('aria-selected', 'true')
    })

    fireEvent.keyDown(screen.getByTestId(EXPANDED.model), { key: 'Home' })
    await waitFor(() => {
      expect(screen.getByTestId(EXPANDED.olumi)).toHaveAttribute('aria-selected', 'true')
    })
  })

  it('theDockBodyIsTheTabpanelTheActiveTabControls', async () => {
    renderDock()
    await expandDock()
    fireEvent.click(screen.getByTestId(EXPANDED.results))

    await waitFor(() => {
      expect(screen.getByTestId(EXPANDED.results)).toHaveAttribute('aria-selected', 'true')
    })
    const body = screen.getByTestId('outputs-dock-body')
    const activeTab = screen.getByTestId(EXPANDED.results)

    expect(body).toHaveAttribute('role', 'tabpanel')
    // Bind BY IDENTITY: the panel must name the tab that is actually selected,
    // and that tab must point back at this panel. A test that only checked
    // "some id is present" would pass on a panel labelled by the wrong tab.
    expect(body.getAttribute('aria-labelledby')).toBe(activeTab.id)
    expect(activeTab.getAttribute('aria-controls')).toBe(body.id)
    expect(activeTab.id).toBeTruthy()
    expect(body.id).toBeTruthy()
  })

  /**
   * OPPOSITE-DIRECTION TWIN of the tabpanel case: the label must TRACK the
   * selection rather than being stamped once. Fronting a different tab must
   * re-label the panel — otherwise the panel keeps announcing a tab the user
   * has left, which is the stale-claim defect this estate keeps paying for.
   */
  it('theTabpanelLabelFollowsTheSelectionRatherThanStickingToTheFirstTab', async () => {
    renderDock()
    await expandDock()

    fireEvent.click(screen.getByTestId(EXPANDED.results))
    await waitFor(() => {
      expect(screen.getByTestId('outputs-dock-body').getAttribute('aria-labelledby')).toBe(
        screen.getByTestId(EXPANDED.results).id,
      )
    })

    fireEvent.click(screen.getByTestId(EXPANDED.model))
    await waitFor(() => {
      expect(screen.getByTestId('outputs-dock-body').getAttribute('aria-labelledby')).toBe(
        screen.getByTestId(EXPANDED.model).id,
      )
    })
    // And it is genuinely a DIFFERENT id — otherwise the assertion above would
    // hold vacuously if every tab shared one id.
    expect(screen.getByTestId(EXPANDED.model).id).not.toBe(screen.getByTestId(EXPANDED.results).id)
  })

  // ── THE COLLAPSED RAIL — the SECOND instance, bound separately ───────────

  it('theCollapsedRailIsATablist: the rail exposes role="tablist" with a name', async () => {
    renderDock()
    await collapseDock()

    const rail = screen.getByTestId('outputs-dock-rail-tablist')
    expect(rail).toHaveAttribute('role', 'tablist')
    expect(rail).toHaveAccessibleName()
  })

  it('theActiveRailTabDeclaresItself: the fronted rail icon carries aria-selected="true"', async () => {
    renderDock()
    await frontAnalysisThenCollapse()

    await waitFor(() => {
      expect(screen.getByTestId(RAIL.results)).toHaveAttribute('aria-selected', 'true')
    })
    expect(screen.getByTestId(RAIL.results)).toHaveAttribute('role', 'tab')
  })

  /** OPPOSITE-DIRECTION TWIN — same reasoning as the expanded strip's twin. */
  it('theInactiveRailTabsDeclareThemselvesToo: non-fronted rail icons carry aria-selected="false"', async () => {
    renderDock()
    await frontAnalysisThenCollapse()

    await waitFor(() => {
      expect(screen.getByTestId(RAIL.results)).toHaveAttribute('aria-selected', 'true')
    })
    expect(screen.getByTestId(RAIL.olumi)).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByTestId(RAIL.model)).toHaveAttribute('aria-selected', 'false')
  })

  it('theRailKeepsItsAccessibleNames: each rail icon is still named after its panel', async () => {
    renderDock()
    await collapseDock()

    // Protected content: the rail is icon-only, so the accessible name IS the
    // only label. A tab-semantics change must not consume it.
    expect(screen.getByTestId(RAIL.olumi)).toHaveAccessibleName('Olumi')
    expect(screen.getByTestId(RAIL.results)).toHaveAccessibleName('Analysis')
    expect(screen.getByTestId(RAIL.model)).toHaveAccessibleName('Model')
  })

  // ── THE ROLE-LESS LABEL DEFECT ──────────────────────────────────────────

  /**
   * `aria-label` on a `<div>` with no role is IGNORED by assistive technology —
   * a generic container cannot take an accessible name. The strip's outer
   * wrapper carried `aria-label="Outputs sections"` anyway, duplicating the
   * name the `<nav>` inside it already had. Two elements claiming one name,
   * one of them silently inert.
   */
  it('noRolelessContainerClaimsTheStripName', async () => {
    renderDock()
    await expandDock()

    const claimants = Array.from(
      document.querySelectorAll('[aria-label="Outputs sections"]'),
    ).filter(el => !el.getAttribute('role') && el.tagName !== 'NAV')
    expect(claimants).toEqual([])
  })
})
