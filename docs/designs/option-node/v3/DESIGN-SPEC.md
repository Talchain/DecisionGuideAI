# Option node V3 — pragmatic PoC specification

**Canonical visual: [the original premium V2, refined in place](../v2/olumi-option-node-v2.html).** Keep that visual foundation for this component sheet and subsequent node specifications. The standalone `v3/olumi-option-node-v3.html` and `v3/prototype.template.html` were rejected; neither is the design reference or a PoC renderer.

**Scope:** application changes in draft PR #1333, source reference `e77f8a31043d48ec6a7d3a74726daafe74eff322`, plus the existing behaviour they preserve. This document describes source and intended acceptance. It does not claim deployment, an AI-backed journey, or measured improvement in thinking quality. Values authored for the visual are illustrative unless the specimen identifies a captured source.

## Purpose and implementation boundary

Help someone understand an option, inspect its assumptions and challenge it with Olumi. Refine the existing desktop node and inspector while preserving graph density, the top-centre shape, connections and familiar interaction routes.

**#1333 changes:** reduce the quick-action row to Ask, Challenge and More; add Open details to the existing menu; replace those action buttons' native tooltips with positioned hover/focus tooltips; make body previews yield to action interaction; give option inspector titles a full-width wrapping row. The tooltip/menu improvement is shared across node types. Inspector title wrapping is option-specific.

**Existing and unchanged:** option body content, result selectors, provenance, reasoning cues, readiness rules, node title clamp, description expansion, graph geometry and inspector content authority. Do not depict their redesign as work implemented by this PR.

## Element-by-element content contract

| Element | Meaning and display rule | Source owner |
|---|---|---|
| Top-centre purple square | This is an option. It remains above the card and does not intercept the connection handle. | `BaseNode`, `NodeShapeIndicator` |
| Title | Authored option name; two-line node clamp, full name recoverable in inspector. Missing label displays “Untitled”. | `BaseNode`; `data.label` |
| Description | Show its existing expand/collapse control only when supplied. Expanded markdown reveals the description. Do not add an invented summary. | `BaseNode`; `data.description` |
| Origin glyph | FileText: “From your brief”; Sparkles: “Olumi suggested this”; UserCheck: “You added this”. Unknown origin renders no glyph. This describes option origin, not evidence quality or review. | `NodeProvenanceMark`, `nodeProvenanceClaim`, `VALUE_PROVENANCE_ICON`; `data.provenance` |
| Small header numeral | Stable option number, only when registered. It is not votes, comments or contributors. | `optionNumbering[id]` |
| Changes and distinguishing factor | Retain existing known change rows and the derived differentiator where eligible. Do not invent units, baseline values or before/after quantities. | `OptionNode`, `computeAllDifferentiators`, intervention formatters |
| Support bar and percentage | Existing post-analysis comparative support, when the shared selectors provide it. **This is not chance of reaching the goal.** #1333 does not remove it. Missing/failed calculations do not become zero. | `useNodeDisplayMetadata`, `formatWinProbability`, `COMPARATIVE_COPY` |
| Result explanation | Existing “Supported by…”, “Held back by…” and close-margin text appear only on their data and claim-permission branches. No permanent explanation is fabricated. | `OptionNode`, `deriveDecisionVerdict` |
| Needs input | Before analysis, an assessed CEE option with empty interventions can carry the amber badge. Unknown assessment is not a failed check. No universal “well-formed”, “ready” or “vetted” claim. | `BaseNode.isIncomplete`, `optionsWereAssessed`, `StatusPill` |
| Reasoning cue | Existing baseline status-quo cue requires explicit `is_baseline: true`; its popover explains the concern and offers Discuss with AI when available. Do not diagnose the person. | `useScienceIcons`, `biasSignal`, `ScienceIcon` |
| Coaching marker | Appears only when a live guidance item targets this node; one marker, with a count for additional items. Opens the existing guidance route. A count is not team participation. | `NodeCoachingMarker`, `guidanceItems[].target_object.id` |
| Edited dot | This node differs from the device-local last-analysis snapshot. It does not establish the freshness of every result. | `BaseNode.isEditedSinceRun` |

