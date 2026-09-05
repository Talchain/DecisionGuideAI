/**
 * Model tab v2 — THE DETAIL REGION (design §4.4).
 *
 * MOUNTED since the 16 Aug 2026 mount train, via `ModelTabV2Panel`. See
 * `types.ts`.
 *
 * WHAT IT REPLACES. Today reaching an edge's detail costs THREE nested
 * disclosures — the section accordion, then a per-card `cardExpanded` toggled by
 * clicking the card body with NO CHEVRON AND NO VISIBLE AFFORDANCE, then the
 * global `showDetail` whose control lives outside the tab in the dock chrome
 * (design §2 F7). Selection replaces the middle one entirely, so the axes drop
 * from three to two: group open/closed, and selection. The invisible axis is the
 * one being deleted, and it is invisible by design accident, not by intent.
 *
 * TWO PROPERTIES THIS FILE EXISTS TO GUARANTEE:
 *
 * 1. THE ADVANCED BLOCK IS ABSENT FROM THE DOM IN PLAIN — not hidden, not
 *    `display:none`, not zero-height. A parameter that is merely invisible is
 *    still findable, still copyable, still read by a screen reader, and still
 *    there to be mistaken for a plain value the moment a stylesheet changes.
 *    "Flip one switch and see none of them" (design §12) is a claim about what
 *    EXISTS, and it is enforced here by not rendering the subtree at all.
 *
 * 2. IT REFUSES TO RENDER SOMEBODY ELSE'S DETAIL. `detail.rowId` must equal the
 *    row it was asked to describe. On a mismatch it says so, loudly, instead of
 *    painting a confident and wrong pane — see `ModelRowDetail.rowId`.
 */

import { typography } from '../../styles/typography'
import { EDIT_RESERVED_HEIGHT_CLASS } from './valueCellMetrics'
import { SourceProvenancePill } from '../components/model-tab/SourceProvenancePill'
import { RELATIONSHIP_LABEL_SEPARATOR } from './adapters'
import {
  classifyInterventionProvenance,
  type ValueProvenanceKind,
} from '../domain/valueProvenance'
import { KIND_LABEL } from './rowPresentation'
import type { DetailField, DetailTier, ModelRow, ModelRowDetail } from './types'

/**
 * ⭐ WHO CHOSE THIS TARGET — this surface's register, TOTAL over the kind.
 *
 * ⚠ A SECOND REGISTER, AND THAT IS THE RATIFIED SHAPE, NOT A TRAP-12 MIRROR.
 * `valueProvenance` owns the KIND and says so in its own header: *"This module
 * owns the kind. Each surface keeps its own register (the Model tab is terse,
 * the inspector writes sentences) but must be TOTAL over `ValueProvenanceKind`
 * — a `Record<ValueProvenanceKind, …>` makes a missing kind a type error rather
 * than a silent fallback."* A new kind cannot land here unlabelled.
 *
 * ⚠ WHY NOT `SourceProvenancePill`, WHICH SITS TEN LINES BELOW. That component
 * takes a raw LITERAL and classifies it with `classifyValueProvenance` — the
 * NODE `observed_state.source` vocabulary. An intervention's `source` is a
 * different, three-member vocabulary wearing the same field name (see
 * `valueProvenance`), so handing it `'cee_hypothesis'` renders **"Not set"** —
 * a claim about the value, over a value that is set. The wording is kept
 * identical to the pill's on purpose: same tab, same register, one voice.
 */
const INTERVENTION_PROVENANCE_LABEL: Record<ValueProvenanceKind, string> = {
  brief: 'From brief',
  ai: 'AI estimate',
  confirmed: 'Confirmed by you',
  edited: 'User edited',
  assumption: 'Your assumption',
  human: 'Set by you',
  panel: 'From your panel',
}

const INTERVENTION_PROVENANCE_BORDER: Record<ValueProvenanceKind, string> = {
  brief: 'border-info/30',
  ai: 'border-warning/30',
  confirmed: 'border-success/30',
  edited: 'border-success/30',
  assumption: 'border-success/30',
  human: 'border-success/30',
  panel: 'border-info/30',
}

