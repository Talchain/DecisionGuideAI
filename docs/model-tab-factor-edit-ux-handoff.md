# Model-tab factor editing — isolated UI handoff

Status: implementation candidate for independent review. Do not merge or deploy until Primary supplies canonical completion and lifecycle integration. This document is not a full persistence or PoC acceptance verdict.

## Identity and ownership

Built from UI staging/deployed `a206cca9f5fd3a35376ad3c090fda59f97eec1b9` (deploy `6a95858d3f12120009faf91f`). Read final UI #1020 and #1024 deltas. Neither changes this factor editor. Ownership claim: https://github.com/Talchain/olumi-programme-docs/issues/26#issuecomment-5479766007.

Paul confirmed no Reasoning overlap with `src/canvas/model-tab-v2/**`. This candidate changes ModelTabV2Panel, ModelRowView, types, their focused tests and a browser test. It does not change adapters, ModelDetailRegion, shared hooks/stores, the panel parent/shell, conversation, V5, results, Inspector, normalization or option-intervention authority.

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

No new normalization rules. In particular, blanking an AI input preserves the event builder's `raw_or_value` basis and the displayed hint; it does not authorize switching to raw units. The frame-only scale mismatch remains Primary's backend repair.

## Acceptance boundary

Component tests exercise the real factor authority and exact event/undo, with real store-backed rerenders. Browser tests exercise the actual Model-tab component in a controlled local fixture; they do not certify server persistence. Validation evidence and exact candidate head are recorded in the PR/review comments.

## Recorded isolated validation

Node `20.19.5`; final focused suite: **352/352 across 21 files**. Includes the complete Model-tab-v2 suite, existing factor-value scale/event-builder tests and the no-raw-store-writes boundary scan. Focused ESLint and the close-out consistency check pass. The repository typecheck gate passes against its existing baseline; this does not claim a zero-diagnostic repository.

The final panel test corpus is identical across these independent worktrees (SHA-256 `e464de7db21556d5ab087a1b4eea2159ae0c1cc8abee312d19232b2e368b2d41`):

| Source | Passed | Failed |
| --- | ---: | ---: |
| Pristine `a206cca9` | 13 | 37 |
| Candidate | 50 | 0 |
| Prefix parser restored only for target factor | 46 | 4 |
| Same parser mutation only for sibling factor | 50 | 0 |

The four target failures are malformed concatenation, alternatives, a percent suffix and hexadecimal input. Pristine failures also prove the direct Enter/blur, blank AI seed and no-change idle regressions. The sibling mutation is a scope discriminator, not a separate sibling-validation claim. Two formatted-display controls (`£15,000` and `Moderate`) keep the explicit model-scale cue `0.5` and emit typed `0.85` unchanged through the existing builder.

Chromium **8/8**: native macOS select-all/replacement, genuine blur, Enter followed by focus change, Escape/deletion, untouched AI input and invalid inputs. Three captured states (blank/context, unconfirmed attempt and validation error) fit the 440px dock without horizontal overflow. Enter removes its input, so its later focus change is not claimed as a native blur event on that removed input; component tests explicitly cover the same-tick Enter/blur collision. There is no mocked successful receipt.

Replay the focused suite from the repository root with Node 20:

```sh
VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=test_key pnpm exec vitest run src/canvas/model-tab-v2 src/canvas/conversation/__tests__/factorValueEditModelScale.spec.ts src/canvas/components/model-tab/__tests__/modelTabNoRawStoreWrites.sourceScan.spec.ts
pnpm exec playwright test e2e/model-tab-factor-edit.spec.ts --project=chromium
```

The browser spec creates and removes its own temporary Vite mount; the standard Playwright configuration additionally starts the normal local app server. Both are local-only. Original local evidence is retained under `/private/tmp/model-tab-edit-ux-20260831.9dfKoq/` (suite/typecheck logs), `/private/tmp/model-tab-edit-red-mutations-20260831.m5qwhyy8/` (source/test hashes, patches, commands and all four reports) and `/private/tmp/model-tab-factor-e2e-config-od72l500/` (browser report/screenshots). These paths are session-local; the tests and discriminator description above are the portable evidence recipe.

## Deferred native acceptance

The following native witness remains REQUIRED after integration, on a bracketed exact UI/CEE/PLoT/ISL build:

1. Start from an analysis that consumed an Olumi/defaulted factor value; identify the exact scenario/factor and an untouched sibling.
2. Type a distinct value and commit with Enter. Observe exactly one real factor transaction, attributed canonical completion, and an immediate canonical read containing the accepted value/source.
3. Before rerun, Model shows the current user-authored value, Reasoning/Analysis retains the provenance of the last run, and that run is stale. Do not rewrite historical run provenance to resemble the current model.
4. Rerun through the native action. Verify the analysis request consumes the corrected canonical factor and new run provenance reflects what was consumed. Reload and read canonical state again; the sibling remains unchanged.
5. Repeat the blur counterpart, no-change/select-replace controls, malformed-input refusals and a controlled rejection. Test queueing/interruption and late acknowledgement without a false saved state.

Model tab contains separate Enter-to-commit paths for factor values and option interventions. This PR guarantees validation/deduplication only for the factor-value path. ModelDetailRegion's gated option-intervention path is unchanged.

No merge/deploy by this lane. Independent exact-head review is required; native canonical completion remains unproven until the named integration and witness are complete.