Baseline body wording follows the existing explicit flag, with its existing label fallback where applicable. The science cue's explicit-flag condition is narrower; the visual must not assume every inferred baseline receives that cue.

## Hover, focus, menu and Olumi routes

| Interaction | Required behaviour |
|---|---|
| Rest → hover, focus or selection | Reveal up to three quick actions in order: Ask, Challenge, More. Existing channel gates determine which appear. |
| Ask (`MessageSquare`) | Uses the existing `askAI` explanation route and sends through the registered conversation channel. It is not a discussion-count control. |
| Challenge (`Zap`) | Selects the option and opens its existing editable, unsent challenge through `requestAsk`; the person sends it. It does not alter the model or certify a detected bias. |
| More (`MoreHorizontal`) | Opens the existing node menu; Open details (`PanelRight`) selects this node and opens its inspector. Preserve other supported menu actions. |
| Body preview | Keep the existing 300 ms entry and 100 ms exit delays. The pointer can enter the preview. Hover or focus on the action row suppresses it. Returning to the body restarts its delay. |
| Action tooltip | Positioned against the actual button; 300 ms hover delay, keyboard-focus access, wrapping and viewport flip/shift. Pointer can enter it. Escape and activation dismiss it. |
| Escape after body preview | Dismiss until pointer leaves and re-enters the node. Do not immediately reopen under a stationary pointer. |
| AI unavailable | Hide shortcuts whose existing channel requirements are unmet; retain More and Open details. Do not simulate a successful AI response. |

The existing Ask and Challenge routes have different send semantics. Inspector Ask Olumi and Change this both prepare editable drafts through `requestAsk`. This PR does not unify those routes. The visual must disclose local simulation and must not suggest that a scripted answer came from live Olumi.

The standard body preview retains existing intervention targets, empty/baseline messages and contextual chips, such as “What could go wrong?”. Detailed view places its existing additional content inline. Goal probability is conditional detail under existing availability and permission rules, never a new permanent metric in this refinement.

## Inspector content and authority

The header retains the option type, full wrapping title, rename pencil, optional inclusion rationale, Back to results when enabled, technical detail and Close. Rename uses the canonical label mutation and retains the 100-character limit. The three top actions remain **Ask Olumi, Change this, Its analysis**.

The current `InspectorRouter` wraps `OptionPanel` in a **disabled fieldset**. Only header rename and the top quick actions sit outside it. Preserve the visible authority notice: the name saves; other fields are currently read-only; supported factor edits use the Model tab and structural requests use Olumi.

| Section | Current content and honest fallback |
|---|---|
| Context | Existing description or empty prompt; baseline label and attributed drafting notes when present. Description editing is disabled by the mounted router. |
| What this option changes | Factor rows from the option's intervention map. Prefer a supplied `display_value`; otherwise retain the existing numeric presentation, including “Currently: N/A” when baseline is absent. Show per-value provenance only when the intervention's own source resolves. Add a change remains visible but disabled. |
| Coaching within the input section | One existing targeted guidance card, otherwise static coverage coaching. Its buttons are also inside the disabled fieldset on this route; do not show them as working inspector actions. |
| Impact | Post-analysis only: existing support, permitted context, supplied headline and comparison. Keep stale-result treatment and distinguish “not in last run” from unavailable results. |
| Connections | Existing outbound factor connections or the empty message. Their buttons are inside the disabled fieldset. |
| Technical detail | Existing disclosure only in technical mode. Do not promote raw model values into invented real-world quantities. |

`OptionPanel`, `InterventionRow`, `InspectorCoaching`, `InspectorRouter`, `InspectorQuickActions` and `INSPECTOR_READ_ONLY_REASON` own these behaviours. Source-level editors inside `OptionPanel` do not establish mounted edit authority.

## Geometry and design-system constraints

