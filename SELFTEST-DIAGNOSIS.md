# Why PR #1683 fails **"Typecheck Gate Self-Test"** — diagnosed from source, nothing executed

**Verdict: the change CAN break it, and it does. The mechanism is a single, deterministic
TypeScript error in the PR's own diff.** It is not base drift and not infrastructure. Do not
re-run the workflow expecting green; the PR needs a one-token fix.

**Answer to the task's explicit escape hatch** — *"if the honest answer is 'this change cannot
plausibly affect it', say so"*: it is not. The mechanism below is visible in the bytes of the
signature and the call site, both quoted in full.

---

## Provenance of this diagnosis

| | |
|---|---|
| Clone | fresh blobless, `--branch staging --single-branch`, at `/private/tmp/selftest-diagnosis-2026-09-18` |
| Staging head read | `eb7211d7abbc06f2d6ea4cd98c060b8650f25ffc` (`git rev-parse HEAD`, not constructed) |
| PR branch read | `canvas/two-facts-two-marks` → `ae76059ac867f12b06f242774ad1c0712620f9c7` |
| Merge base | `5824c05b4762d258b340464650daf70e8fa77c23` |
| **Commands run** | `git clone / fetch / show / diff`, `rg`, `sed`, `cat` — **read-only** |
| **Commands NOT run** | no `pnpm install`, no `tsc`, no `vitest`, no `eslint`, no gate, no self-test, no browser, no product API. **CI is the only test authority. I executed nothing.** |

Every claim below is a claim about **source text I read**, or about **control flow I traced through
two shell scripts**. Where I predict a runtime number I say so and give the arithmetic, so the
prediction is falsifiable rather than decorative.

---

## 1. The defect — one line, one token

`src/canvas/domain/nodeProvenanceClaim.ts:303-308`, unchanged by this PR:

```ts
export type NodeProvenanceClaim = 'value' | 'structural' | 'none'   // :98

export function provenanceClaimLabel(
  claim: Exclude<NodeProvenanceClaim, 'none'>,   // ⇒ 'value' | 'structural'
  kind: ValueProvenanceKind,
): string {
```

`src/canvas/nodes/shared/NodeProvenanceMark.tsx:275`, **added by this PR**:

```tsx
{renderMark(provenanceClaimLabel('node', nodeAuthorship.kind), nodeAuthorship.kind, 'node')}
```

`'node'` is not a member of `'value' | 'structural'`. Under `tsconfig.app.json`
(`"strict": true`, and `include: ["src"]` so this file is compiled by construction) that is a
**TS2345** — *Argument of type `'"node"'` is not assignable to parameter of type
`'"value" | "structural"'`*. There are no overloads and no widening: the parameter type is a
closed literal union written three lines above the function body.

The sibling call on the very next line is correct (`provenanceClaimLabel('value', …)`), and the
pre-existing call at `:284` passes `claim`, which the early `if (claim === 'none') return null`
at `:151` has already narrowed to `'value' | 'structural'`. **Line 275 is the only one.**

### Why the author typed it — this is trap 21, in miniature, inside one call

`renderMark(label, kind, claimFor)` carries `claimFor` straight to the DOM attribute
`data-provenance-claim`, where `'node'` / `'value'` is exactly right: the PR's own new spec binds
to it (`marksByClaim('node' | 'value')`), and the component's doc comment explains why. So `'node'`
is a correct string — **for a different question**.

- `data-provenance-claim` answers **"which question does this mark answer?"** → `node` | `value`
- `provenanceClaimLabel`'s first argument answers **"which label vocabulary?"** → `structural` | `value`

The two vocabularies **share the member `'value'`**, which is what makes the mistake invisible on
line 276 and fatal on line 275. Two questions, overlapping answer sets, one variable.

### The fix

```tsx
-{renderMark(provenanceClaimLabel('node', nodeAuthorship.kind), nodeAuthorship.kind, 'node')}
+{renderMark(provenanceClaimLabel('structural', nodeAuthorship.kind), nodeAuthorship.kind, 'node')}
```

`'structural'` is demonstrably the intended vocabulary — `src/canvas/domain/__tests__/nodeProvenanceClaim.spec.ts:220,226`
pins `provenanceClaimLabel('structural', 'ai') === 'Olumi suggested this'` and
`('structural', 'human') === 'You added this'`, which is verbatim the authorship question the PR's
doc comment says the second mark exists to answer. **The third argument stays `'node'`** — the DOM
attribute the new spec binds to is unaffected. One token, on one line.

*(I did not apply this fix: the task scope is diagnosis, and the parent batches PR work.)*

---

## 2. Why that reaches the **self-test** and not only the typecheck job

