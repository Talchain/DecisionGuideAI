RT-12 is implemented in `/private/tmp/canvas-rt12` from staging `7f4f16f83`, on `canvas/rt12-example-figures`. All seven admitted links (`e-12` through `e-18`, bound by their actual endpoints and mapper ids) say **example figure**. A changed strength retires the example attribution and the hover reads **Set by you**. The served Olumi/user-stated controls retain their words.

Three patched links have no `natural_effect`. Their explicit example author is retained as a signed `strengthExampleFigure` key at the existing ingestion and partial-update boundaries. Their Size row uses the existing strength-band words. No natural amount, unit or conversion is invented. The other four use the admitted natural effect. Both paths share the existing strength-equality staleness rule.

The exact current brief's inspector sentence is: “Example figure. The example decision comes with this strength so you can see a Run; change it to see how much it matters.” Examine uses basis `example` and the exact supplied why sentence. The graph has seven example figures, zero placeholders, 13 nodes and 19 edges, with goal **Grow quarterly revenue**.

Validation passed: **209 tests across eight focused spec files**, each run individually with `VITE_SUPABASE_URL=http://localhost VITE_SUPABASE_ANON_KEY=dummy`:

- `rt12ExampleFigures.spec.tsx`: 68.
- `EdgePanel.rt12ExampleFigures.spec.tsx`: 16.
- `rt12ExamplePartialUpdates.spec.ts`: 5.
- `openExampleDecision.spec.ts`: 28.
- `strengthPlaceholder.spec.ts`: 15, including the pinned DraftChat adjacency.
- `strengthDefinitional.spec.ts`: 28.
- `strengthLinkSizing.boundaries.spec.tsx`: 34.
- `aLinkSaysTheUsersFigure.journey4.spec.ts`: 15.

The original reader run was RED (52 failed / 8 passed), the partial-update rows were RED (4 failed / 1 passed), and the writer was RED (2 failed / 26 passed). The prescribed `mutrun.py` ran one focused spec per invocation and killed **38/38 mutants**, with byte-identical restoration and a GREEN baseline after every manifest. Full log: [brief-rt12-mutant-log.txt](brief-rt12-mutant-log.txt). The first schema-removal mutant survived because the schema passes through unknown fields; meaningful malformed-key assertions were added, and the final full reader run killed it.

Only one existing spec was re-pinned: `src/canvas/example/__tests__/openExampleDecision.spec.ts`. Its graph-hash row now pins Science's canonical hash explicitly; its old two-placeholder invariant now pins the seven actual example endpoints and zero placeholders. The card-label assertion now binds the new graph label through `EXAMPLE_DECISION_GOAL_LABEL`. Capture identity, option count, proposal identity, risk reachability and opening safety assertions remain in place. No source-pinned reader lines were re-pinned. Required basename searches were done before edits; the existing `strengthPlaceholder.spec.ts:137` boundary is byte-identical. `ExamineLink.tsx` needs no change because it already renders the view's basis and why directly.

`pnpm run typecheck` **PASSED**: 5,832 of 5,872 tracked TypeScript files covered, 40 declared outside scope, 522 baseline error files / 2,059 errors. `bash scripts/ci/typecheck-gate.sh --update-baseline` refreshed six added/six removed printed identities after the edge type expansion. `scripts/ci/typecheck-baseline.txt` is **byte-identical** to staging; no per-file count grew. The identity refresh was committed separately before the writer. Raw typecheck and focused logs are in `/private/tmp/canvas-rt12-validation/`.

The sandbox rejects `sysctl -n vm.loadavg` during its name-format lookup. The quantitative gate was checked with the equivalent kernel read `os.getloadavg()[0] < 25`; the npx wrapper checked it before every nested mutant run. This is a recorded deviation from the requested command. The sandbox also makes this checkout's `.git` read-only (`index.lock`: Operation not permitted). Seven small local commits, each ending with the required Codex co-author line, are preserved in `/private/tmp/canvas-rt12-local-git`, with this same work tree and branch. The writer is the final commit, subject `feat(canvas): ship the Science RT-12 example figures`. No push occurred.

For Canvas to import the local commit chain into the checkout's writable Git metadata:

```sh
git fetch /private/tmp/canvas-rt12-example-figures.bundle canvas/rt12-example-figures
git reset --mixed FETCH_HEAD
```

The working tree already contains the bundle's source. The checkout's original HEAD remains at staging until import. The supplied graph and fixture are byte-identical to `/private/tmp/canvas-rt12-in/d1.patched.json`; the `capture`, `captureSha256` and `extracted` fields remain unchanged.

