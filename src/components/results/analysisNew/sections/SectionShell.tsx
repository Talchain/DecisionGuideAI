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
 * ⭐ V2 DESIGN SYSTEM: NO TINTS ON THE ROW ICON. The icon sat in a 24px
 * `rounded-full bg-panel-hover` circle, a tinted badge on every section row;
 * the prototype draws a plain `text-light` glyph. The circle is gone and the
 * 24px SLOT stays, untinted, so the glyph keeps its size and position and every
 * title keeps its x. Pinned by `sectionHeaderIconIsPlain.spec.tsx`.
 *
 * ⚠ THE COUNT IS DERIVED BY THE CALLER FROM ITS ACTUAL LIST, never passed as a
 * remembered number. A collapsed row is a PROMISE about what is behind it, and a
 * count that misreports reads as "you have seen everything" when you have not.
 */

/**
 * @panel-act-opt-out a FULL-WIDTH disclosure header; `min-w` is meaningless on a
 * `w-full` control and a tier's inline padding would fight `py-3`
 *
 * ⚠ DECLARED, NOT SILENT. The height came from `py-3` alone — true today and a
 * property of the padding rather than a guarantee. `min-h-[24px]` makes it one.
 * The width dimension is satisfied by `w-full` BY CONSTRUCTION, which is why this
 * file is the one legitimate exception to the both-dimensions rule and says so.
 */
import { useId, useState, type ReactNode } from 'react'
import { ACTION_FOCUS, icon } from '../panelSurfaces'
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
   *
   * ⭐⭐ ZERO IS TREATED AS `null`, AND THE CONVENTION ALREADY EXISTED — it was
   * just not encoded here, so every caller had to remember it. Two did
   * (`AnalysisNewSection`, `StrengthenTheReasoning`, both `length > 0 ? length
   * : null`); four did not, and Paul met one of them: "How this was worked out"
   * rendered a badge of **0** on a row that still expands.
   *
   * That is this header's own rule failing in the other direction — "a
   * collapsed row is a PROMISE about what is behind it, and a count that
   * misreports reads as 'you have seen everything' when you have not". A `0`
   * promises nothing is behind the row and then invites a press anyway.
   *
   * ⚠ ENCODED HERE RATHER THAN AT THE CALL SITES, because six callers each
   * remembering the same coercion is the hand-maintained mirror this estate
   * pays for (trap 12). The two existing guards are now redundant and harmless;
   * they are left alone so this change touches one file.
   */
  count: number | null
  /** First-use explanation. Lives in the row's `title` attribute, never as a row. */
  subtitle?: string
  /**
   * Open on mount. Default CLOSED — that is the whole point of the row.
   * A section may open by default only when something above it depends on the
   * content being visible.
   *
   * ⚠ THE SECOND HALF OF THIS SENTENCE USED TO READ "and no section currently
   * does", AND IT WAS ALREADY FALSE WHEN READ — a hand-maintained mirror
   * (CLAUDE.md trap 12) inside the docblock that states the rule. Derive the
   * callers, never this comment: `grep -rn 'defaultOpen' src`. At the time of
   * writing three sections pass it, and each states its own licence at its own
   * call site, which is where the condition is legible:
   *
   *   · `AnalysisNewSection.tsx:144` — a single finding, where the count on the
   *     row and the one row behind it carry the same information.
   *   · `AnalysisNewTabBody.tsx:1359` — Strengthen, pre-run, when it is the
   *     only content the panel has.
   *   · `AnalysisNewTabBody.tsx` (OptionsComparison) — a run whose glance shows
   *     no reading at all, where the figures below are the reader's only
   *     account of the field.
   *
   * ⚠ IT IS READ EXACTLY ONCE. `useState(defaultOpen)` seeds the state, so from
   * the first render of an instance the open state belongs to the toggle; a
   * later `false` is not re-read. Forcing a re-read means remounting, which was
   * tried and reverted (it discards unsaved composer text).
   */
  defaultOpen?: boolean
  /**
   * CONTROLLED OPEN STATE, optional. When supplied, the caller owns the state
   * and `defaultOpen` is ignored.
   *
   * ⭐ WHY THIS EXISTS AND WHY IT IS NOT A SECOND AUTHORITY. `defaultOpen` is
   * read exactly once (see above), so a section something ELSE can open — the
   * trust line's "How this was worked out" link — cannot be expressed with it:
   * the second click would do nothing, silently. The alternative was to keep
   * that one section on `Accordion`, which would leave TWO disclosure
   * treatments on one surface, and the mixed chrome is the "jumbly" defect this
   * directory's grammar exists to end.
   *
   * ⚠ THE INTERNAL STATE IS STILL TRACKED WHILE CONTROLLED, so a caller that
   * stops controlling does not snap the row shut under the reader.
   */
  open?: boolean
  /** Fires on every toggle, controlled or not. */
  onOpenChange?: (open: boolean) => void
  children: ReactNode
  testId: string
  /**
   * V2 gap 23: a SectionShell nested one level inside another SectionShell
   * ("Drivers and dynamics" inside "What moves the outcome") read as a
   * second, equal-weight section title under the first — the same
   * `panelHeader` h3 twice in a row, one nested inside the other.
   * `'label'` demotes it OUT of the heading map entirely (no h1-h6 at all —
   * `id`/button/chevron/count/toggle move to a plain `<div>`, quiet
   * `panelMeta` type): the parent section's own h3 is the only heading a
   * screen reader's heading navigation meets here, and this reads as a
   * sub-part of it rather than a second section title. Default `'h3'` — the
   * disclosure semantics and every testid are identical either way.
   */
  headingLevel?: 'h3' | 'label'
  /**
   * TAIL-1 (panel-lane design audit 2026-09-25): the prototype's tail groups
   * are a plain `.disclose` door — a chevron and one line of text, nothing
   * else. `'disclose'` drops the icon slot, subtitle, count and heading tag
   * entirely: just the toggle, holding a leading chevron that rotates open,
   * and the title. Opt-in and used only where a caller has a product ruling
   * to drop those; every other caller is unaffected.
   */
  variant?: 'disclose'
}