`scripts/ci/typecheck-gate-selftest.sh` runs the **real** `scripts/ci/typecheck-gate.sh` six times
against the PR's own tree. Three of its scenarios assert the gate's behaviour on a **clean tree**,
so the PR's tree being unclean poisons them.

### The file has ZERO baseline rows — contrast-controlled sweep

| Probe (`rg -a -i`, over both baselines) | Hits |
|---|---|
| **Target** `NodeProvenanceMark` in `typecheck-baseline.txt`, `typecheck-baseline-identities.txt`, `typecheck-uncovered.txt` | **0** |
| **Target** `whoseNumber` (the repaired spec) in the same three files | **0** |
| **Contrast** `src/canvas/nodes` in the two baselines | **18 / 48** |
| **Contrast** `\.spec\.` in the identity baseline | **475** |
| Only baseline row under `src/canvas/nodes/shared/` | `1 ⇥ …/__tests__/ScienceIcon.spec.tsx` |

Target 0 with contrasts at 18/48/475 in the same sweep: the probe is **not blind**, so the zero is
a real absence. A file with no baseline row is subject to the gate's **strictest** check.

### What the gate prints on the PR tree (traced, lines cited)

- **Phase 1, coverage — PASSES.** The PR adds and deletes no files, so `git ls-files` ∖
  `--listFilesOnly` is unchanged. Confirmed: the diff touches exactly 2 existing files.
- **Phase 2, ratchet — FAILS, on three checks at once** (`typecheck-gate.sh` sets `FAIL=1` in each
  block and never short-circuits, so **all three messages appear in one output** — this matters
  below):
  1. `:489` **`New file(s) with TypeScript errors (not in scripts/ci/typecheck-baseline.txt):`**
     — `NodeProvenanceMark.tsx` has no baseline row.
  2. `:524` **`File(s) with MORE errors of a given TS code than the baseline allows:`** — the
     bucket check is `b = (k in base) ? base[k] : 0`, so a brand-new `(file, TS2345)` bucket of 1
     exceeds 0.
  3. `:536` **`Total typecheck errors increased: baseline=2081 current=2082 (+1).`** — both
     baseline headers read `# count=2081` (verified), and the file is loaded by
     `tsconfig.app.json` only (`tsconfig.tooling.json` excludes `src`), so the diagnostic is
     counted once.

The gate `exit 1`s at `:543`, **before** the non-blocking identity report at `:553`.

### The six assertions that flip

`expect …  0` fails on any non-zero exit; `expect_absent` fails when the string **is** printed.

| # | Scenario | Assertion | Why |
|---|---|---|---|
| 1 | 1/7 green control | `clean tree passes` (wants exit 0) | gate exits 1 |
| 2 | 6/7 mutant | `MUTANT: the total-count check is blind to this swap` (wants `Total typecheck errors increased` ABSENT) | the real +1 prints it |
| 3 | 6/7 mutant | `MUTANT: the new-file check is blind to this swap` (wants `New file(s) with TypeScript errors` ABSENT) | the real new erroring file prints it |
| 4 | 7/7 | `the gate still PASSES — no count moved` (wants exit 0) | gate exits 1 |
| 5 | 7/7 | `but the added diagnostic is reported` (wants exit 0) | gate exits 1 before the `::notice::` |
| 6 | 7/7 | `and the report names the file` (wants exit 0) | gate exits 1 |

**Scenarios 6 and 7 are the sharp ones, and they are the self-test's own design working as
intended.** Their `expect_absent` mutants exist to prove the *other* checks stay silent — that is
what makes scenario 6 a discrimination rather than "the gate failed for some reason". A PR that
independently trips the new-file and total checks **destroys that discrimination**, so the
self-test correctly refuses to certify the gate. It is not a false alarm; it is the alarm.

### Falsifiable prediction

The other 12 assertions still pass — scenario 2 wants the same messages the PR now also produces,
scenarios 3+4 exit inside phase 1 before the ratchet ever runs, and 5/5m never compile. So:

> **`═══ self-test: 12 passed, 6 failed ═══`**, with `PASS + FAIL = 18`, so the
> `EXPECTED_ASSERTIONS=18` early-exit guard passes and the run reaches the honest
> `FAIL -ne 0 → exit 1` at the end.

**If the released log shows a different split — especially an early-exit "ran N assertions,
expected 18" — this diagnosis is wrong and the cause is elsewhere.**

---

## 3. The cross-check that settles it without re-running anything

`.github/workflows/staging-full-tests.yml` runs **two** jobs off this gate:

- job `tsc` → `pnpm run typecheck` → `bash scripts/ci/typecheck-gate.sh` (`package.json:44`)
- job `typecheck-selftest`, **name `Typecheck Gate Self-Test`** → `pnpm run typecheck:selftest` (`:45`)