- Established `JSON.stringify(graph)` hash: `b0abef2da7be9348f3b99cdab6b19f880ebae58db8ee345ba2e19f1d78000a8a`.
- Raw file hash: `8978b093d647314e502655284a084780f55612c35a1881a2dd64dee18af1f9a7`.

The no-touch files are unchanged, and no feature flags or routes were added. Status is **CODED / TESTED locally**. Canvas owns served-bundle and browser-journey verification after importing the commits; this builder report supplies local mounted DOM assertions and mutation evidence. No deployed acceptance or release closeout is claimed.

Every changed checkout file (32):

- `docs/brief-rt12-inspector-mutants.json` — Four mounted inspector mutations.
- `docs/brief-rt12-local-report.md` — This builder report and handoff.
- `docs/brief-rt12-mutant-log.txt` — Full final mutant outcomes, baselines and initial RED counts.
- `docs/brief-rt12-partial-mutants.json` — Five partial-update mutations.
- `docs/brief-rt12-reader-mutants.json` — 27 isolated reader mutations.
- `docs/brief-rt12-writer-mutants.json` — Two writer/hash mutations.
- `scripts/ci/typecheck-baseline-identities.txt` — Refresh six existing printed diagnostic identities; per-file counts unchanged.
- `src/canvas/components/DraftChat.tsx` — Admit and strip the example strength key in the third ingestion hop; preserve placeholder source pin.
- `src/canvas/components/StarterDecisions.tsx` — Match the Science goal label: Grow quarterly revenue.
- `src/canvas/components/hoverCard/LinkHoverCard.tsx` — Say example figure for Strength and Direction; Size uses the shared sentence.
- `src/canvas/conversation/utils/applyPatch.ts` — Admit example metadata in graph-patch ingestion.
- `src/canvas/domain/__tests__/fixtures/d1.patched.rt12.json` — Byte-identical Science corpus used before the shipped writer changes.
- `src/canvas/domain/__tests__/rt12ExampleFigures.spec.tsx` — New 68-test reader, ingestion, schema, control and staleness contract.
- `src/canvas/domain/__tests__/rt12ExamplePartialUpdates.spec.ts` — New five-test contract across all seven links for partial-update admission and retirement.
- `src/canvas/domain/edgeStrengthSettlement.ts` — Live example strengths are no one's judgement and are not human-settled.
- `src/canvas/domain/edges.ts` — Persist and validate the finite signed example strength key.
- `src/canvas/domain/linkSizingLabels.ts` — Reuse the partial-update boundary to strip, admit, preserve and retire the new internal key.
- `src/canvas/domain/naturalEffect.ts` — Admit example author/schema/words, share strength staleness, and preserve example phrase attribution.
- `src/canvas/edges/StyledEdge.tsx` — Suppress est. for current example figures.
- `src/canvas/edges/edgeSizePhrase.ts` — Expose exampleFigure; use existing band words for the three links without natural_effect.
- `src/canvas/example/__tests__/openExampleDecision.spec.ts` — Re-pin the Science hash and seven example classes; retain opening/safety/structural assertions.
- `src/canvas/example/d1.graph.json` — Replace byte-for-byte with the supplied Science patch.
- `src/canvas/example/exampleDecision.ts` — Update shipped graph hash and RT-12 Science provenance comments; capture fields unchanged.
- `src/canvas/model-tab-v2/adapters.ts` — Suppress unconfirmed estimate attention and retain example detail/source words.
- `src/canvas/nodes/shared/EdgePills.tsx` — Show example figure in visible strength text and title.
- `src/canvas/ui/inspector-v2/__tests__/EdgePanel.rt12ExampleFigures.spec.tsx` — New 16-test mounted InspectorRouter/EdgePanel/Examine contract.
- `src/canvas/ui/inspector-v2/coachingConfig.ts` — Use the exact example strength sentence in both resolvers.
- `src/canvas/ui/inspector-v2/examine/examineLinkView.ts` — Add example basis with the exact why sentence.
- `src/canvas/ui/inspector-v2/inspectorStrings.ts` — Name the strength spread an example figure.
- `src/canvas/ui/inspector-v2/panels/EdgePanel.tsx` — Forward live example attribution and suppress current estimate/confirmation.
- `src/canvas/utils/applyDraftResult.ts` — Admit example metadata through the real draft ingestion hop.
- `src/canvas/utils/mergeAppliedGraph.ts` — Acquire and remove the new key as metadata, including unchanged-value readbacks.
