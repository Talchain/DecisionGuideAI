# vendor/

Checkout-stable local tarball references for pre-publish consumption of
private packages. Each tarball is checked in and pinned via
`file:./vendor/<name>.tgz` in `package.json`, so the path resolves
identically from a normal clone, a CI checkout, and any worktree.

## Current contents

### `talchain-schemas-0.31.0.tgz` ← THE CURRENT PIN

**Provenance: byte-identical to the artefact PLoT `staging` DEPLOYS.**
olumi-schemas carries tag `v0.31.0`; PLoT PR #301 vendored
`talchain-schemas-0.31.0.tgz` and **merged 2026-08-01T17:16:26Z** as
`7133bba1`, which is PLoT's `staging` tip. This copy is that blob, and its
SHA-256 was computed here and compared to PLoT's own sidecar **at the merged
staging tip**:

```
this repo      : a9efa0fdb390faed86e53867024141cd86813b5d33379c2d21cb213b612de1ad
PLoT staging   : a9efa0fdb390faed86e53867024141cd86813b5d33379c2d21cb213b612de1ad   ✅ identical
  (7133bba1)
```

⚠ **THIS SECTION WAS WRITTEN AGAINST AN OPEN PR AND UPGRADED IN THE SAME PR.**
It first recorded byte-identity with PLoT #301 while that PR was still open,
and said so — *"byte-identity with a sibling lane's PROPOSED pin, not with
anything deployed"*. #301 merged **during this lane's run**, so the caveat was
true when written and stale within the hour. Corrected here rather than left to
rot, which is the failure mode this file keeps cataloguing. Note the direction:
the claim got STRONGER, and a stale caveat that understates provenance is still
a stale caveat — drift is not only the optimistic kind.

⚠ **WHAT IS PROVEN HERE, AND WHAT IS NOT.** Same rule as always: a `file:` pin
makes pnpm hash the LOCAL tarball, so no hash in this file says anything about a
registry.

| Claim | Status |
|---|---|
| the sidecar matches the checked-in bytes | ✅ proven — `shasum -a 256 -c vendor/talchain-schemas-0.31.0.tgz.sha256` |
| **byte-identical to the artefact PLoT `staging` DEPLOYS** | ✅ **proven** — sha256 above matches PLoT's own sidecar at the merged staging tip `7133bba1`, and PLoT `staging`'s `package.json` pins `file:./vendor/talchain-schemas-0.31.0.tgz`. Re-derive, don't trust this row: `gh api "repos/Talchain/plot-lite-service/contents/vendor/talchain-schemas-0.31.0.tgz.sha256?ref=staging"`. |
| byte-identical to what **CEE** deploys | ❌ **NO — CEE `staging` still pins 0.30.0.** The skew is deliberate, one optional additive field wide, and reader-first (see below). It IS skew: hazard 1 says never assume parity, so check each repo's pin. |
| **"is the published registry release"** | ⚠️ **NOT PROVEN HERE.** Inherited from PLoT #301. This lane did not re-pack: the scope is 401 on GitHub Packages and 404 on public npm, and no token was used. |

**Is that safe? Yes, and it is derived, not asserted.** 0.31.0 adds exactly ONE
thing: an OPTIONAL `action_prompt` string on `CoachingBlockSchema`. Adopting it
ahead of CEE cannot break anyone, because *nothing else consumes the UI's pin* —
the UI is a leaf. And the field is reader-first by construction:
the schema's own adoption note says a UI on an older pin drops the key and
renders today's non-interactive card, while a UI that adopts before CEE emits
simply never sees one. **Neither side blocks the other, so there is no landing
order and no outage window.** Rollback is a revert.

**What it adds (ROADMAP 2.225):** `CoachingBlockSchema.action_prompt`,
`z.string().min(1).max(300).optional()` — the producer-authored turn text a
coaching chip dispatches VERBATIM. Verified at the RESOLVED bytes, not from
release notes: `dist/boundary/blocks.js:516` and `dist/boundary/blocks.d.ts:873`
in the vendored tarball both carry it.

