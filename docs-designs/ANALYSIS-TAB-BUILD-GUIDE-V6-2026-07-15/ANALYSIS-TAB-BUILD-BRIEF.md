# Olumi Analysis Tab Build Brief

> Provenance: supplied verbatim by Paul to A2 on 2026-07-15 ("the brief the previous Workstream was working from"). Companion to analysis-tab-prototype-build-ready-v6.html (sha 080b4a04) in this directory. The brief is the authority on intent, boundaries and acceptance; the prototype is the interaction/layout reference only.

## Status and purpose

This is the implementation and experience brief for the next major Analysis tab build in `DecisionGuideAI`.

It explains not only what to build, but why the experience is structured this way, how each surface should behave, how the pieces should connect to the decision graph and the AI, and where the architectural boundaries sit.

Use `analysis-tab-prototype-build-ready-v6.html` as the interaction and layout reference. It is not production code and it is not a new design-system source of truth. Rebuild the experience from existing Olumi components, selectors, contracts and interaction seams.

The goal is not a pixel-for-pixel port. The goal is a production-quality Olumi-native implementation that preserves the prototype's product logic, improves its usability and accessibility, follows Design System v5 exactly, and integrates the Analysis tab deeply with the graph and AI.

---

# 1. Product intent

Olumi is not a winner-picking dashboard and it is not an AI that outsources thinking.

It is a thinking environment that helps individuals and teams:

- frame the right problem;
- generate stronger possibilities;
- challenge assumptions and blind spots;
- understand causal drivers and uncertainty;
- compare routes fairly;
- identify what is worth learning next;
- reach a defensible provisional decision;
- preserve ownership of the final judgement.

The Analysis tab should therefore do four jobs:

1. **Orient**
   Make the current decision, framing quality and decision posture immediately legible.

2. **Explain**
   Show what the current analysis suggests, why, how uncertain it is and what could change it.

3. **Coach**
   Identify the single most valuable intervention now, whether that is clarifying, broadening, challenging, evaluating or committing.

4. **Connect**
   Make the graph, Analysis tab and AI feel like one system rather than three adjacent products.

The experience must remain adaptive and non-linear. Do not expose a visible Frame, Ideate, Evaluate, Decide or Optimise stage switcher in the PoC. Those concepts remain useful internally, but users should simply receive the right guidance for the current state.

---

# 2. Core experience principles

## 2.1 One stable tab, adaptive coaching

The overall Analysis tab structure remains stable. The user should not have to learn a different layout for each stage of reasoning.

What changes is:

- the framing status;
- the current read;
- the single highest-priority recommendation;
- which supporting evidence is available;
- which methods are relevant.

## 2.2 One question per surface

Each major surface owns one user question:

| Surface | Question it owns |
|---|---|
| Decision overview | What decision are we addressing, how is it framed, and how should we treat it? |
| Freshness | Does this analysis still reflect the current model? |
| Analysis | What does the current model suggest, why, and what could change it? |
| Strengthen your model | What is the most valuable thing to improve next? |
| Advanced | What technical detail, limitations or provenance may an expert need? |

Do not repeat the same target prompt, next action, freshness warning or conclusion across several surfaces.

## 2.3 Answer first, coach second

When analysis exists, lead with the current finding. Coaching follows, unless the framing is contradictory or critically incomplete.

If the brief is contradictory, pause reliance on the read and make resolving the contradiction the primary action.

If information is missing but the model is still useful for exploration, qualify the read rather than blocking everything.

## 2.4 Progressive disclosure

The first viewport should be calm and useful:

- compact decision overview;
- one freshness status;
- analysis headline and current lens;
- one recommendation.

Detailed framing, evidence lists, trade-offs, receipts and secondary recommendations remain one click away.

## 2.5 No false precision

- Do not show a composite trust score.
- Do not show ambiguous percentages without a clear denominator and meaning.
- Do not expose normalised values, coefficients, elasticity or internal engine language.
- Prefer calibrated words such as `tentative`, `close`, `stable` or `needs evidence` when that is the contract-backed representation.
- Keep win probability, outcome change, evidence quality, influence and flip likelihood visibly distinct.

