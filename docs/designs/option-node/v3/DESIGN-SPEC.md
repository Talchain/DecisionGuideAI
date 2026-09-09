# Option node V3 — delivery specification

Updated 9 September 2026. This is the component contract and repair register following Paul's staging tests. **The visual foundation remains [premium V2](../v2/olumi-option-node-v2.html), refined in place.** No new prototype, image, option taxonomy or graph geometry is authorised by this update. The rejected standalone V3 template is not a design reference.

## Purpose

Make an option understandable at a glance, then help people inspect, question and improve it with Olumi. Keep the existing top-centre square, compact card, graph connections, provenance and useful visual results. Desktop hover is valuable; essential information must also be recoverable by focus or selection.

## Resting node

| Element | What the person learns | Display contract |
|---|---|---|
| Top-centre purple square | This is an option | Preserve existing position, tokens and pointer-transparent handles. |
| Title and supplied description | What choosing it means | Authored text; two-line title clamp with full inspector recovery. No AI-created summary inferred solely from the title. No blank description prompt on every resting card. |
| Origin glyph | Where this option came from | Reuse the ratified provenance resolver. Unknown origin makes no claim. Option origin is separate from each value's origin, evidence quality and human review. |
| Stable option number | Which option is being discussed | Existing identity only, never rank, votes or contributors. Explain on hover/focus. |
| Target levels / changes | What it sets or changes | Consistent factor label and target presentation; a known band label accompanies a level strip where the scale supports it. A before marker needs an explicitly identified, compatible reference. Keep an explicit `+N more` when rows are capped; reveal all in the inspector. |
| Comparative result bar | How often it scored highest among the analysed options | Retain the useful visual. Use shared comparative vocabulary and eligibility. Zero is a real result; missing is not zero. This is neither goal attainment, evidence quality nor team support. |
| Permitted leading designation | Whether this option can be called ahead | Existing model claim permission AND result separation/currentness govern the claim. Reserve header space; a badge must not cover the title or shape. Numeric eligibility is distinct from permission to name a leader. |
| One factor to examine | Where to investigate the result | A global sensitivity ranking intersected with the option's factors supports navigation, not “this caused it to win”. Option-specific causal wording requires an actual option-specific explanation. |
| Conditional attention / reasoning cue | What needs judgement or investigation | Existing readiness and node-targeted warning/bias producers only. Reuse the registered glyphs; explain why the cue appears and provide a working next step. Do not diagnose a person from baseline status. |
| Edited / result state | Whether displayed analysis still applies | Use canonical currentness. Missing, failed and stale remain distinguishable. Do not infer a previous run's change history from screenshots. |

Use the current typography and node layout. Do not introduce different visual templates for pilots, headcount, scope cuts or other subjects. The same information pattern must handle all of them, including long names and absent data.

## Value and reference rules

1. Name the comparison reference. A baseline option, the factor's observed value and an explicitly retained before-value are different roles. A before/after pair on the option node requires one explicitly declared baseline option with a value for that factor; a label match or an observed value alone does not establish that reference. Multiple declared baselines are ambiguous. Preview and inspector must use the same role for the same claimed comparison.
2. A unit belongs to its raw value. Never prefix a normalised value with currency, multiply by 100 as a repair, or infer a missing starting quantity from an option's name.
3. Render before and after on compatible scales. If only a model level is available, label it as a model level or use its defined band. If a reference is unavailable, show the target alone. Missing values receive an explicit state, not an invented comparison.
4. A normalised percentage change is not automatically a meaningful real-world percentage change: an offset scale or qualitative score invalidates that inference. Only present relative change when the quantity and reference support it. Direction is neutral unless the goal-dependent effect is established.
5. A baseline flag identifies a reference option. It does not prove that its intervention map is empty, that it leaves every factor unchanged, or that inaction is risk-free. Show “Baseline option”; make any no-change statement only after comparing known values against the named reference. The detail list retains every valid target, including targets equal to an observed value; its heading is “What this option sets”. An equal target is marked “same as reference” under the named reference, without claiming the entire option changes nothing. Without a declared reference, the compact card loses its unsupported before/after pair; target details, result bars, provenance and coaching remain. This is a deliberate correctness limitation, not a reduction of the desired information model.
6. Preserve per-value provenance from its own record. A confirmed input does not establish that the whole option was vetted. No contributor or dissent count without actual records.
7. A formatted number can faithfully display a wrongly bound quantity. Such cases remain a producer/contract repair; the UI must not manufacture a semantic correction from labels.

## Hover, focus and actions

