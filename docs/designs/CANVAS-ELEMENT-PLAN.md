# Canvas content delivery plan

9 September 2026 · Proposal for Paul, Canvas and PoC Strategic Path · implementation batches not launched

This is the single whole-graph content and delivery proposal. It extends the existing option-node specification; it does not replace the premium V2 reference or authorise a new prototype, node geometry, taxonomy or backend writer. The current option repair remains with its existing author and reviewer.

## Assessment and delivery objective

Last night's observation-preservation and Question-node changes are useful trust repairs. They do not constitute a complete graph-content pass. PR counts, lines removed and new safeguards are not the delivery measure. The next measure is whether someone can understand, inspect and improve every element of a real scenario, and retain the resulting work.

The recurring failure is fragmented delivery: a local symptom becomes a new mini-project; a prototype or fixture supplies an assumption; implementation and tests inherit it; independent review discovers the missing context. More rules in memory alone will not solve that sequence.

Change the unit of work to a complete user capability. Agree the content of all existing element types together, reuse the current components, and deliver coherent batches with one consolidated independent review. Preserve scientifically useful information; correct its meaning and source rather than systematically removing it.

Shareability has two concurrent requirements:
1. Core: ordinary edit → canonical save → analysis consumes the changed inputs → faithful explanation → reopen retains the work.
2. Canvas: every displayed element communicates its purpose, the relevant known or missing information, and a useful working next action.

The native first-Save refusal is an actual Core blocker. It should not become an excuse to leave the remaining Canvas content undesigned; nor should Canvas changes obscure that the joined journey still fails.

## Today's priority and deliberate cuts

Strategic Path is reconciling a programme-wide reset for today. The matrix below provides the whole-graph direction; it does not start new implementation batches ahead of that reset.

1. Finish the existing canonical-save and goal-writer repairs, then prove that the changed inputs reach analysis and survive reopening. Preserve their current owners.
2. Finish #1368 through its current reviewer. Fix contradictions in value, unit, reference and result currentness where they obstruct the same user journey. Avoid unrelated node enrichment during that repair.
3. Agree the factor/goal content decisions from this matrix once. Implement the smallest coherent improvement that lets a tester inspect assumptions and success criteria, once shared-file ownership is reconciled.

Defer additional risk/outcome/action enrichment, new sensitivity visuals, new collaboration records, geometry and decorative polish. The cost is a less complete first demonstration; the benefit is concentrating effort on a faithful, testable reasoning loop. Retain existing scientific calculations and useful observations. This is a delivery order, not a decision to remove them.

Re-entry conditions: the Canvas pair takes the second content batch after the first batch is accepted and Strategic Path releases capacity from the current save/AI blockers. A sensitivity visual enters that batch only after the existing science owner verifies the complete node-to-result binding described below. New collaboration records return to Strategic Path for prioritisation after the first faithful single-user journey is witnessed. Geometry and decorative polish are closed for this pass; reopen only for an observed readability or interaction failure in user testing.

## Content matrix

These are proposed content decisions grounded in current source. A schema field or reader is not a claim that every live graph populates it. Conditional measurements require a current, node-bound result with a defined quantity and unit. Missing measurements must not be replaced by edge weights, unrelated results or inferred numbers.