## 2.6 Human ownership

Olumi can challenge, recommend and propose. It does not silently decide or silently mutate the model.

Any action that changes the graph or model must use the existing proposal, confirmation and canonical apply path.

---

# 3. Canonical Analysis tab hierarchy

Implement the tab in this order:

1. Decision overview
2. Freshness strip
3. Merged Analysis panel
4. Strengthen your model
5. Advanced and receipts

There is no separate `Understand the result` panel. Its content is now progressively disclosed inside the Analysis panel.

---

# 4. Decision overview

## 4.1 Purpose

This is the orientation and framing surface. It is deliberately separate from analysis results.

It should tell the user:

- what decision or challenge Olumi believes it is helping with;
- whether the framing has the basics;
- which parts of the brief need attention;
- how consequential, urgent or reversible the decision is;
- what framing question matters most now;
- which global methods and actions are available.

It should not show option rankings, analysis outcomes, drivers or detailed model-strength recommendations.

## 4.2 Collapsed ready state

When the brief has the basics, keep this surface compact.

Show:

- decision title;
- decision classification pills;
- a quiet framing state;
- the persistent `Actions` control.

Recommended copy:

- `Framing has the basics`
- supporting line: `Goal, context, constraints and options`

Do not say `good framing`, `good enough` or imply that the brief is objectively correct.

## 4.3 Decision classification

The prototype currently shows:

- High stakes
- Reversible
- 12-month horizon
- Risk cautious

These are useful only if they change behaviour.

They should inform:

- coaching depth;
- how much challenge Olumi applies;
- how strongly evidence gaps are prioritised;
- whether a fast provisional choice is reasonable;
- how prominently revisit conditions are suggested.

Rules:

- low-stakes and reversible decisions may receive a faster, lighter process;
- high-stakes or hard-to-reverse decisions should trigger stronger framing, challenge and evidence checks;
- risk posture may shape how trade-offs are discussed, but must not silently alter the mathematical result;
- if a classification is inferred rather than user-confirmed, say so and allow correction;
- if a classification is not consumed anywhere, do not imply that it is active.

Clicking a classification pill should open a small review interaction. It may support direct edit or open a contextual AI conversation.

## 4.4 Canonical brief dimensions

Use one canonical set everywhere:

- Goal
- Context
- Constraints
- Options

The success measure sits within Goal. The problem or challenge is part of Context.

Do not introduce alternative sets such as Frame, Evidence and Estimates.

## 4.5 Brief quality states

### Ready

- collapsed by default;
- neutral, quiet presentation;
- no long checklist in the first viewport;
- user may expand to inspect and edit the brief.

### Thin or incomplete

- expand automatically;
- qualify the analysis;
- identify the most important missing information;
- ask two or three focused questions at most;
- allow the user to answer directly or work through them with Olumi.

### Contradictory

- expand automatically;
- pause reliance on the read;
- show the two conflicting claims in plain language;
- provide the fastest route to resolve them;
- do not silently select one interpretation.

### Possible factual inaccuracy

- distinguish between missing information and an unverified claim;
- do not assert that the claim is false unless evidence supports that;
- label it as unverified and request a source, correction or confirmation.

## 4.6 The framing question

The overview may show one adversarial framing question, for example:

> What would make bringing on a co-founder clearly better than hiring a senior technical lead?

This is not a generic checklist item. It is the highest-value framing challenge derived from the current brief and model.

Routes:

- `Answer directly`
- `Work through with Olumi`
- optional `Focus on canvas` when there is a corresponding goal, constraint or option set

## 4.7 Persistent Actions menu

Keep one persistent Actions menu in the top-right of the Decision overview.

It is not a duplicate of Strengthen your model.

### Strengthen your model owns

- Olumi's single prioritised recommendation;
- why it matters now;
- its status and progress;
- the fastest action.

### Actions owns