- Reveal **Ask, Challenge, More**, using existing capability gates. Ask uses the existing explanation route; Challenge opens its existing editable draft; More includes Open details.
- Visible action tooltips are short: “Ask Olumi”, “Challenge this option”, “More actions”. The full node identity belongs in the accessible name and the inspector, not repeated inside a large tooltip.
- Use the positioned tooltip pattern with the existing 300 ms delay, focus support, viewport collision handling and Escape dismissal. Preserve pointer travel into the body preview.
- Only one relevant transient explanation should compete for attention. Body preview yields to action/metadata interaction; inspector remains anchored. Check shared provenance/science cues as well as quick actions.
- Preview shows full factor names, targets, named reference if available, all available explanatory detail and explicit overflow. Avoid nested arrows such as `Factor → before → after`.
- Olumi prompts have distinct jobs: explain the modelled result, investigate what would change the assessment, and consider omitted assumptions or consequences. Use existing intent-bearing action routes. A prompt is an invitation, not a claim that the model has detected a defect.
- An unavailable coaching route must answer honestly. Never show an apparently working chip whose handler silently returns. Preserve the prompt and offer visible unavailability/refusal through existing feedback mechanisms.

## Inspector

Preserve the full wrapping title and existing top actions. The inspector should prioritise context, factor targets with per-value origin, issues to investigate, then conditional analysis and connections.

- Replace the large implementation notice with concise editing guidance. Keep canonical edit authority: never enable controls whose changes cannot be saved.
- Display read-only values as readable values rather than disabled inputs that imply an editable form. Hide or clearly explain unavailable edit actions; keep supported navigation and coaching usable outside the mutation-disabled boundary.
- Use one consistent representation for both ends of a comparison, the same reference as the preview and neutral directional cues. A raw-before / unexplained-normalised-after row is not the finished design.
- Switching between two options sharing a factor must replace the displayed target immediately. A previous option's local draft must never appear as the new option's value.
- Empty description, absent provenance, no interventions, missing result, failure and stale analysis each need honest handling. Do not consume the panel with repeated empty furniture.
- Retained results use the shared analysis-trust verdict. A non-current leader badge says “Last run · Most supported” within the badge itself. The bar's hover and accessible explanation distinguish an established model change from unconfirmed currentness. Keep the result bars; do not repeat a model-wide sentence on every card, invent a second hash or claim a change from absent evidence. Current and draft cards retain their existing treatment. A model-wide freshness explanation belongs on a shared analysis surface.
- Keep outcome probability only when its threshold, units, frame and permission support it. A target in prose is not proof it has been captured in the model.

## Design-system changes to carry with implementation

Keep the existing kind hue and top shape. Needs-judgement is a badge, not a competing kind border. Reuse the provenance and bias registries; status and action must not share an ambiguous glyph/position. Three quick actions remain the row budget. Define reserved metadata space rather than piling additional persistent icons into the header.

Update the existing design-system documents alongside each implemented pattern: short hover copy, focus parity, neutral numeric direction, missing-result state, readable read-only data and overlay precedence. Existing Canvas owners retain their colour, vocabulary, control-scale and glyph work; this spec does not replace those rulings.

## Delivery register

This table is the consolidated scope, not a declaration that every row has shipped. Exact-head tests and deployed interaction receipts belong in [VALIDATION.md](VALIDATION.md).

