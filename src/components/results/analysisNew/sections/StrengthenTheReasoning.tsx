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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { useStrengthenStore, selectHistory } from '../../../../canvas/stores/strengthenStore'

export interface StrengthenTheReasoningProps {
  interventions: Recommendation[]
  /**
   * Producer DSK attestation keyed by recommendation id. SPARSE BY DESIGN —
   * an absent key means the producer attested nothing for that intervention,
   * and the row then carries no grounding badge at all.
   */
  scienceGrounding?: Record<string, ScienceGrounding>
  /**
   * Rows shown before "Show N more". Absent = show all.
   *
   * ⚠ THIS USED TO BE A SLICE IN THE VIEW MODEL, which meant the remainder
   * never arrived here and the section could not disclose it. On a measured
   * staging run eight recommendations were active and five were unreachable.
   * A preview is a presentation choice and belongs at the mount; a cap is a
   * claim about what exists, and this section was never entitled to make one.
   */
  preview?: number
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
  preview,
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
  const dispute = useStrengthenStore((st) => st.dispute)
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
  /**
   * ⚠ SUBSCRIBED EVEN THOUGH `selectHistory` DOES NOT READ IT TODAY. Its
   * signature asks for both halves of the state; handing it `[]` for the half
   * it currently ignores would work until the day it stops ignoring it, and
   * then fail silently (trap 12). Cheap to be correct now.
   */
  const priorityOrder = useStrengthenStore((st) => st.priorityOrder)
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