They are independent jobs (both `needs: install`), and `Staging Gate` requires both.

> **If this diagnosis is right, the `tsc` job on `ae76059a` must ALSO be red**, naming
> `src/canvas/nodes/shared/NodeProvenanceMark.tsx` under *"New file(s) with TypeScript errors"*.
>
> **If `tsc` is GREEN and only the self-test is red, this diagnosis is REFUTED** and the cause is
> the base or the infrastructure.

That check costs one `gh api …/check-runs` call against the exact SHA and needs no workflow re-run.
Per trap 24, query `check-runs` for `ae76059ac867f12b06f242774ad1c0712620f9c7` specifically and
assert `total_count > 0`; per trap 24b, filter `.status == "completed"` **before** `.conclusion`, or
the never-finished run's in-flight jobs will read as failures they are not.

---

## 4. The candidate mechanisms the task asked about — each answered

| Candidate | Verdict |
|---|---|
| **Does the loaded-FILE count shift when a module gains a new function?** | **No.** Coverage is `git ls-files` vs `tsc --listFilesOnly`, a **set of paths**. A new module-private function adds no file. |
| **Does a type-only import shift coverage?** | **No.** `ValueProvenanceKind` is exported at `valueProvenance.ts:68` and that module was **already imported at runtime** on line 1 for `classifyNodeProvenance` / `classifyValueProvenance`. The program's file set is unchanged, and the import itself is clean. |
| **Is the baseline an EXACT count that any movement fails?** | **Not exact — one-directional, and that is not the trigger here.** `CUR_TOTAL > BASE_TOTAL` fails; a *decrease* only prints a `::notice::`. It fires here because the count genuinely went **up** by 1. |
| **Does the self-test depend on a specific diagnostic identity the PR could perturb?** | **Yes, but not via this PR's files.** Scenarios 6/7 doctor `SWAPPED_FILE` = the **first** non-comment row of `typecheck-baseline-identities.txt`, whichever file that is. The PR edits neither baseline, so the row it doctors is unchanged. **The perturbation is the PR's own new diagnostic, not a moved identity.** |
| **Could a line-number shift perturb an identity?** | **No**, and worth recording. `identity.pl` (`typecheck-gate.sh:167`) captures `(file, TS-code, message)` and **discards line and column**. The PR shifts ~90 lines of `NodeProvenanceMark.tsx` and that alone would move nothing. |

---

## 5. What I did NOT verify, stated plainly

- **I did not run `tsc`.** TS2345 and the exact wording are **derived from the signature and the
  call site**, not measured. The *existence* of an error on line 275 follows from a closed literal
  union; the *code number* is the standard argument-assignability code and is my inference.
- **`current = 2082` assumes the PR introduces exactly ONE new diagnostic.** I read the full diff
  of both files, checked every changed call site against its signature, confirmed
  `ValueProvenanceClass` carries both `.kind` and `.userOwned` (`valueProvenance.ts:95-99`) and
  that `classifyNodeProvenance` returns `ValueProvenanceClass | null` (`:311`), and confirmed
  `noUnusedLocals` is not tripped (every import and local is still referenced inside `renderMark`).
  I found no second error. **If a second one exists, the +1 becomes +2 and every conclusion above
  still holds** — the mechanism does not depend on the magnitude.
- **I did not confirm PR #1683's actual check conclusions.** The task states the self-test is red
  and the run never finished; I read no CI logs, because none were available.
- **"The run never finished" is a separate observation I cannot explain from source.** A hung run
  and a red job are different facts. My mechanism explains the **red job**. If the run is also
  genuinely stuck, that is an infrastructure question this diagnosis does not answer — but it is
  not a reason to treat the type error as absent.
- **I did not check for a twin `provenanceClaimLabel`** — I did, and there is none: a
  contrast-controlled sweep found **exactly one definition** (`nodeProvenanceClaim.ts:303`) and
  nine call sites, against a contrast probe (`nodeProvenanceClaim`) returning 11 files. So the
  signature I read is the signature line 275 binds to.

---

## 6. Recommendation

1. **Do not re-run the workflow as-is.** It will fail again, deterministically.
2. Apply the one-token fix on `canvas/two-facts-two-marks`
   (`'node'` → `'structural'`, first argument only, line 275).
3. Confirm with the free cross-check in §3 first: if `tsc` is green on `ae76059a`, ignore all of
   the above and treat the failure as infrastructure.

**Cost note:** this diagnosis executed nothing — no install, no compiler, no test runner, no
product call. It is source reading and control-flow tracing against a fresh staging clone.
