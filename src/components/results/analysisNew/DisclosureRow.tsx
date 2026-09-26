/**
 * Analysis (New) — the one progressive-disclosure primitive every section uses.
 *
 * Three levels, per the brief §12:
 *   L1 scan     — headline + one implication sentence. Always visible.
 *   L2 understand — detail, grounding, and the row's own reasoning intervention.
 *   L3 inspect  — provenance/calculation rows, nested inside L2.
 *
 * ⚠ ACCESSIBILITY IS NOT OPTIONAL HERE AND PROGRESSIVE DISCLOSURE IS WHERE IT
 * USUALLY BREAKS. The whole L1 row is ONE button (so the target is large and
 * the keyboard reaches it once, not three times), it carries `aria-expanded`
 * and `aria-controls`, and the region it controls carries the matching id. A
 * collapsed region is UNMOUNTED rather than CSS-hidden, so a screen reader
 * never walks content the sighted user cannot see.
 *
 * ⚠ NO CARD INSIDE A CARD (§10). This renders a row with a hairline separator,
 * not a container. Depth is expressed with typography and space.
 */

import { useId, useState } from 'react'
import { PanelFigure } from './PanelFigure'
import { ChevronDown, ChevronRight, Crosshair, Pencil } from 'lucide-react'
// ⭐ ONE AI GLYPH FOR AN ASK (Design System v5 §9.8; V2 prototype's single `ai`
// icon). `Sparkles` is the AI-ESTIMATE provenance glyph, so an ask drawn with it
// said "Olumi estimated this" — and put two AI icons on one panel.
import { OlumiAiIcon } from './OlumiAiIcon'
import { IconBtn } from '../../../canvas/components/pre-analysis/primitives/IconBtn'
import { typography } from '../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from './analysisNewCopy'
import type { AnalysisNewFinding } from './analysisNewTypes'
import { action, icon } from './panelSurfaces'

const MARKER_LABEL: Record<NonNullable<AnalysisNewFinding['marker']>, string> = {
  provisional: COPY.markers.provisional,
  stale: COPY.markers.stale,
  not_assessed: COPY.markers.notAssessed,
}

export interface DisclosureRowProps {
  /**
   * Render the level-2 detail already open.
   *
   * ⚠ THE ONE CASE THIS EXISTS FOR, AND WHY IT IS NOT A GENERAL DEFAULT.
   * `AnalysisNewSection` opens a SECTION when it holds exactly one finding —
   * "one row cannot spend the height budget". But the row inside it stayed
   * collapsed, so opening the section revealed A SECOND CLOSED DOOR and the
   * reader needed two clicks to read one sentence. Measured on deployed
   * staging: "Key insights 1" open, its single insight shut beneath it.
   *
   * That is the piecemeal pattern exactly — a click that buys one line. The
   * argument that justifies auto-opening the section is the SAME argument for
   * auto-opening its only row, so the two now move together rather than
   * disagreeing. With two or more findings this stays false and every row
   * opens on demand, because THEN the height argument bites.
   */
  defaultOpen?: boolean
  finding: AnalysisNewFinding
  /** Canvas focus. Absent when the producer named no target. */
  onFocusTarget?: (targetId: string) => void
  /**
   * Routes to the editor for this row's subject. Absent here, or
   * `finding.reviewTargetId` absent, renders NO act — never a disabled one.
   */
  onReviewTarget?: (targetId: string) => void
  /** Runs the row's reasoning intervention through an EXISTING action route. */
  onRunIntervention?: (recommendationId: string) => void
  /**
   * ⭐⭐ WORK THROUGH THIS FINDING WITH OLUMI. Takes the finding rather than an
   * id, because the ask is ABOUT the row and the drawer is seeded from the
   * row's own words - there is no producer record to look up.
   *
   * ⚠ IT SHARES THE SLOT WITH THE INTERVENTION, IT DOES NOT SIT BESIDE IT.
   * Both are "work on this with Olumi" and both are the sparkle; two sparkles
   * on one row would be the panel asking a reader to tell apart two icons it
   * had already said were the same act. Where the producer named a move, the
   * act RUNS it and the tooltip says which. Where it did not, the act opens the
   * conversation. One icon, one meaning, and the accessible name discriminates.
   */
  onAskOlumi?: (finding: AnalysisNewFinding) => void
  /** Stable prefix so two sections cannot mint the same testid. */
  testIdPrefix: string
  /**
   * TAIL-3 (design wave 2, panel-lane design audit 2026-09-25): `'body'` is
   * for a row inside a `bare` `AnalysisNewSection` — one that no longer has
   * its own section-weight toggle around it, so its headline should not read
   * at the section-heading weight either. Renders the headline at
   * `typography.panelBody`/`text-text-body` instead of
   * `typography.panelHeader`/`text-text-header`. Default `'header'`, the
   * weight every other caller already gets; every row's disclosure
   * behaviour, testids and content are unchanged either way.
   */
  headlineTone?: 'header' | 'body'
}

