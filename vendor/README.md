# vendor/

Checkout-stable local tarball references for pre-publish consumption of
private packages. Each tarball is checked in and pinned via
`file:./vendor/<name>.tgz` in `package.json`, so the path resolves
identically from a normal clone, a CI checkout, and any worktree.

## Current contents

### `talchain-schemas-0.38.0.tgz` ← **THE CURRENT PIN**

**Provenance: PACKED FROM THE MERGED, TAGGED RELEASE.** Packed from
`olumi-schemas` **`main` @ `371e18c8`**, tag **`v0.38.0`** (olumi-schemas #37),
by `npm ci && npm run build && npm pack` in a fresh blobless clone with
`HEAD == 371e18c8` asserted before the pack. 353,278 bytes. sha256:

```
761c7ec615da3390ec036c8dab4e5a7857501b1d46ff5f3f777353e2d05e55b9
```

| Claim | Status |
|---|---|
| the sidecar matches the checked-in bytes | ✅ `shasum -a 256 -c vendor/talchain-schemas-0.38.0.tgz.sha256` |
| packed from the merged, tagged source | ✅ `main` @ `371e18c8`, tag `v0.38.0` (both read from the GitHub API, not from a local ref) |
| `check:vendor` agrees | ✅ `node scripts/check-vendor-sha.mjs` (it now also runs in CI, not only before `dev`) |

> ⚠ **THE REGISTRY ENVELOPE DIFFERS BY DESIGN — NEVER MIX IT IN.** A tarball
> fetched from the registry carries a different outer envelope from one produced
> by `npm pack` here, so its sha256 will not equal the value above. That is not
> corruption and it is not a reason to "correct" this manifest: the sidecar
> pins THESE bytes, the ones committed in this directory, and the only check it
> is making is that the committed tarball has not been altered. Comparing it
> against a registry download is comparing two different artefacts.

**What the UI adopts here (ROADMAP 2.646) — READER BEFORE PRODUCER.** The UI
takes 0.38.0 *before* CEE and PLoT move their own pins, so the consumer can
never be the hop that drops a field the producers have started sending. Three
additive cars arrive; the UI consumes ONE of them today:

1. **HONEST ABSENCE on `EnrichmentOutcomeStatsSchema` — the car this repo
   consumes.** `mean`/`p10`/`p50`/`p90` were REQUIRED and are now
   `.optional()`, and `percentiles_source: z.enum(['samples','unavailable'])`
   is declared. That enum is the **wire discriminator** the Results panel now
   reads: see the long note on `DOWNSIDE_UNAVAILABLE_ENGINE_COPY`
   (`src/components/results/utils/downsideCopy.ts`) and the carry through
   `mapV5AnalysisToReport` → `useResultsSectionData` → `OptionCards`.
   **NEVER `.default()` this field at any hop, and never read absence as
   `'samples'`** — that is the `?? 0` fabrication class wearing a string, and
   the schema's own `.describe()` says so.
2. **`DraftGoalConstraint.value_frame`** (ROADMAP 2.266) — declared, **no UI
   consumer**: it is a precondition for reinstating two producer-side honesty
   gates, not a display field. Verified absent from `src/` at this bump.
3. **Two new `ExerciseBlockSchema.exercise_kind` members** (`opportunity_cost`,
   `implementation_intentions`). The UI is **transparent** to these by
   construction: `phase3TypedBlocks.ts:321` parses `exercise_kind` as a
   `nonEmptyString` pass-through discriminator and never enumerates members, so
   no allowlist here can go short of the contract (trap 12's mirror, avoided by
   not having one).

**Type fallout of the four now-optional stats, measured not predicted: NONE.**
`EnrichmentOutcomeStats` has zero type-level importers in UI `src/`, and the
V5 mapper reads the block as `unknown` through `safeFiniteNumber`, so
optionality changes nothing it does. The typecheck gate reported **0 added
diagnostics** at this bump. Had it bitten, the fix is the **forced branch**
(handle the absent case), **never `?? 0`**.

> ⚠ **Bumping the pin? FOUR places move together — and as of ROADMAP 2.649 TWO
> of them are derived.** `package.json` (the pin), `pnpm-lock.yaml` (pnpm
> derives it, and it is what pins the tarball's integrity hash),
> **`vendor/<tarball>.sha256` — the sidecar `scripts/check-vendor-sha.mjs`
> reads, and pre-push check 5a fails without it**, and
> **`src/lib/talchainSchemasVersion.ts` — ⚠ NO LONGER HAND-MAINTAINED**: it is
> GENERATED from the `package.json` pin by
> `scripts/generate-schemas-version.mjs`. Run `pnpm run generate:schemas-version`;
> `pnpm run ci:guard:schemas-version` reds on drift.
> *(This paragraph said "HAND-MAINTAINED" until the 0.38.0 bump — it had been
> stale since 2.649 generated the file. A bump checklist is itself a
> hand-maintained mirror, which is the whole reason 2.649 removed a step from
> it; if you are reading this before touching the pin, **re-derive the list
> from `package.json`'s scripts rather than trusting this sentence**.)*
>
> The 0.37.0 bump initially missed the last two: the sidecar was absent, and
> the constant still read `0.35.0` — caught by
> `src/lib/__tests__/talchainSchemasVersion.spec.ts`, which was the sole red in
> that PR's first CI run. Third bump in a row that this list had bitten, which
> is what motivated generating the constant.

### `talchain-schemas-0.37.0.tgz` (superseded — REMOVED, section retained for history)

> ⚠ **The tarball and its sidecar were DELETED in the 0.38.0 bump**, in the same
> commit that added 0.38.0's — two coexisting "current pin" tarballs read as
> ambiguous provenance. Packed from `olumi-schemas` **`main` @ `685d92ec`**, tag
> **`v0.37.0`** (olumi-schemas #36); 347,174 bytes; sha256
> `835ab4b8381e1280f239de0d408c2da6790ab9f93a0a14ce6e5a389acd4dd369`.

**What the UI adopted at 0.37.0 (ROADMAP 2.490 slice 2):**
`DskProtocolProvenanceSchema` and `ExerciseBlockSchema.dsk_provenance` — the
decision-science protocol attribution the exercise card badges. The adapter
(`src/v5/phase3TypedBlocks.ts`) re-states that schema's three constraints
independently, because it parses the RAW WIRE PAYLOAD rather than running the
Zod schema; both were read at those vendored bytes and agree exactly
(`/^DSK-P-\d{3}$/`, non-empty title, `strong|medium|weak|mixed`, all three
required). The editable-field table (adopted at 0.35.0) is carried forward at
**revision 2**, above the revision-1 floor
`editableFieldTable.pinAndParity.spec.ts` requires — and 0.38.0 carries it
forward again unchanged.

### `talchain-schemas-0.35.0.tgz` (superseded — REMOVED, section retained for history)

> ⚠ **The tarball and its sidecar were DELETED in the 0.37.0 bump** (two
> coexisting "current pin" tarballs read as ambiguous provenance). This section
> is kept because the 0.35.0 leg's adoption note below is still the record of
> when the editable-field table entered the UI.

**Provenance: PACKED FROM THE MERGED, TAGGED, PUBLISHED RELEASE — the first
section in this file that can say so.** Built with `npm ci && npm run build &&
npm pack` from a fresh blobless clone of `olumi-schemas` at tag **`v0.35.0`**
(= `6c88076b`, which is also `main`'s head). 337,967 bytes. sha256:

```
bbca89c0fe4b33b10822cfbac826a224424343c86729016df2882f16b9f464b7
```

| Claim | Status |
|---|---|
| the sidecar matches the checked-in bytes | ✅ `shasum -a 256 -c vendor/talchain-schemas-0.35.0.tgz.sha256` |
| reproducible from tagged source | ✅ an independent `npm pack` at `v0.35.0` produced these exact bytes |
| byte-identical to what **CEE deploys** | ✅ matches CEE's committed sidecar AND CEE's committed tarball re-hashed — both consumers of the editable-field table run identical schema bytes **by construction** |

**What the UI adopts here (ROADMAP 2.474):** `orchestrator/editable-fields` — the
CLASSED field-parity table (42 rows at revision 1) — and `orchestrator/edit-tool-ops`.
**Neither module exists in 0.34.0**, which is the whole point of the bump: the UI
could not import the table CEE has enforced its referee allowlist from since
0.35.0, and `requireEditableFieldTableRevision` — the fail-loud pin-skew guard —
was itself absent from the old pin, so the UI failed *silently*. Bound by
`src/canvas/ui/inspector-v2/__tests__/editableFieldTable.pinAndParity.spec.ts`.

> ⚠ ~~**Bumping the pin? THREE places move together**~~ — **SUPERSEDED at the
> 0.37.0 bump: it is FOUR, and the missing fourth (`vendor/<tarball>.sha256`)
> was itself skipped here. The live checklist is in the 0.37.0 section above;
> this one is left struck through rather than deleted so nobody re-derives the
> short list from a historical section.**

### `talchain-schemas-0.34.0.tgz` (superseded — retained)

> **⚠ BRANCH-PACKED, PRE-PUBLISH** (same trade as prior train sections; no
> registry 0.34.0 exists until olumi-schemas PR #33 merges; merge order
> schemas → CEE → UI). Packed with `npm pack` from olumi-schemas branch
> `p4/transport-events-0.34` at `b883869` (full gate green, 43 files / 1446
> tests). sha256
> `c3db4b4e5e4458cbd11c9b924c7e529ccd0f405b2967844e30550aecf9acc559` —
> BYTE-IDENTICAL to CEE's vendored copy by construction.

**What the UI adopts here (P4 transport):** SystemEventSchema members
`edge_adjudication` + `prior_range_edit` — the two emitters this leg ships
(ContestedEdgeCard verdicts and inspector prior-range edits, which previously
terminated in the client store). ⚠ Reader-first: these emitters must deploy
AFTER CEE's 0.34.0 leg — an older CEE pin rejects the whole turn on either
kind.


### `talchain-schemas-0.32.0.tgz` (superseded — retained)

> ⚠ **This section carried the marker `← THE CURRENT PIN` until 5 Aug 2026, and
> it was ALREADY FALSE BEFORE THE 0.35.0 BUMP:** the pin had been 0.34.0 since
> that section was added above, so the marker had been lying for at least one
> whole version and nothing failed. It is the FOURTH hand-maintained mirror of
> the pin, and the only unguarded one — the other three (`package.json`,
> `pnpm-lock.yaml`, `src/lib/talchainSchemasVersion.ts`) all have a check that
> REDs on drift, which is precisely why this one drifted and they did not. It is
> also the first file a re-vendor lane reads, so it is the mirror best placed to
> mislead. Marker moved to 0.35.0 above; this heading is now inert prose.

**Provenance: PACKED FROM THE OPEN olumi-schemas PR BRANCH, PRE-PUBLISH — stated
plainly because this file keeps cataloguing exactly this situation.** Lane 2
(P3 ui_directive panel verbs) is a THREE-REPO TRAIN with a hard merge order
(schemas → UI → CEE): this tarball was built with `npm pack` from
`lane2/ui-directive-panel-section-0.32.0` at commit `23f8e01b` (the 0.32.0
version-bump PR, full gate green: 40 files / 1402 tests), BEFORE that PR merged,
because the UI leg cannot compile against verbs its pin does not carry.

```
this repo : 472cd35d355c2292589a98f609e6ad478c9576dab179ea1ce27b06c87a5dd93a
```

| Claim | Status |
|---|---|
| the sidecar matches the checked-in bytes | ✅ proven — `shasum -a 256 -c vendor/talchain-schemas-0.32.0.tgz.sha256` |
| "is the published registry release" | ❌ **NOT YET — no 0.32.0 release existed when this was written.** The schemas PR merge (orchestrator's) auto-publishes; once tag `v0.32.0` exists, re-derive: `npm pack @talchain/schemas@0.32.0` and compare shas. A mismatch (e.g. pack-time metadata) is a finding to record here, not to hide. |
| byte-identical to what CEE deploys | Only once CEE's leg of this train merges — CEE's re-vendor copies THIS tarball's bytes (sha recorded in its own vendor README), so the two consumers of the new verbs run identical schema bytes by construction. |
| byte-identical to what PLoT deploys | ❌ PLoT stays on 0.31.0 — verified NOT a Block-union reader at its tip `d011b99` (`ui_directive` appears once, in a test comment), so the verbs this pin adds cannot reach it. Hazard 1 says check, not assume: check PLoT's own `package.json` before citing this row. |

**What it adds (Lane 2, P3):** `ui_directive` verbs `open_panel` / `open_section`
+ optional strict `ui_target` (closed vocabularies: the 5 OutputsDock tab ids /
the 5 ModelTabBody section ids), cross-field-enforced both directions at the
BlockSchema union. Additive: every pre-0.32.0 payload parses byte-identically;
a UI on THIS pin merely gains the ability to parse (and this PR, to execute) the
new verbs. **Emission stays with CEE and lands only in CEE's own leg, after this
one — so there is no window where a deployed consumer strict-rejects a served
verb.** Rollback is a revert.

`src/lib/talchainSchemasVersion.ts` is bumped to `0.32.0` in lockstep (its spec
derives the expected value from the `file:` pin in `package.json` and fails on
drift).

### `talchain-schemas-0.31.0.tgz` (historical — no longer vendored)

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

> ⚠ **THAT INVARIANT IS CURRENTLY VIOLATED, stated rather than quietly fixed
> (5 Aug 2026).** `vendor/` holds THREE tarballs — `0.32.0`, `0.34.0` and the
> pinned `0.35.0`. Deleting the two superseded ones is the obvious tidy-up and
> this lane deliberately did NOT do it: `scripts/check-vendor-sha.mjs` derives
> the tarball it verifies FROM the pin, so an unpinned tarball is unverified by
> anything, and removing files is exactly the kind of "obviously safe" change
> that wants its own diff and its own gate run rather than a ride-along in a
> pin bump. Rowed. Either enforce the invariant with a check or restate it as
> "the pinned version plus retained history" — an invariant no one enforces is
> the same broken alarm as a stale marker.

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

## Standing policy — ⚠ THERE IS NO REMOVAL CRITERION. THE VENDORED TARBALL *IS* THE MECHANISM.

> ⚠ **THIS SECTION USED TO SAY THE OPPOSITE, AND THE OPPOSITE IS NOW A CI
> FAILURE.** It read: *"**Removal criterion:** delete this tarball + the vendor
> entry and switch `package.json` to a registry version
> (`"@talchain/schemas": "^0.3.0"`) once `olumi-schemas` publishes to the
> private npm registry."* `olumi-schemas` **does** publish, so that sentence was
> an instruction to do the thing the pipeline now rejects — a stale doc pointed
> straight at a red gate. Ratified 6 Aug 2026 and encoded in `ci.yml`'s
> rewritten **Schema contract gate** (PR #611): **a registry pin FAILS the
> gate; a `file:./vendor/*.tgz` pin is what passes.**

The vendored tarball is not a stopgap awaiting a registry. It is the long-term
mechanism, for one reason: a `^x.y.z` range lets the bytes a consumer compiles
against change without any commit in that consumer, which is precisely how the
schema-version skew this estate keeps paying for goes unobserved. A checked-in
tarball with a sha256 sidecar makes the contract a reviewable artefact — the
diff shows which bytes moved, and the gate can prove nobody swapped them.

**THE BYTE RULE — how a tarball here is produced, without exception.**

1. Fresh blobless clone of `olumi-schemas`, checked out at the **merged, tagged**
   commit — and `HEAD` **asserted equal** to that SHA before anything else
   (fetching a ref is not checking it out).
2. `npm ci && npm run build && npm pack`.
3. **NEVER the registry artifact.** A tarball downloaded from the registry
   carries a different outer envelope, so its sha256 will not match one packed
   here. That is not corruption and it is not a reason to "correct" a sidecar —
   they are two different artefacts, and only the packed one is what this repo
   compiles against.
4. Record the sha256 of the **committed** bytes in the sidecar, and state the
   source commit + tag + byte count in this file.

**FOUR PLACES MOVE TOGETHER on every bump** — and only two are hand-touched
(re-derive this list from `package.json`'s scripts rather than trusting this
sentence; a checklist is itself a hand-maintained mirror):

| # | what | derived? |
|---|---|---|
| 1 | `package.json` — the `file:./vendor/<tarball>` pin | ✋ by hand |
| 2 | `pnpm-lock.yaml` — pins the tarball's integrity hash | ✅ `pnpm install` |
| 3 | `vendor/<tarball>.sha256` — read by `scripts/check-vendor-sha.mjs`, which runs in **`ci.yml`**, in **`staging-full-tests.yml`**, in the pre-push scripts, and before `pnpm dev` | ✋ by hand |
| 4 | `src/lib/talchainSchemasVersion.ts` — feeds `schema_versions.ui_vendored_talchain_schemas` in the debug bundle | ✅ `pnpm run generate:schemas-version` (guarded by `pnpm run ci:guard:schemas-version`) |

**Delete the superseded tarball AND its sidecar in the same commit that adds the
new pair.** Two coexisting "current pin" tarballs read as ambiguous provenance,
and the ambiguity is worst exactly when someone is trying to work out which
bytes a shipped build was compiled against.
