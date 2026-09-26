/**
 * Inspector v2 - centralised string table
 * All user-facing labels. Exact strings from spec §3. No deviation.
 */

import type { NodeType, FactorCategory } from '../../domain/nodes'
import { classifyValueProvenance, type ValueProvenanceKind } from '../../domain/valueProvenance'
import type { ParticipantNameResolution } from '../../../collab/participantNames'
import { DECISION_NODE_LABEL } from '../../domain/vocabulary'
import { fragileEdgeSentence } from '../../edges/connectorCopy'

// ─── Section titles (spec §3.1) ────────────────────────────────────
export const SECTION_TITLES = {
  successTarget:       { label: 'Success target',                icon: 'Target'         },
  impact:              { label: 'Impact',                        icon: 'BarChart3'      },
  whatDrivesThis:      { label: 'What drives this',              icon: 'GitBranch'      },
  options:             { label: 'Options',                       icon: 'Layers'         },
  decisionFraming:     { label: 'Decision framing',              icon: 'FileText'       },
  whatThisChanges:     { label: 'What this option changes',      icon: 'Zap'            },
  value:               { label: 'Value',                         icon: 'Gauge'          },
  whereThisComes:      { label: 'Where this comes from',         icon: 'FileSearch'     },
  yourEstimate:        { label: 'Your estimate',                 icon: 'Sliders'        },
  howStrong:           { label: 'How strong is this effect',     icon: 'Activity'       },
  doesExist:           { label: 'Does this connection exist',    icon: 'ShieldQuestion' },
  howUncertain:        { label: 'How uncertain is the strength', icon: 'Maximize2'      },
  evidence:            { label: 'Evidence',                      icon: 'FileSearch'     },
  fragility:           { label: 'Sensitive assumptions',           icon: 'AlertTriangle'  },
  connections:         { label: 'Connections',                   icon: 'GitBranch'      },
  predictedRange:      { label: 'Predicted range by option',     icon: 'BarChart3'      },
  investigationValue:  { label: 'Value of investigation',        icon: 'TrendingUp'     },
} as const

export type SectionKey = keyof typeof SECTION_TITLES

// ─── Type/pill labels (spec §3.2) ──────────────────────────────────
/**
 * The inspector's KIND label.
 *
 * ⭐ v3.1 (DESIGN-GAP-v31 row 7): "The factor kind label must read the kind
 * ('Factor'), not 'You can change this'." The label names WHAT the element is;
 * the three category phrases were claims about the element ("You can change
 * this", "You measure this", "Outside your control") sitting where the kind
 * belongs. Where a category matters, the pane says it in its body (the external
 * pane's own "Outside your control" pill is unchanged).
 *
 * `category` is still accepted so callers need not change, and ignored.
 */
export function getTypeLabel(nodeType: NodeType, _category?: FactorCategory | string): string {
  if (nodeType === 'factor') return 'Factor'
  const labels: Partial<Record<NodeType, string>> = {
    goal:       'Goal',
    decision:   DECISION_NODE_LABEL,
    option:     'Option',
    outcome:    'Outcome',
    risk:       'Risk',
    action:     'Action',
    constraint: 'Constraint',
  }
  return labels[nodeType] ?? 'Node'
}

/** Edge type label - always "Relationship" in user-facing UI */
export const EDGE_TYPE_LABEL = 'Relationship'

// ─── Badge / tooltip labels (spec §3.2) ────────────────────────────
export const BADGE_TOOLTIPS: Record<string, string> = {
  controllable: 'Your team can directly adjust this factor',
  observable:   'Your team can track this but not directly control it',
  external:     "Market conditions, competitor actions, or other forces you can't influence",
  baseline:     'What happens if you change nothing',
  explicit:     'This value was stated in your decision brief',
  inferred:     'This value was estimated because it wasn\'t stated explicitly',
}

/**
 * ROADMAP 2.638 S2 — the user-owned arm of both label functions, derived.
 *
 * These three inspector panels are DEPLOYED-MOUNTED (`USE_INSPECTOR_V2` is a
 * hardcoded `true`; no flag gates them), and before this both functions sent
 * every user-owned source they did not literally list to their DEFAULT arm:
 * `getExtractionLabel('user_confirmed')` returned **"Estimated by Olumi"** —
 * the machine claiming a number the user had explicitly confirmed — and
 * `getProvenanceLabel('user_confirmed')` leaked the raw wire literal as
 * "Source: user_confirmed".
 *
 * The map is TOTAL over `ValueProvenanceKind`: adding a kind to the canonical
 * classification is a type error here, never a silent fallback (trap 12). The
 * copy register is this surface's own — sentences, not the Model tab's terse
 * pills — which is why the kind, not the string, is what is shared.
 *
 * "Confirmed by you" states a STATUS and nothing else. Confirming does not
 * change the analysis today (that is the compute slice, S4) and the copy must
 * not imply it does.
 */
const ATTRIBUTED_LABEL: Record<ValueProvenanceKind, string | null> = {
  confirmed: 'Confirmed by you',
  edited: 'Set by you',
  assumption: 'Your assumption',
  human: 'Set by you',
  // Producer kinds keep each function's own pre-existing copy — see below.
  brief: null,
  ai: null,
  // 0.40.0 — a named colleague's panel answer, applied by the owner.
  //
  // ⚠ NOT `null`, AND THE FIRST VERSION OF THIS LINE WAS `null` AND WAS WRONG.
  // The reasoning was that `panel` is not `userOwned`, so the lookup would never
  // be reached — which was true of the lookup and false of the OUTCOME: the
  // caller fell straight through to its default arm and
  // `getExtractionLabel('panel_elicited')` returned **"Estimated by Olumi"**.
  // The machine claiming authorship of a named colleague's number, on three
  // unflagged inspector panels. That is the SAME defect this file's header
  // records for `user_confirmed`, reintroduced by the very slice written to end
  // it. Totality bought a type error, not an answer — the compiler was satisfied
  // by `null` and the copy was a lie.
  //
  // ⭐ THE UNNAMED FALLBACK, AND IT IS NOW A FALLBACK RATHER THAN THE ONLY COPY
  // (D1, 14 Aug 2026). Reached whenever the person cannot be named: the value
  // carries no `elicited_from`, round data has not loaded, the round has no row
  // for that participant, or the row's label is blank.
  //
  // It stays exactly as it was, deliberately, because it is TRUE in all four
  // cases — the value did come from the owner's panel. That is what makes the
  // named version safe to add: a name that arrives one paint later ADDS detail
  // to a true sentence instead of replacing a placeholder. Never render the id
  // here; a uuid in this pill is a name for nobody, and `participantNames.ts`
  // cannot produce one.
  //
  // The ORIGINAL version of this comment said a name could not live on this
  // surface at all, "because only `participant_id` is persisted, so a name here
  // could not be reached by the R-2 redaction routine". The premise was right
  // and the conclusion did not follow: R-2 is beyond reach only for a name
  // PERSISTED in the graph. A name RESOLVED AT RENDER from CEE's roster
  // (`pseudonym ?? display_name`) is redaction-correct by construction, which
  // is what schemas 0.40.0's own header prescribes — "display names are
  // resolved at render time from round data".
  panel: 'From your panel',
}