- user-invoked science-grounded methods;
- global utilities;
- methods the user may deliberately choose even when they are not the current top recommendation.

Recommended catalogue:

**Methods**

- Reframe the problem
- Generate a materially different option
- Consider the opposite
- Apply the outside view
- Run a pre-mortem
- Explore trade-offs
- Review a possible bias

**Global actions**

- Edit decision brief
- Review all inputs
- Rerun analysis

Requirements:

- maintain one stable menu rather than separate pre-analysis and post-analysis menus;
- order or highlight methods contextually, but keep the catalogue recognisable;
- each method should explain why it could help now;
- methods open a contextual AI session rather than a generic blank conversation;
- do not bury the current best next move in the menu;
- do not show dead or unavailable methods as if they work.

---

# 5. Freshness strip

## 5.1 Purpose

This is the sole owner of current versus stale analysis state.

It should answer:

- does this analysis reflect the current model?
- if not, why not?
- what is the recovery action?

## 5.2 Behaviour

Fresh:

- quiet, compact status;
- no repeated green banners elsewhere.

Stale:

- clear explanation that the model changed after the run;
- one rerun action;
- Analysis content may dim or lock as already established, but the recovery action remains crisp.

## 5.3 Ownership

Consume the existing canonical freshness signal.

Do not:

- compute freshness locally from ad hoc UI state;
- create another graph hash;
- compare arbitrary client snapshots;
- show a second stale banner inside Strengthen your model.

---

# 6. Merged Analysis panel

## 6.1 Purpose

This panel combines the current analysis and the evidence needed to understand it.

It answers:

- what currently leads or whether there is no clear leader;
- what the likely outcomes are;
- how the options compare against the goal;
- how stable the recommendation is;
- why the result looks this way;
- what is most likely to change it;
- what practical trade-offs sit behind the leading routes.

The top remains answer-first. Evidence is progressively disclosed.

## 6.2 Analysis headline

The headline must be contract-backed and calibrated.

Examples:

- `Bring On Technical Co-Founder is slightly ahead.`
- `The top options are close.`
- `No option is clearly ahead yet.`

Never use `winner`.

Do not make a strong leader claim merely because one option is ranked first.

When the brief is contradictory, replace reliance on the headline with the contradiction state and its resolution action.

## 6.3 Lenses

Current lens set:

- Goal fit
- Likely outcome
- Stability
- What changed

### Goal fit

Available only when a valid measurable success definition exists.

It should not unlock because a stray constraint or joint-goal field happens to be present.

### Likely outcome

Shows option outcome distributions and a clear comparison basis.

Use stable option numbers matching the graph and all other views.

Values need explicit meaning, for example:

- expected change versus the current approach;
- probability of reaching the success measure;
- outcome in the user's actual unit.

Never show a percentage if the quantity is not genuinely a percentage.

### Stability

Show only producer-backed per-option stability.

If it is not available, keep the honest unavailable state.

Do not derive or approximate it in the UI.

### What changed

Keep gated until versioned comparison and provenance exist.

Do not recreate it from local browser history or cached run diffs.

## 6.4 Option rows

Requirements:

- stable numbering across graph, Analysis, AI references and other panels;
- long labels wrap to two lines or provide full text on hover;
- option order uses the approved shared selector;
- the active lens must not silently reorder rows unless that behaviour is explicitly designed and labelled;
- ranges must not exaggerate tiny differences;
- target markers appear only when units match;
- identical rendered values must not produce a strongest-outcome claim.

## 6.5 Quick evidence links

The summary may show two compact links:

- Main driver
- Top flip risk

These must remain semantically distinct:

- **Main driver** means strongest effect on the analysed outcome.
- **Top flip risk** means most likely to change which option leads.

Clicking either should focus the relevant factor or connection on the canvas.

Do not imply the main driver is necessarily the factor most likely to change the decision.

## 6.6 Expandable evidence section

Use one disclosure:

`Why and what could change it`

Inside it, provide three views:

### Drivers

