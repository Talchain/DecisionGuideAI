# J1 fixtures: Recovery Batch 0 note (DL, 11 Oct 2026)

- **Which recordings:** `tuple.json` stays on the 8 Oct pin (CEE b33222d4), and the 26 recordings belong to it. Required J1 replays them unchanged.
- **The deployed combination** (UI 448bda2e, CEE 50530b5f, PLoT 5a1c2032, ISL 87a031f7) boots under this harness. Recorded locally on 11 Oct: J0 and J1 passed.
- **J2b fails there,** for two reasons:
  - The AI drafted a different topology for the same brief.
  - On that topology, admission demotes a same-unit 1/1 definition to a placeholder (`admit-model.ts:4364`, `link-effect.ts:514`, `admit-candidate.ts:263`), so goal figures are withheld.

  The 7 leader-dependent enrichment keys are then absent. **The pin was deliberately NOT re-baselined.**
- **Batch A will:**
  - fix admission;
  - move `tuple.json` to its candidate combination;
  - re-record;
  - turn the two new cases (`J1 positive`, `J1 refusal`, currently `test.fixme`) live.
- **The 11 Oct recordings** are kept outside the repository as evidence: `~/olumi-work/recovery/b0/j1-new-recordings-20261011/`.

---

# Batch 0 J1 handoff (11 October 2026)

`tuple.pinned-20261008.json` preserves the 8 October backend pin and recording provenance for regression comparison with the existing 26 exchanges.

`tuple.json` selects the user-supplied deployed backend combination, with UI baseline 448bda2e. Its UI field is attribution, not a checkout override: CI and record-local build this checkout and J0 checks its actual HEAD. No product source changed in this patch. The existing recordings have NOT been re-captured for this tuple; they still belong to the regression pin. The obsolete `recorded_at` / `recorded_with_ui` fields were removed from the new tuple rather than claiming a recording occurred.

## Migration cause and fix

- `.github/workflows/journey-j1.yml:222` calls `stack/apply-migrations.sh` after merging the selected repositories' migrations; `stack/record-local.sh:121` uses the same runner.
- The original runner's line 46 unconditionally used `psql --single-transaction`. CEE migration `supabase/migrations/20261009010100_phase2_a_sweep_index.sql:7` executes `CREATE INDEX CONCURRENTLY IF NOT EXISTS analysis_run_facts_sweep_idx ...`. The file explicitly says it is not transactional at line 1.
- PostgreSQL rejects that wrapper with SQLSTATE 25001. The original fallback (line 60) reran the file outside a transaction, successfully. It overwrote the first log, then line 70 required a parsed ERROR despite that successful retry. The supplied `j1-current-tips-failure.log:964` reports exactly `failed but no ERROR line parsed (0 raw)` and line 965 exits 1. The first PostgreSQL diagnostic was not retained in that log; the explanation follows from the runner and the SQL, read from the local CEE source snapshot at `/Users/paulslee/olumi-work/third-party-review/assessment-20261011/olumi-assistants-service/`.
- The runner now retries ONLY SQLSTATE 25001 with `cannot run inside a transaction block`, without the wrapper, still with `ON_ERROR_STOP=1`. A failed strict retry stays red. The original wrapper diagnostic is retained beside the migration report. No filename/SHA allow-list, SQL change, migration skip or error-parser relaxation was added. Both CI and local recording inherit the fix for any selected tuple carrying such a migration; this does not promise that arbitrary incompatible schemas or application builds will boot.
- The Docker pull rate-limit messages recovered before migrations. The later missing `@playwright/test` is fallout from the aborted setup skipping dependency installation, not the initiating failure.

## New assertions

Both tests are appended outside the original serial group in `J1-whole-poc.journey.spec.ts`, so an existing J1 assertion failure does not skip them. Both are selected by the existing workflow/record-local `J1-whole-poc` filter, before the advisory isolation invocation. The original brief, assertions and `expect.json` are unchanged.