/**
 * The named form of the `panel` attribution.
 *
 * ⚠ IT ATTRIBUTES AND MUST NOT ENDORSE (Paul's ruling: "apply Grace's value" is
 * not "Grace was correct"). "From Grace's panel answer" records whose number it
 * is; anything in the register of "Grace's estimate is the right one" —
 * "verified by", "per Grace", "Grace's figure" — smuggles a verdict into a
 * provenance label. The owner adopting a value is a decision the owner owns.
 */
function namedPanelLabel(label: string): string {
  return `From ${label}'s panel answer`
}

/**
 * The attribution label for a source, or null when the producer owns it and the
 * caller's own default copy should apply.
 *
 * ⚠ THE GATE IS "DOES THIS KIND CARRY AN ATTRIBUTION", NOT "IS IT USER-OWNED".
 * It used to be `if (!cls?.userOwned) return null`, which silently routed every
 * non-user-owned kind to the caller's default — fine for `brief`/`ai`, whose
 * defaults ARE their copy, and a falsehood for `panel`, whose value belongs to
 * a third person who is neither the reader nor the machine. Keying on the map's
 * own null-ness is behaviour-identical for all six pre-existing kinds (the four
 * user-owned ones are non-null, `brief` and `ai` are null) and is the only
 * version that can answer for a kind that is attributed to somebody else.
 */
function attributedLabelFor(
  source: string,
  attributedTo?: ParticipantNameResolution,
): string | null {
  const cls = classifyValueProvenance(source)
  if (!cls) return null
  // The name is consulted ONLY for the kind it can describe. Passing a
  // resolution alongside `user_override` must not change that value's copy —
  // the number is the owner's, whatever a round happens to say about somebody
  // else, and this gate is what keeps a stale resolution from relabelling it.
  if (cls.kind === 'panel' && attributedTo?.state === 'named') {
    return namedPanelLabel(attributedTo.label)
  }
  return ATTRIBUTED_LABEL[cls.kind]
}

// ─── Provenance labels (spec §3.4) ────────────────────────────────
export function getProvenanceLabel(
  source?: string,
  attributedTo?: ParticipantNameResolution,
): string {
  if (!source) return 'No evidence yet'
  const attributed = attributedLabelFor(source, attributedTo)
  if (attributed) return attributed
  switch (source) {
    case 'brief_extraction': return 'Generated from your brief'
    case 'explicit':         return 'From your brief'
    case 'cee_inference':    return 'Estimated by Olumi'
    case 'inferred':         return 'Estimated by Olumi'
    case 'cee_repair':       return 'Generated from your brief (adjusted during validation)'
    case 'ai-suggested':     return 'Generated from your brief'
    case 'default':          return 'No evidence yet'
    default:                 return source.startsWith('evidence:') ? `Based on ${source.slice(9)}` : `Source: ${source}`
  }
}

/** Extraction type user-facing labels */
export function getExtractionLabel(
  source?: string,
  attributedTo?: ParticipantNameResolution,
): string {
  if (!source) return 'Estimated by Olumi'
  const attributed = attributedLabelFor(source, attributedTo)
  if (attributed) return attributed
  switch (source) {
    case 'brief_extraction': return 'From your brief'
    default:                 return 'Estimated by Olumi'
  }
}

// ─── Strength human labels (validation_ui_data_contract_v1.1 thresholds) ─────
// ⚠ THE THRESHOLDS ARE NOT RESTATED HERE ANY MORE. This comment used to spell
// them out beside a re-export of the function that owns them — a mirror two
// lines from its source, which is the shape that drifts silently (trap 12).
// They are `CANVAS_STRENGTH_BANDS` in `domain/vocabulary.ts`, aligned with the DS v4
// reference artefact; read the table, and change the contract before the table.
//
// ⚠ THE BODY MOVED TO `domain/vocabulary.ts` AND THIS IS A RE-EXPORT, so this
// module stays the address every existing importer already knows. It moved
// because the CANVAS needs the same four words: `domain/edgeLabels.ts` carried
// a restatement on different cuts and the two surfaces disagreed about the same
// edge. `domain/` cannot import from `ui/` — nothing in this repo does — so the
// one source has to sit below both readers. The definition, the thresholds and
// the contract reference are unchanged; see that file for why.
export { getStrengthLabel } from '../../domain/vocabulary'

// `getStrengthDescription(signedValue)` — DELETED (ROADMAP 2.950). It built the
// literal string "Strong positive" from `signedValue >= 0`, i.e. read a
// DIRECTION CLAIM off the sign of a number `resolveEdgeSignedStrengthDisplay`
// may have signed from a defaulted `direction` — the 2.263/2.935 defect class,
// as a utility waiting for a caller. Verified at the bytes before removal: its
// ONLY import was `edges/StyledEdge.tsx`, which never called it (the KNOWN
// SURVIVORS list in `domain/edgeValueProvenance.ts` recorded it as rendered;
// that entry was stale and is corrected in the same change). If you need a
// directional strength sentence, use `getDirectionalStrengthLabel`
// (`components/model-tab/strengthBands.ts`), which takes a resolved
// `EdgeDirectionDisplay` and cannot fabricate the direction.

// ─── Empty states (DS v4 §16) ──────────────────────────────────────
export const EMPTY_STATES = {
  noAnalysis:       'Run your first simulation to see results',
  noInterventions:  'This option doesn\'t change any factors yet',
  noThreshold:      'Adding a specific target unlocks probability calculations',
  noEvidence:       'No calibration or external data. Providing evidence would improve trust in this connection.',
  noInboundConnections: 'No inbound connections yet.',
  noPrediction:     'No prediction available',
  /**
   * L-40 — the flat denial. Previously typed out three times as a literal, and
   * rendered by panels that were simultaneously showing connections the user
   * could see on the canvas. Now one constant, and every panel that shows it
   * must first prove there is genuinely nothing to show.
   */
  noConnectionsFlat: 'No connections yet.',
} as const

