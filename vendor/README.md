# vendor/

Checkout-stable local tarball references for pre-publish consumption of
private packages. Each tarball is checked in and pinned via
`file:./vendor/<name>.tgz` in `package.json`, so the path resolves
identically from a normal clone, a CI checkout, and any worktree.

## Current contents

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
