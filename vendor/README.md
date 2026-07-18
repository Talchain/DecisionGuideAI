# vendor/

Checkout-stable local tarball references for pre-publish consumption of
private packages. Each tarball is checked in and pinned via
`file:./vendor/<name>.tgz` in `package.json`, so the path resolves
identically from a normal clone, a CI checkout, and any worktree.

## Current contents

### `talchain-schemas-0.18.0.tgz`

**⚠ PRE-RELEASE — NOT A PUBLISHED ARTEFACT.** Built from the head of
olumi-schemas **PR #10** (`claude-schemas/draft-goal-constraints` @
`8291ca03d2702a80b0cbd6629857ed92c34a6b26`), which is **open, unmerged and
Paul-gated**. There is no `v0.18.0` tag and no published 0.18.0 package.
**This vendored tarball MUST be replaced with the published artefact before
this branch merges.**

**Purpose:** 0.15.0 → 0.18.0 re-pin (a **two**-minor jump). The load-bearing
change is 0.18.0's optional `goal_constraints` array on
`DraftGraphBlockSchema`, inherited by the
`OlumiResponseSchema.draft_graph` projection
(`DraftGraphBlockSchema.omit({ type: true })`) that this app actually reads.

**Why the re-pin is REQUIRED, not optional.** `DraftGraphBlockSchema` is
`.strict()`, and `draft_graph` is a KNOWN top-level key in
`responseParser.ts` — so it goes to strict validation rather than the
`__additive__` sidecar. At 0.15.0 a response carrying
`draft_graph.goal_constraints` therefore does not lose the field quietly: the
whole parse fails with `unrecognized_keys: ["goal_constraints"]` and
`parseV5Response` returns `kind: 'parse_error'`, losing the entire turn.
**Deploy order is load-bearing: this pin must ship BEFORE CEE starts
emitting the field.** (Verified empirically at both versions against the same
payload.)

Delta 0.15.0 → 0.18.0, verified against built dists at both refs
(24/24 differential checks, including positive controls):

- **0.16.0** — additive optional fields on the standalone
  `DecisionRecordSchema` family only (`committed_by_user?`,
  `confidence_source?`, `probability_of_goal?`,
  `probability_of_joint_goal?`) + new `DecisionRecordConfidenceSource` enum.
  Not wired into `OlumiResponseSchema`; no wire surface affected.
- **0.17.0** — new `./fixtures` subpath export only. No existing entry point
  rewired; `.`, `./boundary`, `./orchestrator` unchanged.
- **0.18.0** — `DraftGraphBlockSchema.goal_constraints?` +
  `DraftGoalConstraintSchema` / `DraftGoalConstraint` on `/boundary`.

**Nothing else changed that this app consumes.** Zero exports removed or
renamed; the `blocks[]` discriminated union is byte-identical at both refs
(14 members, same discriminators — no new block type for `mapV5Blocks` to
handle); `OlumiResponseSchema`'s top-level fields are unchanged and it stays
`.strict()`; `run.ts` / `analysis.ts` untouched. Only 4 new exports land on
the surfaces this app imports.

Source: olumi-schemas PR #10 head `8291ca03d2702a80b0cbd6629857ed92c34a6b26`;
built via `npm ci && npm run build && npm pack` from a fresh blobless clone
(918/918 package tests green at that head). SHA256 manifest lives alongside
as `talchain-schemas-0.18.0.tgz.sha256`
(`86c44b042d5423fcc87041941925beec53a726a439915562195c040f8c97ce7d`),
checked by the pre-push gate. The byte-identical tarball is vendored into
olumi-assistants-service on branch `fix/goal-constraints-wire-emit` — same
hash, so producer and consumer are provably on the same contract.

**Keep `src/lib/talchainSchemasVersion.ts` in step.** That constant is
drift-guarded by `src/lib/__tests__/talchainSchemasVersion.spec.ts`, which
fails if it diverges from the `file:` pin.

Earlier vendored versions (0.3.0 at A0, 0.4.0 at A1, ..., 0.13.1, and
0.15.0 at the reasoning/held_proposal/ui_directive wave) are removed on
each bump — only the currently-pinned version lives in `vendor/`.

(Note: this section previously still described 0.13.1 while the actual pin
had already moved to 0.15.0 — a hand-maintained mirror that had drifted.
It is corrected here.)

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