// ─── Group labels (v6.2 three-group layout) ───────────────────────
// Quiet headers for the Context / Your input / Connections layout.
export const GROUP_LABELS = {
  context:         'Context',
  input:           'Your input',
  connections:     'Connections',
  whatDrivesThis:  'What drives this',
  evidence:        'Evidence',
  impact:          'Impact',
  comparison:      'Comparison',
  whatThisChanges: 'What this option changes',
  /**
   * The header for a value group when the record does not say who put the
   * number there. It attributes NOTHING, deliberately — see
   * `getInputGroupLabel` below for why neither "Your input" nor an Olumi
   * attribution is available in that state.
   */
  inputUnattributed: 'Value',
} as const

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE "Your input" HEADER, RESOLVED AGAINST WHO ACTUALLY PUT THE VALUE THERE
 * ─────────────────────────────────────────────────────────────────────────────
 * `GROUP_LABELS.input` was passed UNCONDITIONALLY at all seven panel sites, so
 * every factor, goal and risk panel headed a group "Your input" over whatever
 * was inside it — including Olumi's own estimates. Measured on the deployed
 * product: **"Your input: 140"** on a value the user never supplied, in a panel
 * that simultaneously said "Estimated by Olumi" twice.
 *
 * False attribution is the worst class this estate has. An invented fact
 * carrying apparent provenance is worse than an ordinary wrong number, because
 * nothing downstream can tell it apart.
 *
 * ⚠ THE HEADER IS NOT DELETED, AND THAT IS THE RULING, NOT AN OVERSIGHT
 * (Paul, 29 Aug 2026 — "I'd rather caveat them"). Dropping the header would
 * trade a false label for no label; the group would get quieter and less
 * truthful at once. It is made HONEST ABOUT ITSELF instead.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠⚠ TWO OPPOSITE HARMS, AND THEY CANNOT SHARE ONE WINDOW
 * ─────────────────────────────────────────────────────────────────────────────
 *   · INVENTED AUTHORSHIP — "Your input" over Olumi's estimate. The reported
 *     defect: it credits the user with a number they never gave.
 *   · STRIPPED AUTHORSHIP — an Olumi attribution over a number the user DID
 *     supply. `utils/observedStateHelpers.ts` records this estate getting
 *     exactly this backwards once already, and its verdict stands: *"a gap
 *     wrongly INVENTED tells them a number they supplied is not theirs, which
 *     is the worse harm."*
 *
 * A single predicate flipping between "Your input" and an attribution commits
 * one harm or the other on every value the record does not stamp. So there are
 * THREE arms, not two, and the third claims nothing:
 *
 *   POSITIVE EVIDENCE the value is the user's        → 'Your input'
 *   POSITIVE EVIDENCE it is somebody else's          → 'Value'
 *   NO EVIDENCE EITHER WAY, and a value on screen    → 'Value'
 *   NO EVIDENCE, and NOTHING in the group yet        → 'Your input'
 *
 * The second and third arms answer alike ON PURPOSE — see INPUT_GROUP_LABEL
 * below. The header does not re-attribute; the pill inside the group already
 * does, and two attribution registers over one number is how they drift.
 *
 * The last arm is not a lapse: over an empty editor reading "No value set.
 * Click to enter", "Your input" is a PROMPT, not an attribution — there is no
 * number to misattribute, and this is the ordinary needs-input state.
 *
 * ⚠ NAMED RESIDUAL, not hidden: how often a real CEE draft leaves
 * `observed_state.source` unstamped is UNMEASURED here. Both
 * `mergeServerGraph.provenance.spec.ts` and `mergeAppliedGraph.spec.ts` carry
 * unstamped-value fixtures, so the class is real; its FREQUENCY on the wire is
 * not established, and if it is common this header reads 'Value' more often
 * than 'Your input'. That is honest in every one of those cases, but it is a
 * visible change and it deserves a live witness rather than an assumption.
 *
 * ⚠ SCOPE — THREE OF THE SEVEN SITES, and the other four are NOT covered.
 * `observed_state.source` exists only on the three FACTOR panels (External,
 * Observable, Controllable), which is also where the reported defect was seen.
 * GoalPanel, DecisionPanel, EdgePanel and RiskPanel pass this header over
 * content with no `observed_state` behind it at all, and at least DecisionPanel
 * carries the same falsehood by a different route (its "Your input" group holds
 * a read-only option list and model-computed win probabilities). EdgePanel has
 * its own separate `edgeValueSource` vocabulary — a DIFFERENT question under a
 * similar name (CLAUDE.md trap 21), not a drop-in. Those four are left
 * unchanged and NAMED rather than guessed at.
 */
const INPUT_GROUP_LABEL: Record<ValueProvenanceKind, string> = {
  // The four user-owned kinds. The twin obligation: a group that genuinely IS
  // the user's input must still say so.
  confirmed:  GROUP_LABELS.input,
  edited:     GROUP_LABELS.input,
  assumption: GROUP_LABELS.input,
  human:      GROUP_LABELS.input,
  // ─────────────────────────────────────────────────────────────────────────
  // ⭐⭐ THE HEADER STOPS CLAIMING; IT DOES NOT RE-ATTRIBUTE. Measured, not
  // chosen: the first version of this record answered each non-user-owned kind
  // with that kind's own attribution — 'From your brief' for `brief`,
  // "Olumi's estimate" for `ai`, "From your panel" for `panel`. Two existing
  // guards REDed on it, both correctly, and both for the same root cause:
  //
  //   · Brief3Panels.spec.tsx  — "Found multiple elements with the text: From
  //     your brief". The header duplicated the pill's sentence verbatim.
  //   · panelAttributionNaming.spec.tsx — the pill had resolved the author to
  //     "From Grace's panel answer" while my header still read the unnamed
  //     "From your panel", which that spec exists to keep off the surface.
  //
  // The defect was not the copy. It was creating a SECOND ATTRIBUTION AUTHORITY
  // beside `getProvenanceLabel`/`getExtractionLabel`, over the same number, in
  // the same panel — two registers answering one question, which is how they
  // drift apart (CLAUDE.md traps 12 and 21). The pill is the estate's one
  // attribution surface and it is already INSIDE this group, carrying the name
  // where a name exists. So the header answers only the question it owns —
  // *is this the user's own input?* — and where the answer is no it says
  // nothing further.
  //
  // ⚠ THIS IS NOT HIDING (Paul, 29 Aug). Nothing leaves the user's reach: the
  // attribution stays rendered, in the same group, one element down, and in its
  // fullest available form. What is removed is a false claim, not information.
  //
  // ⚠ THE COST, NAMED: the header is less informative than "Olumi's estimate"
  // would have been. That is the price of one authority instead of two, and it
  // is the right way round — an uninformative true header costs a tester a
  // glance downward; a competing one costs them a wrong belief about who
  // authored a number.
  brief: GROUP_LABELS.inputUnattributed,
  ai:    GROUP_LABELS.inputUnattributed,
  panel: GROUP_LABELS.inputUnattributed,
}