- rank factors by producer-backed effect on the analysed outcome;
- show evidence quality separately;
- make each row clickable to focus the factor on the canvas;
- avoid internal terms such as elasticity;
- provide `See all factors` and `Show fewer`.

### Flip risks

- rank producer-backed fragile relationships by leader-switch likelihood;
- state the consequence in plain language;
- use user-facing labels and user units where available;
- do not expose normalised thresholds;
- only enable drag or direct manipulation if it genuinely previews or reruns the model.

Example:

> If salary cost rises above £X, option 2 becomes the likely leader.

Where an exact threshold is not available, use honest probability-based wording.

### Trade-offs

For each leading option, show:

- You gain
- You give up
- Depends on
- Watch

Trade-offs should come from a grounded producer or reviewed narrative. The UI must not invent them from labels alone.

The section should help users confront the reality of the choice, not only inspect charts.

## 6.7 Route to the next recommendation

The Analysis panel may show a compact line such as:

`Next recommendation: Define a measurable success measure`

It should open or scroll to Strengthen your model.

It must not duplicate the full coaching content or own recommendation status.

---

# 7. Success-measure flow

## 7.1 Why it exists

A qualitative goal can remain qualitative, but Goal fit requires a measurable test.

The existing experience repeated `set a target` in too many places without helping users construct the right target.

Replace those repeated prompts with one canonical `Define success` flow.

## 7.2 Required fields

Capture:

- metric or outcome;
- direction;
- numeric threshold;
- unit;
- timeframe;
- optional baseline, evidence or source.

Examples:

- increase delivery capacity by at least 20% within 12 months;
- reach at least 50 active customers within 6 months;
- keep implementation cost below £120,000.

## 7.3 Validation

- threshold must be finite;
- unit is required;
- timeframe is required;
- metric must map to a valid outcome or goal representation;
- show the assembled sentence before commit;
- protect against percentage scaling and unit mismatch;
- do not fabricate a number when the user only has a qualitative aspiration.

## 7.4 Write path

This is analysis-affecting and rerun-only.

It must:

- use the existing success-target setter and canonical run path;
- cause exactly one rerun;
- mark analysis stale or running using the existing freshness flow;
- not mutate graph topology;
- not create local CAS, graph identity or version truth;
- not silently create a new goal node.

If the user needs help defining the measure, open a contextual AI dialogue before committing a number.

---

# 8. Strengthen your model

## 8.1 Purpose

This is Olumi's adaptive reasoning plan.

It is not a static checklist and it is not a generic task manager.

It should help the user improve the quality of the reasoning by identifying the single highest-value intervention now.

## 8.2 Adaptive help types

Internally, recommendations fall into five help types:

- Clarify
- Broaden
- Challenge
- Evaluate
- Commit

Do not show these as visible stages or navigation.

## 8.3 Default presentation

Show:

- one expanded recommendation;
- the remaining recommendations collapsed and hidden behind `Show more`;
- `Expand all` and `Collapse all`;
- a compact summary such as `2 addressed · 3 worth checking`;
- addressed and dismissed history behind disclosure.

Only one recommendation is primary by default.

## 8.4 Recommendation content

Each recommendation needs:

- title;
- short signal or reason it appeared;
- why it matters now;
- one practical `Try this` instruction;
- named grounding source;
- one primary action;
- `Focus on canvas` where a target exists;
- `Work through with Olumi`;
- `Not relevant`.

Example:

**Give Engineering Capacity a realistic range**

- Signal: high influence, low evidence.
- Why: a single figure hides uncertainty in an important input.
- Try this: use a plausible low and high based on past delivery.
- Source: sensitivity and evidence-quality signals.

## 8.5 Recommendation lifecycle

Use stable recommendation identities.

Statuses:

- Recommended
- In progress
- Addressed
- Dismissed
- Reopened

Behaviour:

- addressed recommendations move into history;
- dismissed means `not relevant`, not silently deleted;
- a later graph or brief change may reopen an item;
- explain why a reopened recommendation returned;
- reprioritise after edits and reruns;
- do not reset all progress because a new analysis response arrived.

