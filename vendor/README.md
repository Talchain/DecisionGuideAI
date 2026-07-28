# vendor/

Checkout-stable local tarball references for pre-publish consumption of
private packages. Each tarball is checked in and pinned via
`file:./vendor/<name>.tgz` in `package.json`, so the path resolves
identically from a normal clone, a CI checkout, and any worktree.

## Current contents

### `talchain-schemas-0.29.0.tgz` ← THE CURRENT PIN

**Provenance: the PUBLISHED REGISTRY ARTEFACT, not a locally-packed branch.**
Fetched with `npm pack @talchain/schemas@0.29.0 --registry=https://npm.pkg.github.com`
from olumi-schemas #28 (merged `80c52743`). This matters: a merge can publish
something other than the reviewed branch, so the artefact that ships is the one
that was fetched from the registry, and the integrity recorded in
`pnpm-lock.yaml` after install
(`sha512-BAHbxcy/mIlCc+GNiOxvS4zadrl+0Kwecx4va886b6gicbTPwAzciuhQiPe3YU7kUj+FSclK10ApMf9NNk89qg==`)
is the registry's own. SHA256 manifest alongside as
`talchain-schemas-0.29.0.tgz.sha256`.

**What it adds (ROADMAP 1.346):** the `factor_value_edit` system-event kind —
the VALUE-CARRYING inspector edit `{target_id, value (model scale), raw_value?,
unit?, field? (literal 'value')}`. A sibling of `direct_graph_edit`, not a value
on it.

**Absorption cost 0.22.0 → 0.29.0, MEASURED at this tip rather than estimated:
ZERO.** Both gate projects were compiled at each pin and the sorted diagnostic
text diffed — **byte-identical** (`tsconfig.app.json` 2178, `tsconfig.tooling.json`
596; gate ratchet 626 files / 2517 errors either way). Counts alone would not
have been enough: the per-file ratchet is blind to a within-file swap, so the
comparison is on the diagnostic TEXT.

The zero is not vacuous — a positive control was run in both directions: a file
typing `{kind: 'factor_value_edit', …}` as `SystemEventTurnPayload['event']`
raises TS2322 at 0.22.0 and compiles clean at 0.29.0, so the instrument
demonstrably discriminates between the two pins.

Silent-drop census (hazard 1 — a consumer on an older pin drops fields it does
not know): **0 exports removed** from the `dist/boundary` surface and **0 field
names removed** from `olumi-response.d.ts`, `turn-payload.d.ts` or `enums.d.ts`.
`turn-payload` gains only additive members (the `graph_state` node/edge shape and
the `factor_value_edit` fields).

⚠ **Reader-first is mandatory for this member, not a preference.** `SystemEventSchema`
is a `discriminatedUnion` on `kind` whose members are all `.strict()`, so a
consumer pinned below 0.29.0 that receives `factor_value_edit` rejects the WHOLE
turn — not just the unknown field. The order is publish → CEE re-vendors → CEE
deploys → only then the UI emitter ships. CEE build `74d997a6` (pin ≥0.29.0) was
deploy-verified before this pin landed.

`src/lib/talchainSchemasVersion.ts` is bumped to `0.29.0` in lockstep (its spec
derives the expected value from the `file:` pin in `package.json` and fails on
drift).

### `talchain-schemas-0.21.0.tgz` (historical — no longer vendored)

**⚠ PREP tarball — NOT the publishable artefact. Deliberately built ADDITIVE-ONLY
(see anchor-drift note).** The `ActionType` enum gains `what_changed` as the 11th
value, after `analysis_readiness` — and NOTHING else moves relative to the UI's
current 0.20.0 pin.

**Provenance (anchor drift corrected).** The F2B brief said to pack olumi-schemas
`feat/actiontype-what-changed` (PR #17, enum commit `d27b1bb`, tip `798a395`)
directly. That branch, however, sits on top of PR #13 (compute-seam analysis
JSON-Schema types, `636c78b`) and PR #14 (`GoalConstraintSchema` →
`LegacyGoalConstraintStubSchema` rename, `9edcb34`) — both landed on `main`
AFTER the UI's committed 0.20.0 tarball, which was built from `1b936ec` (PR #12,
the 0.20.0 release — verified byte-identical `.d.ts` to the committed
`talchain-schemas-0.20.0.tgz`). Packing the raw branch head drags #13/#14 into
the UI and introduces ~113 non-additive `tsc` errors (the #14 rename in
particular), violating "additive only; nothing else moves".

So this prep tgz is built from `1b936ec` + ONLY the `what_changed` enum value
(version set to `0.21.0`), so the ONLY `.d.ts` delta vs 0.20.0 is the additive
`| "what_changed"` union member wherever `ActionType` is embedded
(`enums`, `boundary/olumi-response`, `boundary/turn-payload`,
`orchestrator/session`). Built + packed via `npm ci && npm run build &&
npm pack`; the schemas package suite is **1012/1012 green** at the branch head
(incl. `actiontype-what-changed.test.ts`).

**This tarball MUST be re-packed + sha-verified from the MERGED + PUBLISHED
0.21.0 tip before this UI change merges** (same protocol CEE PR #620 used for its
prep tgz). ⚠ The real published 0.21.0 will be built from `main` and WILL carry
PR #13 + #14 — so the re-pack step must be paired with a SEPARATE UI change that
absorbs those ~113 non-additive type deltas; that fold is out of scope for this
additive send PR. SHA256 manifest lives alongside as
`talchain-schemas-0.21.0.tgz.sha256`
(`41033f067cfbe1f6bd716d57140ef586816bb836ac312d8d9c0cf4ac3945e63f`), checked by
the pre-push gate (Check 6a). Landing is blocked on olumi-schemas #17 merge +
publish → CEE #620 merge + deploy-verify (see parallel-briefs/F2B-BYTE-CONFIRM
§6). `src/lib/talchainSchemasVersion.ts` is bumped to `0.21.0` in lockstep.