/**
 * The honest header for a panel's value group.
 *
 * @param source   the node's `observed_state.source` literal, if any
 * @param hasValue whether the group currently shows a value at all
 */
export function getInputGroupLabel(
  source: string | null | undefined,
  hasValue: boolean,
): string {
  const cls = classifyValueProvenance(source)
  // `classifyValueProvenance` returns null — never a guessed class — for an
  // absent or unrecognised literal. Guessing here is precisely how "Estimated
  // by Olumi" ended up over a confirmed value.
  if (cls) return INPUT_GROUP_LABEL[cls.kind]
  return hasValue ? GROUP_LABELS.inputUnattributed : GROUP_LABELS.input
}

// ─── Inline section labels (v6.2 subordinate rows) ────────────────
export const INLINE_LABELS = {
  setByOptions: 'Set by options',
  influences:   'Influences',
  drivers:      'What drives this',
  influenceOnResults: 'Influence on results',
  /**
   * ⚠ THE VALUE-OF-INFORMATION BAR HAD NO VISIBLE LABEL, AND THE PANEL
   * CONTRADICTED ITSELF AS A RESULT.
   *
   * `DataBar` renders `label` as an `aria-label` ONLY — never as text — so a
   * sighted reader saw an unlabelled bar. `ImportanceBar` puts its label
   * BELOW its own bar, so `Influence on results` sat immediately above the
   * unlabelled investigation-value bar and was read as belonging to it. On a
   * top driver that produced, in one vertical stack:
   *
   *     1st · 100%  ->  Influence on results  ->  [bar] Low
   *     -> "Further investigation here is unlikely to change the outcome."
   *     -> "This is one of the most influential factors in your model."
   *
   * i.e. "influence: Low" directly above "one of the most influential". The
   * data was never wrong — influence and value-of-information are different
   * quantities — but a missing label made a coherent panel look like a
   * data-integrity defect. A reviewer nearly filed it as one.
   */
  investigationValue: 'Investigation value',
  sensitiveAssumption: 'Sensitive assumption',
  flipRisk:     '{pct}% flip risk',
  strengthQuestion: 'How strong is this effect?',
  /**
   * ⭐ THE DRAWN-LINK VARIANT. It STATES THE PRECONDITION AND PROMISES NO
   * OUTCOME, which is the register UI #1540 arrived at after three drafts: the
   * sender has no revert lifecycle, so "the edge is SENT" is honest and "the
   * edge is SAVED" is not. Naming what the link NEEDS is true whatever the
   * transport then does.
   */
  strengthQuestionForSave:
    'How strong is this effect? This connection needs one before it can be sent to the model.',
  // ⛔ "SENT", NOT "REACH". A draft said "reach the model" — and reaching is
  // ARRIVAL, not dispatch, which is the same overclaim this file's sibling
  // comment refuses ("the edge is SENT, never SAVED"). It is also precisely what
  // the open acceptance test exists to decide, so asserting it here would be
  // claiming the result in advance. "Sent" is true under BOTH outcomes.
  existenceQuestion: 'Does this connection exist?',
  strengthUncertainty: 'Strength uncertainty',
  contributesToGoal: 'Contributes to your goal',
  basedOnModelStructure: 'Based on model structure',
  seeContributions: 'See all contributions',
  seeSensitivity: 'See sensitivity analysis',
  runAnalysisOutcome: 'Run analysis to see predicted outcome ranges per option.',
  // Risk probability × impact editing surface (P1.7).
  riskLikelihood: 'Likelihood',
  riskImpact: 'Impact',
  riskNotSet: 'Not set. Click to enter.',
  riskImpactNotSet: 'Not set.',
  riskSeverity: 'Severity',
  riskExposureHint: 'Likelihood and impact define this risk. Editing them re-runs cleanly against the analysis.',
  fineTune: 'Fine-tune',
  fineTuneUncertainty: 'Fine-tune uncertainty',
  modelDetail: 'Model detail',
} as const

// ─── Edge link-kind notices (migrated from EdgePanel JSX) ─────────
export const EDGE_LINK_NOTICES = {
  organisational: {
    title: 'Organisational link',
    body:  'This connection shows how options relate to the decision. It does not affect analysis.',
  },
  intervention: {
    title: 'Intervention link',
    // ⛔ THIS USED TO END "It affects analysis." — an unqualified claim that is
    // false about the one number sitting under it. Two different things are
    // being conflated:
    //   • THE LINK ITSELF IS READ. Its existence corresponds to an entry in
    //     the option's `interventions` map — the "sets to" quantity — and that
    //     quantity does reach the maths.
    //   • THE COEFFICIENT ON THE LINK IS NOT READ. PLoT deletes option and
    //     decision nodes AND every edge incident to them before any arithmetic
    //     (`NON_CAUSAL_NODE_KINDS` → `filterOptionNodes`, called at
    //     `routes/v2/run.ts` ~1,900 lines before the ISL request is built;
    //     ISL carries a `NON_INFERENCE_KINDS` safety net behind it).
    // Measured at ISL staging tip `28fe0c95`, PLoT `75e7f974`, 30 Aug 2026:
    // taking an option→factor edge's strength 1.0 → 0.3 → 0.0 → −1.0, and
    // deleting the edges outright, all returned a BIT-IDENTICAL win
    // probability to 8 dp, while the same edit on a factor→goal edge moved it.
    // So the user read "It affects analysis", edited β, watched the staleness
    // banner fire, re-ran, and received a guaranteed-identical number.
    // ⚠ This sentence mirrors a filter that lives in ANOTHER SERVICE (trap 12).
    // It is stated as what the analysis READS rather than as a copy of PLoT's
    // predicate, and the derivation above is dated and cited so a successor
    // re-derives rather than inherits. If PLoT ever stops filtering option
    // edges, this sentence and `EDGE_COPY.interventionStrengthInert` both move.
    bodyTemplate: 'This connection shows how {sourceLabel} sets {targetLabel} in the analysed scenario. The analysis reads the link and the value it sets — not the effect strength stored on the connection.',
  },
} as const