Durable persistence may be limited in the PoC. Keep the internal contract ready for later persistence without claiming it already exists.

## 8.6 Recommendation grounding

Every recommendation must have a named deterministic or producer-backed trigger.

Examples:

- missing measurable success definition;
- narrow or homogeneous option-set signal;
- highest Value of Information;
- low-evidence high-influence factor;
- highest recorded flip risk;
- missing counterargument critique;
- readiness signal supporting provisional commitment.

Do not derive option similarity, trust, trade-offs or bias from superficial UI heuristics.

The UI may adapt presentation, not invent semantic truth.

## 8.7 Backward coaching

This is essential to prevent winner-picker drift.

The system must be able to recommend:

- clarify the goal;
- reframe the decision;
- broaden the option set;
- add a missing outcome;
- seek a different perspective;
- challenge the leading option;
- improve evidence before relying on the ranking.

For example:

> Three of four options use the same mechanism. Generate one materially different route before relying on this comparison.

This must use a producer-owned similarity or coverage signal, not a local text comparison in the UI.

## 8.8 Primary action routing

Use the right route for each recommendation:

- direct inline edit for a threshold, range or known parameter;
- canvas focus for a factor, option or connection;
- AI dialogue for framing, ideation, bias checks and science-grounded methods;
- proposal and confirmation flow for structural model changes;
- rerun through the canonical run path after analysis-affecting edits.

Close a recommendation only after the action genuinely succeeds.

## 8.9 Addressed history

The history provides continuity and ownership.

It should answer:

- what did the user already address?
- what changed because of it?
- why did an issue reopen?

Do not turn it into a performance score or 100% completion target.

---

# 9. Lightweight decision record

## 9.1 Purpose

When `Commit` is genuinely the most valuable next move, offer a light record:

- chosen option;
- confidence;
- concise rationale;
- key assumption to watch;
- revisit trigger or date.

This preserves agency and enables later learning.

## 9.2 PoC status

Design and prototype it now.

Durable saving depends on required identity, persistence and Model Management decisions.

Until those dependencies land:

- label it honestly;
- do not imply cross-session durability;
- do not create a local substitute for canonical decision-record storage;
- do not expand it into task management, project delivery or ownership workflows.

---

# 10. Advanced and receipts

## 10.1 Purpose

Provide expert depth without burdening the default experience.

Potential content:

- simulation count and seed;
- provenance and build identifiers;
- model limitations and warnings;
- identifiability status;
- technical diagnostics;
- unavailable-feature explanations.

## 10.2 Risk profile

The user's decision risk posture belongs in the Decision overview if it actively changes coaching.

Technical or model risk diagnostics belong in Advanced.

Do not conflate:

- user risk preference;
- decision stakes;
- model robustness;
- evidence quality;
- uncertainty in the outcome.

---

# 11. Cross-surface integration

The Analysis tab should feel physically connected to the graph and AI.

## 11.1 Analysis tab to graph

Use the existing focus and highlight infrastructure.

Expected behaviours:

- clicking an option focuses and selects its option representation;
- clicking a driver focuses the factor;
- clicking a flip risk focuses the causal connection;
- hovering an entity-linked item may highlight it without moving the viewport;
- explicit click may pan, select and open the appropriate inspector;
- all interactions respect reduced motion.

Reuse existing `focusByTarget`, `EntityLink`, graph selection and highlight-pulse seams where appropriate.

Do not create a second focus system.

## 11.2 Graph to Analysis tab

Improve the reciprocal direction:

- selecting an option can highlight or reveal its Analysis row;
- selecting a factor can open Drivers and identify its rank and evidence quality;
- selecting a fragile connection can open Flip risks;
- selecting the goal can expose Goal fit or the success-measure action;
- selecting an element should not unexpectedly replace the whole Analysis narrative.

Treat this as contextual focus, not a permanent filter unless the user explicitly chooses one.

## 11.3 Analysis tab to AI

Every `Work through with Olumi` action should open a contextual working session with:

- recommendation or method identity;
- relevant entity references;
- grounding signal;
- current brief quality;
- current analysis state;
- intended outcome of the dialogue.

Examples:

- clarify a missing constraint;
- generate a non-hiring option;
- review the strongest case against the leader;
- plan an evidence check for a fragile assumption;
- translate a qualitative goal into a measurable success definition.

The user should not need to restate context.

## 11.4 AI to graph

Where the current response contract supports target references:

- render them as clickable entity links;
- clicking focuses the graph;
- accepted graph edits should auto-pulse changed elements;
- proposals should show their target clearly;
- unknown block kinds should render an honest fallback rather than disappear.

Do not create a new outbound directive contract in this UI brief. If a richer highlight, open-inspector or panel-navigation directive is needed, route it through the orchestrator and shared-schema process.

## 11.5 AI to Analysis tab

Useful future integrations:

- AI can open the relevant recommendation or evidence view after a dialogue;
- completing a coaching dialogue can mark a recommendation `in progress`;
- accepting a proposed model change can mark it `addressed` only after the canonical write succeeds;
- rerun completion should refresh the priority order;
- the AI can explain why a recommendation appeared, disappeared or reopened.

Use existing system events and typed actions where available. Do not use fragile DOM coupling.

## 11.6 Canvas edits and visibility

When the user or AI changes the model:

- visibly pulse changed elements;
- mark analysis stale through the sole freshness owner;
- keep the next recommendation grounded in the latest completed analysis until rerun, clearly labelled;
- after rerun, update the Analysis read and recommendation plan coherently.

---

# 12. Data and semantic ownership

## 12.1 UI responsibility

The UI:

- displays contract-backed values;
- adapts layout and progressive disclosure;
- routes user intent;
- focuses graph elements;
- opens contextual AI sessions;
- submits approved edits through existing action paths.

The UI does not:

- compute model truth;
- derive option similarity;
- invent trust bands;
- calculate graph hashes;
- create local version history;
- approximate What changed;
- synthesise ungrounded trade-offs;
- rank next actions using new local semantics.

## 12.2 CEE responsibility

CEE or the approved coaching layer owns:

- brief critique and framing questions;
- science-grounded coaching narratives;
- grounded bias prompts;
- option-set coverage or homogeneity interpretation where contracted;
- structured recommended actions and target references;
- explanatory narrative around deterministic analysis.

## 12.3 PLoT and ISL responsibility

PLoT and ISL own:

- analysis request validation;
- outcome distributions;
- Goal fit probabilities;
- drivers and sensitivity;
- robustness and fragile relationships;
- Value of Information;
- canonical semantic transforms and repairs.

## 12.4 Shared selector layer

Use one approved adapter or selector layer so that:

- Hero;
- option rows;
- graph option labels;
- WinGauge or equivalent;
- evidence views;
- AI references

show the same values, order and labels.

Do not allow each component to independently interpret the raw response.

---

# 13. Design System v5 requirements

The implementation must feel native to Olumi.

## 13.1 Typography

- Inter only.
- Side-panel components use only:
  - `panelHeader`: 14px, semibold
  - `panelBody`: 12px, regular
  - `panelMeta`: 11px, regular
- Use semantic typography tokens.
- Do not use raw font-size or font-weight utility classes.

## 13.2 Colour

- Use exact semantic, entity and data tokens.
- Do not invent colours.
- Neutral backgrounds for cards, banners, accordions and pills.
- Main shades for text, icons and borders.
- Entity light shades only for canvas fills and entity-linked hover states.
- Primary action uses the approved info-blue to success-green interaction.

## 13.3 Borders and surfaces

- Full borders only.
- No left-only accent borders.
- No coloured card backgrounds.
- Use shared panel surface, radius and shadow patterns.
- Avoid nested cards unless the hierarchy genuinely requires them.

## 13.4 Icons and language