| Component | Current constraint to preserve |
|---|---|
| Node | White `#FEFEFE`; option hue `#AAA7E4`, light token `#DDDCF5`; normally 1 px kind-coloured border; 20 px radius. Padding 12 px top/sides, 24 px bottom. Selection uses the existing 4 px purple/50 ring and 2 px offset. |
| Width and height | Layout-derived width: current minimum 230 px, maximum 320 px; height follows content. Do not use the registry's nominal 220 × 100 as a fixed card size. |
| Top shape | 18 px square glyph inside a 22 × 22 px surround, centred 10 px above the card. Pointer-transparent; preserve connection handles. |
| Canvas type | Current source tokens are **12/11/10 px**, multiplied by `--canvas-label-scale`. Title weight 500, two-line clamp. Do not substitute a new font scale. |
| Quick actions | 20 px visual controls, 24 px effective targets, 11 px icons, 6 px gaps; 6 px from bottom/right. Screen size still depends on canvas zoom. |
| Body preview | 260 px wide; maximum height 250 px; 10 px vertical/12 px horizontal padding; portalled and viewport-positioned. |
| Inspector | 340 px wide, 12 px radius; header 16 px horizontal padding and 14/12 px top/bottom. Scrollable body maximum height 560 px. Typography 14/12/11 px. |

Source owners: `BaseNode`, `nodeLayoutConstants`, `typography`, `NodePopover`, `InspectorShell` and `brand.css`. The shared tooltip uses `asChild` without an extra layout wrapper and blocks inherited native titles on its action buttons. Other legacy native titles are not migrated by this slice.

## Acceptance and excluded claims

Use the premium visual foundation to inspect **resting, selected, body-preview, action-tooltip, inspector, long-title and missing-input** specimens. Label pre-analysis and post-analysis examples so conditional content is intelligible.

- At normal desktop working sizes, confirm the top shape, connections and existing card content remain legible; action controls do not overlap header metadata.
- A 100-character title clamps only on the node and wraps fully in the inspector. Missing description and unknown provenance add no invented content.
- Pointer and keyboard reach all available shortcuts. More → Open details opens the correct option; Escape dismisses the active explanation.
- Body preview and action tooltip do not compete while selecting an action; viewport-edge and zoom checks keep explanations attached and readable.
- Header rename persists through the canonical route. Inspector body controls remain disabled and its notice matches the available editing routes.
- Check needs-input, unassessed, no-result, failed-result and stale-result branches against their real producers; absence is never rendered as a completed review.
- Before deployment claims, repeat the relevant interactions on the identified served build with a real conversation. Local fixture interactions are not that proof.

Private contribution/reveal, named dissent or contributors, vetting, authored sacrifice/reversibility/test records, option-type visual families and new coaching selection are **not implemented by #1333**. Preserve them as separate proposed capabilities if discussed; do not place them in a specimen labelled as the PoC being built. Origin is not accuracy; silence is not agreement.

See [IMPLEMENTATION.md](IMPLEMENTATION.md) and [VALIDATION.md](VALIDATION.md) for the earlier local application evidence and its limitations. Those receipts are historical validation of the bounded application change, not acceptance of the rejected standalone prototype or a deployed journey.

## Review-sheet fidelity and current gaps

The refined premium V2 shows a constructed pre-analysis fixture based on Paul's screenshot (label, differentiator and supplied targets); edges are omitted. The other examples are explicit robustness fixtures. Review magnification is not a change to production tokens. The inspector remains present as a component specimen even when its Close/Back route is explained; More shows the Open details excerpt. This reference does not reproduce the whole application or post-analysis journey.

The source check found an existing availability gap: `NodeChip` remains rendered for the pre-analysis “What could go wrong?” prompt, but with neither `_dispatchAction` nor `_sendMessage`, its handler returns without visible feedback. The quick-action shortcut gates do not repair that separate component. Canvas owns the follow-up: reopen at the next preview-coaching refinement; acceptance must include a visible refusal or an honest unavailable state when both channels are absent. No source change is made to that route in #1333.

Independent review candidate is frozen at `e77f8a31`; design files may be refined locally without changing application source. The original project-output HTML and repository V2 copy are synchronised; the rejected V3 prototype remains untouched.