| Element and user question | Compact content and optional visual | Existing source or route | Current gap and next action | Proposed delivery owner |
|---|---|---|---|---|
| Question: what are we exploring? | Authored question; compact readiness summary; one consequential issue if supported. Preserve strategic framing, not just a recommendation. | DecisionNode authored label/body and existing readiness calculation. Its duplicate verdict was removed in #1362. | Keep the shipped improvement. In selection, make assumptions and scope easy to inspect; contextual Ask helps refine the question. No fresh card redesign. | Canvas pair; maintenance only unless acceptance finds a defect. |
| Option: what does this choice involve? | Title/context; what it sets; existing source/attention cues; eligible comparative visual with clear meaning and reference. Overflow remains explicit. | Option interventions and details; shared provenance and result/currentness consumers; existing V3 delivery specification. | Finish the in-flight observation-to-AI repair and existing acceptance. Stop revisiting geometry, inventing option archetypes or reopening settled content without new evidence. | Existing Codex author and Canvas reviewer. |
| Factor: what is this variable, and what do we know? | Name; current stated value with its actual unit or encoding; uncertainty/needs-input when present; controllability. A modelled influence or sensitivity indicator is secondary and conditional. | FactorNode; observedState, display_value, encoding_map, prior, category/controllability; useNodeDisplayMetadata and factor-sensitivity mapping. | Establish a consistent reading order and value meaning across card, hover and inspector. Separate current value, option target, uncertainty and sensitivity. Ask/check an assumption; edit through the existing canonical route. | Canvas pair, first proposed batch. Core owns upstream quantity defects. |
| Goal: what would success mean? | Success criterion; threshold/direction/unit and time horizon where captured; constraints. Show an eligible goal-attainment visual only for the right target and result basis. | GoalNode threshold readers; goal-fit/display metadata; store.goalConstraints and report.goal_constraints. | Make captured versus unresolved target context intelligible without a wall of warnings. Confirm a target through the existing route. Do not promote a baseline number into a target or silently infer a horizon from prose. | Canvas display in first batch; f361 retains canonical goal writer #1413. |
| Risk: what might go wrong, and how could we reduce it? | Risk statement; likelihood and impact as separate concepts when supplied; uncertainty/source cue. Rich causal paths, mitigation discussion and genuine sensitivity belong in detail. | RiskNodeData probability/impact are defined; RiskNode currently consumes them and a separately gated edge-to-goal strength. Existing ScienceIcon/Ask routes. | The available edge strength is not risk likelihood, severity or sensitivity. Improve the content hierarchy and route to examining the assumption or mitigation. Validate live population before promising a probability or risk-sensitivity feed. | Canvas pair, second proposed batch; scientific producer questions stay with existing Core owner. |
| Outcome: what could follow? | Consequence statement; a bound modelled quantity/range only when the analysis identifies this outcome and its unit. Otherwise retain meaningful qualitative context. | OutcomeNode, useNodeDisplayMetadata, graph connections; generic authored label/description/body. | An edge-to-goal strength is not an outcome forecast. Give the consequence and causal explanation priority. “What else follows?” should open a contextual draft, preserving the selected outcome. | Canvas pair, second batch. |
| Action: what will we do or test next? | Specific action and context; links to the assumption, evidence or outcome it addresses. Owner/date/status only if an actual stored record supplies them. | ActionNode currently renders BaseNode plus description; common node text and connections. | Improve the authored action and its role in the model using existing editing/Ask. Do not introduce a task-management system or invent a team commitment. A useful prompt asks what the action would establish. | Canvas pair, second batch. |
| Constraints and connections: what limits or links these elements? | Goal constraints retain their operator, bound and unit. Connections explain causal direction and stated strength, with origin/uncertainty; computed sensitivity is clearly separate. | Constraints are rendered on GoalNode; there is no standalone ConstraintNode renderer. Existing edge provenance, signed-strength and robustness consumers. | Improve the existing surfaces. Do not resurrect a constraint node from the schema enum. Keep plus/minus meaning and distinguish a stated coefficient from a measured sensitivity or outcome probability. | Goal-constraint display with first batch; shared edge semantics before dependent second-batch work. |

The eight-kind schema includes constraint, but the mounted UI does not use a standalone constraint renderer. Evidence, disagreement and contributions should remain visible through existing records and interactions where available; this plan does not invent new node types or team-review counts.

## Shared interaction and design-system contract

Use the current BaseNode, top-of-node shapes, semantic colours, typography, provenance resolver and action routes. Improve the existing shared pieces only where needed; do not build a replacement component framework.

- At rest: identity, the most useful type-specific datum/context, and consequential source/attention signals. No compulsory block of identical guidance on every node.
- Hover and keyboard focus: full labels, what a visual measures, its source/reference and a short explanation. Keep tooltips short and prevent competing overlays.
- Inspector: the complete content, actual editable fields, evidence/provenance, uncertainty, relevant connections and one contextual next move. The same quantity must mean the same thing on all three surfaces.
- AI: the selected element and actual concern reach an editable prompt. Explain, challenge, explore consequences or propose a test according to the task. A cue is not a diagnosis; a suggestion is not an applied change.
- Design-system updates accompany the relevant component batch: metric meaning, value/reference presentation, source/attention icons, missing/stale states and interaction behaviour. No separate design-system overhaul.
- Do not add a generic intelligence score or assume that the most visually prominent issue has the greatest value of information. “Most valuable next” needs its own valid producer; an unranked useful suggestion does not.

## Delivery sequence and ownership

**Now: close the current capability and lock the whole content pass.**
The existing author/reviewer finishes #1368; no new repair lane. Paul and Canvas review this matrix once for material content decisions. Resolve only disagreements that change implementation. Any unproven datum gets a named owner and an honest rendering fallback, rather than blocking the entire graph.

**First proposed implementation batch: factors, goals and their constraint display.**
These establish the meaning of values, assumptions and success across the graph. Inspect shared-file and semantic dependencies before fixing the batch boundary. Reuse existing formatting/currentness/provenance helpers. Core's active writer fixes continue independently; Canvas does not edit their contracts.

**Second proposed batch: risks, outcomes, actions and remaining connection content.**
Apply the same interaction and data rules. Keep distinct type-specific questions; do not flatten every node into a metric card. Finish the ordinary graph-reading and investigation experience before adding new scientific calculations or collaborative record types.

Two batches are a starting proposal, not an instruction to combine unrelated changes. Split only for a genuine dependency or independently releasable capability. Do not create one PR per label/icon or one redesign per node.

Existing owners:
- Codex option/Canvas pair: content specification, bounded frontend changes and independent implementation review, with one writer per shared file.
- Strategic Path: programme priority, cross-service alignment, release coordination and the sole native end-to-end acceptance driver.
- Existing Core authors: manual intervention writer #1416 and goal/context writer #1413. This plan does not divert or transfer them.