- Positive: a separate brief states an absolute weekly capacity target of **at least 100 tickets per week**, without a deadline. Baseline capacity is 80; one additional specialist contributes about 20 (10–30). It binds **Add one specialist** by exact label, captures its graph ID, and uses that ID in the analysis payload, canonical stored Run and Results matrix. It requires a numeric point, the exact goal-chance column heading, equality to `probability_of_goal` at the Run's declared display precision, and inequality to win share at both raw and displayed precision. Selecting a different option because its numbers happen to pass is impossible. The existing UI displays rounded percentages, so equality is explicitly at `whole` or `nearest_5` percent precision, not a claim of unrounded numerical identity.
- Refusal: the same facts with an explicitly unset target; asserts no invented target in the captured goal/constraints, no per-option goal probability or canonical figure/range, and no percentage in each model option's matrix cell. The goal lens has no chart/range; `hero-lens-unavailable` must visibly explain `Set a success target to unlock Goal fit.` and `hero-define-success` must be a visible, enabled **Define success** next step.
- Each case binds the Results stamp to the captured Run's computed time and canonical run ID, and binds the payload, stored current read and canonical view by analysis hash. Evidence JSON records those identities, payload and actual DOM text; it will be written by the DL's run, not fabricated here.

## DL recording plan

Use a **full replacement recording**, not `fill`, for the changed CEE and new briefs. Preserve the old 26 files with the regression tuple before running: `record` deletes the current numbered files. No recording was modified by this patch.

The replacement scope is exactly all existing files below, plus the two new cases:

| Files in `llm/` | Recorded role / why include in the replacement |
| --- | --- |
| `0001-openai.json`, `0009-openai.json`, `0015-openai.json` | Brief extraction in the three original drafts. Capture afresh as part of the coherent full sequence; unchanged requests might otherwise be reusable. |
| `0002-openai.json`, `0010-openai.json`, `0016-openai.json` | Draft construction: complete prompt/tool/schema body and resulting model identities must belong to the new CEE sequence. |
| `0003-openai.json`, `0011-openai.json`, `0017-openai.json` | Goal extraction: full instructions/schema/brief body is matched, including temporal interpretation. |
| `0004-openai.json`, `0012-openai.json`, `0018-openai.json` | Draft self-check: input includes the newly constructed graph. |
| `0006-openai.json`, `0014-openai.json`, `0020-openai.json`, `0022-openai.json` | Agent continuations: tool outputs, model/graph state and conversation context depend on construction and CEE changes. |
| `0005-openai.json`, `0007-openai.json`, `0013-openai.json`, `0019-openai.json`, `0021-openai.json`, `0023-openai.json`, `0025-openai.json` | Factor-validation guidance: requests contain model/analysis context from those drafts and Runs. |
| `0008-openai.json`, `0024-openai.json`, `0026-openai.json` | Run explanations: requests contain the exact analysis payload and graph/analysis hashes. |

The replay server matches the canonical whole request (including tools and schemas), not just the brief or call number; graph/analysis hashes are not normalised. These are replacement scopes, **not a claim that every old request is proven to drift**. The minimum subset that truly differs cannot be established without sending the deployed CEE's requests through replay, which this task prohibited. New numbering and order will follow the new run; old numbers are not stable semantic IDs.

From the patched UI checkout, after preserving the old fixtures and arranging the record script's existing DL heavy window:

```sh
J1_TUPLE=pinned J1_RECORD_MODE=record J1_MAX_CALLS=48 \
  J1_REC_DIR=/private/tmp/j1-b0-current \
  bash e2e/core/journey/stack/record-local.sh
```

Planning estimate: **42 provider calls** = the existing 26 exchanges + roughly 8 for each new draft/Run case (using the original first draft/Run's eight-call shape). **48 is a hard budget cap, not an expected or measured count.** Provider tool loops, admission and the no-target path may change the count; neither an exact total nor a guaranteed passing positive fixture is determinable without the prohibited run. The default cap of 15 is too small even for the existing 26-file scope.

The script swallows Playwright exit statuses to collect both suites: its shell exit alone does not prove success. DL must inspect both Playwright logs and the boundary ledger; all existing expectations remain enforced. In particular, J2b's exact enrichment-key set and J2d's pinned `option_intervention` branch may block the new tuple. No such runtime blocker was measured here and neither expectation was changed. If blocked, report the exact failing expectation instead of updating it to fit the new output. Bank only a fully witnessed run with no upstream errors/429s/budget refusals and the script's recording scan clean, then verify strict replay.

## Status and limits

No installs, builds, tests, provider calls, or re-recording were run. No sealed directory was read. A read-only `git show`/`git diff` against a local partial CEE clone unexpectedly attempted lazy network fetching; DNS rejected it and no remote content was obtained. Subsequent CEE inspection used filesystem files only.

Branch creation (`git switch -c recovery/b0-j1-current`) was rejected because the sandbox makes this checkout's `.git` read-only. Changes remain uncommitted on `staging`; no commit SHA exists and nothing was pushed. A session with Git metadata write access must create the requested branch and commit the five changed/new files. Runtime acceptance and exact provider-call count remain for the DL.
