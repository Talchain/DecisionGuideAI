/**
 * EdgeAdvancedEditor — structured technical detail for edges.
 * Groups: Effect parameters, Structural uncertainty, Metadata.
 * All edits flow through useEdgeMutations.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../../store'
import { resolveEdgeValueDisplay } from '../../../domain/edgeValueProvenance'
import { METRIC_UNSET } from '../../../nodes/shared/metricVocabulary'
import { useEdgeMutations } from '../useInspectorMutations'
import { EDGE_COPY } from '../inspectorStrings'
import { typography } from '../../../../styles/typography'
import { AdvancedField } from '../shared/AdvancedField'
import { AdvancedFieldGroup } from '../shared/AdvancedFieldGroup'
import { AdvancedWarningPill } from '../shared/AdvancedWarningPill'

/**
 * Which of `EdgePanel`'s three link classes this editor is rendering under.
 *
 * ⚠ SUPPLIED BY THE CALLER ON PURPOSE — this editor does NOT re-derive it.
 * `EdgePanel` already owns the derivation (`sourceKind`/`targetKind`, EdgePanel
 * .tsx:180-181) and uses it to choose which notice to render. Deriving it a
 * second time here would create a second semantic owner for one question, and
 * the two would drift (trap 21: two authorities answering what looks like the
 * same question, disagreeing on a reachable class, neither one wrong in
 * isolation). The prop is REQUIRED, not defaulted, so a future call site is a
 * type error rather than a silent `'causal'`.
 */
export type EdgeLinkKind = 'causal' | 'organisational' | 'intervention'

interface EdgeAdvancedEditorProps {
  edgeId: string
  linkKind: EdgeLinkKind
}

/**
 * The field definitions, named ONCE each.
 *
 * Every numeric field below renders its helper text on two branches — set and
 * unset — and a definition typed twice is a hand-maintained mirror (CLAUDE.md
 * trap 12) inside a component whose whole job is to be precise about numbers.
 * The unset branch DERIVES its copy from these, so a rewording cannot leave the
 * two branches defining the same quantity differently.
 */
const BETA_DEFINITION = 'Signed causal effect size. Positive = same direction.'
const SIGMA_DEFINITION = 'Std dev of the effect estimate. Higher = less certain.'
const EXISTENCE_DEFINITION = 'Bernoulli probability that this causal link exists.'

/**
 * ⭐⭐ WHAT AN UNSET EDITABLE NUMBER SAYS — one shape, three fields.
 *
 * The state has to reach BOTH channels or it reaches half the users: the
 * placeholder is what a sighted person sees in the empty box, and the helper
 * text is what `aria-describedby` announces (`AdvancedField.tsx:186`). A
 * placeholder alone would leave a screen-reader user with a silent empty field
 * and no way to tell "nobody has said" from "the panel is broken".
 *
 * ⛔ THE WORDS ARE `METRIC_UNSET`'s, NOT THIS FILE'S. Three other surfaces on
 * this same edge already say "Not set yet" — the existence readout and the
 * uncertainty readout in `EdgePanel` (`:922`, `:976`) and the metric rows on
 * the cards. Minting a fourth phrasing here would give one state two names on
 * one screen, which is the defect this fix exists to close, one level down.
 */
function unsetHelper(definition: string): string {
  return `${METRIC_UNSET.standalone} — ${definition}`
}

