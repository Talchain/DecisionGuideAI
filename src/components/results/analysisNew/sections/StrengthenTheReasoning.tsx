/**
 * Analysis (New) — "Strengthen the reasoning".
 *
 * ⭐ THIS IS THE SECTION THE EXPERIMENT EXISTS TO TEST. It is second from the
 * top and it is the only section given a stronger visual treatment, because the
 * claim under test is that Olumi does not merely analyse a situation — it tells
 * a team how to improve the reasoning itself.
 *
 * ⚠ THE COMPARISON, STATED PRECISELY RATHER THAN RHETORICALLY. Derived from
 * `ResultsBody.tsx` at this tip, the existing Analysis tab's named sections run:
 * Decision brief · Analysis (hero) · Key question · What I was given ·
 * **Strengthen your model** · Options comparison · Drivers · Tornado · Your next
 * steps · Advanced · Adjustments. So the same material is FIFTH of eleven — and
 * it also sits below the warning strips and status furniture the dock renders
 * above `ResultsBody`. Here it is SECOND. That placement delta is the
 * experiment; an earlier draft of this comment said "roughly eleventh", which
 * was a guess dressed as a measurement.
 *
 * ⚠⚠ NOTHING HERE IS AUTHORED. Every row is a `Recommendation` emitted by
 * `buildRecommendations` — the existing, producer-grounded engine — and every
 * field rendered below is the engine's own: `title` (what), `signal` + `whyNow`
 * (why it fired), `tryThis` (the one practical instruction), `sourceLine` (the
 * named grounding, honest about producer-vs-UI basis). If this component ever
 * starts composing a sentence about the user's reasoning, the experiment has
 * become the fabrication it was built to avoid.
 *
 * ── ON THE ACTION ROUTE, STATED PLAINLY ─────────────────────────────────────
 * The engine's `RecAction.kind` spans five routes ('inline-edit', 'ai-dialogue',
 * 'canvas-focus', 'rerun', 'open-modal'), and `StrengthenContainer` owns the
 * dispatch machinery for all of them — including store writes and a degrade
 * path. This experimental surface deliberately offers only the two routes that
 * MUTATE NOTHING:
 *
 *   · "Show on canvas"  → `focusModelTarget` (existing, fail-closed helper)
 *   · the primary CTA   → `openAskOlumi` PREFILLED (existing drawer; the user
 *                          reads and sends, this surface never auto-sends)
 *
 * Everything else is presented as guidance, which the brief explicitly permits
 * ("it may be presented as guidance rather than inventing a new backend
 * behaviour"). The reason is not caution for its own sake: a presentation
 * experiment that also becomes a second dispatch authority would let the two
 * tabs diverge in what they DID as well as what they showed, and the comparison
 * would no longer be about information architecture.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Crosshair, FlaskConical, Lightbulb, type LucideIcon } from 'lucide-react'
import { strengthenWhyLine } from '../analysisNewCopy'
import { SectionShell } from './SectionShell'
import { typography } from '../../../../styles/typography'
import { openAskOlumi } from '../../coaching/askOlumiStore'
import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { attentionNoteForRecommendation } from '../../strengthen/recommendationAttention'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { SEVERITY_BADGE_CLASS, NOTICE_MS } from '../../strengthen/StrengthenPanel'
import { STRENGTHEN_COPY } from '../../strengthen/strengthenCopy'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import type { ScienceGrounding } from '../analysisNewTypes'
import { methodForRecommendation } from '../recommendationMethod'
import { NodeMark, markKindForTarget } from '../nodeMarks'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'

export interface StrengthenTheReasoningProps {
  interventions: Recommendation[]
  /**
   * Producer DSK attestation keyed by recommendation id. SPARSE BY DESIGN —
   * an absent key means the producer attested nothing for that intervention,
   * and the row then carries no grounding badge at all.
   */
  scienceGrounding?: Record<string, ScienceGrounding>
  /** Row icon. Furniture — it never encodes a value. */
  icon?: LucideIcon
  testId?: string
}

/**
 * Human-readable strength, from the producer's CLOSED vocabulary.
 *
 * ⚠ ANYTHING OUTSIDE THE VOCABULARY RENDERS NOTHING. A pass-through would let
 * an unrecognised producer token become user-facing copy, which is precisely
 * how a fabricated-sounding scientific label gets on screen (§15).
 */
