/**
 * Inspector v2 - centralised string table
 * All user-facing labels. Exact strings from spec §3. No deviation.
 */

import type { NodeType, FactorCategory } from '../../domain/nodes'
import { classifyValueProvenance, type ValueProvenanceKind } from '../../domain/valueProvenance'
import type { ParticipantNameResolution } from '../../../collab/participantNames'

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
/** Compound key for factor subtypes */
export function getTypeLabel(nodeType: NodeType, category?: FactorCategory | string): string {
  if (nodeType === 'factor') {
    switch (category) {
      case 'controllable': return 'You can change this'
      case 'observable':   return 'You measure this'
      case 'external':     return 'Outside your control'
      default:             return 'Factor'
    }
  }
  const labels: Partial<Record<NodeType, string>> = {
    goal:       'Goal',
    decision:   'Decision',
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
// Canonical thresholds: Very strong ≥ 0.70, Strong ≥ 0.40, Moderate ≥ 0.20, Slight < 0.20
// Aligned with DS v4 reference artefact.
export function getStrengthLabel(absValue: number): string {
  if (absValue >= 0.70) return 'Very strong'
  if (absValue >= 0.40) return 'Strong'
  if (absValue >= 0.20) return 'Moderate'
  return 'Slight'
}

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
  sensitiveAssumption: 'Sensitive assumption',
  flipRisk:     '{pct}% flip risk',
  strengthQuestion: 'How strong is this effect?',
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
  sensitiveContext: 'Small changes here could shift which option performs best.',
  flipRiskTooltip: (pct: number) =>
    `If this edge's strength changes significantly, there is a ${pct}% probability the leading option would change.`,
  sliderMinUnlikely: 'Unlikely',
  sliderMaxVeryLikely: 'Very likely',
  sliderMinPrecise: 'Precise',
  sliderMaxUncertain: 'Uncertain',
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
export const ASK_TEMPLATES: Record<string, string> = {
  goal:                  'Tell me about the chances of achieving {label}',
  'factor-controllable': 'How important is {label} to the outcome?',
  'factor-observable':   'What would happen if {label} changed?',
  'factor-external':     'How sensitive are the results to {label}?',
  edge:                  'Explain the relationship between {sourceLabel} and {targetLabel}',
  option:                'How does {label} compare to the other options?',
  outcome:               'What drives {label} the most?',
  risk:                  'How can we reduce {label}?',
  decision:              'What are the key trade-offs in {label}?',
}

/**
 * Resolve an "Ask about this" question template with element labels.
 * Returns null if no template matches or required placeholders are missing.
 */
export function resolveAskTemplate(
  panelType: string,
  context: { label?: string; sourceLabel?: string; targetLabel?: string },
): string | null {
  const template = ASK_TEMPLATES[panelType]
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