  /**
   * ⭐⭐ THE TRAIL. "A living representation of the team's reasoning" implies
   * history: what was raised, what was worked through, what was set aside and
   * why. That trail is RECORDED — the store stamps every transition, and
   * `addressed`/`restored` carry a `whatChanged` — and the legacy Strengthen
   * panel renders it. This surface did not, so consolidating onto it would
   * have silently dropped the one part of the model that is not a snapshot.
   *
   * ⚠ AND THE RESTORE IS NOT DECORATION. The undo notice above expires after
   * `NOTICE_MS`; before this, a dismissal a minute old was unreachable and
   * permanent. A record you cannot act on is an archive, not a trail.
   */
  /**
   * ⭐⭐ DISAGREEMENT NEEDED SOMEWHERE TO LIVE, AND HAD NOWHERE.
   *
   * The only response this panel offered to "I think this is wrong" was
   * "Not relevant", which retires the card. A reasoning act became a
   * disappearance, and the reason went unrecorded — while disagreement is
   * precisely where a team's first real insight usually surfaces.
   *
   * `disputingId` is the card with the box open; at most one at a time, because
   * two open composers in a 278px column is not a thing anyone can use.
   */
  const [disputingId, setDisputingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const openDispute = useCallback((id: string, existing: string) => {
    setDisputingId(id)
    setDraft(existing)
  }, [])

  const commitDispute = useCallback(
    (id: string) => {
      // The store no-ops on an empty reason; closing without recording is the
      // honest outcome, not a silent empty entry.
      dispute(id, draft)
      setDisputingId(null)
      setDraft('')
    },
    [dispute, draft],
  )

  const retired = useMemo(
    () => selectHistory({ records: strengthenRecords, priorityOrder }),
    [strengthenRecords, priorityOrder],
  )
  const [historyOpen, setHistoryOpen] = useState(false)

  /**
   * ⚠ THE COUNT ON THE COLLAPSED HEADER IS THE FULL LIST, NOT THE PREVIEW.
   * `SectionShell` already receives `interventions.length`, so a reader who
   * never opens the section still sees how many findings there are — and the
   * number they then meet inside must reconcile with it. Previewing without
   * disclosing the remainder is how "Strengthen the reasoning (8)" came to
   * open onto three rows and nothing else.
   */
  const [expanded, setExpanded] = useState(false)
  const limit = preview ?? interventions.length
  const visible = expanded ? interventions : interventions.slice(0, limit)
  const hidden = interventions.length - visible.length

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
          {visible.map((rec) => {
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
            /**
             * ⚠ THE LATEST DISPUTE, NOT ANY DISPUTE. A user who revises what
             * they said should see what they now think, not the first thing
             * they typed — so this scans BACKWARDS and stops at the first hit.
             */
            const record = strengthenRecords[rec.id]
            const standingDispute = record
              ? [...record.history].reverse().find((e) => e.event === 'disputed')?.disputeReason
              : undefined
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
                  {/* ⚠ THIS COMMENT USED TO CALL THIS BUTTON "disagreeing".
                      It is not. "Not relevant" says this finding does not apply
                      to me; "I disagree" says it is wrong, and here is why. The
                      first retires the card, the second keeps it and attaches a
                      position to it. One name for both is exactly how the panel
                      came to offer only deletion. Both are offered now, and both
                      need the store to hold this id — see `strengthenRecords`. */}
                  {record ? (
                    <button
                      type="button"
                      onClick={() => openDispute(rec.id, standingDispute ?? '')}
                      className={`${typography.panelMeta} ml-auto inline-flex items-center rounded px-1 py-1 text-text-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                      data-testid={`${testId}-disagree`}
                    >
                      {standingDispute ? COPY.dissent.edit : COPY.dissent.open}
                    </button>
                  ) : null}
                  {record ? (
                  <button
                    type="button"
                    onClick={() => {
                      dismiss(rec.id)
                      showUndo({ id: rec.id, title: rec.title })
                    }}
                    className={`${typography.panelMeta} inline-flex items-center rounded px-1 py-1 text-text-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                    data-testid={`${testId}-dismiss`}
                  >
                    {STRENGTHEN_COPY.notRelevant}
                  </button>
                  ) : null}
                </div>

                {/* ⭐ THE OBJECTION STAYS ON THE CARD. It is not a note filed
                    elsewhere and it is not a chat message that scrolls away —
                    the finding and the reason it is contested are read
                    together, which is the whole point. */}
                {disputingId === rec.id ? (
                  <div className="mt-1.5" data-testid={`${testId}-disagree-form`}>
                    <label
                      className={`${typography.panelMeta} block text-text-light mb-1`}
                      htmlFor={`${testId}-disagree-input-${rec.id}`}
                    >
                      {COPY.dissent.prompt}
                    </label>
                    <textarea
                      id={`${testId}-disagree-input-${rec.id}`}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={2}
                      className={`${typography.panelBody} w-full rounded border border-panel-border bg-panel-hover px-2 py-1 text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                      data-testid={`${testId}-disagree-input`}
                    />
                    <div className="mt-1 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => commitDispute(rec.id)}
                        className={`${typography.panelMeta} rounded text-info hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                        data-testid={`${testId}-disagree-save`}
                      >
                        {COPY.dissent.save}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDisputingId(null)
                          setDraft('')
                        }}
                        className={`${typography.panelMeta} rounded text-text-light hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                        data-testid={`${testId}-disagree-cancel`}
                      >
                        {COPY.dissent.cancel}
                      </button>
                    </div>
                  </div>
                ) : standingDispute ? (
                  <p
                    className={`${typography.panelBody} mt-1.5 mb-0 rounded border-l-2 border-attention/60 bg-panel-hover px-2 py-1 text-text-body`}
                    data-testid={`${testId}-disagreement`}
                    data-recommendation-id={rec.id}
                  >
                    <span className={`${typography.panelMeta} text-text-light`}>
                      {COPY.dissent.standing}:{' '}
                    </span>
                    {standingDispute}
                  </p>
                ) : null}

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

      {/* ⭐ THE TAIL IS REACHABLE, AND IT SAYS HOW LONG IT IS. Same control,
          same copy constants and same testid convention as every sibling
          section (`AnalysisNewSection`), because a reader should not have to
          learn a second disclosure idiom inside one panel. */}
      {hidden > 0 || expanded ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={`${typography.panelMeta} text-info underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info mt-2`}
          data-testid={`${testId}-show-more`}
        >
          {expanded ? COPY.disclosure.collapse : COPY.disclosure.moreStrengthen(hidden)}
        </button>
      ) : null}

      {/* ⚠ OFFERED ONLY WHEN THERE IS A TRAIL. A toggle that opens onto
          "Nothing addressed yet" is furniture advertising an empty room — the
          legacy panel can afford it because it is always mounted; a section
          that is itself collapsible cannot. */}
      {retired.length > 0 ? (
        <div className="mt-2 border-t border-panel-border pt-2">
          <button
            type="button"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((v) => !v)}
            className={`${typography.panelMeta} text-text-light hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            data-testid={`${testId}-history-toggle`}
          >
            {STRENGTHEN_COPY.historyToggle} ({retired.length})
          </button>

          {historyOpen ? (
            <ul
              className="mt-1.5 space-y-1.5 list-none p-0 m-0"
              data-testid={`${testId}-history`}
            >
              {retired.map((record) => {
                const last = record.history[record.history.length - 1]
                return (
                  <li
                    key={record.id}
                    className="flex items-start gap-2"
                    data-testid={`${testId}-history-item`}
                    data-recommendation-id={record.id}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={`${typography.panelBody} text-text-body m-0`}>
                        {record.snapshot.title}
                      </p>
                      {/* ⚠ THE PRODUCER'S OWN `whatChanged` WHEN THERE IS ONE,
                          and a bare statement of the outcome when there is not.
                          Never "Addressed: undefined", and never a sentence
                          about a change nobody recorded. */}
                      <p className={`${typography.panelMeta} text-text-light m-0`}>
                        {record.status === 'dismissed'
                          ? STRENGTHEN_COPY.historyDismissed
                          : last?.whatChanged
                            ? `${STRENGTHEN_COPY.historyAddressed}: ${last.whatChanged}.`
                            : `${STRENGTHEN_COPY.historyAddressed}.`}
                      </p>
                    </div>
                    {record.status === 'dismissed' ? (
                      <button
                        type="button"
                        onClick={() => restoreDismissed(record.id)}
                        className={`${typography.panelMeta} flex-none text-info hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                        data-testid={`${testId}-history-restore`}
                      >
                        {STRENGTHEN_COPY.undo}
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </SectionShell>
  )
}