| ID | Repair / improvement | Owner and existing carrier | Current evidence / completion condition |
|---|---|---|---|
| O01 | Three actions, positioned quick-action tooltips, wrapping inspector title | Option Codex, [#1333](https://github.com/Talchain/DecisionGuideAI/pull/1333) | Merged as `d913bd1f`; Paul's screenshots confirm mounted surface and expose residual issues below. |
| O02 | Correct unit/value pairing in inspector | Canvas, [#1339](https://github.com/Talchain/DecisionGuideAI/pull/1339) | Merged as `41d43f11`; containment only. Does not align both ends or repair semantic misbinding. |
| O03 | One reference and compatible values across node, preview and inspector; option-switch freshness | Option Codex [#1353](https://github.com/Talchain/DecisionGuideAI/pull/1353), Canvas [#1343](https://github.com/Talchain/DecisionGuideAI/pull/1343), TC quantity authority | Inspector target-only/identity repair deployed as `81dbddd0`. Named-reference node repair under hosted checks and review. Shared scale inference remains a separate dependency; no guessed conversion. |
| O04 | Baseline label without unconditional no-change claim; full change-list recovery | Option Codex [#1342](https://github.com/Talchain/DecisionGuideAI/pull/1342) and #1353 | #1342 passed hosted gates and deployed. #1353 extends target retention and Detailed preview recovery. Mounted acceptance outstanding. |
| O05 | Explicit missing result; preserve measured zero and existing failure/currentness | Option Codex #1342 and #1353 | Missing/zero/failed repair deployed; retained-result freshness qualification included in #1353 for shared validation. No new currentness browser witness. |
| O06 | Honest factor explanation; no global-rank causal claim | Option Codex #1342 | Neutral wording and full factor link passed hosted gates and deployed. Actual coaching/navigation acceptance outstanding. |
| O07 | Compact action tooltips and non-silent coaching fallback | Canvas [#1341](https://github.com/Talchain/DecisionGuideAI/pull/1341); Option Codex #1342 | Both deployed after hosted checks; keyboard and live-route acceptance still outstanding. |
| O08 | Compact read-only inspector; neutral deltas and truthful edit affordances | Canvas [#1355](https://github.com/Talchain/DecisionGuideAI/pull/1355) | Independent review requests concise notice, explicit model-value fallback and exercised navigation alongside fenced writes. Runtime inspect/rename/navigation/AI checks required. |
| G01 | Legible controls at actual canvas zoom | Canvas, [#1274](https://github.com/Talchain/DecisionGuideAI/pull/1274) | Merged as `b8be19c1`; independent delta approval and hosted gate recorded. Paint witness still required. |
| G02 | Native provenance/icon hover replacement | Canvas, [#1264](https://github.com/Talchain/DecisionGuideAI/pull/1264) | Hosted gates passed, independently reviewed and deployed as `14276d5b`; overlay interaction acceptance outstanding. |
| G03 | Comparative vocabulary, leading-badge reservation and actual question framing | Canvas: [#1310](https://github.com/Talchain/DecisionGuideAI/pull/1310), [#1219](https://github.com/Talchain/DecisionGuideAI/pull/1219) where applicable | Vocabulary candidates exist; avoid duplicate answer on “Question”, unsupported causal/goal claims and badge/title overlap. Remaining source allocation to be confirmed. |
| G04 | Remove extent banner, preserve reserved overlay space | Canvas, [#1340](https://github.com/Talchain/DecisionGuideAI/pull/1340) | Merged as `58fa67cd`; 64 px reservation unchanged to avoid reopening the decision-node overlay defect. |
| G05 | Bias registry aliases and design-system reconciliation | Canvas, [#1327](https://github.com/Talchain/DecisionGuideAI/pull/1327), [#1319](https://github.com/Talchain/DecisionGuideAI/pull/1319) | #1327 deployed. #1319 needs current implementation references; unknown bias observations need neutral preservation rather than an invented diagnosis. |
| G06 | Factor influence/edge certainty/strength copy, path dimming and badge readability | Canvas, including [#1344](https://github.com/Talchain/DecisionGuideAI/pull/1344) | Evidence/measurement coaching and static evidence-gap warning deployed as `ee2b241f`. Structural influence and graph framing remain open; existing framing tests stay active. |
| D01 | Feature-perception money misbinding; goal target and 4% absolute churn constraint | Strategic path / TC0f6, CEE #1402 and UI continuation | Joined manual bundle `b0d541a9` establishes wrong bindings. First-loss mechanism remains to be proven; live corrected-model rerun required. |
| D02 | Grandfather option preservation and unsupported edit acknowledgements | Strategic path / TC0f6 | Captured feature value differs from the promised matching options. Saved model, consumed rerun input and explanation must agree. |
| D03 | Add-risk/reframe loops, explanation fidelity and provider refusal | Strategic path / f361 / operator | Existing harness and runtime owners. No duplicate log collection or billing/configuration action from this spec. |

Coordination and measured context: [implementation alignment](https://github.com/Talchain/olumi-programme-docs/pull/38#issuecomment-5593567321), [joined manual assessment](https://github.com/Talchain/olumi-programme-docs/pull/38#issuecomment-5593522167). The screenshots came from loaded build `d913bd1f`; a later staging deployment is not evidence that the photographed state changed.

## Acceptance

Review a real mounted option, its preview and its inspector together. Include long title, missing description/provenance, zero and five interventions, explicit baseline with values, unknown reference, qualitative levels, valid raw quantities, missing/failed/zero result, withheld leader and stale analysis. Retain the full name and all rows through selection.

At normal desktop zoom, confirm readable controls, no badge/title collision, hover/focus/Escape behaviour and useful graph context with the inspector open. Click each AI/navigation action and observe a real result, draft or honest refusal. Rename and reload; switch between options sharing a factor; ensure the current target follows the selected option.

One served-build interaction artefact per acceptance row is required for closure. Tests, merge and deployment alone do not demonstrate the joined user journey. Local simulation does not establish AI quality or improved thinking. Private reveal, contributor/vetting records, new option archetypes and new authored experiment records remain outside this pragmatic refinement; reopen only with an explicit product brief and real data contract.
