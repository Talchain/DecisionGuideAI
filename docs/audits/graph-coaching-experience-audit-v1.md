# Olumi Graph Coaching Experience & Progressive Disclosure Audit — v1

**Date:** 2026-07-05 · **Auditor:** Claude (live-experience audit + code trace)
**Environment:** deployed staging (`https://staging--olumi.netlify.app/#/canvas`), worktree
`claude/jovial-leakey-a3fd71` at exact parity with `origin/staging` (code == deployed).
**Method:** live driving of the real staging app (screenshots, wire captures, payload replays)
paired with code tracing at the deployed commit.
**Tagging authority: Cross-workstream Graph Data Contract v0.2** (supersedes v0.1):
`analysisAffectingHash` owns analysis/proposal/referee staleness; `graphIdentityHash` owns future
strict CAS, version identity and restore safety; #341 is the reference mutation-envelope candidate
to evolve (not a hard no-go); layout is display identity — excluded from `analysisAffectingHash`,
in `graphIdentityHash` only if persisted.

> Audit only. No code changes, no commits, no schema/prompt/migration changes, no durable
> mutations. Paul's canvas model was restored byte-identically after observation (§2).

---

## 1. Executive verdict

**Do we have enough coaching-experience clarity to begin implementation? Yes — for a
coherence-and-disclosure brief.** The disclosure architecture (Standard/Detailed/hover/inspector)
is built and largely sound; the CTA repertoire is rich; the staleness system is genuinely good.
What blocks the graph from feeling intelligent is not missing surface area — it is that **the
same number changes meaning between states, adjacent surfaces contradict each other, and the two
most-coached loops dead-end silently.** Those are fixable now, mostly with Safe UX / Safe
passthrough changes.

**Is the graph under-, over-, or mis-coaching? All three, by state — but the dominant failure is
mis-coaching:**

- *Pre-analysis Standard* coaches adequately (triage line, needs-input pills, EdgePills,
  hover Layer-2). Slightly under: nothing tells you *why* to switch to Detailed.
- *Detailed view* over-discloses and physically breaks: expanded cards overlap and bury
  neighbouring titles — post-analysis the **goal node itself is fully occluded** by risk cards.
  In-card and cross-card duplication is heavy (same from→to values twice on one option card;
  same edge weight on source pill + target list + edge card + inspector, in up to six different
  vocabularies).
- *Mis-coaching is structural:* factor-card percentages silently switch meaning between states
  (pre = edge **weight** "▲ 30 %", post = edge **beliefExists** "85 %", same position, same
  format, no label change); "No sensitivity or fragility signals fired. Your model is currently
  consistent." renders when robustness never ran; "Robustness unknown" sits beside "77 %
  stability"; three surfaces make three contradictory statements about one intervention
  ("→ 60 %" / "Does not change" / "↑ 20 %").
- *The coached loops break at the wire:* the canvas run path (⌘Enter, command palette) sends a
  **legacy V1 request that silently drops edge direction, beliefs, observed values and the goal
  threshold** — so the app's own headline coaching ("Adding a specific target unlocks
  probability calculations") is a dead end on that path, and the two run buttons that users can
  actually see ("Analyse first pass", error-state "Try Again") are silent no-ops. Meanwhile the
  chat-side Rerun runs a *different, richer* pipeline (CEE server-side) that produced a
  **contradictory recommendation on the same model** (leader flipped from Outsourced Contractor
  Team to Hire One Senior Engineer). One screen, two engines-in-effect, two truths.

**Highest-value next implementation brief:** *"One number, one meaning, one run path"* — a
coherence brief (§10) that (a) fixes the broken run CTAs and routes the canvas run through the
already-existing rich request builder, (b) removes silent semantic switches and duplicate
renderings, (c) resolves the Detailed-view occlusion with disclosure (not layout) changes, and
(d) ships the first safe AI-to-graph slice (drive the existing highlight/pulse from existing
result targets). All within UI wiring + display; no schema, hash, CAS or layout-system changes.

**Prior-audit corrections (per instruction #4):** deployed staging **falsifies** repo-default
flag assumptions. Live-verified ON: Graph Lens (6 lenses render), evidence-gap badges,
cross-highlight flag, Compare tab (mounted, empty state), analysis hero, deterministic-CEE
blocks, pre-analysis enriched + v3, AI Panel v2. The FocusNow static rows are **mounted and
rendering** in the Analysis panel ("Strengthen your model" list). Conclusions in earlier audits
or memory that these were "dark/unmounted" are superseded by this audit's screenshots. Still
genuinely dormant: `guidance_items` (none emitted by CEE all session — strip and inspector
sections never rendered), CoachingPanel Phase-0 module (no mount), Journey tab (not in dock).

---

## 2. Evidence base

**Environments inspected**
- Deployed staging app in Chrome (real CEE + PLoT staging backends), 1512×806 viewport.
- Worktree at parity with `origin/staging` (0/0 divergence) for code tracing.
- PLoT staging service direct (`plot-lite-service-staging.onrender.com`) for wire verification.

**Scenario used**
- Paul's recovered model "Product Team Growth Strategy" (goal: Ship v2 Within 6 Months with
  Sustainable Burn; 4 options, 5 factors, 2 outcomes, 3 risks, 31 edges, 16 nodes) — almost
  certainly the graph in Paul's two seed screenshots. Walked: pre-analysis → thin-path analysis →
  goal-target edit → stale → CEE-path analysis → fully decorated state → undo/restore.