export function DisclosureRow({
  finding,
  onFocusTarget,
  onReviewTarget,
  onRunIntervention,
  onAskOlumi,
  testIdPrefix,
  defaultOpen = false,
  headlineTone = 'header',
}: DisclosureRowProps) {
  const [open, setOpen] = useState(defaultOpen)
  const [inspectOpen, setInspectOpen] = useState(false)
  const regionId = useId()
  const inspectId = useId()

  const hasLevel2 =
    Boolean(finding.detail) || Boolean(finding.intervention) || finding.inspect.length > 0
  const marker = finding.marker ? MARKER_LABEL[finding.marker] : null

  return (
    <div
      className="border-b border-panel-border last:border-b-0 py-2.5"
      data-testid={`${testIdPrefix}-row`}
      data-finding-id={finding.id}
    >
      <button
        type="button"
        // A row with nothing beneath it is not a disclosure control. It stays a
        // plain block so the keyboard is not offered an expander that expands
        // nothing — an affordance that does nothing is the same class of lie as
        // a claim nobody measured.
        onClick={hasLevel2 ? () => setOpen((v) => !v) : undefined}
        disabled={!hasLevel2}
        aria-expanded={hasLevel2 ? open : undefined}
        aria-controls={hasLevel2 && open ? regionId : undefined}
        className={`w-full text-left flex items-start gap-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info ${
          hasLevel2 ? 'hover:opacity-80' : 'cursor-default'
        }`}
        /**
         * ⚠⚠ `-row-toggle`, NOT `-toggle`, AND THE COLLISION WAS REAL. This
         * row and its OWNING SECTION were both rendering `${prefix}-toggle`,
         * so the moment a section is open the id matches two controls and
         * `getByTestId` throws. It stayed latent only because every section
         * defaulted closed — a duplicate id that no test could reach.
         *
         * Found by opening single-item sections: the change did not create the
         * collision, it exposed one that was already shipped, and any future
         * default-open section would have hit it too.
         */
        data-testid={`${testIdPrefix}-row-toggle`}
      >
        {hasLevel2 ? (
          open ? (
            <ChevronDown className={`${icon('row')} mt-0.5 shrink-0 text-text-light`} aria-hidden="true" />
          ) : (
            <ChevronRight className={`${icon('row')} mt-0.5 shrink-0 text-text-light`} aria-hidden="true" />
          )
        ) : (
          <span className="w-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1">
          <span
            className={`${
              headlineTone === 'body' ? `${typography.panelBody} text-text-body` : `${typography.panelHeader} text-text-header`
            } block`}
          >
            {finding.headline}
            {marker ? (
              <span
                className={`${typography.panelMeta} text-text-light ml-2`}
                data-testid={`${testIdPrefix}-marker`}
              >
                {marker}
              </span>
            ) : null}
          </span>
          {finding.implication ? (
            <span className={`${typography.panelBody} text-text-body block mt-0.5`}>
              {finding.implication}
            </span>
          ) : null}

          {/* ⭐⭐ THE MEASURED RISK, AT L1 — visible without opening the row.
              This is the quantity the row is ABOUT: the producer's
              `switch_probability`, "P(flipping this edge switches the
              recommended option)". Behind disclosure it would be a number a
              reader has to go looking for, and the reason to look is the number.

              ⛔ BOTH FIELDS OR NEITHER. The builder sets them together and an
              absent measurement means NOT COMPUTED — never zero. A track with
              no fill would read as a measured "this changes nothing", which is
              the fabrication the contract names by name.

              ⚠ THE OPTION ROW'S GEOMETRY EXACTLY — same 8px track, same radius,
              same `bg-info` fill, same positive-only 2px floor. A probability
              drawn two ways on one panel is two scales the reader must learn;
              the section differs by its LABEL, never by its ruler. */}
          {finding.flipReadout !== undefined && finding.flipFraction !== undefined ? (
            <span className="block mt-1.5">
              {/* ⭐⭐ THE NUMBER ALONE, BECAUSE THE CAPTION IS THE SECTION'S.
                  Witnessed on the deployed build `92b5e60e`: three rows, three
                  bars, and "How often this changed the answer" printed THREE
                  TIMES — a label repeated once per row is furniture by the
                  second row and noise by the third. It is one fact about the
                  whole column, so it is said once above the column, in
                  `AnalysisNewSection`'s existing `caveat` slot, which exists
                  for exactly this ("a caveat the user must read to interpret
                  it correctly").

                  ⚠ THE NUMBER IS NOT LEFT BARE. What makes a lone percentage
                  ambiguous is a SECOND number beside it meaning something else
                  — the reason the option rows name both of theirs. There is one
                  figure per row here, under a caption that names it, so the
                  ambiguity that rule guards against does not arise. */}
              <span className="flex items-baseline justify-end">
                <span
                  className={`${typography.panelMeta} text-text-light shrink-0 tabular-nums`}
                  data-testid={`${testIdPrefix}-flip`}
                >
                  {finding.flipReadout}
                </span>
              </span>
              {/* ⚠ THIS FILE IS NOT UNDER `sections/`, WHICH IS WHY THE FIRST
                  SWEEP MISSED IT. A census scoped to a directory answers
                  "which figures are in sections?" and not "which figures does
                  the panel draw" — the narrower question, silently. Found by
                  re-running the sweep over the whole of `analysisNew` after the
                  first three adoptions. */}
              <PanelFigure
                variant="influence"
                className="mt-1"
                fraction={finding.flipFraction}
                testId={`${testIdPrefix}-flip-bar`}
              />
            </span>
          ) : null}
        </span>
      </button>

      {hasLevel2 && open ? (
        <div id={regionId} className="pl-6 mt-2 space-y-2" data-testid={`${testIdPrefix}-detail`}>
          {finding.detail ? (
            <p className={`${typography.panelBody} text-text-body`}>{finding.detail}</p>
          ) : null}

          {/* The grounding line. Every row can say what put it here. */}
          <p className={`${typography.panelMeta} text-text-light`} data-testid={`${testIdPrefix}-grounding`}>
            {COPY.disclosure.groundedIn} {finding.groundedIn}.
          </p>

          {/* ⭐⭐ THE ACTS ARE ICONS; THE DISCLOSURE BELOW KEEPS ITS WORD.
              Four text links stacked here and wrapped on a 428px dock, so an
              expanded row spent two to four LINES on its controls — the single
              biggest block of text on a panel whose complaint is that it is a
              wall of text. Each act is a verb on an object the row has already
              named, which is exactly what an icon with a tooltip carries well.

              ⛔ INSPECT IS DELIBERATELY NOT ONE OF THEM. It reveals CONTENT
              rather than acting on the model, and an icon would strip the one
              control here that a reader needs a word for. The rule this row
              now follows is that TREATMENT FOLLOWS KIND — three acts in one
              treatment, one disclosure in another — rather than four controls
              differing for no stated reason, which is the defect Paul saw. */}
          <div className="flex flex-wrap items-center gap-1" data-testid={`${testIdPrefix}-acts`}>
            {/* The camera frames the EDGE when one resolved, else the node.
                `targetId` stays the node-identity join `buildNodeInsights`
                reads — see `focusTargetId`'s declaration for why these are two
                fields and not one. */}
            {(finding.focusTargetId ?? finding.targetId) && onFocusTarget ? (
              <IconBtn
                icon={Crosshair}
                tooltip={COPY.disclosure.focusTarget}
                ariaLabel={COPY.disclosure.focusTarget}
                onClick={() => onFocusTarget((finding.focusTargetId ?? finding.targetId)!)}
                testId={`${testIdPrefix}-focus`}
              />
            ) : null}

            {/* ⭐ THE ACT THE ROW'S OWN SENTENCE ASKS FOR. Rendered only where
                the view model established the destination can serve it, so the
                two cannot disagree: there is no arm here that offers a route
                the Model tab would not honour, and none that renders disabled.

                ⚠ IT SITS BESIDE "Show on canvas", NOT INSTEAD OF IT. They
                answer different questions — where is this thing, versus where
                do I change it — and a reader who wants to see the relationship
                before touching it is the ordinary case, not an edge one. */}
            {finding.reviewTargetId && onReviewTarget ? (
              <IconBtn
                icon={Pencil}
                tooltip={COPY.disclosure.reviewTarget}
                ariaLabel={COPY.disclosure.reviewTarget}
                onClick={() => onReviewTarget(finding.reviewTargetId!)}
                testId={`${testIdPrefix}-review`}
              />
            ) : null}

            {/* ⚠ CONTEXTUAL INTERVENTION — stays visibly attached to the finding
                that triggered it (§3B). It is never a generic tip: it exists
                only because the strengthen ENGINE emitted a recommendation for
                THIS row's target id. */}
            {/* ⛔ AND IT MUST BE NAMEABLE. `intervention.label` is producer data,
                so `''` is reachable — and an icon carries no words, which makes
                its name the control's ONLY name. Rendering it anyway ships a
                round, pressable, entirely unreachable button that every shape
                and style assertion applauds.

                ⛔⛔ AND THIS IS A NEW RISK CLASS, NOT ONE WE ARE JOINING — my
                first draft of this comment claimed the opposite and an
                independent sweep refuted it. Every OTHER `IconBtn` caller on
                staging builds its label from a template literal with a literal
                prefix (`Scenario ${n}`, `Discuss ${label}`) or reads a static
                token table, so NONE of them can produce an empty name: they are
                safe by construction rather than by luck. This call site is the
                first to hand the primitive raw graph data, which is exactly why
                the guard has to name this act specifically.

                ⚠ THE GATE IS HERE RATHER THAN IN `IconBtn` BECAUSE THE
                PRIMITIVE CANNOT FIX IT. This call site passes the same value as
                both tooltip and label, so there is nothing to fall back to. An
                act we cannot name is an act we do not offer. */}
            {/* ⭐⭐ THE AI ACT IS ALWAYS AVAILABLE, AND THAT IS THE CHANGE.
                Measured on the served build with every section open, all 36
                buttons enumerated: the panel offered ZERO routes to work on a
                finding with Olumi. The slot existed and was gated on
                `finding.intervention` - producer data that no finding carried
                on a real run - so #1643's restoration shipped dark.

                ⚠ AN ASK IS NOT A DISPATCH. A producer intervention is a named
                move and needs producer data; talking to Olumi about a finding
                needs only a SUBJECT, and the row's own title is one. Gating the
                ask on the dispatch's data was one gate answering two questions
                (CLAUDE.md trap 21).

                ⛔ AND IT IS ONE SLOT, NOT TWO. Both arms are "work on this with
                Olumi" and both are the sparkle. Two sparkles on one row would
                ask the reader to tell apart two icons the panel had just said
                were the same act. The tooltip and the accessible name carry the
                difference, which is where a difference of INTENT belongs. */}
            {finding.intervention && finding.intervention.label.trim() !== '' && onRunIntervention ? (
              <IconBtn
                icon={OlumiAiIcon}
                tooltip={finding.intervention.label}
                ariaLabel={finding.intervention.label}
                variant="primary"
                onClick={() => onRunIntervention(finding.intervention!.recommendationId)}
                testId={`${testIdPrefix}-intervention`}
                dataAttrs={{ 'data-recommendation-id': finding.intervention.recommendationId }}
              />
            ) : onAskOlumi && finding.headline.trim() !== '' ? (
              /* ⚠ GATED ON A NAMEABLE SUBJECT, NOT ON THE HANDLER ALONE. An act
                 whose accessible name would be the copy constant with no
                 subject is the same defect the intervention arm was fixed for:
                 a control that cannot say what it acts on. The title is what
                 seeds the drawer, so an empty one would open it blank. */
              <IconBtn
                icon={OlumiAiIcon}
                tooltip={COPY.disclosure.askOlumi}
                ariaLabel={COPY.disclosure.askOlumi}
                onClick={() => onAskOlumi(finding)}
                testId={`${testIdPrefix}-ask`}
              />
            ) : null}
          </div>

          {finding.inspect.length > 0 ? (
            <div>
              <button
                type="button"
                onClick={() => setInspectOpen((v) => !v)}
                aria-expanded={inspectOpen}
                aria-controls={inspectOpen ? inspectId : undefined}
                /**
                 * ⭐⭐ THE TIER HAS A NAME AND THIS ROW WAS SPELLING IT OUT —
                 * WRONGLY, IN THE ONE CHARACTER THAT MATTERS.
                 *
                 * Its three siblings in this same flex row — focus, review and
                 * intervention — all use `action('inline')`. This one
                 * hand-copied the shape and substituted `text-text-light` for
                 * the action colour, so on the deployed build "Inspect" reads
                 * GREY-underlined beside "Show on canvas" reading
                 * INFO-underlined: four controls in one row, two colours, no
                 * rule distinguishing them. Paul, on that screenshot: the
                 * affordances contradict each other.
                 *
                 * ⚠ AND THE HAND-COPY IS THE DEFECT, NOT JUST ITS COLOUR. A
                 * spelled-out tier drifts the first time the tier moves, which
                 * is exactly what happened here — `ACTION_TIER.inline` is
                 * `'rounded text-info underline'` and this string agreed with
                 * it on two of three tokens. #1594 fixed the same shape in
                 * `SuccessTargetLine`; naming the tier is what stops the next
                 * one.
                 *
                 * ⚠ THE FOCUS RING IS NOT LOST. `action()` composes the
                 * estate's focus treatment, so the visible-focus behaviour is
                 * the tier's rather than this call site's opinion of it.
                 */
                className={`${typography.panelMeta} ${action('inline')}`}
                data-testid={`${testIdPrefix}-inspect-toggle`}
              >
                {inspectOpen ? (
                  <ChevronDown className={`${icon('inline')} inline-block mr-0.5 -mt-px`} aria-hidden="true" />
                ) : (
                  <ChevronRight className={`${icon('inline')} inline-block mr-0.5 -mt-px`} aria-hidden="true" />
                )}
                {COPY.disclosure.inspect}
              </button>
              {inspectOpen ? (
                <dl
                  id={inspectId}
                  className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1"
                  data-testid={`${testIdPrefix}-inspect`}
                >
                  {finding.inspect.map((r) => (
                    <div key={r.label} className="contents">
                      {/* ⚠ MIRRORS `DeeperAnalysis.tsx:110-111`, WHICH ALREADY HAD THIS
                          AND THIS FILE DID NOT. Both render producer-supplied node
                          labels and values, which are unbounded and may contain a
                          token with no break opportunity — and an unbreakable token
                          in a 278px column gives the whole tab a horizontal
                          scrollbar. Same content, same risk, one guard: an
                          asymmetry, not a decision. */}
                      <dt className={`${typography.panelMeta} text-text-light break-words`}>{r.label}</dt>
                      <dd className={`${typography.panelMeta} text-text-body break-words min-w-0`}>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