- Lucide icons only.
- Sentence case.
- British English.
- Use `and`, not `&`.
- No em dashes.
- User-facing language says factors, connections, assumptions, goal, outcomes and risks.
- Do not expose node, edge, coefficient, elasticity, normalised or graph hash.
- Prefer `leading option`, not `winner`.
- Prefer `check` or `review`, not `validate`.

## 13.5 Accessibility

- Accordion headers and rows are buttons, not clickable divs.
- Correct `aria-expanded`, tab roles and focus order.
- Keyboard operation for menus, tabs, accordions and modals.
- Focus must return to the invoking control.
- Do not rely on colour alone.
- Honour reduced-motion preferences.
- Do not place essential information only in 11px metadata.

---

# 14. Refinement authority

You are encouraged to improve the prototype where this brings it closer to the design system and improves function.

You may refine:

- spacing;
- content density;
- typography token use;
- component reuse;
- responsive behaviour;
- accessibility;
- labels and helper copy;
- progressive disclosure;
- loading, empty, stale and unavailable states;
- animation restraint;
- graph focus and AI hand-off interactions;
- duplication removal.

You may not independently change:

- semantic meaning of analysis fields;
- ranking logic;
- trust calculations;
- graph mutation contracts;
- version or freshness authority;
- schema shapes;
- producer responsibilities;
- prompt content;
- persistence architecture.

If a useful improvement requires one of those changes, document the proposal and stop that part rather than implementing a local workaround.

---

# 15. Implementation approach

Do not ship this as one uncontrolled rewrite.

## Wave 0: read-only audit and plan

Before changing code:

1. Read:
   - `CLAUDE.md`
   - current HANDOVER and ROADMAP rows for Analysis
   - Design System v5
   - current Analysis Hero and Focus panel code
   - selector and freshness code
   - graph focus helpers
   - current Actions menus
   - current feature flags
2. Produce a component map:
   - current component;
   - current data source;
   - current flag;
   - target component;
   - keep, merge, retire or defer;
   - integration seams to reuse.
3. Identify exactly which prototype elements already exist and which are fixture-only.
4. Propose the PR sequence and touched files.
5. Do not implement until the plan is reviewed.

## Wave 1: Decision overview and action ownership

- build the compact overview;
- consolidate the Actions menus;
- implement ready, thin and contradictory framing states;
- connect direct edit and AI hand-off;
- preserve one freshness owner.

## Wave 2: Merged Analysis panel

- preserve current live Hero behaviours;
- merge Drivers, Flip risks and Trade-offs under evidence disclosure;
- reuse the shared selector;
- keep unavailable states honest;
- preserve rollback behind the existing transition flag until acceptance.

## Wave 3: Strengthen your model

- implement one primary recommendation;
- restore Show more, Show fewer, Expand all and Collapse all;
- add lifecycle and addressed history;
- route actions to direct edit, canvas focus or AI;
- use producer-backed recommendation sources only.

## Wave 4: cross-surface integration and polish

- graph focus and hover links;
- contextual AI hand-offs;
- applied-edit pulse;
- accessibility;
- responsive behaviour;
- Design System v5 audit.

## Wave 5: gated additions

Only when dependencies exist:

- durable decision records;
- live option-similarity signal;
- version-backed What changed;
- per-option Stability;
- richer AI directives;
- collaboration and outcome learning.

One lane at a time. Each wave should be independently testable and reviewable.

---

# 16. Required states and fixtures

Create or reuse representative fixtures for:

1. Ready brief, no target
2. Ready brief, valid target
3. Thin brief
4. Contradictory brief
5. Fresh analysis
6. Stale analysis
7. Close call
8. Clear leader
9. Identical rendered outcome values
10. Stability unavailable
11. What changed unavailable
12. Narrow or homogeneous option set
13. High-influence, low-evidence factor
14. Fragile relationship with alternative leader
15. Commit is the top recommendation
16. No current recommendations
17. Long option labels
18. Missing units
19. Partial analysis response
20. Unknown AI block fallback

Fixtures must be explicitly labelled as fixtures and must never masquerade as live analysis.

---

