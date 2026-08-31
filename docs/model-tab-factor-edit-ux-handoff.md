# Model-tab factor editing — isolated UI handoff

Status: implementation candidate for independent review. Do not merge or deploy until Primary supplies canonical completion and lifecycle integration. This document is not a full persistence or PoC acceptance verdict.

## Identity and ownership

Built from UI staging/deployed `a206cca9f5fd3a35376ad3c090fda59f97eec1b9` (deploy `6a95858d3f12120009faf91f`). Read final UI #1020 and #1024 deltas. Neither changes this factor editor. Ownership claim: https://github.com/Talchain/olumi-programme-docs/issues/26#issuecomment-5479766007.

Paul confirmed no Reasoning overlap with `src/canvas/model-tab-v2/**`. This candidate changes ModelTabV2Panel, ModelRowView, types, their focused tests and a browser test. It does not change adapters, ModelDetailRegion, shared hooks/stores, the panel parent/shell, conversation, V5, results, Inspector, normalization or option-intervention authority.

## Product ruling and assessment reconciliation

The previous R9 three-beat in `docs/Design/MODEL-EDITOR-V2.md` was a real product ruling, not an implementation accident. **Paul explicitly superseded it for factor values in this task:** Enter or blur saves one valid changed value, without another Confirm. The affected tests now encode that approved change. This is a factor-only exception, not authority to harmonize other editors or remove unrelated affordances. The separate `confirmValueAsIs` / `onConfirmValueAsIs` gesture and its authority gate remain unchanged. No new claim is made about keyboard undo or guest version restoration.

Claude's plan assessment correctly identified the missing completion API and the need for numeric no-op checks. Both are reflected below. `EditProposalHandle` is an existing documented shape with no live implementation; exposing and wiring it is still work for the shared owner. Neither dispatcher/context signatures nor the directory-derived boundary guards are changed here. Existing callback pass-throughs suffice, so ModelOutline/useOutlineKeyboard/contracts need no speculative edits.

`valueProvenance.ts` is read-only for this lane. Its existing `user` / `user_override` classification already supports canonical edited values; neither its taxonomy nor surface labels need widening. The proposed addition of ISL's `user_input` / `computed` to its model-source map is not adopted: the installed model-source contract excludes them and its completeness guard rejects private additions. Any run-provenance repair belongs to Reasoning and must interpret the run's own evidence, not current model ownership. In particular, confusing bootstrap-confidence degeneracy with value origin is a within-run issue; it does not make disagreement between an old run and a subsequently edited model an error.

Reasoning handoff: at UI `a206cca9`, `buildAnalysisNewViewModel` and `buildHeroModel` both treat confidence degeneracy as estimated value origin. The cited `brief_extraction`/zero-stability fixture illustrates the classifier error if that row is admitted; it does **not** establish Claude's "live today" mounted claim, because the current UI filters its zero-elasticity row in that six-factor case and current PLoT also filters its intervention-override category. Reasoning must bind any mounted claim to an actually emitted/displayed row and exact run/build. At ISL `28fe0c95`, `robustness.py:1373-1391` supplies `value_defaulted` as absent or true, with true meaning fallback zero; `response_v2.py:1129-1136` documents absence for observed/prior-derived values. PLoT `d37c8cfd` preserves that field when present. Requiring explicit false therefore leaves three glance copy branches unserved on this fresh producer path, though schema-legal cached/custom data could reach them. Neither absence nor fallback zero licenses inventing user authorship or an Olumi reasoned estimate. These findings were sent to the orchestrator for the existing Reasoning owner; no results or shared taxonomy files are changed here.

The assessment's suggested `raw_only` change is not adopted because Paul explicitly requires preserving the existing adapter/event-builder basis. Blanking a contribution field does not change its numeric units; the editor supplies separate context and an explicit model-scale cue. `Number()` runs only after the whole-string decimal/exponent grammar succeeds, so empty-string and hexadecimal coercions cannot reach it. The unresolved display is labelled **Your entry**, not an accepted canonical value. The permissive receipt predicate is treated only as a non-revert safeguard, never as proof of saving.

## Banked behavior

