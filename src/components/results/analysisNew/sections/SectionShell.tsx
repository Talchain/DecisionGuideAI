/**
 * Analysis (New) — the collapsed section row, and the ONE implementation of it.
 *
 * ⭐⭐ THIS IS THE INFORMATION ARCHITECTURE THE DESIGN ASKS FOR, AND IT WAS THE
 * PIECE THAT DID NOT SHIP.
 *
 * Both revisions of Paul's concept agree on it: below "At a glance" the surface
 * is FIVE ONE-LINE ROWS — icon, title, count, chevron — and everything else is
 * one click away. What shipped instead rendered four sections EXPANDED inline.
 *
 * Measured on the deployed build at `a9fc1564`, a real guest run: the panel came
 * to 1,584px against a 769px viewport — 2.1 viewports of scroll on the surface
 * whose own header calls itself "the 5-to-10-second read". The existing Analysis
 * tab was 4,596px, so the new tab was already the better of the two; it was not
 * yet the thing it was designed to be, and Paul is being asked to judge the
 * comparison against a partial implementation of his own proposal.
 *
 * ⚠ ONE IMPLEMENTATION, NOT TWO. `AnalysisNewSection` (findings) and
 * `StrengthenTheReasoning` (recommendation cards) render different bodies but
 * the SAME header and the same disclosure behaviour. Two copies of that would be
 * a hand-maintained mirror (CLAUDE.md trap 12) in the most visible furniture on
 * the surface — so the header lives here and both call it.
 *
 * ⚠ SENTENCE CASE, DELIBERATELY, AND IT IS A DEVIATION FROM THE MOCK-UP. The
 * concept sets these titles in capitals. The Design System v5 ratchet forbids
 * that text-transform utility anywhere in `src/`, and small caps are not in the
 * panel scale — `analysisNewCopy.ts` records the same constraint for the same
 * reason. The ratchet is the authority, so the titles stay sentence case.
 *
 * (This note itself tripped the guard on its first draft, by naming the banned
 * utility in prose: the check is a text scan and cannot tell a comment from a
 * class. Worth knowing before you explain a DS decision in a header.)
 *
 * ⚠ THE COUNT IS DERIVED BY THE CALLER FROM ITS ACTUAL LIST, never passed as a
 * remembered number. A collapsed row is a PROMISE about what is behind it, and a
 * count that misreports reads as "you have seen everything" when you have not.
 */

import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { typography } from '../../../../styles/typography'

export interface SectionShellProps {
  title: string
  /** Lucide icon component. Furniture only — it never encodes a value. */
  icon?: LucideIcon
  /**
   * How many items sit behind the row. `null` renders no count — used when the
   * section has nothing countable to promise (an empty state with a sentence).
   */
  count: number | null
  /** First-use explanation. Lives in the row's `title` attribute, never as a row. */
  subtitle?: string
  /**
   * Open on mount. Default CLOSED — that is the whole point of the row.
   * A section may open by default only when something above it depends on the
   * content being visible, and no section currently does.
   */
  defaultOpen?: boolean
  children: ReactNode
  testId: string
}

export function SectionShell({
  title,
  icon: Icon,
  count,
  subtitle,
  defaultOpen = false,
  children,
  testId,
}: SectionShellProps) {
  const [open, setOpen] = useState(defaultOpen)
  const regionId = useId()

  return (
    <section
      className="border-b border-panel-border last:border-b-0"
      data-testid={testId}
      // ⚠ STILL A LABELLED LANDMARK. Turning the section header into a
      // disclosure control must not cost the landmark its name — the dock's own
      // spec pins `aria-labelledby`, and it was right to: a screen-reader user
      // navigating by landmark would otherwise meet four unnamed regions.
      aria-labelledby={`${testId}-heading`}
      data-section-open={open ? 'true' : 'false'}
    >
      {/* ⚠ HEADING WRAPS BUTTON — the WAI-ARIA accordion pattern, and the
          reason is that BOTH facts are true at once: this is a heading in the
          document outline AND a control that expands a region. Making it only
          a button deletes it from the heading map; making it only a heading
          deletes the control. The button carries the interaction, the `h3`
          carries the structure. */}
      <h3 id={`${testId}-heading`} className="m-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        // ⚠ Points at the region ONLY while it exists. A collapsed region is
        // UNMOUNTED rather than CSS-hidden (the rule `DisclosureRow` already
        // follows), so a resting `aria-controls` would reference nothing.
        aria-controls={open ? regionId : undefined}
        title={subtitle}
        className={`w-full flex items-center gap-2.5 py-3 text-left rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
        data-testid={`${testId}-toggle`}
      >
        {Icon ? (
          <span className="shrink-0 w-6 h-6 rounded-full bg-panel-hover flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-text-light" aria-hidden={true} />
          </span>
        ) : null}
        <span
          className={`${typography.panelHeader} text-text-header min-w-0 flex-1`}
          data-testid={`${testId}-title`}
        >
          {title}
        </span>
        {count != null ? (
          <span
            className={`${typography.panelMeta} text-text-light shrink-0`}
            data-testid={`${testId}-count`}
          >
            {count}
          </span>
        ) : null}
        {open ? (
          <ChevronDown className="w-4 h-4 shrink-0 text-text-light" aria-hidden={true} />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0 text-text-light" aria-hidden={true} />
        )}
      </button>
      </h3>

      {open ? (
        <div id={regionId} className="pb-3" data-testid={`${testId}-region`}>
          {children}
        </div>
      ) : null}
    </section>
  )
}