/** Resolve edge link template with source/target labels. */
export function resolveEdgeLinkTemplate(
  context: { sourceLabel: string; targetLabel: string },
): string {
  return EDGE_LINK_NOTICES.intervention.bodyTemplate
    .replace('{sourceLabel}', context.sourceLabel)
    .replace('{targetLabel}', context.targetLabel)
}

// ─── Edge panel copy (v6.2) ───────────────────────────────────────
export const EDGE_COPY = {
  sensitiveContext: 'Small changes here could shift which option the data supports.',
  /**
   * The SAME sentence the canvas cue, the edge hover and the key carry
   * (`fragileEdgeSentence`), so the panel cannot size the change one way on its
   * heading and another on this tooltip ("small" vs "significantly" was the
   * reviewer blocker on Paul 23 Sep contract feedback point 4). No size claim.
   */
  flipRiskTooltip: (pct: number) => `${fragileEdgeSentence(pct / 100)}.`,
  sliderMinUnlikely: 'Unlikely',
  sliderMaxVeryLikely: 'Very likely',
  sliderMinPrecise: 'Precise',
  sliderMaxUncertain: 'Uncertain',
  /**
   * ⭐⭐ THE SENTENCE THIS SURFACE EXISTS FOR — printed only when the stated
   * spread reaches far enough to change the adjective.
   *
   * It sits directly beneath the `StrengthBandButtons` pills, one of which is
   * highlighted with exactly the word it quotes, so the quotation is pointing at
   * something the reader can see rather than at an abstraction. That adjacency
   * is the whole design: the product qualifying its own headline word in the
   * place the word appears is worth more than a caveat filed elsewhere.
   *
   * ⛔ THE BAND WORDS ARE PASSED IN, NOT LOOKED UP HERE. They come from
   * `resolveStrengthSpread`, which is gated on BOTH values' provenance — so this
   * template is unreachable for an edge nobody characterised. A copy function
   * that derived its own labels could be called with anything.
   *
   * ⛔⛔ IT STATES THE SPAN. IT DOES NOT RETURN A VERDICT ON THE WORD, AND THAT
   * IS THE WHOLE POINT OF THIS WORDING.
   *
   * An earlier draft ended *"so ‘{word}’ is a firmer word than the numbers
   * earn."* That asserts ONE direction — the adjective overstates — while the
   * interval is `magnitude ± spread` and opens BOTH ways. Where the stated
   * magnitude sits low in its band, the span reaches UP into the next one, and
   * the sentence then told a team to discount a connection its own numbers say
   * may be UNDERSTATED. Measured against live CEE edges (see the spec header):
   * `0.30 ± 0.20` → [0.10, 0.50], word "Moderate", span slight…strong — the
   * old sentence called "Moderate" too firm while 0.50 is "Strong"; and
   * `0.38 ± 0.05` → [0.33, 0.43] never drops below Moderate at all, so the
   * claim was false outright rather than merely one-sided.
   *
   * One predicate cannot guard two opposite harms (platform trap 22b), so this
   * copy makes no claim about which way the interval leans. It names the span
   * and says what the quoted word is a word FOR — both true whichever end of
   * the interval the truth sits at, and true when the span opens both ways.
   *
   * ⚠ THE THREE ARGUMENTS ARE NOT INTERCHANGEABLE. `low`/`high` are the band
   * words at the ENDS of the interval; `word` is the band word for the stated
   * magnitude ITSELF, which is what the highlighted pill above shows. `word` is
   * not always between the other two as printed — it equals `low` whenever the
   * span opens upwards — and the sentence must stay true in that case.
   */
  strengthSpansBands: (low: string, high: string, word: string) =>
    `Anywhere from ${low} to ${high} fits this estimate — "${word}" is the word for the stated number, not for the range around it.`,
  /**
   * The magnitude and its spread together. A bare point estimate reads as a
   * measurement; this reads as an estimate, which is what it is.
   *
   * ⚠ NO "σ", NO "std", NO "standard deviation" in the plain surface. The
   * expert annotation below still says `σ =` under `techMode`, and that is
   * the right place for the notation — a reader who has not asked for it gets
   * the same fact in words.
   */
  strengthSpreadReadout: (magnitude: string, spread: string) => `${magnitude} ± ${spread}`,
  /** Accessible name for the readout above — the symbol spoken as English. */
  strengthSpreadReadoutLabel: 'Stated strength, give or take the stated uncertainty',
  /**
   * ⭐⭐ WHAT AN UNASSESSED SLIDER LOOKS LIKE — AND WHY IT IS WORDS, NOT
   * GEOMETRY.
   *
   * A range input must put its handle somewhere, and on THIS scale every
   * position is a claim. The three alternatives were weighed and rejected:
   *
   *   · MOVE IT TO THE CENTRE. Rejected, and it is the tempting one. The
   *     centre of this slider is LABELLED — `sliderNoEffect`, "No effect" — and
   *     `SignedStrengthSlider` prints "No effect" as its own direction word
   *     there. Centring would swap a fabricated moderate-positive for a
   *     fabricated NULL RESULT, which is a STRONGER claim about the world, not
   *     a weaker one. "This connection does nothing" is the last thing a tool
   *     for thinking should assert on a link nobody has assessed.
   *   · HIDE OR DISABLE THE CONTROL. Rejected on the standing no-hiding
   *     ruling recorded on `interventionStrengthInert` above — correct the
   *     claim, never remove the surface. It is also the one control by which a
   *     user could FIX the unset state.
   *   · LEAVE IT AND SAY NOTHING. That is the defect.
   *
   * So the handle keeps its position and the panel states what the position
   * means. The pills above light nothing and the β field withholds its number,
   * so this sentence is the only thing on screen making a claim about the
   * handle — and the claim it makes is "not a reading".
   *
   * ⚠ WHAT THIS DOES NOT FIX, stated rather than implied. `SignedStrengthSlider`
   * still draws a coloured fill from the centre out, still prints a direction
   * word ("Positive"), and still renders `getEffectSizeCoaching` — all three
   * derived from the same defaulted magnitude. Neutralising them is a change to
   * that component's visual design on every surface that mounts it, which is a
   * founder ruling rather than a lane decision, and it is NOT made here.
   */
  strengthUnsetSliderNotice:
    'Nobody has said how strong this effect is yet. The handle starts at a default position — it is not a reading.',
  existenceTooltip: 'How confident are you that this causal link is real?',
  sliderStrongNegative: 'Strong negative',
  sliderNoEffect: 'No effect',
  sliderStrongPositive: 'Strong positive',
  needsYourJudgement: 'Needs your judgement',
  // Caveat carried by the β field on an option→factor (intervention) edge.
  // The control stays visible and stays editable — the no-hiding ruling says
  // correct the claim, never remove the surface. See the derivation cited on
  // `EDGE_LINK_NOTICES.intervention.bodyTemplate` above.
  // ⚠ Deliberately says nothing about whether the edit PERSISTS. It does
  // persist, and it does move the analysis-affecting hash — which is why the
  // product honestly reports "stale, re-run" and then returns the same number.
  // The claim here is only about what the analysis reads.
  interventionStrengthInert:
    'The analysis does not read this coefficient on an option link — it reads the value the option sets its target to. Editing β will not change the result.',
} as const