const STRENGTH_LABEL: Record<string, string> = {
  strong: 'Strong evidence',
  moderate: 'Moderate evidence',
  limited: 'Limited evidence',
  emerging: 'Emerging evidence',
}

export function StrengthenTheReasoning({
  interventions,
  scienceGrounding = {},
  icon,
  testId = 'analysis-new-strengthen',
}: StrengthenTheReasoningProps) {
  /**
   * ⭐ THE DISMISSAL IS USER AGENCY, NOT HOUSEKEEPING. The shipped Strengthen
   * panel has always had "Not relevant"; this surface read the resulting
   * `dismissed` status (`useAnalysisNewViewModel`'s RETIRED_STATUSES) and had no
   * way to WRITE it — so a reader could see coaching filtered by a decision this
   * tab gave them no way to make. Dismissing bad coaching is how the human stays
   * authoritative, which is the sixth clause of the alignment principle.
   *
   * The store, the copy and the undo already exist; only the control was
   * missing. Undo matters as much as the dismissal: a one-way discard of a
   * producer-grounded finding is a worse affordance than none.
   */
  const dismiss = useStrengthenStore((st) => st.dismiss)
  const restoreDismissed = useStrengthenStore((st) => st.restoreDismissed)
  /**
   * ⚠⚠ WITNESSED ON DEPLOYED `3378415d`, AND IT IS THE DEFECT CLASS THIS WHOLE
   * SURFACE EXISTS TO AVOID: a control that claims an action it did not perform.
   *
   * `strengthenStore.dismiss` opens with `const record = get().records[id]; if
   * (!record) return` — it SILENTLY NO-OPS for an id it holds no record for.
   * Records are created by `reconcile`, which runs on a COMPLETED analysis. So
   * before a run there is no record, the dismissal does nothing, and the notice
   * still said "Recommendation dismissed". The card stayed on screen next to a
   * sentence saying it had gone.
   *
   * The fix is not a louder notice. A control that cannot act is not an
   * affordance, it is an advertisement — so the button is not offered unless the
   * store actually holds this recommendation and can retire it.
   */
  const strengthenRecords = useStrengthenStore((st) => st.records)
  const [undoable, setUndoable] = useState<{ id: string; title: string } | null>(null)

  /**
   * ⚠ THE NOTICE IS TRANSIENT, ON THE OWNER'S TIMING. An earlier draft left it up
   * indefinitely, which accumulates furniture and — worse — would have made the
   * SAME action linger for different lengths on this surface and on the shipped
   * Strengthen panel. `NOTICE_MS` is imported from that panel rather than
   * restated, so the two cannot drift.
   *
   * The timer is cleared on replace and on unmount: dismissing a second card
   * while the first notice is up must not leave an orphaned timeout that blanks
   * the new one early.
   */
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (noticeTimer.current) clearTimeout(noticeTimer.current) }, [])

  const showUndo = useCallback((next: { id: string; title: string }) => {
    setUndoable(next)
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setUndoable(null), NOTICE_MS)
  }, [])

  const clearUndo = useCallback(() => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setUndoable(null)
  }, [])

  return (
    <SectionShell
      title={COPY.sections.strengthen}
      icon={icon}
      count={interventions.length > 0 ? interventions.length : null}
      testId={testId}
    >
      {/* ⚠ THE UNDO IS NOT OPTIONAL FURNITURE. Dismissing removes the card on
          the next render (the view model treats `dismissed` as retired), so
          without this the only feedback for a misclick is a finding silently
          vanishing. It names what went, so the undo is a choice rather than a
          guess. */}
      {undoable ? (
        <div
          className={`${typography.panelMeta} flex flex-wrap items-center gap-2 rounded-md bg-panel-hover px-2 py-1 text-text-light`}
          role="status"
          data-testid={`${testId}-dismissed-notice`}
        >
          <span>
            {STRENGTHEN_COPY.dismissedNotice}: {undoable.title}
          </span>
          <button
            type="button"
            onClick={() => {
              restoreDismissed(undoable.id)
              clearUndo()
            }}
            className="rounded text-info hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
            data-testid={`${testId}-dismissed-undo`}
          >
            {STRENGTHEN_COPY.undo}
          </button>
        </div>
      ) : null}

      {interventions.length === 0 ? (
        // ⚠ STATES WHAT WAS NOT FOUND, NOT THAT NOTHING IS WRONG. "Your
        // reasoning looks solid" would be a claim nobody measured.
        <p className={`${typography.panelBody} text-text-light`} data-testid={`${testId}-empty`}>
          {COPY.empty.strengthen}
        </p>
      ) : (
        <ul className="space-y-3 list-none p-0 m-0">
          {interventions.map((rec) => {
            const grounding = scienceGrounding[rec.id]
            // `null` for most findings, and that is correct — see
            // `recommendationMethod.ts`. No placeholder, no default technique.
            const method = methodForRecommendation(rec.id)
            /**
             * ⭐ THE MARK MOVES WORK OUT OF THE SENTENCE AND INTO THE FORM.
             * A card about a Risk now carries the risk shape, in the risk
             * colour, matching the canvas — so "this concerns a risk" is
             * something the reader sees rather than a clause they parse.
             *
             * `null` whenever the honest answer is unknown: no target, an EDGE
             * target (a relationship has no node kind), or a kind this panel
             * does not draw. Nothing renders then — a shape that means the
             * wrong thing is worse than no shape.
             */
            const markKind = markKindForTarget(rec.targetId)
            const strengthLabel =
              grounding?.strength && STRENGTH_LABEL[grounding.strength]
                ? STRENGTH_LABEL[grounding.strength]
                : null
            return (
              <li
                key={rec.id}
                className="border-l-2 border-info/40 pl-3"
                data-testid={`${testId}-item`}
                data-recommendation-id={rec.id}
              >
                {/* ⭐ THE GROUNDING RIDES WITH THE TITLE, NOT AT THE BOTTOM.
                    Being able to say WHICH decision-science claim licenses a
                    recommendation is the thing that separates this from a
                    generated suggestion — and it was rendering as the smallest,
                    greyest, last line on the card, beneath two paragraphs and
                    two links. A reader who stopped early never saw it.

                    The sentence is unchanged and still carries its `data-dsk-*`
                    attributes; only its POSITION and weight changed. It sits
                    beside the title as a chip, where it qualifies the
                    recommendation at the moment the reader meets it. */}
                {/* ⭐ THE TITLE GETS THE FULL WIDTH; THE QUALIFIERS SHARE A ROW
                    BENEATH IT. Mounted at the 280px dock floor, a chip in the
                    title's right slot squeezed the heading into a ~150px column
                    — "Define what / success looks like" wrapped mid-phrase and
                    the severity badge was pushed onto a line of its own. Two
                    chips competing with a heading for one row does not fit the
                    narrowest width this product supports.

                    They are also the same KIND of thing: how urgent this is, and
                    what licenses it. Reading them as a pair beneath the title is
                    what they are. */}
                <p className={`${typography.panelHeader} text-text-header m-0 flex items-baseline gap-2`}>
                  {markKind ? <NodeMark kind={markKind} className="w-3 h-3 self-center" /> : null}
                  <span className="min-w-0">{rec.title}</span>
                </p>

                {rec.category || grounding || method ? (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {rec.category ? (
                      <span
                        className={`${typography.panelMeta} inline-flex items-center rounded-pill border bg-transparent px-1.5 ${SEVERITY_BADGE_CLASS[rec.category]}`}
                        data-testid={`${testId}-severity`}
                        data-category={rec.category}
                      >
                        {STRENGTHEN_COPY.severityLabel[rec.category]}
                      </span>
                    ) : null}
                    {/* ⭐⭐ THE TECHNIQUE, ON THE FINDING THAT WARRANTS IT.
                        This is the single clearest expression of "Olumi
                        recommends techniques, not answers": the seven
                        science-grounded methods already ship, and until now they
                        sat in a dropdown with no idea which finding should
                        trigger them. The chip is a control, not a label — it
                        opens the method's own prompt with THIS finding as
                        context, so the technique arrives already pointed at the
                        thing that warranted it. */}
                    {method ? (
                      <button
                        type="button"
                        onClick={() =>
                          openAskOlumi({
                            // The FINDING is the context, not the method's own
                            // description — that is the whole point of attaching
                            // a technique to a trigger. `ActionsMenu` sends the
                            // description because it dispatches from a menu with
                            // no finding to point at.
                            context: rec.whyNow || rec.signal,
                            draft: method.prompt,
                            label: method.title,
                            // ⚠ IDENTITY MUST RIDE THE DISPATCH, and omitting
                            // this made the chip cosmetic. `ActionsMenu` passes
                            // both, and its comment says why: the method id
                            // travels in `parameters` so the eventual dispatch is
                            // a conversation-typed turn carrying
                            // `chip_metadata {method_id}`. Without them the
                            // drawer still opens with the right prompt, so
                            // nothing looks broken — CEE simply never learns
                            // which technique the user invoked.
                            parameters: { method_id: method.id },
                            source: 'chip',
                            ...(rec.targetId ? { targetId: rec.targetId } : {}),
                          })
                        }
                        className={`${typography.panelMeta} inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-info hover:bg-info/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                        data-testid={`${testId}-method`}
                        data-method-id={method.id}
                        title={method.description}
                      >
                        <Lightbulb className="w-3 h-3" aria-hidden={true} />
                        {method.title}
                      </button>
                    ) : null}
                    {grounding ? (
                      <span
                        className={`${typography.panelMeta} inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-info`}
                        data-testid={`${testId}-science-grounding`}
                        data-dsk-claim-id={grounding.claimId}
                        {...(grounding.protocolId
                          ? { 'data-dsk-protocol-id': grounding.protocolId }
                          : {})}
                        title={`Grounded in the decision-science knowledge base${
                          strengthLabel ? ` · ${strengthLabel}` : ''
                        }.`}
                      >
                        <FlaskConical className="w-3 h-3" aria-hidden={true} />
                        {strengthLabel ?? COPY.strengthen.groundedChip}
                        <span className="sr-only">
                          {`Grounded in the decision-science knowledge base${
                            strengthLabel ? ` · ${strengthLabel}` : ''
                          }.`}
                        </span>
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <p
                  className={`${typography.panelBody} text-text-body mt-1 mb-0`}
                  data-testid={`${testId}-why`}
                >
                  {strengthenWhyLine(rec.signal, rec.whyNow)}
                </p>

                {rec.tryThis ? (
                  <p
                    className={`${typography.panelBody} text-text-light mt-1 mb-0`}
                    data-testid={`${testId}-try`}
                  >
                    <span className="text-info">{STRENGTHEN_COPY.tryThisLead}</span>{' '}
                    {rec.tryThis}
                  </p>
                ) : null}

                {/* The action is the point of the card, so it reads as a
                    control rather than as a fourth line of prose. */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      openAskOlumi({
                        context: rec.whyNow || rec.signal,
                        draft: rec.action.prompt ?? rec.tryThis,
                        label: rec.action.label,
                        ...(rec.targetId ? { targetId: rec.targetId } : {}),
                        ...(rec.action.parameters ? { parameters: rec.action.parameters } : {}),
                      })
                    }
                    className={`${typography.panelBody} inline-flex items-center gap-1 rounded-md bg-info/10 px-2 py-1 text-info hover:bg-info/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                    data-testid={`${testId}-action`}
                  >
                    {rec.action.label}
                    <ArrowRight className="w-3 h-3" aria-hidden={true} />
                  </button>
                  {rec.targetId ? (
                    <button
                      type="button"
                      onClick={() => focusModelTarget(rec.targetId!, attentionNoteForRecommendation(rec))}
                      className={`${typography.panelMeta} inline-flex items-center gap-1 rounded px-1 py-1 text-info hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                      data-testid={`${testId}-focus`}
                    >
                      <Crosshair className="w-3 h-3" aria-hidden={true} />
                      Show on canvas
                    </button>
                  ) : null}
                  {/* Sits last and reads quietly: disagreeing is a first-class
                      move, but it is not the one being recommended.

                      Offered only when the store can actually retire this id —
                      see the note on `strengthenRecords` above. */}
                  {strengthenRecords[rec.id] ? (
                  <button
                    type="button"
                    onClick={() => {
                      dismiss(rec.id)
                      showUndo({ id: rec.id, title: rec.title })
                    }}
                    className={`${typography.panelMeta} ml-auto inline-flex items-center rounded px-1 py-1 text-text-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                    data-testid={`${testId}-dismiss`}
                  >
                    {STRENGTHEN_COPY.notRelevant}
                  </button>
                  ) : null}
                </div>

                {rec.sourceLine ? (
                  <p
                    className={`${typography.panelMeta} text-text-light mt-1.5 mb-0`}
                    data-testid={`${testId}-source`}
                  >
                    {rec.sourceLine}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </SectionShell>
  )
}