Timebox content/source reconciliation to one focused pass. The next visible milestone should be a reviewable factor/goal batch, not another option-node proposal. Do not promise a completion date before the shared-file dependency check; report the next deliverable and its actual blocker instead.

## Checks that prevent repeat work

1. Establish the actual target once per run and whenever deployment changes: staging host, served commit, loaded commit and scenario/run identity. Use the existing entry point and version readback, not a manually guessed URL or local branch. A surprising result first triggers a target check. No new general-purpose safeguard project.
2. Review the meaning before the implementation. Use a small set of raw payload examples, including long text, missing units/reference, conflicting or stale analysis and unfamiliar signals. The author must not invent fixture facts to make the desired visual possible.
3. Preserve independent judgement. The same author may update implementation tests, but the reviewer checks the actual producer-to-user behaviour and surviving positive cases. A test matching new copy does not independently establish that the copy is true.
4. One consolidated review per batch. Blocking findings are wrong meaning/data, lost work, broken interaction and unreadable essential content. Preference-level polish is recorded for later.
5. Run the required hosted checks once per changed candidate; repeat because of a change, failure or new concern, not habit. Do not rerun the same native journey in several lanes.
6. Record progress by completed user capabilities and node-content acceptance, with separate source/test/deployed/journey evidence. Count rework and newly introduced defects; stop a repeating failure pattern before expanding scope.

## Sensitivity: retain the science, verify the binding

Sensitivity analysis is scientifically valuable: it examines how model outputs respond to uncertain inputs and assumptions. That can guide what to investigate or test. The European Commission's JRC recommends uncertainty and sensitivity analysis in modelling; it is not merely decorative information. [JRC introductory guide](https://publications.jrc.ec.europa.eu/repository/handle/JRC122132).

A raw causal coefficient can be a meaningful model parameter. It is not, by itself, a sensitivity statistic. Removing a clause selected by the largest raw edge weight does not remove the engine's sensitivity capability.

The claim “risk nodes have no sensitivity feed” remains unproven as a universal statement. At remote ISL staging commit 7781ca4f, validate_parameter_uncertainties_reference_nodes checks node existence and uniqueness, and _compute_factor_sensitivity iterates supplied uncertainty node IDs. The name factor_sensitivity and three fixtures with no risk rows do not settle risk eligibility, evaluator behaviour or upstream selection.

The precise open check is: can a particular risk variable's uncertainty enter the request, affect the evaluator, produce a correctly scoped result and reach that same UI node? Establish those links before either promising a visual or commissioning a new producer. This source read is not an end-to-end risk-sensitivity test.

Keep elasticity, edge variation, result-switch probability, outcome spread and evidence quality distinct. ISL also identifies a sensitivity reference option and can suppress per-factor attributions under active correlation. A future visual must preserve that scope and any withholding reason; an engine field's mere presence is not enough.

## Acceptance for the first shareable graph pass

On the same representative scenario, with long-text and missing/stale-data variants:
- Each existing node communicates its purpose and useful content at normal desktop scale.
- Hover, focus and inspector agree on values, units, reference, provenance and result currentness.
- Important content is recoverable without relying solely on hover; labels and controls do not collide.
- A contextual AI action preserves the actual element/observation and results in an editable draft, a useful response or an honest service refusal.
- Supported edits save through the canonical writer, subsequent analysis consumes them, and reopening retains them.
- Missing data and unsupported calculations are explicit without flooding every card with warnings.

Canvas content and interaction checks can progress during Core repair. Canonical save/rerun/reopen and the native AI response journey must join before claiming the PoC is reliably shareable. Passing this slice does not establish the longer-term collaboration and learning proposition.

## Evidence and limits

Source baseline for this proposal: UI staging3b2df4ce7a44c4e119065b2866bfb14c4f2ef49a, directly served in this task; current source reads include domain/nodes.ts and DecisionNode, FactorNode, GoalNode, RiskNode, OutcomeNode and ActionNode. Source inventory is not a fresh visual audit of every node.

ISL staging was resolved remotely to7781ca4fdee93e550a9c3cc7b7e2a0bb5141bcf1 before reading models/robustness_v2.py, services/robustness_analyzer_v2.py and api/robustness.py. The risk-binding question remains open.

#1366 is reviewed, merged and served (receipt5600398596). #1368's unknown-title review is being addressed at substantive successore7ef316c; its intermediate test-only relaxation is withdrawn. It is not yet approved or deployed. Core's first-Save and goal-writer failures remain owned work, not resolved by this plan.

Programme authority remains [PoC Strategic Path / programme38](https://github.com/Talchain/olumi-programme-docs/pull/38). The existing [option-node specification](option-node/v3/DESIGN-SPEC.md) and [premium V2](option-node/v2/olumi-option-node-v2.html) remain preserved. No prototype was edited.
