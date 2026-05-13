# V5 Analysis-tab data contract — v1.3 (FROZEN)

**Status:** FROZEN (2026-05-13). This is the canonical authoritative
shape for Phase 3A of the V5 completion programme. Subsequent revisions
land as new versioned files (`v1_4.md`, `v1_5.md`, …) and are recorded
in the V5 tracker change log. **`v1_3.md` is not edited in place.**

**Companion documents (out of scope here):**
- `olumi-coaching-ux-requirements-v1.md` — UX requirements §9.1–§9.4
  are the acceptance standard for Phases 3A (§9.1+§9.2) and 3B
  (§9.3+§9.4).
- `V5_CURRENT_STATE.md` — programme tracker. Phase 3A section
  references this contract as its hard constraint.

**Repo path (canonical):** `docs/v5/v5-analysis-tab-data-contract-v1_3.md`

---

## 1. Purpose

Defines the wire-level contract between CEE (orchestrator-v5) and the
DecisionGuideAI Analysis tab for coaching content produced by
`decision_review` (auto-invoked after every successful `run_analysis`
per the Phase 2 homework decision, Option A).

The contract covers:

- Four coaching block types: `ReviewCardBlock`, `CoachingBlock`,
  `EvidenceBlock`, `ExerciseBlock`.
- Standard block metadata that every coaching block carries.
- Freshness / staleness semantics emitted by CEE; canonical user-
  facing copy chosen by the Analysis tab.
- Interaction intents and their handler-registry round-trip
  requirement.