# 17. Behavioural acceptance criteria

## Decision overview

- ready state is compact and collapsed;
- thin and contradictory states expand automatically;
- contradictory framing pauses reliance on the read;
- exactly one framing question is promoted;
- Actions is persistent and not duplicated elsewhere;
- decision classification can be reviewed or corrected.

## Freshness

- one freshness owner;
- stale state identifies the recovery action;
- no local freshness derivation.

## Analysis

- headline, ordering and values reconcile with the approved selector;
- Goal fit only appears with a valid success measure;
- Stability and What changed remain honest when unavailable;
- main driver and top flip risk are distinct;
- evidence rows focus the correct graph entities;
- long option labels remain legible;
- no copy overstates a tie.

## Strengthen your model

- one recommendation is expanded by default;
- recommendations are producer-backed;
- Show more and Expand all have distinct functions;
- addressed and dismissed states persist for the current session;
- failed actions do not mark items addressed;
- new analysis reprioritises without resetting all history;
- broaden does not appear without a valid similarity signal.

## Success measure

- validates metric, finite threshold, unit and timeframe;
- uses user units;
- causes one canonical rerun;
- does not mutate graph topology.

## Decision record

- clearly labelled prototype-only until persistence lands;
- captures the five agreed fields;
- does not imply task-management functionality.

## Cross-surface

- entity links focus the graph;
- AI sessions receive the relevant context;
- accepted edits visibly pulse;
- stale state updates coherently;
- unknown blocks do not disappear silently.

## Design and accessibility

- no raw colour or typography utilities;
- full borders only;
- neutral card backgrounds;
- Lucide icons;
- keyboard-complete interactions;
- reduced-motion support;
- British English and sentence case.

---

# 18. Testing expectations

Follow the repository's RED-first and review discipline.

Minimum tests:

- selector reconciliation;
- brief-state behaviour;
- success-measure validation and single rerun;
- unavailable lens honesty;
- recommendation grounding and ordering;
- recommendation lifecycle;
- narrow-option gating;
- driver and flip-risk focus routing;
- Actions ownership;
- stale/fresh behaviour;
- unknown-block fallback;
- feature-flag ON and OFF liveness;
- accessibility checks for tabs, accordions, menus and modals.

Tests should assert behavioural truth and user-visible meaning, not merely component shape.

Use real captured boundary fixtures where possible.

---

# 19. Explicit do not

Do not:

- create visible stage navigation;
- add another permanent panel;
- restore a separate Understand the result panel;
- duplicate `Define success`;
- duplicate freshness;
- duplicate the next recommendation in Actions;
- invent trust or option-similarity signals;
- approximate What changed locally;
- implement local graph mutation, CAS, hashing or version truth;
- hardcode prompt content;
- expose internal analytical terminology;
- ship fixture data as live;
- silently drop unknown AI blocks;
- retire the current Hero without a rollback path and staging acceptance;
- expand the PoC into collaboration, task management or outcome-learning infrastructure.

---

# 20. Required return pack

On completion of each wave, report:

- what changed;
- screenshots of all key states;
- components and existing seams reused;
- new files and touched files;
- tests run and results;
- Design System v5 audit;
- accessibility audit;
- data source for every displayed semantic claim;
- any fixture-only or unavailable behaviour;
- cross-surface integration demonstrated;
- deviations from this brief;
- open product or architecture decisions;
- recommended next wave.

Before merge, perform an independent self-adversarial review of the full diff.

---

# 21. Final product test

The completed Analysis tab should let a user answer, with minimal effort:

1. What decision is Olumi helping me think through?
2. Has it been framed well enough to rely on?
3. How consequential and reversible is it?
4. What does the current model suggest?
5. Why?
6. What could change the result?
7. What should I improve next?
8. Can I act on that directly, inspect it on the graph or work through it with Olumi?
9. What have I already addressed?
10. Am I ready to make a provisional decision and record what would change my mind?

If those answers require the user to decode multiple duplicated panels, search through menus or restate context to the AI, the experience is not finished.