⚠ **THE FIELD CARRIES BINDING CONSUMER DOCTRINE IN ITS OWN DOC COMMENT — read it
before wiring anything to it.** Two clauses bite:
1. **VERBATIM MEANS VERBATIM** — dispatch the string unmodified; no templating,
   interpolation, appended context or "improving". Wording fixes belong at the
   producer.
2. **FAIL CLOSED, AND SILENTLY** — absence means the producer authored no
   prompt, so the consumer renders **NO dispatching chip**, and *"It must not
   fall back to composing one from `action_intent` or `action_label`: that
   fallback IS the defect."*

**SCOPE ASYMMETRY, stated in the contract so it is not mistaken for an
oversight:** `ReviewCardBlockSchema` and `EvidenceBlockSchema` also carry
`action_intent`/`action_label` and **deliberately do NOT get `action_prompt` in
0.31.0**. They are `.strict()`, so a producer *cannot* emit one on them.
Consequence for this repo: only the COACHING card can become interactive at this
pin — wiring the review-card or evidence pills would be dead code today.

**Absorption cost 0.30.0 → 0.31.0: ZERO new typecheck errors.** Measured on the
re-vendor commit alone, before any code change: the gate's per-file ratchet and
total both held at the baseline (**622 files / 2505 errors**), coverage 3128 /
3168. 0.31.0 is one optional string and nothing else, so there is no removed
export or renamed field for a consumer to drop.

`src/lib/talchainSchemasVersion.ts` is bumped to `0.31.0` in lockstep (its spec
derives the expected value from the `file:` pin in `package.json` and fails on
drift).

### `talchain-schemas-0.30.0.tgz` (historical — no longer vendored)

**Provenance: the PUBLISHED REGISTRY ARTEFACT, obtained via CEE rather than
re-packed here — and byte-verified, not assumed.** olumi-schemas PR #29 merged
`f5815a34`, tagged `v0.30.0`, publish run `30445606038` green; CEE #754 vendored
that release artefact with `npm pack @talchain/schemas@0.30.0` from GitHub
Packages. This copy was fetched from CEE `staging` and its SHA-256 compared to
CEE's own manifest:

```
this repo : cd3746369b26da20e079c8d8ec323294edcc46a32df6830b657aed2cd465a0cc
CEE staging: cd3746369b26da20e079c8d8ec323294edcc46a32df6830b657aed2cd465a0cc   ✅ identical
```

At the time that was written, CEE and the UI ran BYTE-IDENTICAL schemas — the
strongest available answer to the schema-skew hazard.

⚠ **NO LONGER TRUE, and corrected here rather than left to rot when the pin
moved: the UI is on 0.31.0 and CEE `staging` is still on 0.30.0.** The skew is
deliberate, one optional additive field wide, and reader-first (see the 0.31.0
section) — but it IS skew, and hazard 1 says never assume parity. Check each
repo's `package.json` pin.

⚠ **WHAT IS PROVEN HERE, AND WHAT IS NOT — read before citing any hash in this
file as provenance.** A `file:` pin makes pnpm hash the LOCAL tarball, so no hash
recorded here or in the lockfile can say anything about a registry.

| Claim | Status |
|---|---|
| the sidecar matches the checked-in bytes | ✅ proven — `shasum -a 256 -c vendor/talchain-schemas-0.30.0.tgz.sha256` |
| **byte-identical to the artefact CEE deployed** | ✅ proven — sha256 above matches CEE `staging`'s own sidecar, and the two repos hold the same git blob at the same length |
| **"is the published registry release"** | ⚠️ **NOT PROVEN HERE.** Inherited from CEE's `vendor/README.md`, which records `npm pack @talchain/schemas@0.30.0` from GitHub Packages (olumi-schemas #29 → `f5815a34`, tag `v0.30.0`, publish run `30445606038`). This lane did not re-pack: the scope is 401 on GitHub Packages and 404 on public npm, and no token was used. |