- Enter and blur invoke one synchronously guarded factor commit. No separate Confirm step.
- The existing authority still builds the factor event, applies its optimistic write and carries its undo; this UI introduces no writer.
- AI estimates appear as context, not prefilled input. User-owned values remain selected/replaceable. The shared model-provenance classifier governs this distinction; historical run-default flags are never consulted or changed.
- Whole trimmed finite decimal/exponent input is required. Prefixes, suffixes, alternatives, malformed concatenations and non-finite values are refused visibly before mutation.
- Untouched/whitespace-only blank inputs, equivalent numeric values, Escape and IME continuation do not submit.
- An unresolved attempt remains visible on its row when another row is selected. Its captured value is labelled Previous. Optimistic user provenance is suppressed in that row and its detail view.
- The current hook supplies only `dispatched`, `local_only` or `not_encodable`. Dispatch renders Not yet confirmed; local-only renders Not saved to the shared model; local refusal retains the editable draft with an error; a synchronous transport exception remains unconfirmed. No current branch creates an applied state.
- Row renderer controls consume the existing documented applied/refused/inflight states, including the applied value/source. Those controls are contract tests, not proof that the shared dispatcher currently supplies them.

## Required integration — Primary with the relevant shared-file owners

This is the exact remaining delta; do not replace it with a second writer or a successful-send heuristic.

1. `src/canvas/hooks/useModelEditAuthority.ts`: expose the existing factor transaction's completion, compatible with the documented `EditProposalHandle`/`EditCommitState`. Preserve the current event builder and input basis. Do not manufacture an applied receipt from the submitted value or optimistic source.
2. `src/canvas/conversation/useConversation.ts` and `optimisticFactorEdit.ts`: correlate completion by scenario, factor and edit/turn identity, including the deferred-send flush. Queueing stays pending. An attributed accepted receipt plus committed canonical value/source settles; explicit refusal uses ownership-safe rollback; interruption/transport uncertainty stays unconfirmed. The permissive `responseAppliedFactorEdit` non-revert safeguard is not a positive Saved predicate. Ordinary receipt `after` currently lacks canonical source, so carry it from the authoritative graph/readback through the existing reconciliation seam.
3. `src/canvas/components/ModelTabBody.tsx`: supply its current scenario identity as the new `modelIdentity` prop. The keyed Model-only content then resets immediately even if factor IDs repeat. Lift transaction outcome/lifecycle into the shared authority so switching tabs/remounting cannot erase unresolved status. The optional prop alone is not a claim that production scenario binding exists.
4. ModelTabV2Panel: connect the returned authoritative state in place of the temporary dispatch-only unconfirmed map. Consume terminal state verbatim; reconcile canonical nodes so the outline and detail agree. Reject late results for an obsolete edit/scenario. Until then the candidate remains a draft and same-row editing stays locked after an unconfirmed dispatch; no automatic retry.

No new normalization rules. In particular, blanking an AI input preserves the event builder's `raw_or_value` basis and the displayed hint; it does not authorize switching to raw units. Native input-basis/scale acceptance remains with the separate scale lane through Primary. This PR does not establish a backend scale defect or prescribe its repair without mounted input-basis evidence.

## Acceptance boundary

Component tests exercise the real factor authority and exact event/undo, with real store-backed rerenders. Browser tests exercise the actual Model-tab component in a controlled local fixture; they do not certify server persistence. Validation evidence and exact candidate head are recorded in the PR/review comments.

## Recorded isolated validation

Node `20.19.5`; full focused run at the runtime candidate: **352/352 across 21 files**, followed by the final expanded panel corpus **53/53** after adding three rejection cases. The full run includes the complete Model-tab-v2 suite, existing factor-value scale/event-builder tests and the no-raw-store-writes boundary scan. Focused ESLint and the close-out consistency check pass. The repository typecheck gate passes against its existing baseline; this does not claim a zero-diagnostic repository.

The final panel test corpus is identical across these independent worktrees (SHA-256 `c01c9d7248e92b9706c7351fbb18204ed863aca2ce04e7ec333720bc4380bfb5`):

