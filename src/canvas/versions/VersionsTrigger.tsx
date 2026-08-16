/**
 * VersionsTrigger — the control that opens version history.
 * British English: visualisation, colour, initialise.
 *
 * ── R4 (Paul, 16 Aug 2026): THE FLOATING PILL IS RETIRED ─────────────────────
 * The previous trigger was `position: absolute; z-[1500]`, anchored to the
 * viewport's right edge by a `calc()` over the OutputsDock's own width token.
 * It was a whole module of arithmetic (`versionsTriggerPosition.ts`, now
 * deleted) whose only job was to keep one floating control from landing on
 * another floating control — and it still stranded the pill ~350px out over
 * open canvas whenever the dock was collapsed (ledger L-08), because the offset
 * assumed the EXPANDED width in both dock states.
 *
 * ⚠ SO THIS COMPONENT CARRIES NO POSITIONING AT ALL — no `absolute`, no
 * `fixed`, no `z-index`, no inset. It is an ordinary inline control that sits
 * in whatever header row mounts it, and its layout is that row's business. That
 * is the actual fix: the defect was never the arithmetic, it was a control with
 * no home. Adding a position here would recreate L-08 with better maths.
 *
 * ── WHERE IT IS MOUNTED ──────────────────────────────────────────────────────
 *   - the app's top header bar (`components/layout/TopBar.tsx`) — the primary
 *     home, beside share and the model name, which is where a user looks for
 *     document history;
 *   - the analysis panel header — one line, owned by the cockpit lane:
 *
 *         import { VersionsTrigger } from '../../canvas/versions/VersionsTrigger'
 *         // ...in the dock's header row:
 *         <VersionsTrigger variant="icon" />
 *
 * Both read the same store, so two triggers cannot disagree about whether the
 * panel is open, and neither owns the state.
 */

import { History } from 'lucide-react'
import { typography } from '../../styles/typography'
import { useVersionsPanelStore } from './versionsPanelStore'

export type VersionsTriggerVariant = 'icon' | 'labelled'

export interface VersionsTriggerProps {
  /**
   * `icon` — a square icon button, for a dense header row (the default).
   * `labelled` — icon plus the words, for a row with space for them.
   */
  variant?: VersionsTriggerVariant
  /** Extra classes from the host row. Layout belongs to the host, never here. */
  className?: string
  /** Test hook, so two mounted triggers stay distinguishable in a spec. */
  'data-testid'?: string
}

/**
 * The control's name, in one place. It says HISTORY rather than "compare"
 * because the panel's primary job is the list of versions; comparing two of
 * them is one thing you can do once you have two.
 */
export const VERSIONS_TRIGGER_LABEL = 'Version history'

export function VersionsTrigger({
  variant = 'icon',
  className = '',
  'data-testid': testId = 'versions-trigger',
}: VersionsTriggerProps) {
  const isOpen = useVersionsPanelStore((state) => state.isOpen)
  const toggle = useVersionsPanelStore((state) => state.toggle)

  // `aria-expanded` is the honest state report: the control both opens AND
  // closes the panel, and a user (or an assistant) reading the tree can tell
  // which it will do next.
  const common = {
    type: 'button' as const,
    onClick: toggle,
    'aria-expanded': isOpen,
    'aria-label': VERSIONS_TRIGGER_LABEL,
    'data-testid': testId,
  }

  if (variant === 'icon') {
    return (
      <button {...common} className={className}>
        <History size={14} aria-hidden="true" />
      </button>
    )
  }

  return (
    <button
      {...common}
      className={`${typography.panelBody} inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-panel-border bg-panel text-text-body hover:bg-panel-hover ${className}`}
    >
      <History className="w-3.5 h-3.5" aria-hidden="true" />
      {VERSIONS_TRIGGER_LABEL}
    </button>
  )
}
