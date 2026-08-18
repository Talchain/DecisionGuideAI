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
  return (
    <div className="flex items-center gap-2 px-2 py-2" aria-label="Outputs sections">
      <span className="sr-only" aria-live="polite">
        {surfaces.find(s => s.id === activeTab)?.label ?? ''}
      </span>
      <nav className="flex flex-1 min-w-0 gap-1" aria-label="Outputs sections">
        {surfaces.map(surface => {
          const isActive = activeTab === surface.id
          return (
            <button
              key={surface.id}
              type="button"
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
              className={`flex-auto min-w-0 px-2 py-1 rounded ${typography.panelBody} focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 ${
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
