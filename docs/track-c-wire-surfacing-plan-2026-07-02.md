# Track C — schema/wire alignment + surfacing plan (2026-07-02)

**Repo refs verified this session:** DGAI `origin/staging` @ `5a4a9ff1` · CEE `origin/staging` @
`2376914c8` (post-#318; originally audited on `475922b300`). **Companion evidence:** CEE `Docs/v5/ui-wire-contract-skew-evidence.md` +
`tests/contract/cee-egress-wire-surface-pin.test.ts` (branch `claude/trackc-egress-wire-pin`).

**Status: plan only.** No DGAI code changes are authorised on this branch. The schema-bump
implementation branch needs separate authorisation from Paul.

## 0. Framing — this is a live output-loss defect

DGAI pins `@talchain/schemas@0.8.1` ([package.json:95](../package.json) →
`vendor/talchain-schemas-0.8.1.tgz`); CEE staging pins `0.13.0`. CEE's egress is the **strict**
`OlumiResponseSchema` at 0.13.0, which includes four Phase-3 block types
(`coaching`, `evidence`, `exercise`, `review_card`) that 0.8.1 has never heard of. CEE may
already be producing coaching, evidence, exercise and review-card output that this UI cannot
recognise or render. Boundary validation here is observational only
(`warnOnInvalidApiResponse()` in `src/lib/api-schemas.ts` logs and continues), so the loss is
silent — nothing fails closed, nothing names the dropped blocks.

## 1. Slice 1 (keystone): schema bump 0.8.1 → 0.13.0

Scope of the implementation branch (when authorised):

1. **Vendor swap:** add `vendor/talchain-schemas-0.13.0.tgz` (+ `.sha256`, matching the existing
   `vendor/README.md` convention), update `package.json` pin, refresh lockfile.
2. **Compile surface:** `OrchestratorTurnPayload` (used by `src/v5/v5Adapter.ts` `callV5Turn()`)
   and any other `@talchain/schemas` imports must compile against 0.13.0 — expect additive block
   union members and new optional fields; breaking renames must be enumerated during the bump by
   diffing the two tarballs' `dist/` type surfaces.
3. **Block handling:** `src/v5/responseParser.ts` + `src/lib/v5EmbeddedEvidence.ts` iterate
   `response.blocks`; verify unknown-block handling today (silent skip) and make the four new
   block types *recognised* — even if Slice 2 rendering hasn't landed, they should reach a typed
   store with a feature-flagged fallback rendering (e.g. collapsed "coaching" card), not be
   dropped.
4. **Boundary validation upgrade (small, high value):** keep `warnOnInvalidApiResponse`
   observational (fail-closed at the UI would brick turns on any CEE hotfix), but add a
   **named-drop log + telemetry event** when a block of unknown `type` is discarded, so skew
   becomes visible instead of silent (see Slice 3).
5. **Regression gate:** re-run the draft/turn adapter tests; smoke a live staging turn journey
   (draft → analyse → coaching) before/after and diff the rendered block census.

Risk note: 0.8.1→0.13.0 spans many contract versions; the CEE-side pin test now enumerates the
exact 0.13.0 surface, so the bump has a machine-checked target shape rather than a guess.

## 2. Slice 2: render what's currently dropped (ranked)

| Rank | Surfacing item | Wire source (0.13.0) | Where it lands |
|---|---|---|---|
| 1 | **Coaching blocks** (`coaching_kind`, `title`, `body`, `action_label`/`action_intent`, `priority_rank`, `freshness`) | `blocks[type=coaching]` | DraftChat / PreAnalysisPanel coaching card stack (`src/canvas/components/pre-analysis/PreAnalysisPanel.tsx`) |
| 2 | **Review cards** (`card_kind`, `severity`) | `blocks[type=review_card]` | results/review surface (`src/components/results/*`) |
| 3 | **Evidence blocks** (`evidence_gap`, `current_confidence`, `impact_if_gathered`, `suggested_technique`) | `blocks[type=evidence]` | evidence-gap cards; ties into guidance `evidence_gap` item_type already in telemetry taxonomy |
| 4 | **Exercise blocks** (pre-mortem-shaped: `counter_case`, `failure_scenario`, `mitigation`, `warning_signs`) | `blocks[type=exercise]` | guided-exercise panel (new component) |
| 5 | **`suggested_actions[].action_type`** | top-level `suggested_actions` | chip styling/routing by action type |
| 6 | **`strengthen_items[].actionType` + `biasCategory`** | already adapted in `src/adapters/cee/client.ts` `mapDraftCoachingFromResponse()`, never rendered | bias-category badges on strengthen/bias cards — **needs no schema bump; could ship first as a warm-up slice** |
| 7 | **Enrichment values** (`flip_thresholds` values, `confidence_tier`, `inference_warnings`, `edge_e_values`) | `blocks[].enrichment` carriers (schema-unpinned) | fragile-edge UX + confidence badges + warnings sidebar; today `src/lib/v5EvidenceKeys.ts` uses some only as promotion gate keys |

Copy for new surfaces goes through the existing consolidated copy modules
(`src/canvas/ui/inspector-v2/coachingConfig.ts`, `src/components/results/constants.ts`) — no
scattered strings.

## 3. Slice 3: field-arrival observability (non-executor)

Extend `src/telemetry/guidanceEvents.ts` (shown/clicked/dismissed exist today) with arrival
events, keeping the module's data-minimisation rules (ids/kinds only, never content):

- `coaching_received` — counts by `block.type` per turn (incl. an `unknown_block_type` count —
  the skew alarm);
- `enrichment_keys_received` — key names present on enrichment carriers (names only, no values);
- optional dev-only console table gated by the existing telemetry-enabled check.

This is what turns "the UI silently drops output" into a measurable, alertable signal, and it
directly serves the coaching-readiness evidence lane (CEE side already has the egress pin test).

## 4. Sequencing & authorisation gates

1. This plan doc (doc-only branch) — done.
2. **Paul gate:** authorise the schema-bump implementation branch (Slice 1). Rank-6
   (`actionType`/`biasCategory` badges) can optionally run before/parallel to the bump since it
   needs no schema change.
3. Slice 2 rendering in priority order, each its own PR.
4. Slice 3 observability can land with Slice 1 (the unknown-block counter is most valuable
   *before* the bump ships everywhere, to quantify current loss on staging).

## 5. Verification recipe for the bump branch (when it runs)

- `npm`/`pnpm` install + typecheck + existing adapter/parser unit tests green.
- Contract cross-check: the CEE pin test's expected surface (top-level keys, 12 block types,
  Phase-3 key sets) must match what the bumped UI schemas parse.
- Live staging journey smoke: run a draft+analyse turn against CEE staging, assert the four block
  types round-trip into the UI store (or the `unknown_block_type` counter is zero).
- Fetch-and-verify DGAI `origin/staging` again at branch time (this plan verified `5a4a9ff1`).