// ─── Baseline / option badges ─────────────────────────────────────
export const BASELINE_BADGE_LABEL = 'Baseline option'

// ─── Action button labels (migrated hardcoded strings) ────────────
export const ACTION_LABELS = {
  addChange:     '+ Add a change',
  addOption:     '+ Add option',
  addConstraint: '+ Add constraint',
  seeAllDrivers: 'See all drivers',
  compareOptions: 'Compare all options',
  confirmCurrentStrength: 'Confirm this estimate',
  /**
   * ⛔ DELIBERATELY NOT "Updated" AND DELIBERATELY NOT A TICK. Confirming sends
   * a statement; only CEE can record it. The previous copy claimed the act had
   * landed at the instant of the click, on the one path where it was in fact
   * being refused. This says exactly what is true at that moment.
   */
  strengthConfirmSent: 'Sent to Olumi',
  /**
   * ⛔ THE STATE THAT WAS SILENT. `no_carrier` means this session has no
   * conversation to send through — a fact about the RENDER CONTEXT, not about the
   * edge, so no gate over edge data can eliminate it. Saying nothing there is
   * PERMANENT silence at a control the person just pressed. Wording follows
   * `FactorControllablePanel:840-846`, which already states all three outcomes.
   */
  strengthConfirmNotSent: 'Not sent to Olumi',
  /**
   * ⛔⛔ THE EDIT PATH SHIPPED THE DEFECT ITS OWN SIBLING WAS FIXED FOR.
   * `handleConfirmCurrentStrength` above carries a ⛔⛔ banner recording that it
   * called `confirmEdit('strength')` unconditionally, rendering `EditConfirmation`
   * at its defaults — **"Updated" in success green** — plus `InlineRerunPrompt`,
   * so a person was told their statement was saved and invited to SPEND AN
   * ANALYSIS on a change that did not exist. That was closed for CONFIRM and
   * left open for EDIT: a band press and a slider drag still say "Updated" in
   * success green whatever the server did, because the send was `.catch(() => {})`.
   * These two labels are the edit path's half, and they are TWO because the
   * harms are opposite (CLAUDE.md trap 22b): "nothing was recorded" and "we
   * cannot tell" must never share one sentence.
   */
  strengthEditNotRecorded: 'Not recorded — Olumi did not take this change',
  /**
   * ⚠ THE UNCERTAINTY IS RETAINED, NOT RESOLVED. `unverified` means the change
   * MAY have landed, so this must not claim either way — and unlike the line
   * above it must NOT suppress the re-run affordance, because the model may
   * genuinely hold the new value.
   */
  strengthEditUnverified: 'Olumi may not have recorded this',
  /**
   * ⛔ THE WINDOW I MISSED FIRST TIME, AND IT IS THE ONE EVERY EDIT PASSES
   * THROUGH. A settlement is ALWAYS at least one microtask late
   * (`settleSystemEventSend` resolves a promise), so between the press and the
   * answer `strengthEditSend` is `null`. My first version rendered
   * `EditConfirmation`'s DEFAULTS in that window — "Updated" in success green,
   * with the re-run offered — which is the exact claim this change exists to
   * stop, surviving in the gap between the two states I did name.
   * ⭐ A mock that settles SYNCHRONOUSLY cannot see this window, and mine did.
   * The test was not missing by oversight; the instrument could not reach it.
   */
  strengthEditSending: 'Sending to Olumi…',
  /**
   * ⛔ `queued` IS NOT `sent`, AND IT WAS READING AS ONE.
   * `settleSystemEventSend`: queued means *"buffered behind an in-flight turn —
   * THE TURN DOES NOT EXIST YET"*. It fell through to "Sent to Olumi", which is
   * the same optimistic receipt this change exists to remove, one state over.
   * ⚠ Reachable in normal use: `sendSystemEvent`'s `deferIfBusy` defaults TRUE,
   * so any edit made while a turn is in flight lands here.
   */
  strengthEditQueued: 'Waiting for the current turn to finish',
} as const

// ─── Empty description placeholders ───────────────────────────────
export const DESCRIPTION_PLACEHOLDERS = {
  decision: "What's the decision you're facing and why does it matter now?",
  option:   'What would choosing this option actually mean in practice?',
  goal:     'Describe what achieving this goal looks like for your team.',
  factor:   'What is this factor and why does it matter?',
  outcome:  'What does this outcome represent in your decision?',
  risk:     'What could go wrong and how would it affect the decision?',
} as const