The `pnpm-lock.yaml` entry records
`sha512-6qF6M0Gkt6/WQ4/2nxZWU0hau93g/fhH4+0c/3mZTA+I5U8LY9mxLjZsgf980cPbjYJeBEKwdbMUX9HQhCXmrg==`
against `tarball: file:vendor/talchain-schemas-0.30.0.tgz` — i.e. **pnpm hashing the
local file**, reproducible with
`openssl dgst -sha512 -binary vendor/talchain-schemas-0.30.0.tgz | base64`. It is
**local integrity, not registry evidence**, and an earlier draft of this section
cited it as though it were the latter. Corrected after an adversarial review of
PR #531 recomputed it and showed the citation was self-referential.

**What it adds (ROADMAP 2.141, V7-C slice 1a):** the **VOI family** on
`CEE_UI_ENRICHMENT_KEEP_LIST` — `factor_evppi`, `decision_evpi`,
`p_win_sensitivity`, `correlation_model` — plus the new exported
`EnrichmentFactorEvppiEntrySchema` (open/passthrough, only `factor_id`
required). **FOUR keys, not the three the design's slice table first listed:**
`correlation_model` is the discriminator for an absent `p_win_sensitivity`
(suppressed under active correlation and named in
`correlation_model.suppressed_attributions`), so transporting three would carry
the question and leave the answer behind. Verified at the RESOLVED bytes, not
from the release notes: importing `CEE_UI_ENRICHMENT_KEEP_LIST` from the
installed `dist/boundary/enrichment.js` returns all four.

**Absorption cost 0.29.0 → 0.30.0: ZERO new typecheck errors.** The gate's
per-file ratchet and total both held at the baseline (622 files / 2510 errors)
across the re-vendor; the four new UI errors that appeared during the lane were
this lane's own code and fixtures, and were fixed at source rather than
baselined. 0.30.0 is a keep-list plus one entry schema and nothing else, so
there is no removed export or renamed field for an older consumer to drop.

⚠ **SEQUENCING: THERE ISN'T ANY, AND THAT IS DERIVED.** Unlike the 0.29.0
`factor_value_edit` train (a `.strict()` discriminated-union member, where a
below-pin consumer rejects the WHOLE turn), this release adds only ENRICHMENT
keys. `AnalysisResultBlockSchema.enrichment` is
`z.record(z.string(), z.unknown()).optional()` (checked in the installed
`dist/boundary/blocks.js:53`) and the typed envelope is `.passthrough()`, so an
additive enrichment key parses at every pinned validator. No outage window, no
forced landing order, no flag; rollback is a revert.

`src/lib/talchainSchemasVersion.ts` is bumped to `0.30.0` in lockstep (its spec
derives the expected value from the `file:` pin in `package.json` and fails on
drift).

### `talchain-schemas-0.29.0.tgz` (historical — no longer vendored)

The absorption measurements, silent-drop census and reader-first sequencing notes
for this pin are gone with the pin: it is no longer vendored, nothing resolves
against it, and prose about a tarball that is not here is the drift this file
already warns about. Its git history has them if a future lane needs them.

What is kept is the CORRECTION, because the defect it records recurs:

⚠ **CORRECTED (adversarial review of PR #531).** This section previously cited
`sha512-BAHbxcy/mIlCc+GNiOxvS4zadrl+0Kwecx4va886b6gicbTPwAzciuhQiPe3YU7kUj+FSclK10ApMf9NNk89qg==`
from `pnpm-lock.yaml` and asserted it **"is the registry's own"**. That was
**false**: the pin is `file:./vendor/...`, so pnpm hashed the LOCAL tarball and
the string is reproducible offline from the checked-in bytes. It was zero evidence
about the registry. What a lockfile hash and a `.sha256` sidecar actually attest
is **local integrity of the checked-in file** — nothing more. Same defect, same
correction, as the 0.30.0 section above: **no hash in this file can say anything
about a registry while the pin is `file:`.**

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