| Source | Passed | Failed |
| --- | ---: | ---: |
| Pristine `a206cca9` | 13 | 40 |
| Candidate | 53 | 0 |
| Prefix parser restored only for target factor | 46 | 7 |
| Same parser mutation only for sibling factor | 53 | 0 |

The seven target failures are malformed concatenation, alternatives, a percent suffix, comma grouping, hexadecimal, binary and octal input. Pristine failures also prove the direct Enter/blur, blank AI seed and no-change idle regressions. The sibling mutation is a scope discriminator, not a separate sibling-validation claim. Two formatted-display controls (`£15,000` and `Moderate`) keep the explicit model-scale cue `0.5` and emit typed `0.85` unchanged through the existing builder.

Chromium **8/8**: native macOS select-all/replacement, genuine blur, Enter followed by focus change, Escape/deletion, untouched AI input and invalid inputs. Three captured states (blank/context, unconfirmed attempt and validation error) fit the 440px dock without horizontal overflow. Enter removes its input, so its later focus change is not claimed as a native blur event on that removed input; component tests explicitly cover the same-tick Enter/blur collision. There is no mocked successful receipt.

Replay the focused suite from the repository root with Node 20:

```sh
VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=test_key pnpm exec vitest run src/canvas/model-tab-v2 src/canvas/conversation/__tests__/factorValueEditModelScale.spec.ts src/canvas/components/model-tab/__tests__/modelTabNoRawStoreWrites.sourceScan.spec.ts
```

The standard Playwright config starts the entire app and requires unrelated `ENGINE_SERVICE_URL` configuration before collecting tests. Use this isolated local replay instead; it does not change shared configuration:

```sh
MODEL_TAB_REPLAY_DIR="$(mktemp -d)"
cat > "$MODEL_TAB_REPLAY_DIR/playwright.config.cjs" <<'CONFIG'
module.exports = {
  testDir: process.env.MODEL_TAB_UI_ROOT + '/e2e',
  testMatch: 'model-tab-factor-edit.spec.ts',
  workers: 1, timeout: 45000, retries: 0,
  reporter: [['list']],
  use: { browserName: 'chromium', headless: true },
  outputDir: __dirname + '/output',
};
CONFIG
MODEL_TAB_UI_ROOT="$PWD" pnpm exec playwright test --config "$MODEL_TAB_REPLAY_DIR/playwright.config.cjs"
```

The browser spec creates and removes its own temporary Vite mount. Original local evidence is retained under `/private/tmp/model-tab-edit-ux-20260831.9dfKoq/` (suite/typecheck logs), `/private/tmp/model-tab-edit-red-mutations-20260831.m5qwhyy8/` (source/test hashes, patches, commands and all four reports) and `/private/tmp/model-tab-factor-e2e-config-od72l500/` (browser report/screenshots). These paths are session-local; the tests and discriminator description above are the portable evidence recipe. The isolated browser command was also rerun at committed runtime head `a0d7b0fa94f0f42f86a98a8e56c2c74b488a949b`: **8/8**, with no source changes.

## Deferred native acceptance

The following native witness remains REQUIRED after integration, on a bracketed exact UI/CEE/PLoT/ISL build:

1. Start from an analysis that consumed an Olumi/defaulted factor value; identify the exact scenario/factor and an untouched sibling.
2. Type a distinct value and commit with Enter. Observe exactly one real factor transaction, attributed canonical completion, and an immediate canonical read containing the accepted value/source.
3. Before rerun, Model shows the current user-authored value, Reasoning/Analysis retains the provenance of the last run, and that run is stale. Do not rewrite historical run provenance to resemble the current model.
4. Rerun through the native action. Verify the analysis request consumes the corrected canonical factor and new run provenance reflects what was consumed. Reload and read canonical state again; the sibling remains unchanged.
5. Repeat the blur counterpart, no-change/select-replace controls, malformed-input refusals and a controlled rejection. Test queueing/interruption and late acknowledgement without a false saved state.

Model tab contains separate Enter-to-commit paths for factor values and option interventions. This PR guarantees validation/deduplication only for the factor-value path. ModelDetailRegion's gated option-intervention path is unchanged.

No merge/deploy by this lane. Independent exact-head review is required; native canonical completion remains unproven until the named integration and witness are complete.
