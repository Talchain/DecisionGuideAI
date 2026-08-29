/**
 * The right-hand dock's tab strip. Owned by the shell; no child may render a
 * tab or add a control to this row.
 *
 * ── THE OVERFLOW DEFECT, AND WHY THE OBVIOUS FIX IS WRONG ─────────────────
 * The buttons carried `flex-1` but no `min-w-0` and no truncation, so their
 * default `min-width: auto` floored each one at min-content and `flex-basis:0`
 * never bit. The `<nav>` shrank; its children did not; they spilled under the
 * sibling controls.
 *
 * The obvious fix — `truncate` on the BUTTON — silently deletes protected
 * content. Each button holds the label AND, trailing it, the three-state
 * freshness icon and the factors-to-verify badge. `truncate` is
 * `overflow:hidden` on the button, and because the text sits in a nested span
 * there is no ellipsis either: it just clips, and what it clips first is the
 * trailing affordances. That would remove the CANNOT-CONFIRM state (leaving
 * the product asserting a freshness it cannot confirm) and the Model tab's
 * provenance badge — two of the six protected items, killed by a layout fix.
 *
 * So the rule is split by element:
 *   - `min-w-0` on the BUTTON, so `flex-basis: 0` finally bites;
 *   - `truncate` on the LABEL SPAN ONLY, so the label ellipsises;
 *   - `shrink-0` on the freshness icon and the verify badge, so they are the
 *     last things to give up space rather than the first;
 *   - `title` with the full label, so an ellipsised tab is still identifiable.
 *
 * A class-presence spec passes on the broken implementation, so it is not the
 * mechanism. The mechanism is the visual-regression harness: the label must
 * ellipsise AND the two protected testids must be painted with a non-zero box.
 */

import { useCallback, useRef } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react'
import type { OutputTab } from '../../../stores/uiStore'
import { typography } from '../../../styles/typography'
import { VersionsTrigger } from '../../versions/VersionsTrigger'
import type { WorkspaceSurfaceDescriptor } from './shellContract'

/**
 * The shared class for the row's icon controls. Named once because the row's
 * controls have to read as one set — a control that self-styles differently
 * looks like a button that lost its styling.
 */
const ROW_ICON_CONTROL =
  'inline-flex items-center justify-center w-6 h-6 rounded border border-panel-border ' +
  `${typography.panelMeta} text-text-header hover:bg-panel shrink-0`

/**
 * The DOM id of a dock tab, and of the panel they all control. Both halves of
 * the `aria-controls` / `aria-labelledby` pair are built from THIS function, so
 * the two can never drift into naming different elements — the failure mode a
 * hand-written pair invites (CLAUDE.md trap 12).
 *
 * The rail's tabs (rendered by `OutputsDock` when the dock is collapsed) build
 * their ids from `railTabDomId` instead. The two strips never co-render, but
 * they are given distinct id-spaces anyway: a duplicate id is invisible to
 * every test that queries by testid and silently breaks the one thing these
 * attributes exist to do.
 */
export const tabDomId = (id: OutputTab): string => `outputs-dock-tab-${id}`
export const railTabDomId = (id: OutputTab): string => `outputs-dock-rail-tab-${id}`
export const DOCK_PANEL_DOM_ID = 'outputs-dock-panel'

/** The accessible name shared by both strips. Written once, used by both. */
export const DOCK_TABLIST_LABEL = 'Outputs sections'

/**
 * The WAI-ARIA tabs keyboard model, shared by the expanded strip and the rail.
 *
 * Left/Right (plus Home/End) move focus AND selection, wrapping at both ends —
 * the same contract `HeroLensTabs` already implements for the analysis lens
 * switcher. Returns the surface to front, or `null` when the key is not one
 * this pattern owns.
 *
 * ⚠ IT RETURNS `null` RATHER THAN DEFAULTING TO A TAB, and that is the whole
 * discrimination. A handler that answered "some tab" for every keystroke would
 * satisfy an arrow-key test and destroy ordinary typing on the strip; the
 * suite's opposite-direction twin pins that an unrelated key is inert.
 */