/**
 * The mark that sits beside an intervention's number.
 *
 * ⚠ RENDERS **NOTHING** WHEN THE RECORD DOES NOT SAY. Not "Not set", not a
 * neutral pill, not a dash. An unrecorded provenance is unknown, and unknown
 * stays unknown — a default in any direction is an invented provenance, which
 * is the defect one level up from the one this component closes.
 */
function InterventionProvenanceMark({ source }: { source: string | undefined }) {
  const cls = classifyInterventionProvenance(source)
  if (cls === null) return null
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full bg-transparent border ${INTERVENTION_PROVENANCE_BORDER[cls.kind]} text-text-body ${typography.panelMeta}`}
    >
      {INTERVENTION_PROVENANCE_LABEL[cls.kind]}
    </span>
  )
}

export interface ModelDetailRegionProps {
  row: ModelRow
  detail: ModelRowDetail
  tier: DetailTier
  onFocusOnCanvas?: (id: string) => void
  /**
   * The intervention currently being edited, if any — OWNED BY THE HOST.
   *
   * ⚠ THIS COMPONENT HOLDS NO EDIT STATE, deliberately. The panel owns "the one
   * active edit" for the whole surface, which is what stops the outline and the
   * detail region each believing they have one. `factorId` identifies the row
   * BY IDENTITY, never by position in the list (trap 19).
   */
  interventionEdit?: { factorId: string; draft: string } | null
  /** Begin editing one intervention target. Absent ⇒ the list is read-only. */
  onBeginInterventionEdit?: (factorId: string, seed: string) => void
  onInterventionDraftChange?: (factorId: string, draft: string) => void
  /** Commit the draft through the write authority. */
  onCommitIntervention?: (factorId: string) => void
  onDiscardInterventionEdit?: () => void
}

/**
 * Would "Where it came from" have anything under its heading?
 *
 * ⚠ ONE PREDICATE, MIRRORING THE THREE CHILDREN EXACTLY. Written as a separate
 * function so the mirror is visible: if a fourth child is ever added to that
 * section and not added here, the section can render empty again — which is the
 * defect this predicate closes, wearing a fourth condition.
 */
function hasProvenanceContent(
  provenanceSource: string | undefined,
  detail: ModelRowDetail,
): boolean {
  const pillWouldRender = typeof provenanceSource === 'string' && provenanceSource !== ''
  return pillWouldRender || detail.basis !== null || detail.adjustments.length > 0
}

/** Absence is rendered as absence — never as a zero, never as a blank cell. */
function FieldList({ fields, testid }: { fields: readonly DetailField[]; testid: string }) {
  if (fields.length === 0) return null
  return (
    <dl data-testid={testid} className="grid grid-cols-2 gap-x-3 gap-y-1">
      {fields.map(f => (
        <div key={f.label} className="contents">
          <dt className={`${typography.panelBody} text-text-light`}>{f.label}</dt>
          <dd
            data-testid={`${testid}-${f.label}`}
            className={`${typography.panelTabular} text-text-body`}
          >
            {f.value ?? 'Not stated'}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function ModelDetailRegion({
  row,
  detail,
  tier,
  onFocusOnCanvas,
  interventionEdit = null,
  onBeginInterventionEdit,
  onInterventionDraftChange,
  onCommitIntervention,
  onDiscardInterventionEdit,
}: ModelDetailRegionProps) {
  /**
   * ⚠ THE QUESTION IS "WAS THIS TITLE DERIVED AS `from → to`?", NOT
   * "DOES THE TITLE CONTAIN THIS STRING?" — and the difference was measured.
   * A substring match produced FIVE false suppressions over a ten-case corpus
   * ("Cost" inside "Costs", "Revenue" inside "Revenue Growth Rate",
   * "Capacity" inside "Team Capacity"), and a word-boundary match does not
   * rescue it because "Revenue Growth Rate" contains "Revenue" as a whole
   * word. That is where a predicate over text stops being winnable — this
   * estate has watched one oscillate through four rounds — so the test is
   * structural instead: the derived form ENDS WITH the shared separator plus
   * the target's label, by construction. Same corpus: 10/10, zero false
   * suppressions, and it fails in the SAFE direction (keeps the heading)
   * whenever the format differs at all. Written as a containment check against the row's own rendered
   * label rather than as `kind === 'relationship'`, because a producer-named
   * relationship does NOT name its target in the title and genuinely needs the
   * section. Deriving it from the label keeps the two in step even if
   * `relationshipLabel` changes shape — the predicate reads the same string
   * the user is looking at.
   */
  const affectsRestatesTheTitle =
    detail !== null &&
    detail.affects.length === 1 &&
    detail.affects[0] !== undefined &&
    row.label.endsWith(`${RELATIONSHIP_LABEL_SEPARATOR}${detail.affects[0].label}`)
  /*
   * The identity gate. This is deliberately a VISIBLE refusal rather than a
   * silent `return null`: a detail region that quietly vanishes looks like a
   * rendering bug and gets "fixed" by removing the check, whereas a stated
   * mismatch names the defect for whoever sees it.
   */
  /*
   * ⚠ READ DEFENSIVELY EVEN THOUGH THE TYPE SAYS IT IS REQUIRED (preamble P1).
   *
   * `interventions` is not optional in `ModelRowDetail`, so a producer that
   * omits it is a contract break — and the type keeps obliging producers. But
   * the SEAM ONE PAST THAT GUARD is this render, and `detail.interventions.length`
   * on an absent array throws during render and takes the WHOLE pane with it:
   * the element's name, its value, its provenance and its "what it affects"
   * list all disappear because one list is missing. That is #746's exact shape —
   * malformity must cost the citation, never the attribution.
   *
   * Proven, not assumed: twelve existing tests in this file went RED the moment
   * the field was added, all of them on payloads built before it existed, and
   * every one of them was asserting something ELSE about the pane.
   */
  const interventions = detail.interventions ?? []

  if (detail.rowId !== row.id) {
    return (
      <aside data-testid="model-detail-v2" data-mismatch="true">
        <p data-testid="model-detail-v2-mismatch" className={`${typography.panelBody} text-danger`}>
          This panel was given details for a different element, so it has not shown them.
        </p>
      </aside>
    )
  }

  return (
    <aside
      data-testid="model-detail-v2"
      data-row-id={row.id}
      data-tier={tier}
      aria-label={`${KIND_LABEL[row.kind]} details: ${row.label}`}
      className="flex flex-col gap-3 p-3"
    >
      {/* 1 — What this is */}
      <section data-testid="model-detail-v2-what">
        <h3 className={`${typography.panelHeader} text-text-header`}>{row.label}</h3>
        <p className={`${typography.panelBody} text-text-light`}>{KIND_LABEL[row.kind]}</p>
        {detail.description !== null && (
          <p
            data-testid="model-detail-v2-description"
            className={`${typography.panelBody} text-text-body`}
          >
            {detail.description}
          </p>
        )}
      </section>

      {/* 2 — Its value */}
      <section data-testid="model-detail-v2-value">
        <h4 className={`${typography.panelHeader} text-text-header`}>Its value</h4>
        <p data-testid="model-detail-v2-primary" className={`${typography.panelTabular} text-text-body`}>
          {row.primaryValue ?? 'Not set'}
        </p>
        <FieldList fields={detail.secondaryValues} testid="model-detail-v2-secondary" />
      </section>

      {/*
        2b — What this option would change (rehomed from `OptionsSection`'s
        intervention rows, 18 Aug 2026).

        ⚠ IT RENDERS ONLY WHEN THERE IS SOMETHING TO SHOW. An option that sets
        no targets reports that through its ROW's `missing-intervention` marker
        and the repair queue that collects it — an empty section here would be a
        second, quieter rendering of the same fact, and the two would then have
        to be kept in step.
      */}
      {interventions.length > 0 && (
        <section data-testid="model-detail-v2-interventions">
          <h4 className={`${typography.panelHeader} text-text-header`}>What this would change</h4>
          <ul>
            {interventions.map(iv => {
              const editing = interventionEdit?.factorId === iv.factorId
              const editable = typeof onBeginInterventionEdit === 'function'
              return (
                <li
                  key={iv.factorId}
                  data-testid={`model-detail-v2-intervention-${iv.factorId}`}
                  className="flex items-center gap-2 py-0.5"
                >
                  {/*
                    ⚠ THE FACTOR'S NAME, NEVER ITS ID. The projection drops any
                    entry it cannot name, so there is no `?? factorId` fallback
                    to leak one here — see `buildOptionInterventions`.
                  */}
                  <span className={`${typography.panelBody} text-text-body flex-1 truncate`}>
                    {iv.factorLabel}
                  </span>

                  {editing ? (
                    <>
                      <input
                        type="number"
                        autoFocus
                        data-testid={`model-detail-v2-intervention-${iv.factorId}-input`}
                        aria-label={`Target value for ${iv.factorLabel}`}
                        value={interventionEdit.draft}
                        onChange={e => onInterventionDraftChange?.(iv.factorId, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') onCommitIntervention?.(iv.factorId)
                          if (e.key === 'Escape') onDiscardInterventionEdit?.()
                        }}
                        className={`${typography.tabular} w-24 bg-panel-hover border border-panel-border rounded px-1`}
                      />
                      <button
                        type="button"
                        data-testid={`model-detail-v2-intervention-${iv.factorId}-save`}
                        onClick={() => onCommitIntervention?.(iv.factorId)}
                        className={`${typography.buttonSmall} text-info`}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        data-testid={`model-detail-v2-intervention-${iv.factorId}-cancel`}
                        onClick={() => onDiscardInterventionEdit?.()}
                        className={`${typography.buttonSmall} text-text-light`}
                      >
                        Cancel
                      </button>
                    </>
                  ) : editable ? (
                    <button
                      type="button"
                      data-testid={`model-detail-v2-intervention-${iv.factorId}-value`}
                      title="Change this target"
                      aria-label={`Change the target for ${iv.factorLabel}`}
                      onClick={() =>
                        onBeginInterventionEdit?.(
                          iv.factorId,
                          // ⚠ SEEDS FROM `numericValue`, NEVER FROM `value`. The
                          // displayed string may be CEE-authored prose; seeding an
                          // editor from it would let a label be saved back as if the
                          // user had typed it.
                          iv.numericValue === null ? '' : String(iv.numericValue),
                        )
                      }
                      className={`${typography.panelTabular} ${EDIT_RESERVED_HEIGHT_CLASS} inline-flex items-center underline decoration-dotted`}
                    >
                      {iv.value ?? 'Not set'}
                    </button>
                  ) : (
                    <span
                      data-testid={`model-detail-v2-intervention-${iv.factorId}-value`}
                      className={`${typography.panelTabular} text-text-light`}
                    >
                      {iv.value ?? 'Not set'}
                    </span>
                  )}

                  {/*
                    ⭐ WHO CHOSE THIS NUMBER — ON THE SAME LINE AS THE NUMBER.

                    ⚠⚠ THE DEFECT THIS CLOSES (B1-a, deployed witness UI
                    `88cb7e37` · CEE `d1da670`, 2026-08-24). A target CEE had
                    invented — raw 22,500, no unit, `value_confidence: low`, its
                    own reasoning saying *"this amount is not stated in the
                    brief"* — rendered here as a bare `0.45`, in the same
                    control, the same typography and with no badge, tooltip,
                    icon or unit, directly comparable with the user's own
                    £45,000 rendered as a bare `0.9`. **The only difference
                    between a number Olumi invented and one the user wrote was
                    the digits.**

                    ⚠ INLINE, NOT IN "Where it came from" AND NOT BEHIND A
                    HOVER. A disclosure a user has to go and look for is a
                    disclosure that arrives after they have already believed the
                    number. It costs no extra interaction: it is in the same
                    glance as the figure it qualifies.

                    ⚠ IT CLASSIFIES THROUGH THE **INTERVENTION** VOCABULARY, not
                    the node one the pill below uses. `cee_hypothesis` is not an
                    `observed_state.source` literal and never was — see
                    `InterventionProvenanceMark`.

                    ⚠ NO STAMP ⇒ NOTHING RENDERS. Unknown stays unknown.
                  */}
                  <span data-testid={`model-detail-v2-intervention-${iv.factorId}-provenance`}>
                    <InterventionProvenanceMark source={iv.provenanceSource} />
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/*
        3 — Where it came from.

        ⚠ THE HEADING IS NOT RENDERED WHEN NOTHING WOULD SIT UNDER IT. On the
        deployed build (UI `88cb7e37`) this section rendered on an OPTION as a
        heading with an empty body: an option node carries no `observedState`,
        so `row.provenanceSource` is absent and `basis` is `null`, and the pane
        announced that provenance had been looked for and none exists — on the
        one element whose provenance is the finding. That is the same rule
        `FieldList` above already applies and the same rule this file states in
        its own words: absence is rendered as absence, never as a blank cell.

        ⚠ THE PREDICATE IS DERIVED FROM WHAT EACH CHILD ACTUALLY RENDERS, not
        from "is the field present". `SourceProvenancePill` with
        `showWhenAbsent={false}` renders nothing for an empty string, so a
        `provenanceSource: ''` would satisfy `!== undefined` and reproduce the
        empty heading this gate exists to remove.
      */}
      {(hasProvenanceContent(row.provenanceSource, detail)) && (
      <section data-testid="model-detail-v2-provenance">
        <h4 className={`${typography.panelHeader} text-text-header`}>Where it came from</h4>
        {row.provenanceSource !== undefined && (
          <SourceProvenancePill source={row.provenanceSource} showWhenAbsent={false} />
        )}
        {detail.basis !== null && (
          <p
            data-testid="model-detail-v2-basis"
            className={`${typography.panelBody} text-text-body`}
          >
            {detail.basis}
          </p>
        )}
        {detail.adjustments.length > 0 && (
          <ul data-testid="model-detail-v2-adjustments">
            {detail.adjustments.map(a => (
              <li key={a} className={`${typography.panelBody} text-text-light`}>
                {a}
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {/*
        4 — What it affects.

        ⭐⭐ A SECTION THAT RESTATES THE TITLE IS NOT INFORMATION.

        For a RELATIONSHIP the projection sets `affects` to exactly one entry —
        the edge's target (`adapters.ts`). And when the producer did not name
        the edge, `relationshipLabel` builds the row's own title as
        `${from} → ${to}` from the SAME `resolveCanvasLabel` call. So the panel
        rendered:

            Hit Next Launch Date → Boost Productivity     ← the row
            What it affects                               ← a 14px header
            Boost Productivity                            ← the same string

        Three lines and a section heading to repeat the second half of the
        title the reader is already looking at. Paul reported it from a manual
        test, and he was right: it is furniture, not content.

        ⚠ BUT ONLY ON THE DERIVED-LABEL PATH, WHICH IS WHY THIS IS A PREDICATE
        AND NOT `kind === 'relationship'`. When the producer DOES name the edge
        ("product gaps mediate churn"), the target appears nowhere in the title
        and this section is the only place it is stated — suppressing it there
        would delete real information. The condition therefore asks the
        question that actually matters: does the title already say this?

        The AFFORDANCE survives either way. The button is the only route from a
        relationship to its target on the canvas, so the restating case keeps
        the control and drops the claim — it states the ACTION instead of
        repeating the fact.
      */}
      <section data-testid="model-detail-v2-affects">
        {affectsRestatesTheTitle ? (
          <button
            type="button"
            data-testid={`model-detail-v2-affects-${detail.affects[0]!.id}`}
            onClick={() => onFocusOnCanvas?.(detail.affects[0]!.id)}
            className={`${typography.panelBody} text-info text-left`}
          >
            Show {detail.affects[0]!.label} on canvas
          </button>
        ) : (
          <>
        <h4 className={`${typography.panelHeader} text-text-header`}>What it affects</h4>
        {detail.affects.length === 0 ? (
          <p className={`${typography.panelBody} text-text-light`}>
            Nothing in the model depends on this yet
          </p>
        ) : (
          <ul>
            {detail.affects.map(a => (
              <li key={a.id}>
                <button
                  type="button"
                  data-testid={`model-detail-v2-affects-${a.id}`}
                  onClick={() => onFocusOnCanvas?.(a.id)}
                  className={`${typography.panelBody} text-info text-left`}
                >
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        )}
          </>
        )}
      </section>

      {/*
        5 — Advanced. ⚠ NOT RENDERED AT ALL IN PLAIN. See the header: this is an
        existence claim, not a visibility one.
      */}
      {tier === 'advanced' && (
        <section data-testid="model-detail-v2-advanced">
          <h4 className={`${typography.panelHeader} text-text-header`}>Advanced — model parameters</h4>
          {detail.advancedParameters.length === 0 ? (
            <p className={`${typography.panelBody} text-text-light`}>
              This element has no model parameters
            </p>
          ) : (
            <FieldList fields={detail.advancedParameters} testid="model-detail-v2-advanced-fields" />
          )}
        </section>
      )}
    </aside>
  )
}