export function EdgeAdvancedEditor({ edgeId, linkKind }: EdgeAdvancedEditorProps) {
  const edge = useCanvasStore(s => s.edges.find(e => e.id === edgeId))
  const mutations = useEdgeMutations(edgeId)

  const direction = edge?.data?.direction ?? 'positive'
  const edgeLabel = (edge?.data as Record<string, unknown>)?.label as string | undefined
  const provenance = (edge?.data as Record<string, unknown>)?.provenance as string | undefined

  /**
   * ⭐⭐ THE SAME GATE THE REST OF THE ESTATE ALREADY USES — this file was the
   * last surface reading these three fields RAW.
   *
   * What it was doing, and why it is the worst instance of the family rather
   * than a late straggler:
   *
   *   · `beliefExists ?? EDGE_CONSTRAINTS.beliefExists.default` printed **0.7**
   *     under "Existence probability", beside a formal definition, on the one
   *     surface a person opens BECAUSE they want the numbers. Two inches up the
   *     same open panel, `EdgePanel:922` prints the same edge's existence as
   *     "Not set yet". One edge, one quantity, two verdicts, one screen — and
   *     the reader resolves the contradiction the wrong way round, because the
   *     figure under the technical heading looks like the held value and the
   *     "Not set yet" looks like the display being coy.
   *   · `strengthStd ?? 0.15` printed a standard deviation nobody supplied.
   *     `USER_EDGE_DEFAULTS.strengthStd` fabricates that 0.15 on every
   *     hand-drawn edge, and the same field is already gated on the line
   *     (`StyledEdge.tsx:1229`) and in the panel (`EdgePanel:368`).
   *   · `weight ?? 0.5` — A DIFFERENT QUESTION, named apart below.
   *
   * ⛔⛔ AND THE PART THAT MAKES IT LAUNDERING RATHER THAN MERELY WRONG. These
   * fields are EDITABLE. `AdvancedField` commits on BLUR, so a user who clicked
   * in, read 0.7, and tabbed out unchanged committed `setExistsProbability(0.7)`
   * — which stamps `beliefExistsSource: 'user'` (`useInspectorMutations:794`).
   * A fabricated UI constant became a provenance-stamped human claim, and every
   * correctly-gated sibling surface then displayed it faithfully as 70%. The
   * gates elsewhere made that WORSE, not better: they are what lends the
   * laundered number its authority.
   *
   * That path is closed HERE by handing the field `undefined` rather than a
   * number — an empty numeric entry cannot be admitted
   * (`admitNumericField('')` → `NOT_FINITE`), so blur commits nothing — and
   * closed in `AdvancedField` by refusing to SCOLD for an empty blur, which is
   * what makes "unset" a state an editable numeric field can actually be in.
   * Both halves are needed: without the first the default still commits;
   * without the second every unset field would accuse the reader of a typo.
   */
  const existenceDisplay = useMemo(
    () => resolveEdgeValueDisplay(edge?.data as Record<string, unknown> | undefined, 'beliefExists'),
    [edge?.data],
  )
  const stdDisplay = useMemo(
    () => resolveEdgeValueDisplay(edge?.data as Record<string, unknown> | undefined, 'strengthStd'),
    [edge?.data],
  )
  /**
   * ⛔ β IS NOT THE SAME QUESTION AS THE TWO ABOVE, AND IT IS GATED SEPARATELY
   * BECAUSE OF IT (CLAUDE.md trap 21 — this branch already names the EdgePanel
   * pair apart for the same reason).
   *
   * σ asks *how uncertain is this?* and existence asks *is the link there at
   * all?*. β asks *how big, and which way?* — a magnitude and a sign. They
   * default independently (`weight` 0.3/0.5, `strengthStd` 0.15,
   * `beliefExists` 0.7/0.8), they are stamped independently (`weightSource` vs
   * `strengthStdSource` vs `beliefExistsSource`), and an edge can genuinely
   * carry one without the others. Folding them into one gate would make an edge
   * with a stated strength and no stated spread say nothing about either.
   *
   * ⚠ THE MAGNITUDE IS GATED HERE; THE SIGN IS NOT, AND THAT IS STATED RATHER
   * THAN GLOSSED. `direction` also defaults (`USER_EDGE_DEFAULTS.direction:
   * 'positive'`) and has its own owner, `resolveEdgeDirectionDisplay`. Routing
   * the sign through it would also mean gating the "Effect direction" select
   * beside this field, which is a fourth field this change does not name.
   * Reported and rowed instead of half-done. What this gate does guarantee is
   * that where the MAGNITUDE is unstamped, no signed number is printed at all.
   *
   * ⚠ WHY `resolveEdgeValueDisplay(data, 'weight')` AND NOT
   * `resolveEdgeSignedStrengthDisplay`, which is the panel's own strength
   * owner: that resolver PREFERS `strength_mean` when present, and
   * `setStrength` writes `weight` and never `strength_mean`. Hanging an
   * editable field on it would re-render the CEE figure over the user's own
   * entry the moment the store updated — the edit would look discarded. The
   * signed composition below is byte-for-byte what this file already did, so a
   * stamped edge renders exactly the number it rendered before.
   */
  const betaDisplay = useMemo(
    () => resolveEdgeValueDisplay(edge?.data as Record<string, unknown> | undefined, 'weight'),
    [edge?.data],
  )
  const signedMean = betaDisplay.show
    ? (direction === 'negative' ? -betaDisplay.value : betaDisplay.value)
    : undefined

  // CIL warnings from pipeline + provenance-derived defaults
  const cilWarnings = useMemo(() => {
    const warnings = [...((edge?.data as Record<string, unknown>)?.cil_warnings as string[] ?? [])]
    // Add STRENGTH_DEFAULT_APPLIED when edge uses default provenance
    if (!provenance || provenance === 'default' || provenance === 'brief_extraction') {
      if (!warnings.includes('STRENGTH_DEFAULT_APPLIED')) {
        warnings.push('STRENGTH_DEFAULT_APPLIED')
      }
    }
    return warnings
  }, [edge?.data, provenance])

  if (!edge) return null

  return (
    <div className="space-y-1">
      <AdvancedFieldGroup title="Effect parameters">
        <AdvancedField
          label="Effect coefficient (β)"
          value={signedMean === undefined ? undefined : Number(signedMean.toFixed(4))}
          onChange={v => mutations.setStrength(v as number)}
          type="number"
          min={-1}
          max={1}
          step={0.01}
          /* ⛔ The placeholder REPLACES the `[-1, 1]` range hint only while the
             value is unset (`AdvancedField.tsx:153-155`). A range hint in an
             empty box reads as "type something here"; it does not say that
             nobody has. When the value is set the range hint returns. */
          placeholder={betaDisplay.show ? undefined : METRIC_UNSET.standalone}
          helperText={betaDisplay.show ? BETA_DEFINITION : unsetHelper(BETA_DEFINITION)}
        />
        {/* ⛔ DO NOT "FIX" THIS BY HIDING OR DISABLING THE FIELD ABOVE. The
            no-hiding ruling applies: the coefficient is real, it is stored, and
            a user is entitled to see and change it. What was wrong was the
            claim around it, so the claim is what changes.

            ⚠⚠ THIS CAVEAT SHIPS DARK, AND THAT IS RECORDED HERE ON PURPOSE
            (30 Aug 2026). It is not merely that β cannot be EDITED — β cannot
            be VIEWED. This editor renders only inside `EdgePanel`'s
            `TechnicalDisclosure`, which starts COLLAPSED
            (`TechnicalDisclosure.tsx:24`, `useState(false)`) and is opened by
            a `<button>` — and that button sits inside the unconditional
            `<fieldset disabled>` that `InspectorRouter` wraps every panel in
            (`InspectorRouter.tsx:221-233`). A disabled fieldset disables
            descendant buttons, so the disclosure cannot be opened and nothing
            below it ever reaches a user.
            MEASURED IN REAL CHROMIUM, not inferred: a button inside
            `<fieldset disabled>` fired its handler 0 times; the contrast
            control outside the fieldset fired 1. `display: contents` on the
            fieldset does not rescue it.
            ⚠ jsdom CANNOT SETTLE THIS — it does not propagate fieldset
            disabled-ness to `.disabled`, and the spec beside this file renders
            `EdgePanel` DIRECTLY, bypassing the fieldset. So a green suite here
            is evidence about the COMPONENT and says nothing about the product.
            STATUS: this caveat is CODE EXISTS + TESTED, and DARK — it becomes
            user-visible the moment the read-only fieldset lifts, and that is
            the follow-up this comment exists to brief. The sibling half of
            this fix, the intervention notice in `EdgePanel`, is OUTSIDE all of
            this gating and IS reachable (rung: MOUNTED).

            ⚠⚠ THE FIELDSET HAS LIFTED — THE PARAGRAPH ABOVE IS STALE FOR THE
            EDGE BRANCH, AND THE FOLLOW-UP IT BRIEFS IS NOW DUE (derived at
            this tip, 18 Sep 2026, by reading the three files; NOT driven, so
            the rung below is MOUNTED and not JOURNEY-WITNESSED).
            `InspectorRouter.tsx:299-313` now carries the opposite note in
            terms — *"NO BLANKET FENCE HERE ANY MORE, AND THAT IS THE CHANGE …
            this branch used to wrap the whole panel in `<fieldset disabled>`"*
            — and the edge branch renders `<EdgePanel>` with no disabled
            fieldset ancestor. EdgePanel now fences its OWN carrier-less
            writers instead (`:890-980`), and BOTH `<EdgeAdvancedEditor>`
            mounts (`EdgePanel.tsx:1026`, `:1034`) sit AFTER that fieldset
            closes. So the disclosure button is reachable and everything below
            it renders; what still gates this editor is `techMode` alone
            (`TechnicalDisclosure visible={techMode}`, still `useState(false)`
            so still collapsed by default).
            ⭐ THIS IS WHY THE PROVENANCE GATE ABOVE IS NOT HOUSEKEEPING. The
            blur-commit path that launders a UI default into a
            `'user'`-stamped claim was unreachable under the old fieldset and
            is reachable now. A stale "this is dark" comment is exactly how a
            fabrication survives the sweep that would otherwise have caught it
            — which is why this correction is written FORWARD rather than by
            deleting the paragraph it corrects. */}
        {linkKind === 'intervention' && (
          <p
            data-testid="edge-beta-inert-on-intervention"
            // `typography.panelMeta` is set EXPLICITLY, like every sibling in
            // this group. It previously inherited 11px by cascade and was the
            // only element in the slot relying on that.
            className={`${typography.panelMeta} text-warning mt-0.5`}
          >
            {EDGE_COPY.interventionStrengthInert}
          </p>
        )}
        <AdvancedField
          label="Epistemic uncertainty (σ)"
          value={stdDisplay.show ? Number(stdDisplay.value.toFixed(4)) : undefined}
          onChange={v => mutations.setStd(v as number)}
          type="number"
          min={0.01}
          max={0.5}
          step={0.01}
          placeholder={stdDisplay.show ? undefined : METRIC_UNSET.standalone}
          helperText={stdDisplay.show ? SIGMA_DEFINITION : unsetHelper(SIGMA_DEFINITION)}
        />
        <AdvancedField
          label="Effect direction"
          value={direction}
          onChange={v => mutations.setDirection(v as 'positive' | 'negative')}
          type="select"
          options={[
            { value: 'positive', label: 'positive' },
            { value: 'negative', label: 'negative' },
          ]}
        />
      </AdvancedFieldGroup>

      <AdvancedFieldGroup title="Structural uncertainty">
        <AdvancedField
          label="Existence probability"
          value={existenceDisplay.show ? Number(existenceDisplay.value.toFixed(4)) : undefined}
          onChange={v => mutations.setExistsProbability(v as number)}
          type="number"
          min={0.01}
          max={1}
          step={0.01}
          placeholder={existenceDisplay.show ? undefined : METRIC_UNSET.standalone}
          helperText={
            existenceDisplay.show ? EXISTENCE_DEFINITION : unsetHelper(EXISTENCE_DEFINITION)
          }
        />
      </AdvancedFieldGroup>

      <AdvancedFieldGroup title="Metadata">
        <AdvancedField
          label="Edge key"
          value={`${edge.source}→${edge.target}`}
          type="readonly"
        />
        <AdvancedField
          label="Relationship description"
          value={edgeLabel ?? ''}
          onChange={v => mutations.setLabel(v as string)}
          type="text"
          placeholder="Describe the causal mechanism"
        />
      </AdvancedFieldGroup>

      {cilWarnings.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {cilWarnings.map((w, i) => (
            <AdvancedWarningPill key={i} text={w} />
          ))}
        </div>
      )}
    </div>
  )
}