export function nextTabForKey<T extends { id: OutputTab }>(
  surfaces: readonly T[],
  activeTab: OutputTab,
  key: string,
): T | null {
  if (surfaces.length === 0) return null
  const current = surfaces.findIndex(s => s.id === activeTab)
  // An active tab that is not in the strip is not a position to step from.
  // Home/End are still well-defined, so they are answered before this bails.
  switch (key) {
    case 'Home':
      return surfaces[0] ?? null
    case 'End':
      return surfaces[surfaces.length - 1] ?? null
    case 'ArrowRight':
    case 'ArrowLeft': {
      if (current < 0) return null
      const step = key === 'ArrowRight' ? 1 : -1
      const next = (current + step + surfaces.length) % surfaces.length
      return surfaces[next] ?? null
    }
    default:
      return null
  }
}

export interface WorkspaceShellTabStripProps {
  /** Presented surfaces, already filtered by flags, in strip order. */
  surfaces: readonly WorkspaceSurfaceDescriptor[]
  activeTab: OutputTab
  onTabClick: (tab: OutputTab) => void
  isOpen: boolean
  onToggleOpen: () => void
  expertMode: boolean
  onToggleExpertMode: () => void
  /** Analysis freshness: show an icon at all. */
  showResultsFreshnessIcon: boolean
  /** Analysis freshness: stale (true) vs cannot-confirm (false). */
  resultsStale: boolean
  /** Model provenance: number of factors awaiting verification. */
  factorsToVerify: number
}

/**
 * The collapse control.
 *
 * It rendered the bare ASCII characters `>` / `<` as its glyph. A text
 * character is not an icon: it inherits text metrics, it does not align with
 * the icon controls beside it, and it reads to a screen reader as punctuation
 * where the row's other controls read as buttons. The `aria-label` was already
 * correct — only the glyph was wrong.
 */