### `talchain-schemas-0.19.0.tgz`

Built from **olumi-schemas `main`** @ `8088d4e` — the merge commit of
**PR #11** ("0.19.0 wave-2 producer fields"). Unlike the 0.18.0 vendoring,
this is built from a **merged** ref, not an open PR head. There is still no
published registry artefact, so the tarball remains vendored.

**Purpose:** 0.18.0 → 0.19.0 re-pin (single minor). This pin is the gating
step for the CEE 0.19.0 producer work — CEE #545/#546 land against this
contract.

Delta 0.18.0 → 0.19.0, verified by differential export extraction against
built dists at both refs:

- **Zero exports removed or renamed** (469 → 486 exported symbols; the
  0.18.0 set is a strict subset of the 0.19.0 set).
- **17 new exports**, all additive: `CeeErrorRecovery(Schema)`,
  `DecisionClassification(Schema)` + its `Reversibility` / `Risk` /
  `Stakes` member enums and literals, `EnrichmentEdgeEValueStability(Schema)`,
  `GuidanceCategory(+Literal)`, and three `maximal*` fixture builders.
- **`Stage` is unchanged as a type** — `z.ZodEnum<["frame","analyse",
  "decide","review"]>` is byte-identical in `enums.d.ts` at both refs. What
  0.19.0 adds is a **normative comment** pinning that enum as THE canonical
  `stage_indicator` vocabulary, with British `analyse` canonical, and
  instructing consumers to derive from `Stage` / `StageType` rather than
  re-declaring it.

**⚠ That comment describes a real defect in THIS repo, which this PR fixes.**
See "Stage vocabulary" below.

Also newly typed but **not consumed here**: `framing_question` and
`decision_classification` (producer emission is DEFERRED — no UI is built
for these), and `DraftGoalConstraintSchema` (landed in 0.18.0; the upcoming
GoalPanel fix should use it rather than hand-rolling the constraint shape).

Source: olumi-schemas `main` @ `8088d4e`; built via
`npm ci && npm run build && npm pack` from a fresh blobless clone
(**966/966 package tests green** at that head). SHA256 manifest lives
alongside as `talchain-schemas-0.19.0.tgz.sha256`
(`2ba3ebe99b407372b21ad925872846cb8fd8dbfcb4a00ca26c9398d229d8fc04`),
checked by the pre-push gate (`scripts/validate-prepush.sh` Check 6a and
`scripts/pre-push-validate.sh`), which derives the tarball filename from
the `package.json` pin and fails on any drift between bytes and manifest.

#### Stage vocabulary — the drift 0.19.0 called out, fixed here

Two vocabularies exist and they are NOT the same:

| | vocabulary | pinned by |
|---|---|---|
| **Wire** (`StageType`) | `frame · analyse · decide · review` | schemas `Stage` |
| **UI / DB** (`ScenarioStage`) | `frame · ideate · evaluate · decide · optimise` | `scenarios.stage` CHECK constraint |

They overlap only on `frame` and `decide`. `src/v5/stageMapper.ts` is the
translation seam. `src/canvas/conversation/types.ts` had declared
`StageIndicatorWire` in terms of `ScenarioStage` — a hand-maintained mirror
that mis-stated the producer's enum, and by mis-stating it **silenced the
compiler** at the one ingestion site that needed to map. That site wrote the
raw wire value straight into the store, so a canonical `analyse` landed as an
unrecognised stage and `useStagePill` silently fell back to local derivation.

**Keep `src/lib/talchainSchemasVersion.ts` in step.** That constant is
drift-guarded by `src/lib/__tests__/talchainSchemasVersion.spec.ts`, which
fails if it diverges from the `file:` pin.

Earlier vendored versions (0.3.0 at A0, 0.4.0 at A1, ..., 0.13.1, 0.15.0 at
the reasoning/held_proposal/ui_directive wave, and 0.18.0 at the
goal_constraints wave) are removed on each bump — only the currently-pinned
version lives in `vendor/`.

(Note: this section once described 0.13.1 while the pin had already moved to
0.15.0 — a hand-maintained mirror that had drifted. Treat this whole file as
drift-prone: the SHA manifest and `talchainSchemasVersion.spec.ts` are the
mechanical guards; this prose is not.)

**How to update:**

```bash
# 1. Rebuild the schemas package
cd ~/Documents/GitHub/olumi-schemas
npm run build
# 2. Bump the version in olumi-schemas/package.json if contents changed
#    (additive → patch/minor; breaking → major)
# 3. Pack
npm pack  # produces talchain-schemas-<version>.tgz
# 4. Replace the vendored copy here
cp talchain-schemas-<version>.tgz \
   /path/to/DecisionGuideAI/vendor/
# 5. Update package.json `file:` reference if the filename changed
# 6. npm install (reinstalls from the new tarball)
```

**Removal criterion:** delete this tarball + the vendor entry and switch
`package.json` to a registry version (`"@talchain/schemas": "^0.3.0"`)
once `olumi-schemas` publishes to the private npm registry. Until then,
every consuming repo is expected to carry its own `vendor/` copy.