- Suppression rules for raw / internal values in user-facing prose
  (consumes Phase 2c's centralised suppression).
- Copy-length and formatting constraints + fallback behaviour for
  missing or invalid fields.
- The `target_refs` discipline that separates machine references
  from human-readable display text.

What this contract does NOT define:

- Visual rendering decisions (icon, colour, layout, density). Those
  are owned by the Analysis tab and are deliberately absent from the
  contract (correction §3 below).
- Backend prompt content. Phase 3A handlers produce the contract
  shape from `decision_review` outputs; the prompt is implementation
  detail and may evolve without contract changes.
- Phase 3B-only fields (`draft_graph` coaching outputs,
  `coaching_state` persistence shape beyond the `coaching_state_key`
  used for de-duplication). Those land in `v1_4` or later.

---

## 2. Six adopted corrections (locked, 2026-05-13)

These corrections were applied during the 2026-05-13 reconciliation
pass. They are MANDATORY for every Phase 3A implementation and carry
through Phase 3B unless explicitly superseded in a later contract
version.

### §1. Separate display text from machine references

Every coaching block exposes:

- `target_refs[]`: array of machine-readable IDs (e.g. `fac_churn`,
  `opt_a`, `goal_y`, `con_42`, `e_b__y`). Used by the UI to look up
  current labels, navigate to entities, or invoke registered actions.
- Human-readable display fields (`label`, `text`, `summary`, etc.):
  pre-resolved by CEE using the live graph + label registry, ready
  to render. **Never derived by the UI from a raw ID.** If the UI
  needs a label, it reads the resolved field; the `target_refs` are
  for action wiring only.

Renderer contract: a renderer that receives a `target_refs` value
but no matching display field MUST fall back to the contract's
fallback copy (correction §6), not to "fac_churn" or similar raw ID.

### §2. Standard block metadata

Every coaching block, regardless of type, carries the following fields:

```ts
{
  block_id: string;              // ULID or UUID; stable for the lifetime of
                                 // a coaching_state_key.
  block_type: 'ReviewCardBlock' | 'CoachingBlock' | 'EvidenceBlock' | 'ExerciseBlock';
  priority: number;              // Integer ranking within the response.
                                 // Lower = higher priority.
  priority_band: 'critical' | 'recommended' | 'optional';
  freshness: 'fresh' | 'stale' | 'unknown' | 'none';
  freshness_reason:
    | 'graph_hash_match'
    | 'graph_hash_diverged'
    | 'missing_inputs'
    | 'no_prior_analysis'
    | 'cache_invalidated_by_edit'
    | 'budget_exceeded_degraded'
    | string;                    // Open-ended for forward-compatibility;
                                 // unknown reasons map to the "unknown"
                                 // canonical copy in the UI.
  created_at: string;            // ISO 8601 UTC.
  coaching_state_key: string;    // Graph-hash-based dedupe key; see §4.
}
```

Metadata is rendered **conditionally** (e.g. a "Stale" pill when
`freshness === 'stale'`); it is **never leaked into prose**. Renderers
read `freshness` + `freshness_reason` and select canonical copy from
the UI's translation map — they do not echo backend strings.

### §3. Visual rendering decisions owned by the Analysis tab

CEE emits **semantic content**: what the block *means*, what its
priority is, what its freshness is, what entities it references.
The Analysis tab decides **how it renders**: icon choice, colour
palette, layout density, animation, dismissibility.

Phase 3A backend MUST NOT bake visual hints into the contract.
Specifically, the following fields are PROHIBITED on coaching blocks
in v1_3:

- `icon`, `icon_name`, `icon_svg`, `glyph`
- `color`, `colour`, `tint`, `tone`
- `variant` (when used to mean visual variant; semantic variants
  such as `priority_band` are fine)
- `layout`, `density`, `grid_position`, `width`
- `animation_kind`, `transition`

If a future Phase 3B requirement makes one of these unavoidable, the
contract revision lands in `v1_4.md` and explicitly justifies it.

### §4. CEE emits freshness/status/reason; Analysis tab renders canonical copy

Backend signals:

- `freshness ∈ {fresh, stale, unknown, none}`
- `freshness_reason ∈ {graph_hash_match, graph_hash_diverged,
  missing_inputs, no_prior_analysis, cache_invalidated_by_edit,
  budget_exceeded_degraded, …}`

UI translation (canonical copy map, lives in DGAI):

| `freshness` + `freshness_reason` | Canonical UI copy |
|---|---|
| `fresh` + `graph_hash_match` | (no pill rendered) |
| `stale` + `graph_hash_diverged` | "This guidance may be stale — the model has changed since the last run." |
| `stale` + `cache_invalidated_by_edit` | "Edit detected; re-running analysis will refresh this guidance." |
| `unknown` + `missing_inputs` | "Coaching needs more analysis inputs to be reliable here." |
| `unknown` + `budget_exceeded_degraded` | "Coaching ran in fast mode; some depth may be missing." |
| `none` + `no_prior_analysis` | "Run an analysis first to unlock coaching for this scenario." |

The translation map is in the Analysis tab. **No prose freshness
strings in the backend.** A `freshness_reason` not in the map falls
back to the `unknown` canonical copy and the UI logs a tracker
follow-up.

### §5. Verify all interaction intents against the live handler/action registry

Every interaction intent emitted in a coaching block (e.g.
"validate this assumption", "edit this factor", "run sensitivity
on driver X") MUST round-trip through the registered handler /
action surface.

Contract:

- Each intent carries `intent_type: string` and `intent_args: object`.
- `intent_type` MUST exist in the live action registry — either as
  a backend tool handler name (e.g. `set_factor_value`,
  `add_constraint`, `run_analysis`) or as a registered UI action
  (e.g. `open_factor_inspector`, `scroll_to_node`).
- `intent_args` MUST validate against the action's input schema.
- **No orphan intents.** A coaching block that emits an unknown
  intent MUST be dropped by the central egress sanitiser (Phase 2c)
  with a tracker-logged event; the block does not render.

A registry check helper (lives in DGAI; mirror table in CEE for
emission-time validation) is consulted at both ends. Drift between
ends is a P1 blocker.

### §6. Copy-length / formatting + fallback for missing/invalid fields

Each block type declares (see §3 of each block-type schema below):

- Maximum **line count** for prose fields.
- Maximum **character count** per prose field.
- Allowed **inline formatting** (typically: `**bold**`, `*italic*`,
  `` `code` `` per the design system; never raw HTML).
- **Fallback text** when a required field is missing or invalid,
  e.g. `"Coaching unavailable for this run"` or
  `"This recommendation has no supporting evidence on file"` —
  never an empty block, never a crash, never a raw-ID leak.

Renderers must enforce caps client-side (truncate with ellipsis,
preserving formatting tokens) so a backend over-emission cannot
break the layout.

---

## 3. Block schemas

All blocks extend the standard metadata in §2 above.

### 3.1 `ReviewCardBlock`

Purpose: summary card surfaced at the top of the Analysis tab
when `decision_review` produces a primary review.

```ts
ReviewCardBlock = StandardBlockMetadata & {
  block_type: 'ReviewCardBlock';
  title: string;                    // ≤ 60 chars; 1 line.
  body: string;                     // ≤ 280 chars; ≤ 4 lines.
  verdict: 'on_track' | 'caveat' | 'reconsider' | 'insufficient_input';
  target_refs: string[];            // Entities the verdict references.
  primary_action?: InteractionIntent;  // See §4.
};
```

Fallback if any required field missing: render `"Review unavailable
for this run."` and log a tracker event.

### 3.2 `CoachingBlock`

Purpose: an individual coaching point (typically multiple per
response).

```ts
CoachingBlock = StandardBlockMetadata & {
  block_type: 'CoachingBlock';
  headline: string;                 // ≤ 80 chars; 1 line.
  body: string;                     // ≤ 400 chars; ≤ 6 lines.
  category: 'assumption' | 'evidence_gap' | 'sensitivity' | 'fragility' |
            'option_quality' | 'goal_alignment' | string; // forward-compat
  target_refs: string[];
  actions?: InteractionIntent[];    // 0–3 intents.
};
```

Fallback if `headline` missing: drop the block. Fallback if `body`
missing but `headline` present: render `headline + " — details
unavailable."`

### 3.3 `EvidenceBlock`

Purpose: cite-able evidence supporting a `CoachingBlock` or
`ReviewCardBlock`. Renders inline beneath its parent.

```ts
EvidenceBlock = StandardBlockMetadata & {
  block_type: 'EvidenceBlock';
  parent_block_id: string;          // Must match a sibling block's block_id.
  source_kind: 'graph_node' | 'analysis_metric' | 'isl_signal' |
               'plot_evidence' | 'historical_decision' | string;
  summary: string;                  // ≤ 200 chars; ≤ 3 lines.
  target_refs: string[];
  evidence_strength: 'strong' | 'moderate' | 'weak';
};
```

Fallback: if `parent_block_id` does not resolve to a sibling, drop
the block and log a tracker event.

### 3.4 `ExerciseBlock`

Purpose: a "next step" exercise the user can perform (validate an
assumption, run a sensitivity scan, edit a factor).

```ts
ExerciseBlock = StandardBlockMetadata & {
  block_type: 'ExerciseBlock';
  prompt: string;                   // ≤ 120 chars; 1–2 lines.
  exercise_kind: 'validate' | 'edit' | 'compare' | 'sensitivity' |
                 'add_evidence' | string;
  target_refs: string[];
  primary_action: InteractionIntent;  // Required; this IS the exercise.
  estimated_duration_seconds?: number;
};
```

Fallback if `primary_action.intent_type` is not registry-resolvable:
drop the block (no orphan exercises).

---

## 4. Interaction intent shape

```ts
InteractionIntent = {
  intent_type: string;              // Action registry name; see §2 correction 5.
  intent_args: Record<string, unknown>; // Validates against the action's schema.
  display_label: string;            // ≤ 40 chars; what the user sees on the button.
};
```

Renderer contract: a button rendered from an `InteractionIntent`
MUST dispatch via the action registry's standard dispatcher. No
inline navigation, no ad-hoc fetches, no bypassing the registry.

---

## 5. Envelope placement

Coaching blocks land on the V5 response envelope at:

```ts
OrchestratorResponseEnvelopeV2 = {
  // … existing fields …
  coaching: {
    blocks: Array<
      ReviewCardBlock | CoachingBlock | EvidenceBlock | ExerciseBlock
    >;
    coaching_state_key: string;     // Same key on every block in this array.
    decision_review_source: 'auto_invoke' | 'lazy_panel_open' | 'manual';
    degraded?: {                    // Present when budget_exceeded_degraded fired.
      reason: 'latency_budget_exceeded' | 'token_budget_exceeded' | string;
      fallback_invocation: 'lazy' | 'skipped';
    };
  };
};
```

`coaching.blocks` is **ordered**; renderers display in array order
unless they have explicit priority-based reordering rules (and
`priority` / `priority_band` must remain consistent with array
order).

---

## 6. Suppression rules

Phase 2c owns the centralised suppression machinery; coaching
blocks consume it. Specifically:

- All prose fields (`title`, `body`, `headline`, `summary`,
  `prompt`, `display_label`, fallback copy) pass through the
  Phase 2c egress sanitiser before leaving the orchestrator.
- Operator glyphs are always stripped from prose (Phase 2c
  boundary decision).
- Raw entity IDs never appear in prose; `target_refs` is the
  machine-references path.
- Backend vocabulary (`Zod`, `validator`, `envelope`, `noop`,
  `graph_hash`, etc.) never appears in prose.
- Edge `from::to` slugs are resolved upstream by Phase 2a.1; the
  egress walker defensively scrubs any that escape.

If suppression strips a required field to empty, the block falls
back per correction §6.

---

## 7. Acceptance summary (mirrors V5 tracker G3A gate)

Phase 3A is accepted when:

1. CEE emits all four block types on the V5 envelope, conforming to
   v1_3.
2. `decision_review` auto-invoke is wired with all guardrails (graph-
   hash dedupe via `coaching_state_key`, persistence, invalidation on
   edit, feature flag `VITE_ENABLE_AUTO_DECISION_REVIEW`, telemetry
   `decision_review.{latency_ms, input_tokens, output_tokens}`, auto-
   degrade-to-lazy threshold).
3. Analysis tab consumes the contract blocks and renders canonical
   copy from `freshness` / `freshness_reason` (no prose freshness
   strings from backend).
4. Every emitted interaction intent dispatches successfully via the
   live handler / action registry (no orphans).
5. Fallback rendering for missing / invalid fields is tested per
   block type.
6. Latency budget recorded; degrade-to-lazy threshold tested.

UX acceptance source: `olumi-coaching-ux-requirements-v1.md` §9.1 + §9.2.

---

## 8. Change log

- **v1.3 (2026-05-13)** — FROZEN. First version committed in repo.
  Carries the six adopted corrections from the 2026-05-13
  reconciliation pass. Tracked under `docs/v5/`. Originated as an
  unversioned working doc; v1_3 is the first canonical, in-repo,
  version-controlled release.

(Future versions append here with their changes and the tracker
change-log entry that introduced them.)