function CollapseControl({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const Icon = isOpen ? ChevronRight : ChevronLeft
  return (
    <button
      type="button"
      onClick={onToggle}
      className={ROW_ICON_CONTROL}
      aria-label={isOpen ? 'Collapse outputs dock' : 'Expand outputs dock'}
      data-testid="dock-collapse-control"
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
    </button>
  )
}

/** The strip shown when the dock is collapsed to its rail: nothing but the control. */
export function WorkspaceShellCollapsedStrip({ onToggleOpen }: { onToggleOpen: () => void }) {
  return (
    <div className="flex items-center justify-end px-2 py-2">
      <CollapseControl isOpen={false} onToggle={onToggleOpen} />
    </div>
  )
}

export function WorkspaceShellTabStrip({
  surfaces,
  activeTab,
  onTabClick,
  isOpen,
  onToggleOpen,
  expertMode,
  onToggleExpertMode,
  showResultsFreshnessIcon,
  resultsStale,
  factorsToVerify,
}: WorkspaceShellTabStripProps) {
  // Roving focus: moving selection with the keyboard must move focus with it,
  // or the user's focus is left on a tab that is no longer selected and the
  // next arrow key steps from the wrong place.
  const tabRefs = useRef(new Map<OutputTab, HTMLButtonElement | null>())
  const handleTabKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      const next = nextTabForKey(surfaces, activeTab, event.key)
      if (!next) return
      event.preventDefault()
      onTabClick(next.id)
      tabRefs.current.get(next.id)?.focus()
    },
    [surfaces, activeTab, onTabClick],
  )

  return (
    // ⚠ THE OUTER WRAPPER NO LONGER CARRIES `aria-label`. It is a role-less
    // `<div>`, and a generic container cannot take an accessible name — the
    // attribute was silently inert while duplicating a name the elements
    // inside it already carried. An inert claim is the thing removed here.
    //
    // ⚠ WHAT IS *NOT* REMOVED, AND IS NOT AN OVERSIGHT: the name appears
    // TWICE below, on the `<nav>` and again on the `role="tablist"` child.
    // That is deliberate and both are load-bearing — they are two different
    // things to a screen-reader user. The `<nav>` is the LANDMARK ("this
    // region is how you move around the dock"), reachable from a landmark
    // list and resolved by eighteen sibling assertions as
    // `getByRole('navigation', { name: 'Outputs sections' })`. The tablist is
    // the WIDGET ("these controls are a tab set"), and a tablist with no
    // accessible name is announced bare. Unlike the wrapper, BOTH of these
    // elements have a role that can hold a name, so neither claim is inert.
    // `noRolelessContainerClaimsTheStripName` pins exactly this distinction —
    // it explicitly exempts `NAV` and fails only on a role-less claimant.
    <div className="flex items-center gap-2 px-2 py-2">
      <span className="sr-only" aria-live="polite">
        {surfaces.find(s => s.id === activeTab)?.label ?? ''}
      </span>
      {/* ⚠⚠ THE TABLIST IS A CHILD OF THE `<nav>`, NOT THE `<nav>` ITSELF, AND
          THAT IS NOT A STYLE CHOICE — IT WAS MEASURED.

          The first version of this change put `role="tablist"` ON the `<nav>`.
          An explicit role REPLACES the implicit one, so the `navigation`
          landmark ceased to exist — and eighteen assertions across three
          sibling suites (`OutputsDock.dom`, `OutputsDock.runReturnsToOlumi`,
          `OutputsDock.assistantOpenedAttribution`) resolve this element with
          `getByRole('navigation', { name: 'Outputs sections' })`. All eighteen
          went RED against a 73/73 green baseline at `463fc931`.

          A landmark containing a tablist is the correct shape anyway: the
          `<nav>` says "this region is how you move around the dock", the
          tablist says "these three controls are a tab set". Both are true, and
          nesting them keeps every existing binding working. */}
      <nav className="flex flex-1 min-w-0" aria-label={DOCK_TABLIST_LABEL}>
      {/* ⭐ `flex-wrap` IS THE FLOOR UNDER LABEL LEGIBILITY, AND IT IS NOT
          SUFFICIENT ON ITS OWN — the two changes here are load-bearing
          together and were measured separately on deployed staging
          (29 Aug 2026), across the dock's full drag range:

            dock width          shipped        wrap only      wrap + px-1.5
            280 (minimum)   1 row, 55px lost   3 rows, 0     3 rows, 0
            320             1 row, 40px lost   2 rows, 0     2 rows, 0
            360             1 row, 24px lost   2 rows, 0     2 rows, 0
            416 (default)   1 row,  3px lost   2 rows, 0     1 row,  0

          `flex-auto min-w-0` shrinks every label together with NO legible
          floor, so the strip degrades by shaving all four at once rather than
          by reflowing. At the minimum dock width the Model tab rendered ZERO
          characters. Wrapping converts that failure into an extra row, which
          costs a little header height and never costs a name.

          But wrap ALONE regresses the DEFAULT width to two rows: the four
          labels need 276px inside 289px, and once the 12px of gaps are added
          the fit is sub-pixel marginal, so one tab reflows. Reclaiming 4px per
          tab from the horizontal padding (below) restores a genuine ~29px of
          slack, which is what keeps the default on one row. Neither change
          alone gets both ends of the range. */}
      <div
        className="flex flex-1 min-w-0 gap-1 flex-wrap"
        role="tablist"
        aria-label={DOCK_TABLIST_LABEL}
        data-testid="outputs-dock-tablist"
      >
        {surfaces.map(surface => {
          const isActive = activeTab === surface.id
          return (
            <button
              key={surface.id}
              type="button"
              id={tabDomId(surface.id)}
              role="tab"
              // BOTH directions are published, never just the true one. An
              // absent attribute on the inactive tabs would leave a user unable
              // to tell "not selected" from "this control does not report
              // selection at all" — which is the state the strip shipped in.
              aria-selected={isActive}
              aria-controls={DOCK_PANEL_DOM_ID}
              tabIndex={isActive ? 0 : -1}
              ref={el => {
                tabRefs.current.set(surface.id, el)
              }}
              onKeyDown={handleTabKeyDown}
              onClick={() => onTabClick(surface.id)}
              // `min-w-0` is the load-bearing class: without it the button's
              // default `min-width: auto` floors it at min-content, and no
              // amount of flex-shrink can take it below that — which is why the
              // tabs spilled under the controls instead of shrinking.
              //
              // ⚠ `flex-auto`, NOT `flex-1`, and the difference was MEASURED at
              // 1280x800 and 1920x1080. `flex-1` is `flex: 1 1 0%` — basis
              // zero, so every tab ends up the SAME width whatever it holds,
              // and with `min-w-0` it then truncates even when the row has
              // room: at four tabs it rendered "Anal…" and "Mo…" on a row with
              // space to spare, i.e. the fix producing the defect it was
              // written to prevent. `flex-auto` is `flex: 1 1 auto` —
              // content-sized, growing to fill the row and shrinking
              // PROPORTIONALLY only when the content genuinely does not fit.
              title={surface.label}
              data-testid={`outputs-dock-tab-${surface.id}`}
              // `px-1.5`, not `px-2`: 4px per tab, 16px across the strip. That
              // is what buys the default dock width its slack — see the
              // measured table above the tablist. Not a cosmetic tightening.
              className={`flex-auto min-w-0 px-1.5 py-1 rounded ${typography.panelBody} focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 ${
                isActive
                  ? 'text-info border-b-2 border-info'
                  : 'text-text-header hover:bg-panel border-b-2 border-transparent'
              }`}
              style={
                isActive
                  ? { backgroundColor: 'color-mix(in srgb, var(--info) 15%, transparent)' }
                  : undefined
              }
            >
              <span
                className={`flex items-center justify-center gap-1 min-w-0${
                  surface.id === 'results' && resultsStale ? ' text-warning' : ''
                }`}
              >
                {/* Only the LABEL truncates. The affordances after it are
                    protected content and carry `shrink-0`. */}
                <span className="truncate">{surface.label}</span>
                {surface.id === 'results' && showResultsFreshnessIcon && (
                  resultsStale ? (
                    <AlertTriangle
                      className="w-3 h-3 text-warning shrink-0"
                      aria-label="Analysis is stale"
                      data-testid="results-tab-stale-icon"
                    />
                  ) : (
                    <HelpCircle
                      className="w-3 h-3 text-text-light shrink-0"
                      aria-label="Cannot confirm whether this analysis is current."
                      data-testid="results-tab-cannot-confirm-icon"
                    />
                  )
                )}
                {surface.id === 'diagnostics' && factorsToVerify > 0 && (
                  // ⭐ L-58: this was a bare orange number. A `title` is a
                  // hover-only affordance — invisible to a user scanning the
                  // strip, absent on touch, and never reaching a screen reader
                  // as the badge's NAME. The count carries its meaning in the
                  // accessible name too, so "why is there an orange 4?" is
                  // answerable without hovering. (`role="status"` is
                  // deliberately NOT used: a static label on a tab, not a live
                  // announcement.)
                  <span
                    // DS §2.4 forbids weight overrides on panel tokens; this
                    // carried an inline `fontWeight: 600` on top of an inline
                    // `fontSize: 11` — a raw type declaration invisible to
                    // every class-based guard. `panelMeta` IS 11px, so the
                    // token replaces both and the badge stays legible on the
                    // warning fill by contrast rather than by weight.
                    className={`inline-flex items-center justify-center rounded-full bg-warning text-text-on-color shrink-0 ${typography.panelMeta}`}
                    style={{ minWidth: 16, height: 16, padding: '0 4px' }}
                    title={`${factorsToVerify} factor${factorsToVerify !== 1 ? 's' : ''} to verify`}
                    aria-label={`${factorsToVerify} factor${factorsToVerify !== 1 ? 's' : ''} to verify`}
                    data-testid="model-tab-verify-badge"
                  >
                    {factorsToVerify}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
      </nav>
      {/* ⭐ R4 — version history's home in this panel (#739). The trigger
          carries NO positioning of its own; layout belongs to this row, which
          is the point of retiring the floating pill (L-08). Its `icon` variant
          applies `className` with an EMPTY default, so it is given the SAME
          class as the collapse control and the two read as one control set. */}
      <VersionsTrigger
        variant="icon"
        className={ROW_ICON_CONTROL}
        data-testid="dock-versions-trigger"
      />
      <button
        type="button"
        onClick={onToggleExpertMode}
        className={`${typography.panelMeta} px-2 py-1 rounded-full border shrink-0 cursor-pointer transition-colors ${
          expertMode
            ? 'text-info border-info'
            : 'text-text-light border-panel-border hover:border-info hover:text-info'
        }`}
        aria-label={expertMode ? 'Disable expert mode' : 'Enable expert mode'}
        aria-pressed={expertMode}
        title="Toggle expert mode"
      >
        {'</>'}
      </button>
      <CollapseControl isOpen={isOpen} onToggle={onToggleOpen} />
    </div>
  )
}