// ─── "Ask about this" question templates (Task 2) ────────────────────
/**
 * ⭐ THE ASK REGISTER — and every entry now ends where `option` already did.
 *
 * SEVEN OF THESE NINE ASKED THE PRODUCT TO EXPLAIN OR TO DECIDE. "Tell me about
 * the chances of achieving {label}", "Explain the relationship between…" ask it
 * to narrate; "What drives {label} the most?", "How important is {label} to the
 * outcome?", "What are the key trade-offs in {label}?" ask it to rank and to
 * conclude. Both shapes put the model in the author's chair. `option` alone was
 * fixed, and its comment below states the principle it was fixed to:
 * *the ask ends by handing judgement back to the user rather than substituting
 * for it. Humans remain the authors.* A principle applied to one of nine keys is
 * a principle the next edit re-opens — so it is applied to all of them here.
 *
 * ⭐ THE SHAPE EACH ASK NOW HAS, and it is the same three beats every time:
 *   1. NAME WHAT THE MODEL HOLDS — what it assumes, weighed, expects, knows.
 *   2. EXPOSE WHAT THAT RESTS ON — evidence, uncertainty, sensitivity, strength.
 *   3. HAND JUDGEMENT BACK — which of it is the user's to settle.
 * Beat 3 is the load-bearing one and the one that keeps being dropped: without
 * it, beats 1 and 2 are just a better-informed oracle.
 *
 * ⚠ THESE ARE QUESTIONS THE USER ASKS, NOT ANSWERS WE PROMISE. They land as an
 * EDITABLE DRAFT via `ASK_SEMANTIC` and never dispatch. Nothing here should be
 * reworded into a claim about what Olumi will return.
 *
 * ⚠ APOSTROPHES ARE STRAIGHT, matching this whole file (measured: zero U+2019 in
 * `inspectorStrings.ts`; `DESCRIPTION_PLACEHOLDERS.decision` and the guest-mode
 * constraint notice both use `'`). A value carrying one is double-quoted, which
 * is the convention already in use here. Do not "tidy" these to typographic
 * quotes in isolation — that is a file-wide decision, not a per-string one.
 *
 * ⛔ ONE KNOWN SHORTFALL, PINNED IN THE SUITE RATHER THAN HIDDEN.
 * ⚠ `factor-external` ONCE carried beats 1 and 2 and not beat 3 — it named what
 * the model assumed and what it rested on, then stopped, leaving the reader
 * nothing to judge. The guard below caught it in the copy I was handed, and
 * the closing clause was added rather than the guard loosened. Recorded
 * because a gap closed silently is a gap that reopens.
 */
export const ASK_TEMPLATES: Record<string, string> = {
  goal:
    "What does this model assume has to be true for {label} to be reached, and which of those assumptions are mine rather than the model's?",
  'factor-controllable':
    'If I moved {label}, what does this model expect to change, how sure is it, and what would I need to know to act on that?',
  'factor-observable':
    'What is {label} standing in for in this model, how well is it evidenced, and where would my own knowledge of it change the picture?',
  'factor-external':
    "What has this model assumed about {label}, how much would the results move if that assumption is wrong, and is that assumption mine to overrule?",
  edge:
    'What is the claim that {sourceLabel} affects {targetLabel} based on, how strong is the evidence, and is the direction mine to confirm?',
  /**
   * ⛔ NOT "how does this compare to the other options?", which is what shipped
   * until now. That sentence asks the product to rank one option against the
   * rest — the race framing Paul has ruled out repeatedly, and a conclusion the
   * product is not entitled to state. The user clicked ONE option; the three
   * questions we ARE entitled to answer about it are the expected outcome, the
   * width of the uncertainty, and what would have to change for that to move.
   *
   * The closing clause is deliberate: the ask ends by handing judgement back to
   * the user rather than substituting for it. Humans remain the authors.
   */
  option:
    'For {label}, what outcome does this model currently expect, how wide is the uncertainty, and what would have to change for that expectation to move? Say which of those assumptions are mine to judge.',
  outcome:
    "What is this model's expectation for {label} resting on, and which parts of that rest on my judgement rather than on evidence?",
  risk:
    'What does this model actually know about {label} as opposed to assume, and what would I have to decide in order to act on it?',
  decision:
    'For {label}, what has this model actually weighed, and what has it left to me to weigh?',
}

/**
 * ⭐ THE CHANGE REGISTER — "I want to change this", per element type.
 *
 * The twin of `ASK_TEMPLATES`, and it exists because of a measured product
 * problem rather than a wish for symmetry: **most of the model cannot be edited
 * directly, and the surfaces that cannot edit it currently end in a refusal.**
 *
 * There are exactly FOUR server-authoritative edit carriers -- `factor_value_edit`,
 * `prior_range_edit`, `edge_adjudication` and `structural_delete`. Edge strength,
 * likelihood, direction, the goal target and node labels have NO durable carrier:
 * they write to the local store and are overwritten by the next server rehydrate
 * (measured 31 Aug 2026 -- a rename persisted to the autosave, survived 30s, and
 * was destroyed on reload). That is why the inspector is read-only, and the
 * read-only notice is TRUE.
 *
 * But a true refusal is still a dead end, and there is a path that works: the
 * SAME edit made conversationally persists (measured, contrast-controlled). So
 * these templates route the user to the writer that can actually save, instead
 * of telling them their change is impossible.
 *
 * ⚠ PHRASED AS THE USER'S OWN REQUEST, AND DELIBERATELY UNFINISHED. Each opens a
 * sentence the user completes -- it lands as an EDITABLE DRAFT via `ASK_SEMANTIC`
 * and never dispatches, so a half-formed intent is the correct output here, not a
 * defect. Naming the specific editable thing where we know it ("the value of",
 * "the success target for") is what stops the draft being a vague "change this".
 *
 * ⚠ NOTHING HERE ASSERTS THAT THE CHANGE WILL BE MADE. These are requests, not
 * promises; CEE decides. Do not add copy that implies the edit is already agreed.
 */
export const CHANGE_TEMPLATES: Record<string, string> = {
  goal:                  'Change the success target for {label} to ',
  'factor-controllable': 'Change the value of {label} to ',
  'factor-observable':   'Change the value of {label} to ',
  'factor-external':     'Change the uncertainty range for {label} to ',
  edge:                  'Change the strength of the link between {sourceLabel} and {targetLabel} to ',
  option:                'Change {label}: ',
  outcome:               'Change {label}: ',
  risk:                  'Change {label}: ',
  decision:              'Rename {label} to ',
}

/**
 * Substitute element labels into a template.
 *
 * ⚠ ONE RESOLVER FOR BOTH REGISTERS. `resolveAskTemplate` and
 * `resolveChangeTemplate` share this rather than each carrying its own copy of
 * the placeholder rules -- two near-identical substitution helpers beside each
 * other is precisely the near-duplicate that drifts (CLAUDE.md trap 12), and a
 * drift here would show up as one register silently dropping a label the other
 * renders.
 *
 * Returns null when a required placeholder has no value, so a caller can fall
 * back rather than render "Change the value of undefined to".
 */
