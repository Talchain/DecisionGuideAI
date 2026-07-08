# Lane 1.6b — lift goal_fit_basis/display_verdict/confidence_tier through the live Seam-A mapper (claim-integrity)

**Branch:** `claude-ui/seam-1-6b-enrichment-lift` · **Base:** `origin/staging` @ `19094017`
**Doctrine:** render producer meaning verbatim, never invent/repair; additive only; RED-first.
**Reference:** `parallel-briefs/UI-BOUNDARY-DATA-INVENTORY.md`.

## Claim-type verification (STEP 1 — done before any fix)

Traced the live conversational analysis render path end-to-end:

- `/orchestrate/v2/turn` response → `useConversation.ts:3007 applyV5State(...)` →
  `applyV5State.ts:617 mapV5AnalysisToReport(analysisBlock)` → `store.resultsComplete({report, ..., rawV2Response: null})`
  (the comment at `applyV5State.ts` is explicit: *"V5 carries no V2 envelope; pass
  null so the canvas store's V2-shaped enrichment / rawV2Response slots are
  explicitly cleared rather than left to a stale prior write"*).
- The main Results panel (`OutputsDock.tsx:613`) reads `useResultsSectionData()`,
  which reads `results?.report` (`useResultsSectionData.ts:975`) — i.e. **Seam A's
  `mapV5AnalysisToReport` output is the only source on the live path**;
  `rawV2Response` is null so every Seam-B raw-response fallback in
  `useResultsSectionData.ts` is inert on this path.

**Verdict: the drop is on the live path and is user-visible.** Seam A
(`mapV5AnalysisToReport.ts`) is confirmed as the correct and only fix site for the
render path; Seam B (`responseMapper.ts`) is the secondary/browser-direct-PLoT path
and was left untouched (out of scope, not needed — see below).

## What was actually ON-WIRE vs what the mapper dropped

Verified against CEE's `P0B_SAFE_TRANSPORT_ENRICHMENT_KEEP` (`olumi-schemas` tag
`v0.14.0:src/boundary/enrichment.ts:599-611`, the 11-key CEE→UI keep-list):

| Field | ON-WIRE (Seam A, CEE keep-list) | Pre-fix mapper behaviour |
|---|---|---|
| `robustness.display_verdict` / `display_verdict_reason` | YES — `robustness` is a whole keep-list key | Read via a **subset** spread (`mapV5AnalysisToReport.ts:420-461` pre-fix); these two fields were never in the subset → dropped |
| `confidence_tier` (top-level scalar) | YES — one of the 11 keep-list keys | Never read at all → `report.confidence_tier` always undefined |
| `goal_fit_basis` (per-option, `option_comparison[].goal_fit_basis`) | YES — nested inside `option_comparison`, itself a keep-list key | Never read → 0 grep hits anywhere in the UI (confirmed before this lane) |
| `constraints_status` | **NO** — not one of the 11 keep-list keys; CEE's compose.ts strips it before it ever reaches Seam A | N/A — nothing to lift; see residual below |

`constraints_status` was grouped with the other three in the brief, but tracing the
actual CEE keep-list showed it is **not currently on the CEE→UI wire at all** on
Seam A (only reachable via the Seam-B raw V2 response, and even there only feeds a
CEE-context payload — `useConversation.ts:1925` — not a user render). This is a
**backend gap** (CEE compose.ts), not a mapper gap. Lifted defensively/forward-
compatibly in the mapper anyway (harmless, guarded on presence) so no further UI
change is needed once a CEE lane adds it to the keep-list — but it is currently
inert on Seam A. Filed as a residual (see below); not claimed as "now live."

## Fix

`src/v5/mapV5AnalysisToReport.ts`:
- `display_verdict` / `display_verdict_reason` added to the `robustness` spread
  (verbatim strings, `safeString`-guarded — same passthrough discipline as the
  existing `level`/`recommended_option_id` fields).
- Top-level `confidence_tier` lifted from `enrichment.confidence_tier` onto
  `report.confidence_tier` (verbatim string; the consumer already validates against
  the closed `strong|fair|needs_work` union).
- Per-option `goal_fit_basis` (`{scored_from, node_ids}`) lifted from
  `option_comparison[].goal_fit_basis` into `option_probabilities[optionId]`, via a
  new `normaliseGoalFitBasis` helper (narrowed, not opaque — matches the mapper's
  existing convention for nested objects).
- `constraints_status` lifted defensively (forward-compatible no-op today — see
  above).

`src/components/results/types.ts`: `ResultsReport.constraints_status` and
`ResultsOptionProbability.goal_fit_basis` typed; `OptionResult.goalFitIsModelledBasis`
added (the render-facing boolean).