**States covered:** Standard & Detailed pre/post-analysis (whole-graph + band close-ups); hover
(factor/outcome/option popovers, option→factor intervention highlight, edge card); selection
(factor/option/goal/edge, path isolation); inspectors (factor + tech mode, option pre/post, goal
pre/post, edge); Analysis panel (critical issues, feature chips, hero both generations, trust
strip, FocusNow rows, Winner-by toggle, option cards, What's-driving-this, Stress-test,
Advanced); Compare (empty), Model tab; Graph Lens (menu, Evidence, Robustness, Full); staleness
(5 affordances, chat intercept, post-undo mixed state); Olumi chat (V5 turn, staleness intercept,
chat Rerun, analysis_result block); keyboard legend + templates panel (incidental).

**States NOT covered:** graph_patch proposal card / ghost preview / Apply–Dismiss (no patch
offered; per instruction #6 only a throwaway scenario would have been used); Compare with ≥2
runs; Journey tab (absent from dock); `guidance_items` rendering (CEE emitted none);
comparison/flip/premortem/exercise blocks (none emitted); cross-highlight hover sync (no
observable trigger found in session time).

**Payloads captured**
- Thin-path run body (verbatim): `{"graph":{"nodes":[{id,label,kind}],"edges":[{from,to,id,
  weight}]},"seed":1337,"goal_node":"goal_v2_launch","detail_level":"deep"}` — no direction,
  beliefs, observed state, interventions or goal threshold.
- Direct PLoT replay: 200 in 0.34 s (deep, 17.5 KB) incl. `critique[GRAPH_TOO_LARGE BLOCKER:
  "16 nodes (limit: 12). Results marked approximate."]`; proxy replay with app headers + SSE
  Accept: 200 in ≤0.5 s — while all five browser POSTs 504'd (~30 s each).
- PLoT CORS preflight: allow-list omits `x-olumi-sdk` (sent by plot-client) — breaks direct
  fallback calls; masked by same-origin proxy.
- July 4 debug bundle (`~/Downloads/olumi-debug-6151b593-20260704.json`): deployed flag truth
  (36 flags), different scenario.
- Autosave (17.7 KB) chunk-captured and backed up in-browser
  (`olumi-canvas-autosave-AUDIT-BACKUP-20260705`), restored byte-identically (verified
  JSON-equal on nodes and edges).

**Deviations / disclosures**
- Browser→Netlify `/bff/engine/v1/run` POSTs consistently 504 in this environment while
  identical curl requests succeed in <1 s (direct and via proxy, any header combination) —
  browser-transport-specific infra fault, needs separate follow-up. To obtain post-analysis
  states, the page's engine calls were temporarily rerouted in-tab to the same staging PLoT
  host (same service, identical payload; `x-olumi-sdk` stripped to clear the CORS gap).
  Wrappers removed by reload at session end.
- A goal target (≥100) was set via the app's own UI to exercise the coached loop, then reverted
  by undo + wholesale autosave restore (byte-equal verified). Analysis results live in
  sessionStorage only (this tab); Paul's model data is untouched.
- CDP tab screenshots repeatedly wedged immediately after clicking the fit-view control
  (reproduced on two tabs); tooling note only, not a product finding.

---

## 3. Current coaching data map

Value classifications: **Valuable / Duplicate / Noisy / Hidden-but-important / Misplaced /
Unsafe-derived / Broken-garbled / Gated / Dead**. Tags per the brief's scheme.

| Datum | Source (verified) | Displayed where | Coaching job | Classification | Tag / recommendation |
|---|---|---|---|---|---|
| Decision triage line ("Top gap: validate X") | UI-derived priority scan (DecisionNode.tsx) | Decision node, pre-analysis | What to fix first | **Valuable** (best pre-analysis cue on canvas) | Safe UX now: keep; it is the model for "one line per node" |
| Decision mini-hero ("X leads in 77 % of scenarios, but sensitive to Y" + Stability) | CEE-path result passthrough | Decision node, post-analysis | What won / how solid | **Valuable** | Safe passthrough now: keep; make it the canonical on-canvas answer line |
| Factor EdgePills "▲ 30 % v2 Shipping Speed" | Edge **weight** magnitude (EdgePills.tsx:52, via computeSignedMean) | Factor nodes, pre-analysis | Which outputs this factor moves | Valuable but **semantically fragile** (see next row) | Safe UX now: label the number ("strength"), keep |
| Post-analysis "Influences:" % (85 %, 78 %…) | Edge **beliefExists** (useNodeConnections.ts:49-58) | Factor/outcome/risk cards, Detailed | Confidence in links | **Unsafe-derived in effect / mis-coaching**: same slot+format as pre-analysis weight %, different meaning, no label change | Safe UX now (P0): label as "confidence"; never let the two states share a bare "%" format |
| "assumed strength" → "% of your goal" / "% goal drag" | Same goal-edge weights relabelled (RiskNode/OutcomeNode bridge metric) | Outcome/risk nodes | Contribution to goal | **Mis-coaching** when value is just the prior weight: post-analysis label implies computed contribution | Safe UX now: only relabel when a computed contribution exists; else keep "assumed strength" |
| Win probability + bar + "Leading option" badge | CEE-path result (win rates) | Option nodes, post-analysis | What is winning | **Valuable** | Safe passthrough now; also render on thin-path runs once run paths unified |
| "Leads via New Headcount Added, the #1 driver" | CEE-path driver + link | Leader option node | Why it wins + pointer | **Valuable** (best cross-channel coaching on canvas) | Safe passthrough now; wire its click to the standard highlight/focus behaviour |
| "Behind: fewer key changes" (×2 identical) | UI-derived reason bucket | Loser option nodes | Why behind | **Noisy/Duplicate** (identical copy on both losers; low information) | Safe UX now: suppress when non-differentiating |
| "16 % win probability" + "16 % win rate across simulations" | Same datum rendered twice (OptionNode status-quo branch) | Status-quo card | — | **Duplicate** on one card | Safe UX now: one rendering |
| Option delta pills + "Interventions:" list (pre-analysis Detailed) | node interventions | Option cards | What the option changes | **Duplicate** within one card | Safe UX now: single list |
| Intervention statements ("→ 60 %" / "Does not change Team Seniority" / "↑ 20 %") | popover formatter vs canvas annotation vs inspector chip | 3 surfaces simultaneously | — | **Broken-garbled** (three contradictory statements; annotation's no-change condition wrong) | Safe UX now (P0): one formatter, one phrasing, fix the no-change threshold |
| Factor hover "Option values: Medium / Very low / Very high / no change" | UI-derived qualitative buckets | Factor popover | Compare options on this factor | **Misplaced vocabulary** (matches nothing else on screen) | Safe UX now: reuse the same formatted values as option cards |
| "Olumi estimated this from your brief. High leverage, low evidence." | UI/CEE provenance boilerplate | Every inferred factor card (Detailed) | Provenance + evidence nudge | **Noisy** (verbatim ×3+) | Safe UX now: keep once per node in inspector; on canvas reduce to the sparkle + one short line |
| `uncertainty_drivers` prose | CEE observedState passthrough | Factor inspector ("Current team composition not specified…") | Why the estimate is uncertain | **Valuable, well-placed** | Keep (inspector-only) |
| Edge hover card ("Negative / 90 % confident / bar 30 %") | direction + beliefExists + weight passthrough | Edge hover | Understand a link | Valuable but **ambiguous copy** (bare "Negative"; unlabelled bar; % vs % adjacency) | Safe UX now: "Effect: negative · Strength 30 % · Confidence 90 %" |
| Edge "Sensitive · N %" label | `robustness.fragile_edges[].switch_probability` (StyledEdge.tsx:906-909) | Post-analysis edges | Where the result is vulnerable | **Valuable** (top fragility signal) | Safe passthrough now; N needs a label on hover ("chance this flips the result") |
| Edge phrase labels ("Moderate boost (uncertain)") | **UI-derived** buckets (edgeLabels.ts:70-117; thresholds 0.7/0.3 weight, 0.8/0.6 belief) | Post-analysis Detailed edges | Human-readable edge meaning | **Unsafe-derived (untagged)** + clipped by cards + collides with lens labels | Assign UI-SEM id or remove; if kept, tag + fix collisions. **Do not** present as engine output |
| Bare +/− edge glyphs | direction sign (StyledEdge) | Post-analysis edges | Direction reminder | **Noisy** (cryptic floating glyphs) | Safe UX now: drop or fold into hover |
| Evidence lens "Unknown basis" ×31 | lens per-edge label | Evidence lens | What's grounded vs assumed | Valuable concept, **Noisy execution** (31 identical labels + collisions) | Safe UX now: label only exceptions; legend carries the default |
| Robustness lens with no data | lens + empty robustness | Robustness lens | Where result is vulnerable | **Broken-feeling** (active lens changes nothing; legend-only "0") | Safe UX now: on-canvas empty state ("No fragility data this run") |
| Goal readiness checklist (Title/Threshold/Connected/Options) | UI state | Goal inspector | What the goal still needs | **Valuable** | Keep |
| Goal "✓ 87 %" header pill | aggregated inbound edge confidence (inspector header badge) | Goal/outcome/risk inspector headers, pre+post | — | **Unsafe-derived in effect**: unlabelled; reads as success probability pre-analysis | Safe UX now (P0-adjacent): label ("Link confidence 87 %") or remove pre-analysis |
| "Decision stability 77 %" bar + "Stability: 77 % (moderate)" | CEE-path stability | Goal node + decision node | How solid the result is | Valuable, but co-shown with "Robustness unknown" chip | Safe UX now: one stability/robustness statement per surface, consistent wording |
| "No sensitivity or fragility signals fired. Your model is currently consistent." | UI copy on empty robustness | Stress-test section | — | **Unsafe reassurance** when robustness didn't run | Safe UX now (P0): distinguish "didn't run" from "ran clean" |
| Critique "Graph too large: 16 nodes (limit: 12)" | PLoT critique passthrough | Critical Issues card | Model-size warning | Valuable passthrough, but **cross-layer contradiction** with UI limits (50/40) and "(blocks analysis)" heading over rendered results | Gated by data contract: align PLoT limit vs UI limits upstream; Safe UX now: fix heading (§8 P1) |
| "What's driving this" (empty) vs "✓ Drivers" chip | drivers list gated to empty vs feature chip | Analysis panel | Top drivers | **Broken-garbled** contradiction | Safe UX now: empty-state copy + reconcile chip logic |
| Thinking patterns (switch challenge, outside view) | CEE/critique-derived blocks | Stress-test section | Debias prompts | **Valuable** | Keep; candidates for graph anchoring later (design-only now) |
| FocusNow "Strengthen your model" rows | static hygiene rows (mounted) | Analysis panel | Generic next steps | Valuable pre-analysis; **Noisy/stale post-analysis** ("Define what success looks like" persists after success is set) | Safe UX now: hide rows whose condition is already satisfied |
| Model tab factor cards ("AI estimate", "defaulted to 0…", priors) | canvas + CEE provenance | Model tab | Verify the model | **Valuable** (best verify surface) | Keep; fix normalisation leakage ("n:0.00", raw 0–1) — Safe UX now |
| "5 factors · 31 connections" vs "15 relationships" | two counters, different scopes | Advanced vs Model tab | — | **Duplicate/contradictory** | Safe UX now: one scope, one label |
| Chat staleness intercept ("results may be out of date… re-run?") | freshness verdict → chat | Olumi chat | Prevent stale explanation | **Valuable** (best cross-surface behaviour observed) | Keep; the pattern to generalise |
| guidance_items (strip, inspector cards, pulse) | CEE envelope (none emitted all session) | — | Targeted next actions | **Hidden-but-important / dormant**; canvas highlight from guidance never wired | §7 ruling: Safe passthrough now (see below) |
| CoachingPanel Phase-0 module | local module, unmounted | — | Coaching signals | **Gated** (Gate Zero) | Keep dark until certification; not part of this brief |
| `enrichment.causal_validation`, `evidence_freshness`, `critique[].code`, `model_card.identifiability_tag` | PLoT parsed-not-rendered | — | Trust/method depth | **Hidden-but-important** (inspector/Advanced candidates) | Design-only now: reserve an "Analysis methods" disclosure in Advanced |

---

## 4. Current functionality map

| Function / control | Surface | Observed behaviour | Classification | Recommendation |
|---|---|---|---|---|
| "Analyse first pass" button | Pre-analysis panel | Silent no-op (5 clicks, zero network/console/UI) | **Valid but broken** — V5 chip dispatch (`OutputsDock.handleRunAnalysis` → guidanceStore `_dispatchAction`) is fire-and-forget; no dispatcher registered until the Olumi chat mounts | P0 fix: register dispatcher independent of chat tab, or fall back to `runV2Analysis()` when unregistered |
| Error card "Try Again" | Analysis panel error state | Silent no-op (same signature) | **Valid but broken** (same class) | Same fix; must never no-op silently |
| ⌘Enter / palette "Run Analysis" | Canvas | Works; but sends thin V1 body (drops direction/belief/threshold/values; `detail_level:'deep'` hardcoded httpV1Adapter.ts:464; field-name mismatches: mapper reads `confidence`/`belief` where canvas stores `beliefExists`; threshold extractor reads `value/baseline_value/target` where GoalPanel writes `goal_threshold*`) | **Valid but broken (wire)** | P0: route canvas run through the existing V2 builder (`executeV2RunWithAnalysisReady` → `/v2/run`, already implements UI-SEM-001 signed mean, exists_probability, goal_threshold) |
| Chat "Rerun" chip | Olumi chat | Works — CEE server-side analysis; rich results | **Working** | Make this and the canvas run converge on one pipeline (P0 above) |
| Dock "Rerun analysis" / "Run analysis" buttons | Stale banners | Worked post-chat-mount (blue state); greyed/no-op earlier | Ambiguous → same dispatcher issue | Same P0 fix |
| Standard/Detailed eye toggle | Left rail | Works; tooltip names current mode only; adjacent to lens "View (L)" | Working, **ambiguous labelling** | P2: "Switch to Detailed view" phrasing + distinct naming from Lens |
| Graph Lens (L + dropdown) | Left rail | Works; 6 lenses; Evidence lens noisy; Robustness lens no-op without data | Working (flag ON — corrects prior "dark" assumption) | P1 polish (empty state, exception-only labels) |
| Evidence-gap badges | Factor nodes | Flag ON; EvidenceGapBadge conditions not triggered by this model (factors have estimates) | Working-gated by data | none |
| Node selection → path isolation | Canvas | Works (dim + banner); self-referential copy on goal; recolours edges blue (kills direction channel); inspector auto-open inconsistent (factor yes, goal/option no) | Working with defects | P1: keep direction hue in path highlight; consistent open behaviour; fix goal banner copy |
| Node/edge selection → chat context | Chat input | Works ("Ask about X…", "Selected: X") | **Working** (excellent) | Keep |
| Option hover → intervention highlight | Canvas | Works (teal ring + "→ value" annotations) | Working (grammar bug "1 engineers"; "Does not change" bug) | P1 copy/threshold fix |
| Hover popovers | Nodes/edges | Work; **fail to dismiss** (stale popover persisted through selection+inspector+scroll) | Valid but broken | P1: dismissal on selection/inspector open |
| Edge double-click editor | Edge label | Not exercised (labels rarely visible) | Untested | — |
| Inspector v2 panels | All types | Work; strong coaching; option panel unit leakage; "No connections yet." false; header truncation | Working with defects | P1 fixes |
| StaleGuardBanner + staleness system | Panels/chat/bottom bar | Works; 5 simultaneous affordances; post-undo "Cannot confirm…" + greyed hero; **canvas decorations stay saturated while stale** | Working; canvas is the gap | P1: staleness treatment on canvas result decorations |
| Command palette (⌘K) | Global | Present (per code; legend confirmed); not fully exercised live | Working (assumed) | — |
| Keyboard shortcuts | Canvas | Work — including when typing outside inputs (stray-keystroke storm observed) | Working, hazard | P2: ignore single-letter shortcuts while chat/canvas text focus ambiguous |
| Save Snapshot ⌘S / history clock | Top bar | Not exercised (mutation-adjacent) | Untested | — |
| Compare tab | Dock | Mounted, good empty state (corrects prior "OFF" assumption) | Working | — |
| Model tab | Dock | Working verify surface; count mismatch vs Advanced | Working with defect | P2 |
| Templates panel (T) | Overlay | Mounted with demo templates | Working | — |
| Patch Apply/Dismiss + ghost preview | Chat | Not observed (no patch emitted) | Untested — gated by Graph Management for durable semantics | Design-only now |
| guidance pulse (`useGuidancePulseHighlight`) | Canvas | Never fired (no guidance_items; nothing else drives it) | **Dead-in-effect infrastructure** | §7 ruling |
| Browser→proxy run transport | Infra | 5/5 browser 504 vs curl 200 <1 s; PLoT CORS misses `x-olumi-sdk` | **Broken (infra)** | Separate infra ticket — P0 blocker for any coaching evaluation on staging |

---

## 5. Component-by-component coaching map

Format per component: **current → target coaching job**; default / hover / inspector / panel-AI
placement; unsafe or gated items.

**Decision/root node** — Current: triage line (pre), mini-hero + Stability + 2 CTAs (post).
Target: *the graph's one-line answer surface.* Default: exactly one line (top gap pre-analysis;
winner + confidence caveat post). Hover: the "why" one-liner (top driver). Inspector: readiness
breakdown. Panel: full hero. CTAs "Challenge this result" / "Compare options" are the right
grammar — keep. Unsafe: none. Already close to target.

**Option nodes** — Current: title + delta pills (pre); win % + badge + "Leads via"/"Behind" +
chips (post, CEE path only). Target: *what this option changes, and how it's doing.* Default:
title + ≤3 formatted deltas (pre); win % bar + one differentiating reason (post). Hover: full
delta list + "What could go wrong?"/"Why does this lead?". Inspector: editable interventions in
**display units** (never raw normals), Impact, comparison. Panel: ranked comparison. Remove:
duplicate Interventions list (Detailed pre), duplicate win-rate phrasing (status quo),
non-differentiating "Behind:" copy. Unsafe: raw 0–1 values and "does not change" bucket.

**Factor nodes** — Current: value + EdgePills (pre); Influences/belief % lists + provenance
boilerplate + uncertainty (Detailed); sensitivity coaching (CEE post). Target: *what we assumed,
how confident we are, whether it matters.* Default: value + provenance icon + (post) sensitivity
rank/flag only. Hover: pills with labelled strength + per-option values in display units.
Inspector: full provenance, uncertainty drivers, per-option values, influences. Unsafe: bare-%
semantic switch (weight↔belief) — P0; qualitative bucket vocabulary unique to popover.

**Risk / outcome nodes** — Current: "% goal drag" / "% of your goal" relabelled weights +
Depends-on lists + chips. Target: *route importance.* Default: one metric only when computed;
otherwise keep "assumed strength" wording. Hover: drivers list. Inspector: full. "What reduces
this?" / "Add mitigation" / "What strengthens this?" chips: right grammar, wrong density —
show on hover/selection, not ×3 inline in Detailed.

**Goal node** — Current: needs-input coaching (good), then post-analysis copy that ignores the
set target (bug), stability bar (CEE path). Target: *is success defined, and how likely is it?*
Default: target + P(goal) when available; stability bar. Hover: drivers. Inspector: checklist +
target editor + constraints. Unsafe: unlabelled 87 % pill; "Set a target…" copy after target set.

**Edges** — Current encodings: colour=direction, width=importance, dash=existence-certainty;
labels only post-analysis Detailed (top-3/hover/selected) + fragility "Sensitive · N %" + phrase
labels + glyphs. Target: *silent by default; fragility is the one always-on exception.*
Standard: encodings only. Detailed: + "Sensitive · N %" on fragile edges (the only persistent
label class), phrase labels retired or moved to hover. Hover/selection: labelled card ("Effect:
negative · Strength 30 % · Confidence 90 %" + evidence CTA). Inspector: editors + evidence +
direction (currently buried under Fine-tune). Unsafe-derived: `describeEdge()` phrase buckets
(untagged UI semantics) — tag with a UI-SEM id or remove.

**Standard view** — job: **"What matters now."** One glanceable line per node, encodings on
edges, decision-node answer line. Currently adequate pre-analysis; must gain the post-analysis
result layer (win %, badge, fragility) which today only appears via the CEE path.

**Detailed view** — job: **"Why the model behaves this way."** Currently over-discloses
(duplication) and physically overlaps (goal node buried — P0). Target: Detailed adds *one*
extra stratum (drivers/links lists + labelled fragile edges), never free-grows cards beyond
their layout cell: cap card height with internal "+N more" disclosure instead of expanding over
neighbours (this is a card-content policy, not a layout/spacing change).

**Hover** — job: Layer-2 preview + cross-highlight. Works well; must dismiss reliably; unify
vocabulary with cards.

**Inspector** — job: full parameters + provenance + per-element coaching. Strongest surface
today; fix unit leakage, false "No connections yet.", header truncation, unlabelled pills.

**Analysis panel** — job: the answer + trust + next actions. Rich but self-contradicting
(Critical-Issues heading, empty Drivers vs ✓ chip, robustness copy). One verdict per concept.

**Olumi panel** — job: narrative, challenge, next action. The staleness intercept and
selection-aware input are the two best cross-surface behaviours in the product; the "Preparing
explanation…" → explanation + Analysis-result card flow works. Keep it the only *conversational*
surface — do not duplicate its narrative on canvas.

**AI callouts / proposal cards** — not observed (no patch this session). Ghost-preview +
Apply/Dismiss wiring exists in code. Durable-apply semantics: **Gated by Graph Management /
Canonical State** per Contract v0.2 §11–13 — display-side ghosting and "proposed" labelling are
design-only now.

---

## 6. Target progressive-disclosure model

- **Standard view — "What matters now."** Per node: identity (shape+title) + one state line
  (value / win % / target / one-metric) + at most one flag (needs-input, sensitivity, leading).
  Edges: encodings only. Decision node: the answer line. Nothing else.
- **Detailed view — "Why the model behaves this way."** Adds: per-node driver/link lists
  (labelled, one vocabulary), fragile-edge labels ("Sensitive · N %" only), provenance icons'
  short line. Cards never exceed their cell: internal "+N more" instead of overlap. CTAs appear
  on hover/selection, not inline en masse.
- **Hover — preview + pointing.** Layer-2 popover (same vocabulary as cards, same units as
  inspector); option-hover highlights affected factors (existing, keep); dismisses on any
  selection/inspector event.
- **Selection — focus + context.** Path isolation (keep direction hues, fix goal copy),
  consistent panel-open behaviour, chat context binding (existing, keep).
- **Inspector — everything about one element.** Parameters in display units, provenance,
  uncertainty, evidence, per-option values, elements' coaching cards. Tech mode = numbers.
- **Analysis panel — the answer + trust + actions.** Hero (one ranking vocabulary + a bridge to
  the canvas number: "win chance" everywhere), trust strip (one robustness statement),
  drivers (never empty without an explanation), stress-test, state-aware FocusNow rows.
- **Olumi AI — narrative + challenge + next action**, selection-aware, staleness-guarded
  (existing pattern).
- **Anchored graph coaching (future)** — one transient callout at a time, driven by
  guidance_items/drivers targets (§7); persistent badges only for fragility/needs-input.
- **Proposal cards** — ghost styling + "proposed" labels remain display-only until Graph
  Management lands (gated).

---

## 7. AI-in-graph interaction model

**What exists and works today (keep, generalise):** selection→path isolation; option-hover→
factor highlight + annotations; "Leads via X, the #1 driver" link on the leader card;
selection-aware chat; chat staleness intercept; "Show on graph" links in detailed sections;
HighlightLayer + `highlightedNodes/Edges` store; `useGuidancePulseHighlight` +
`guidance-pulse-ring` CSS (danger/info variants) — currently undriven.

**Requested ruling — drive canvas highlight/pulse from `guidance_items.target_object`:**
**Safe passthrough now.** Rationale under Contract v0.2: guidance_items already carry
`target_object{type,id}`, `related_elements`, and `valid_while{analysis_hash, graph_hash}`;
eviction on hash mismatch and on element deletion is already implemented in guidanceStore;
the pulse is a DOM-class display effect that derives no meaning, writes nothing, and respects
`analysisAffectingHash` staleness via the existing `valid_while` eviction. Layout untouched
(display identity, §10). **This is the first safe implementation slice**, with one caveat: CEE
currently emits no guidance_items (observed all session), so ship it together with the same
mechanism driven from *result* targets that do exist today — fragile-edge ids
(`robustness.fragile_edges[].edge_id`), driver node ids, and "Leads via" factor ids — all
Safe passthrough now.

- Highlight behaviour: pulse ring + 2 s cooldown (existing), plus optional `fitView`-to-target
  using the existing panel-aware padding (`computeFitPadding`) — display-only, no layout change.
- Callout behaviour: one anchored, dismissible callout at a time, text = the guidance/driver
  copy verbatim (no UI-composed semantics) — **Safe UX now** for result-anchored copy;
  **design-only now** for anything requiring new CEE fields (`display_title`, staleness copy —
  known Lane-A wire gaps).
- Focus actions: "Focus top estimate" / chip actions route through the same dispatcher —
  fix the dispatcher-registration bug first (§8 P0-2).
- Proposal states: ghost nodes + "proposed" labelling = design-only now; Apply/Reject and any
  durable mutation = **Gated by Graph Management (envelope #341 evolution) + Canonical State
  (strict CAS)** — do not wire beyond the existing chat-block Apply path.
- Version/journey surfaces (compare runs on canvas, restore) = **Gated by Model Management**.

---

## 8. Top issues

### P0 (5)
1. **Canvas run path silently discards user's model** (direction, beliefExists, observed
   values, goal threshold; `detail_level` hardcoded 'deep') — V1 mapper field-name mismatches
   (`mapper.ts:188-245` reads `confidence`/`belief`; canvas stores `beliefExists`;
   `httpV1Adapter.ts:443-459` reads `value/baseline_value/target`; GoalPanel writes
   `goal_threshold*`). Evidence: captured wire body; goal-target loop dead-ends
   ("unlocks probability calculations" → nothing). **Action:** route ⌘Enter/palette through the
   existing V2 builder (`/v2/run`) which already implements UI-SEM-001 + threshold. *Safe
   passthrough now* (existing contract, existing code). Surfaces: canvas run, all result
   decoration. No layout risk.
2. **Primary run CTAs are silent no-ops** ("Analyse first pass", "Try Again", dock Run before
   chat mount) — fire-and-forget chip dispatch with no registered handler. **Action:** register
   the dispatcher at app mount or add explicit fallback + error surfacing. *Safe UX now.* No
   layout risk.
3. **Two rival analysis pipelines return contradictory recommendations on the same model**
   (thin path: "Outsourced Contractor Team leads"; CEE path: "Hire One Senior Engineer leads by
   61 pp") with no indication which truth the user is seeing. **Action:** converge on one
   pipeline (with #1) and label result provenance in the hero. *Safe passthrough now* after #1.
4. **Silent semantic switch of factor percentages** (weight ▲30 % pre vs beliefExists 85 % post,
   same slot/format; EdgePills.tsx:52 vs useNodeConnections.ts:58) plus the intervention
   triple-contradiction ("→ 60 %" / "Does not change" / "↑ 20 %"). **Action:** label both
   number families; single intervention formatter; fix no-change threshold. *Safe UX now.*
5. **Detailed view buries the goal node** (and neighbouring titles) under expanded cards.
   **Action:** cap card height with internal "+N more" disclosure (card-content policy — not
   spacing/size/layout changes). *Safe UX now.* Layout system untouched.

### P1 (5)
1. **False verdict copy on missing analyses:** "No sensitivity or fragility signals fired.
   Your model is currently consistent." when robustness never ran; "✓ Drivers" chip over an
   empty drivers list; "(blocks analysis)" heading above rendered results. Distinguish
   didn't-run / ran-clean / blocked. *Safe UX now.*
2. **Staleness doesn't reach canvas decorations** (win %, Stable pill, winner headline stay
   saturated while every panel says stale). Grey/annotate canvas result layers under the same
   freshness verdict. *Safe passthrough now* (verdict exists).
3. **Goal-state contradictions:** unlabelled "✓ 87 %" pill; "Set a target to see your chances"
   with target set; "Probability data unavailable" after successful run. One goal-state model.
   *Safe UX now* (copy/labels) + depends on P0-1 for the probability itself.
4. **Popover dismissal + vocabulary:** popovers persist through selection/inspector; qualitative
   bucket labels (Medium/Very low…, Slight/Moderate/Strong/Very strong, Strong +/Moderate −,
   signed decimals, %) — six vocabularies for edge strength. One scale, labelled, everywhere.
   *Safe UX now.*
5. **PLoT node-limit vs UI limits:** engine BLOCKER at >12 nodes while UI allows 50/40 and CEE
   drafts 16 — every normal draft is permanently "approximate" with a Critical Issue. Align
   limits (or downgrade critique display for the supported range). *Gated by data contract*
   (cross-service decision); UI can meanwhile soften presentation (*Safe UX now*).

### P2 (5)
1. View-toggle labelling ("Standard view" tooltip names state not action; "View (L)" naming
   clash with lens). *Safe UX now.*
2. Truncation set: mid-word differentiator, inspector header, edge phrase labels, "1 engineers"
   grammar, "Outsourced Contracto…" popover labels. *Safe UX now.*
3. Evidence-lens noise ("Unknown basis" ×31 + label collisions) and Robustness-lens silent
   no-op; lens empty states. *Safe UX now.*
4. Count/notation mismatches: "31 connections" vs "15 relationships"; normalisation leakage in
   Model tab and option inspector ("n:0.00", raw 0–1 alongside £/engineers). *Safe UX now.*
5. FocusNow static rows not state-aware ("Define what success looks like" after success
   defined). *Safe UX now* (visibility conditions only, no new semantics).

**Infra ticket (outside UI scope but blocking):** browser→Netlify `/bff/engine/v1/run` 504s
(curl fine); PLoT CORS allow-list missing `x-olumi-sdk`. Without this, no run works from the
deployed browser UI at all.

---

## 9. Protected non-goals — confirmation

No recommendation in this report requires changes to: graph spacing, node sizing, canvas
density, zoom defaults, auto-layout physics, graph data truth, hashing/normalisation, CAS,
mutation envelope, Apply/Reject wiring, restore, structural compare, or Journey/versioning.
The Detailed-view occlusion fix is a card-content disclosure policy (cap + "+N more"), not a
layout change. The AI-in-graph slice drives existing display-only highlight machinery. Items
that would touch protected systems are explicitly tagged Gated (PLoT limit alignment — data
contract; proposal Apply semantics — Graph Management/Canonical State; run-history compare —
Model Management) and are excluded from the safe implementation scope.

---

## 10. Implementation brief seed

**Title:** Graph coaching coherence v1 — one number, one meaning, one run path.

**Goal:** the same model state tells the same story on every surface; the two coached loops
(set a target → see chances; run analysis → see results) complete end-to-end from the visible
CTAs; the graph gains its first AI-pointing slice.

**Scope (safe now):**
1. Run-path unification: canvas/palette/panel run → existing V2 builder (`/v2/run`); fix chip
   dispatcher registration; error surfacing on all run CTAs; label result provenance in hero.
2. Number coherence: label strength vs confidence everywhere (one vocabulary + tech-mode
   numerics); single intervention formatter (fix "does not change" threshold + "1 engineers");
   remove duplicate renderings (option card ×2 lists, status-quo ×2 win rate, redundant
   "Behind:" copy); reconcile relationship counts; display-units-only in inspector inputs.
3. Verdict honesty: didn't-run vs ran-clean vs blocked states for robustness/drivers/critical
   issues; goal-state machine (target set/unset × probability available/unavailable) driving
   goal node + inspector + hero copy; stale treatment extended to canvas decorations.
4. Detailed-view containment: card height cap + internal "+N more"; CTA chips move to
   hover/selection; boilerplate provenance line reduced to icon + short line.
5. AI-to-graph slice 1: shared focus/highlight utility (pulse + optional fit-to-target reusing
   `computeFitPadding`) driven by (a) fragile-edge ids, (b) top-driver node ids, (c) "Leads
   via" link, (d) guidance_items.target_object when CEE starts emitting; "Show on graph" links
   converge on it.

**No-touch:** layout/spacing/zoom/auto-arrange systems; schemas & wire formats (V2 request
shape already exists); hashing/normalisation/CAS/envelope/restore/compare/Journey; prompts;
persistence; PLoT internals (limit alignment raised as a contract ticket, not implemented).

**Gated (tracked, not in scope):** PLoT node-limit alignment (data contract); proposal-card
durable Apply (Graph Management + Canonical State); run-compare on canvas (Model Management);
anchored callouts needing new CEE fields (`display_title` etc. — Lane A).

**Acceptance criteria:**
- Clicking "Analyse first pass" either runs or visibly explains why not — no silent path.
- One analysis pipeline: canvas and chat rerun produce identical results on an unchanged model;
  wire body contains signed means, exists_probability and goal_threshold (verify by capture).
- Setting a goal target and rerunning changes goal-probability displays (loop closes).
- No surface shows an unlabelled bare "%" for edge data; pre/post formats are distinguishable.
- With robustness absent: no "consistent/clean" claims anywhere; with it present: fragile edges
  labelled and focusable.
- Detailed view: goal node title never occluded at default zoom on the audit scenario.
- Stale model: canvas win %/badges visibly de-emphasised within the same render pass as panels.
- Focus utility: fragile edge → pulse + viewport contains the edge, zoom level unchanged
  (fit padding only).

**Tests / manual review:** wire-capture assertion test for the run body (fields present);
component tests for formatter single-sourcing (strength vs confidence labels, intervention
phrasing); Detailed-view occlusion snapshot on the 16-node audit scenario; staleness
propagation test (edit → all four surfaces + canvas); manual staging walkthrough re-running
this audit's Phase-1 state matrix (checklist in §2).

---

## Appendix A — Hypothesis verdicts (the 11 from the brief)

1. Standard view under-coaches — **Partly upheld**: adequate pre-analysis; under-coaches
   post-analysis only because result decoration is pipeline-dependent (P0-1/P0-3).
2. Detailed view over-discloses — **Upheld** (duplication + overlap + chip density; goal node
   buried).
3. Influence/sensitivity repeated across source/edge/target — **Upheld and worse**: up to six
   vocabularies including inspector and edge card; plus a silent weight↔belief switch.
4. Edge labels collide/unreadable — **Upheld** in Detailed post-analysis and Evidence lens
   (label-on-label, card clipping); Standard is clean because labels are suppressed.
5. Causal labels truncated too aggressively — **Upheld** ("Monthly Burn Increas… is the key
   difference", "Moderate boost (unc…", inspector header).
6. Sparkle/checkmark ambiguity — **Partly upheld**: sparkles have tooltips but no visible
   legend at node level; the goal-header "✓ 87 %" pill is the acute case.
7. "Sensitive 37 %"-style labels unclear — **Upheld**: "Sensitive · 21 %" gives no referent
   (it is switch-probability); "90 % confident" vs "30 %" strength adjacency invites misreads.
8. CTA grammar inconsistent — **Rejected in the small, upheld in the large**: the six question
   families are surprisingly coherent (What could go wrong? / What evidence supports this? /
   What strengthens/reduces this? / What would change/make this lead? / Why does this
   lead/win-lose?); inconsistency is in *density* (×15 chips) and *broken* CTAs, not phrasing.
9. Graph/Analysis/Olumi not one system — **Upheld at the data layer** (two pipelines, three
   goal-state stories, verdict contradictions) — **rejected at the interaction layer**
   (selection-aware chat, staleness intercept, path isolation are genuinely integrated).
10. Valuable upstream coaching hidden/dropped — **Upheld**: guidance_items dormant;
    causal_validation/evidence_freshness/identifiability parsed-never-shown; CoachingPanel
    gated; and the biggest: user's own parameters dropped by the thin wire.
11. Layout/spacing/node size should remain protected — **Upheld**: no finding requires layout
    changes; the one physical defect (overlap) is solvable by card-content disclosure.

## Appendix B — Phase-A raw findings log

F1–F40 as captured live (kept for traceability; each is referenced above):

F1 view-toggle ambiguity · F2 pre-analysis Standard baseline · F3 Detailed overlap +
duplication + boilerplate · F4 four-surface edge-datum duplication, six vocabularies ·
F5 truncation set · F6 popovers (incl. no-dismiss bug, "1 engineers") · F7 edge hover card
ambiguity · F8 edge encodings + blue path recolour · F9 selection inconsistencies +
self-referential goal banner · F10 chat context binding · F11 factor inspector strengths ·
F12 edge inspector (direction buried) · F13 goal checklist + 87 % pill · F14 option inspector
unit leakage + "No connections yet." · F15 intervention triple-contradiction · F16 dead run
CTAs · F17 browser-only 504s · F18 PLoT 12-node limit vs UI 50 · F19 "(blocks analysis)" over
results · F20 thin-path all-100 ranking + relabelled weights · F21 empty Drivers vs ✓ chip ·
F22 stress-test false reassurance · F23 thin wire body truth · F24 goal-target dead end ·
F25 two pipelines, leader flip · F26 CEE-path decorated state (the good state) ·
F27 redundancy in decorated state · F28 robustness-unknown + 77 % stability · F29 target
unacknowledged post-CEE-run · F30 staleness system (5 affordances; canvas gap) · F31 lens
findings · F32 Model tab (counts, normalisation) · F33 Compare empty state · F34 FocusNow
static rows not state-aware · F35 results in sessionStorage (returning-user dead end) ·
F36 stray-keystroke hazard · F37 chat staleness intercept (exemplary) · F38 guidance dormant +
pulse undriven · F39 87 % pill source · F40 PLoT CORS `x-olumi-sdk` gap.