function resolveTemplate(
  template: string | undefined,
  context: { label?: string; sourceLabel?: string; targetLabel?: string },
): string | null {
  if (!template) return null

  let resolved = template
  if (resolved.includes('{label}')) {
    if (!context.label) return null
    resolved = resolved.replace('{label}', context.label)
  }
  if (resolved.includes('{sourceLabel}')) {
    if (!context.sourceLabel) return null
    resolved = resolved.replace('{sourceLabel}', context.sourceLabel)
  }
  if (resolved.includes('{targetLabel}')) {
    if (!context.targetLabel) return null
    resolved = resolved.replace('{targetLabel}', context.targetLabel)
  }
  return resolved
}

/**
 * Resolve an "Ask about this" question template with element labels.
 * Returns null if no template matches or required placeholders are missing.
 */
export function resolveAskTemplate(
  panelType: string,
  context: { label?: string; sourceLabel?: string; targetLabel?: string },
): string | null {
  return resolveTemplate(ASK_TEMPLATES[panelType], context)
}

/**
 * Resolve a "Change this" request template with element labels.
 * Returns null if no template matches or required placeholders are missing.
 */
export function resolveChangeTemplate(
  panelType: string,
  context: { label?: string; sourceLabel?: string; targetLabel?: string },
): string | null {
  return resolveTemplate(CHANGE_TEMPLATES[panelType], context)
}

// ─── Goal panel strings ──────────────────────────────────────────
export const GOAL_STRINGS = {
  impactUnavailable: 'Probability data unavailable for this analysis run.',
} as const

// ─── Option panel strings ────────────────────────────────────────
export const OPTION_STRINGS = {
  impactUnavailable: 'Option impact data unavailable for this analysis run.',
  /**
   * L-24 — an option ADDED SINCE the last run is not the same situation as an
   * option the run covered and returned nothing for, and it must not inherit
   * the same sentence. Derived per node from whether this option appears in the
   * run's own comparison, not from global results mode.
   */
  impactNotInLastRun: 'This option was added after the last analysis, so it has no results yet. Re-run the analysis to include it.',
  /**
   * L-40 — the honest replacement for the contradiction. The option HAS factor
   * links (the Connections list below is rendering them from the same edges);
   * what it lacks is a value for each. Saying it "changes no factors" while
   * three of them are on screen is the product disagreeing with itself.
   */
  linksWithoutValues: 'Linked to {count} factor{s} below, but no change values are set yet — set one to give this option an effect in the analysis.',
  /**
   * ROADMAP 2.1204 — attribution for the drafter's rephrase-absorption note.
   *
   * The note's SENTENCE comes from the wire and is rendered verbatim; this is
   * the attribution that keeps it from reading as the user's own description.
   * It states authorship and nothing more — the same attribute-without-
   * endorsing rule the value-provenance labels follow (Paul's ruling: a
   * provenance label must never become a verdict).
   */
  draftingNoteAttribution: 'Drafted by Olumi',
} as const

// --- Goal constraint UI copy -------------------------------------------
// All user-facing strings for GoalPanel constraint section.
export const GOAL_CONSTRAINT_COPY = {
  extractedFromBrief: (count: number) =>
    `${count} constraint${count !== 1 ? 's' : ''} extracted from your brief`,
  selectFactor:        'Select a factor...',
  alreadyConstrained:  '(already constrained)',
  targetValue:         'Target value',
  operatorLabel:       'Constraint operator',
  factorLabel:         'Constraint target factor',
  valueInputLabel:     'Constraint target value',
  addButton:           'Add',
  cancelButton:        'Cancel',
  errorSelectFactor:   'Select a factor',
  errorInvalidNumber:  'Enter a valid number',
  jointProbability:    'Chance of hitting every target',
  addConstraintButton: '+ Add constraint',
  runForProbability:   'Run the simulation to see the probability of reaching this target.',
  targetUnlocks:       'Adding a specific target unlocks probability calculations.',
  // Canonical State Copy (see DESIGN_SYSTEM.md): honest status for GUEST
  // sessions. A guest's canvas graph lives only in the browser — the client
  // RPC write path is RLS-gated and silently swallows a guest's writes, so a
  // constraint typed into THIS panel never reaches the server graph that CEE's
  // run_analysis reads. The working alternative is chat: CEE's add_constraint
  // handler persists server-side regardless of auth, so a guest's chat-entered
  // constraints ARE analysed. Authenticated users' panel edits persist too, so
  // they never see this. Owned here; pinned as a raw literal in specs.
  guestConstraintsNotInAnalysis:
    "In guest mode, constraints added here aren't included in the analysis. Add them in chat instead.",
} as const

// ─── Decision panel strings ──────────────────────────────────────
export const DECISION_STRINGS = {
  /**
   * L-40 — the Decision inspector said "No connections yet." while the canvas
   * plainly drew its edges. `otherConnections` EXCLUDES option edges by design
   * (options belong in the Input group above), so a decision whose only edges
   * are its options hit a flat denial of edges the user could see.
   *
   * Derived from the SAME edge data the options list reads, and it names where
   * those connections went rather than pretending they do not exist.
   */
  connectionsAreOptions: 'Its {count} option{s} above are its only connections. Nothing else links to this decision yet.',
} as const

// ─── Generic fallback panel strings ──────────────────────────────
export const GENERIC_STRINGS = {
  /**
   * L-24 — the router used to render NOTHING for element types without a
   * bespoke panel. An honest, modest panel beats a silent refusal: the user
   * clicked something and must get a response.
   */
  noSpecialisedEditor: 'This element has no detailed editor yet. You can rename it, describe it, and follow its connections.',
} as const

// ─── Contested-edge review copy (L-38) ───────────────────────────
//
// The relationship inspector printed `contested_reasons` and `pass2.basis` as
// RAW ENUM TOKENS ("existence_boundary_crossing", "domain_prior") and headed
// the comparison "Pass 1 (current) / Pass 2 (review)" with Strength / Std /
// Exists rows. The estate already owns the user-facing translations and the
// good copy precedent (S18) in `model-tab/strengthBands.ts` — the inspector
// CONSUMES those rather than minting a second vocabulary for the same enum.
export const EDGE_REVIEW_COPY = {
  heading:          'Our two reviews disagree here',
  currentEstimate:  'What the model currently uses',
  reviewEstimate:   'What the review suggested',
  strength:         'Effect strength',
  uncertainty:      'How uncertain that is',
  existence:        'Confidence the link is real',
  showDetail:       'See both estimates',
  hideDetail:       'Hide both estimates',
} as const