`src/components/results/useResultsSectionData.ts`: `display_verdict` /
`display_verdict_reason` needed **no render-site change** —
`useResultsSectionData.ts:1420-1445` already reads
`rawRobustnessDisplayVerdict ?? robustness?.display_verdict` where
`robustness = report.robustness` (`:1349`), i.e. it already has a mapped-report
fallback for exactly this case (built for the Seam-B saved/hydrated path). Populating
`report.robustness.display_verdict` in the mapper was sufficient — verified, not
duplicated (per the brief's STEP 3 instruction). Likewise `confidence_tier` needed no
render-site change: `getConfidenceTier(report?.confidence_tier, ...)` (`:2028`)
already reads the mapped-report field directly with no raw-response dependency.

`goal_fit_basis` had **no existing render or consumption anywhere** (confirmed 0 grep
hits pre-lane), so its caveat needed a new render site:
- `useResultsSectionData.ts` computes `goalFitIsModelledBasis` per option — true only
  when the number about to be shown as `goalProbability` **is** the joint-goal figure
  (mirrors the existing `hasConstraints`/`jointGoalProb` fallback branches exactly,
  rather than comparing resulting numbers, to avoid a false-match on a coincidental
  equal value) **and** `goal_fit_basis.scored_from === 'modelled_outcome_distribution'`.
- `OptionCards.tsx` (the primary per-option "Hits target" card — the clearest,
  highest-traffic goal-fit render site) renders the caveat immediately below the
  `StatBar`/low-goal-warning, gated on `option.goalFitIsModelledBasis === true`,
  using the exact wording the honesty rule in the inventory prescribes.

**Scope note on "wherever the joint number appears":** the inventory's §4 item 3
says "render the caveat wherever the joint number appears." This lane renders it at
the primary option-card site (`OptionCards.tsx`). Two secondary sites also read
`probability_of_joint_goal`-derived values — `useNodeDisplayMetadata.ts` (canvas node
badge) and `analysis-hero/buildHeroModel.ts` (hero detail line) — left untouched to
keep this lane additive and minimal per its stated scope
("the specific render sites for the caveat/verdict... do not touch gratuitously").
Filed as a follow-up below.

## Verification (what actually ran)

- **RED-first, both layers, verified by `git stash` on the fix files + re-run:**
  - `mapV5AnalysisToReport.test.ts` new describe block: 3/6 new tests failed pre-fix
    (live 4-field fixture, goal_fit_basis-only-scored_from, constraints_status
    forward-compat) — the rest incidentally passed pre-fix (absence-path assertions
    that are true both before and after).
  - `useResultsSectionData.seamAEnrichmentLift.spec.ts` (new, builds the store
    exactly as `applyV5State` does — mapped report + `rawV2Response: null`): 3/4
    failed pre-fix (confidence tier, goal-fit caveat flag, honest-absence flag
    default); the display_verdict test passed pre-fix as well as post- because it
    happened to already flow through the pre-existing raw-response/mapped-report
    fallback pattern with a partially-populated report in that one shape — the
    3-field failure set is the true RED signal.
  - `OptionCards.goalFitBasisCaveat.spec.tsx` (new, component-level): asserts the
    caveat testid renders only when flagged, never fabricated.
- **Typecheck:** `pnpm run typecheck` (tsc -p tsconfig.ci.json) — clean.
- **Targeted vitest** (all touched files + their existing sibling specs in the same
  area, run together): **285 passed / 0 failed** —
  `mapV5AnalysisToReport.test.ts` (59), `mapV5AnalysisToReport.influence-warnings.spec.ts`,
  `useResultsSectionData.seamAEnrichmentLift.spec.ts` (4, new),
  `useResultsSectionData.goalProbability.spec.ts`, `useResultsSectionData.robustnessVerdict.spec.ts`,
  `useResultsSectionData.displayHonesty.spec.ts`, `useResultsSectionData.spec.ts`,
  `OptionCards.spec.tsx`, `OptionCards.displayHonesty.spec.tsx`,
  `OptionCards.goalFitBasisCaveat.spec.tsx` (2, new), `OptionCards.brief-5_1.spec.tsx`,
  `OptionCards.showAllCollision.spec.tsx`, `OptionCards.v5-visible-render.spec.tsx`.
- **`--changed` sweep:** one pre-existing failure
  (`useConversation.hook.spec.ts > V5 graph re-fetch on analyse response > fetches
  graph from DB and populates canvas when analyse response arrives with empty
  canvas`) — verified byte-identical on unmodified `origin/staging` (same assertion,
  same zero-calls result) via `git stash` on all lane files + re-run. A broader
  `--changed=origin/staging` sweep (no `-t` filter) additionally surfaced ~49
  "failed" files under `src/canvas/` and `src/telemetry/` (e.g.
  `guidanceEvents.spec.tsx` throwing `Cannot read properties of undefined
  (reading 'some')` in `focusHelpers.ts` via `GuidanceStrip.tsx`) — spot-checked two
  of these in isolation with the lane's changes stashed and got the **identical**
  failure/stack trace, confirming pre-existing test-isolation flake unrelated to this
  lane's additive-only optional-field changes (no removed/renamed exports, no changed
  function signatures on existing call sites). Not chased per the chronic-CI-red
  disclosure convention (ROADMAP 1.26 class).
- Full local suite NOT run (OOMs by policy); "Staging Tests" CI chronic red is
  pre-existing — disclosed, not chased.

## Residuals (follow-ups, not this lane)

1. **`constraints_status` is not actually on the CEE→UI Seam-A wire.** CEE's
   `compose.ts` `P0B_SAFE_TRANSPORT_ENRICHMENT_KEEP` (11 keys) omits it. This lane's
   mapper change is forward-compatible but inert until a CEE lane adds it to the
   keep-list (inventory §4 item 5). No user-facing constraint-status surface exists
   yet either way.
2. **Two secondary goal-fit render sites left untouched:** the canvas node badge
   (`useNodeDisplayMetadata.ts` → some node-badge component) and the analysis-hero
   detail line (`analysis-hero/buildHeroModel.ts`'s `goalFit` copy) both derive from
   `probability_of_joint_goal` and could show the same caveat. Not done here to keep
   the lane additive/minimal; flag for a follow-up UI lane if the hero/node-badge
   surfaces are judged worth the same honesty treatment.