export function SectionShell({
  title,
  icon: Icon,
  count,
  subtitle,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  children,
  testId,
  headingLevel = 'h3',
  variant,
}: SectionShellProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const open = controlledOpen ?? uncontrolledOpen
  const toggle = () => {
    const next = !open
    setUncontrolledOpen(next)
    onOpenChange?.(next)
  }
  const regionId = useId()

  /**
   * Does the subtitle already state the count? Word-boundary matched so "14"
   * never suppresses a badge for "4".
   */
  const subtitleStatesCount =
    count != null && subtitle != null
      ? new RegExp(`(^|[^0-9])${count}([^0-9]|$)`).test(subtitle)
      : false

  if (variant === 'disclose') {
    return (
      <section
        className="border-b border-panel-border last:border-b-0"
        data-testid={testId}
        aria-labelledby={`${testId}-heading`}
        data-section-open={open ? 'true' : 'false'}
        data-section-count={count != null ? String(count) : undefined}
      >
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={open ? regionId : undefined}
          className={`${typography.panelBody} text-text-body flex items-center gap-1.5 min-h-[28px] text-left rounded hover:opacity-80 ${ACTION_FOCUS}`}
          data-testid={`${testId}-toggle`}
        >
          <ChevronRight
            className={`${icon('row')} shrink-0 text-text-light transition-transform${open ? ' rotate-90' : ''}`}
            aria-hidden={true}
          />
          <span id={`${testId}-heading`} data-testid={`${testId}-title`}>
            {title}
          </span>
        </button>
        {open ? (
          <div id={regionId} className="pb-3" data-testid={`${testId}-region`}>
            {children}
          </div>
        ) : null}
      </section>
    )
  }

  return (
    <section
      /* ⭐ A2 — CONTAINMENT BY FILL, BUT NOT AT THE COST OF THE DIVIDER.
         (Design pick A2, ratified 5 Sep; corrected after review measured it.)

         ⚠⚠ THE FIRST VERSION TRADED A VISIBLE RULE FOR AN INVISIBLE FILL. It
         dropped the 1px `border-panel-border` and used `bg-panel-hover/40`,
         which composites to `rgb(254, 252, 249.6)` over a `rgb(254, 254, 254)`
         panel — a contrast of 1.015:1, measured against the deployed build's
         own tokens. The reader lost a divider they could see and gained one
         they could not.

         ⚠ AND MY OWN COMMENT ARGUED THE WRONG COMPARISON. It defended dropping
         the border by pointing at the 2px accent box — a thing ALREADY REMOVED
         from this panel. The live alternative was a 1px rule, and that was
         never weighed. A justification aimed at a defect that no longer exists
         is not a justification.

         So: full-strength `bg-panel-hover` (1.038:1 — about 2.5× the
         separation, which is what a subtle surface is), AND the rule stays. A
         rule between sections is a RULE RUNNING EDGE TO EDGE, which the design
         asks for; it was never the one-sided box border it bans. The fill
         groups the header with the body it opened; the rule keeps separating
         one section from the next. Nothing is given up.

         ⚠ `-mx-2 px-2`, NOT `px-2`: padding alone moved the section title 8px
         sideways on open (x 25→33, width 228→212) — witnessed by clicking, not
         by reading classes. The negative margin lets the FILL reach the panel
         edge while the CONTENT stays exactly where it was, so opening a
         section no longer nudges its own heading. */
      /* ⭐ V2 (Paul + ChatGPT brief, 23 Sep 2026): NO TINT ON OPEN. The open
         section was a rounded `bg-panel-hover` card; V2 rules out tinted cards
         and nested boxes. The full-width rule still separates sections, and the
         rotated chevron plus `aria-expanded` say which one is open. */
      className="border-b border-panel-border last:border-b-0"
      data-testid={testId}
      // ⚠ STILL A LABELLED LANDMARK. Turning the section header into a
      // disclosure control must not cost the landmark its name — the dock's own
      // spec pins `aria-labelledby`, and it was right to: a screen-reader user
      // navigating by landmark would otherwise meet four unnamed regions.
      aria-labelledby={`${testId}-heading`}
      data-section-open={open ? 'true' : 'false'}
      /**
       * ⭐ THE COUNT IS ALWAYS CARRIED HERE, WHETHER OR NOT THE BADGE DRAWS.
       *
       * Saying a fact once is a rule about what the READER meets, not about
       * what the section KNOWS. Suppressing the badge when the subtitle
       * already states the number is correct; letting the number leave the
       * DOM entirely is not — it takes the fact away from assistive tech,
       * from the debug bundle, and from every precondition that uses the
       * count to prove a fixture still grounds what it claims to ground.
       *
       * ⚠ THIS IS THE DEFECT THIS CHANGE SHIPPED AND CI CAUGHT. Three
       * preconditions in `strengthenOpensPreRun.spec.tsx` read the badge to
       * assert "the engine really does ground exactly one finding". With the
       * badge conditional on COPY, those preconditions would have gone
       * vacuous the next time a subtitle was reworded — silently, and in the
       * direction that makes a suite agree with itself.
       */
      data-section-count={count != null ? String(count) : undefined}
    >
      {/* ⚠ HEADING WRAPS BUTTON — the WAI-ARIA accordion pattern, and the
          reason is that BOTH facts are true at once: this is a heading in the
          document outline AND a control that expands a region. Making it only
          a button deletes it from the heading map; making it only a heading
          deletes the control. The button carries the interaction, the
          heading tag carries the structure.

          ⚠ V2 GAP 23 — `headingLevel="label"` DROPS THE HEADING TAG, NOT JUST
          ITS WEIGHT. A nested SectionShell ("Drivers and dynamics" inside
          "What moves the outcome") kept its own `<h3>`, so a screen reader's
          heading navigation met TWO section-weight headings in a row — a
          visual-only fix (a quieter font on the same `<h3>`) would not have
          closed that. The parent section's own heading is the only one a
          reader navigating by heading meets; this control is still reachable
          (by Tab, and by role="button"), just not doubly announced as a
          section. `id` stays on the wrapper either way, so `aria-labelledby`
          on the surrounding `<section>` still resolves. */}
      {headingLevel === 'label' ? (
        <div id={`${testId}-heading`} className="m-0">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={open ? regionId : undefined}
            className={`w-full flex items-center gap-2.5 min-h-[24px] py-3 text-left rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            data-testid={`${testId}-toggle`}
          >
            {Icon ? (
              <span className="shrink-0 w-6 h-6 flex items-center justify-center">
                <Icon className={`${icon('row')} text-text-light`} aria-hidden={true} />
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              {/* V2 gap 23: `panelMeta`, not `panelHeader` — the quiet weight
                  this control reads at now that it is not a heading at all. */}
              <span
                className={`${typography.panelMeta} text-text-header block`}
                data-testid={`${testId}-title`}
              >
                {title}
              </span>
              {subtitle ? (
                <span
                  className={`${typography.panelMeta} text-text-light block mt-0.5`}
                  data-testid={`${testId}-subtitle`}
                >
                  {subtitle}
                </span>
              ) : null}
            </span>
            {count != null && count > 0 && !subtitleStatesCount ? (
              <span
                className={`${typography.panelMeta} text-text-light shrink-0`}
                data-testid={`${testId}-count`}
              >
                {count}
              </span>
            ) : null}
            {open ? (
              <ChevronDown className={`${icon('section')} shrink-0 text-text-light`} aria-hidden={true} />
            ) : (
              <ChevronRight className={`${icon('section')} shrink-0 text-text-light`} aria-hidden={true} />
            )}
          </button>
        </div>
      ) : (
      <h3 id={`${testId}-heading`} className="m-0">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        // ⚠ Points at the region ONLY while it exists. A collapsed region is
        // UNMOUNTED rather than CSS-hidden (the rule `DisclosureRow` already
        // follows), so a resting `aria-controls` would reference nothing.
        aria-controls={open ? regionId : undefined}
        className={`w-full flex items-center gap-2.5 min-h-[24px] py-3 text-left rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
        data-testid={`${testId}-toggle`}
      >
        {Icon ? (
          <span className="shrink-0 w-6 h-6 flex items-center justify-center">
            <Icon className={`${icon('row')} text-text-light`} aria-hidden={true} />
          </span>
        ) : null}
        {/* ⭐ THE SUBTITLE IS A LINE, NOT A TOOLTIP.
            It was `title={subtitle}` on the toggle: present in the DOM,
            unreachable by touch and by keyboard, and supplied by no mount, so
            it never rendered at all. The design pack draws it on every
            collapsed row for a reason: a title plus a count is a container name
            and a number, and the subtitle is the part that tells a reader
            whether the row is worth a click.

            Inside the flex column so the two lines stack; the toggle stays ONE
            control, with the subtitle part of its accessible name rather than a
            second tab stop. */}
        <span className="min-w-0 flex-1">
          <span
            className={`${typography.panelHeader} text-text-header block`}
            data-testid={`${testId}-title`}
          >
            {title}
          </span>
          {subtitle ? (
            <span
              className={`${typography.panelMeta} text-text-light block mt-0.5`}
              data-testid={`${testId}-subtitle`}
            >
              {subtitle}
            </span>
          ) : null}
        </span>
        {/* ⭐⭐ ONE FACT, SAID ONCE — AND THE SUBTITLE WINS.
            Witnessed on the deployed build: the Strengthen header rendered a
            count badge reading "4" beside a subtitle reading "0 addressed · 4
            worth checking". The same number, twice, 40px apart, and the badge is
            the copy that says LESS.

            ⚠ DERIVED FROM THE SUBTITLE, NOT FROM A FLAG. A `showCount` prop
            would let a caller pass a subtitle that states the count AND ask for
            the badge anyway, which is the drift this is closing. Asking the
            subtitle whether it already carries the number cannot go stale,
            because the subtitle is the thing that carries it.

            ⚠ WORD-BOUNDARY MATCHED, so a subtitle mentioning "14" does not
            suppress a badge reading "4". A substring test here would hide a
            count for the wrong reason, which is worse than showing it twice. */}
        {count != null && count > 0 && !subtitleStatesCount ? (
          <span
            className={`${typography.panelMeta} text-text-light shrink-0`}
            data-testid={`${testId}-count`}
          >
            {count}
          </span>
        ) : null}
        {open ? (
          <ChevronDown className={`${icon('section')} shrink-0 text-text-light`} aria-hidden={true} />
        ) : (
          <ChevronRight className={`${icon('section')} shrink-0 text-text-light`} aria-hidden={true} />
        )}
      </button>
      </h3>
      )}

      {open ? (
        <div id={regionId} className="pb-3" data-testid={`${testId}-region`}>
          {children}
        </div>
      ) : null}
    </section>
  )
}
