BLOCKED: the captured graph exposes yes/no only inside a conditional user_statements entry; it has no typed factor unit/type for this reader. The scoped reader fix below is ready for DL review, but does not close that original served loss.

- Progress: S11 value-meaning contract proved on the local production reader and mounted card; served capture remains blocked.
- Next two (highest-value? Y): DL supplies the canonical factor-unit projection; fresh review and served replay after integration.
- Mistake: initially assumed the capture carried factor metadata; one new test also exercised the baseline editor instead of the witnessed option-target editor.
- Correction APPLIED: traced persisted and reopened bytes, removed that invalid new assertion, retained every existing edit refusal and attribution negative.

Files changed:
- src/canvas/domain/switchFactors.ts — one shared state reader accepts explicit yes/no, boolean or binary unit/type metadata before magnitude formatting; existing encoding_map and In use / Not in use wording stay authoritative.
- src/canvas/nodes/__tests__/FactorNode.valueEditorScaleAndBaseline.spec.tsx — appended mounted card endpoint rows.
- src/canvas/utils/__tests__/factorOptionSetting.theCardStopsContradictingCee.spec.ts — appended option/factor-id rows, scale/count contrasts, same-label neighbour, encoding map and non-endpoint controls.
- recovery-notes/L25B-* — approach, capture-boundary extract, real execution logs/results and this report. No edits outside this tree/lease. No commit or push.

Rows (node-bound): 1 → In use; 0 → Not in use; 0.9 scale → Very high; 1 specialist → 1 specialist. Boolean neighbour and a yes/no label do not change count meaning. Existing negatives retained. Small property rows span four explicit unit/type declarations, independent of marketing/hiring labels. 0 live provider calls.

| Spec | Lane-base RED (failed/passed) | Final GREEN (passed/failed) |
|---|---:|---:|
| factorOptionSetting.theCardStopsContradictingCee.spec.ts | 6/10 | 16/0 |
| FactorNode.valueEditorScaleAndBaseline.spec.tsx | 4/15 | 19/0 |
| switchFactors.served.spec.tsx (existing routes) | unchanged | 74/0 |

HIGH mutants, each run separately against the setting route: unit declaration removed 4 failed/12 passed; type declaration removed 3/13; endpoints swapped 6/10; numeric endpoints promoted without metadata 2/14. All four KILLED. Unit and type claims each have removal + swapped-endpoint controls; count exclusion additionally has the overbroad mutant. Source restored and all three specs rerun GREEN.

Trace / first loss:
- Source sentence/speaker: captured conditional alternative “Should I hire a marketing manager…”; stored reading=olumi, speaker=user, stance=hypothetical. This is not evidence of a current employed baseline.
- Approval: no approval of a present baseline is established by this conditional entry.
- Persisted readback: marketing_manager_employed has no unit, factor_type, factorType or observed_state; the nested statement alone declares unit=yes/no. hire_marketing_manager sets that factor to 1 and carries user_material_unverified=true.
- This Run: local rows pass declared metadata and exact values through the production shared reader; an engine Run is not claimed. The captured Run's interpreted unit is unknown.
- User saw: hire_marketing_manager's option row said “→ Very high” after cold reopen.
- First missing boundary: producer graph → typed UI factor metadata. The UI receives neither an explicit state unit/type nor a served switch declaration. Parsing the conditional statement/quote into a new authority is outside this lane.

BLOCKED-LEASE: producer graph projection outside the DGAI tree. Smallest hook: preserve/project the producer-declared state unit into the factor's existing unit or observed_state.unit field. No invented baseline is needed: the patched reader can word an option endpoint even when a declared boolean has no current baseline. Owner: DL to assign the producer contract. Capture evidence: L25B-capture-boundary.json and the supplied live reads/reopen.json.

NUMBER: endpoint values are passed through, not computed or defaulted; counts and scales retain their numeric meaning.
AUTHOR: no provenance/source/approval fields change; producer encoding-map words stay authoritative.
CLAIM: state words express declared boolean states, never a strength band or a chance.

Product test: explicit state wording helps people understand and correct the model without turning presence into a magnitude claim; the original served case still needs the upstream unit declaration.
Buddy: correct for explicit metadata; original capture remains blocked. Simpler: one existing reader and existing words, no imports/exports or new authority/parser. OpenAI SDK substitution is inapplicable to typed display; 0 provider calls or added provider latency.

Shape (tools-dl/pr-shape.sh, local worktree diff, no PR/network): source +9/-3, net +6, one file; tests +67/-0, two files; 0 refusal codes, regexes or exports; 3 added if-lines (the diagnostic counts modified if-lines too). Retires the marker-only gate for explicitly declared state factors. Growth reason: the existing reader did not admit typed state declarations.
New cycles: head 2 / base 2 / NEW or GROWN 0 (new-cycles.py against 00a6045270f1817ae140eb25dbfcd5bc92cd5dc2).
ESLint and git diff --check pass. Final required NODE_OPTIONS=--max-old-space-size=6144 pnpm exec tsc --noEmit -p tsconfig.json exits 0 (solution config). Final NODE_OPTIONS=--max-old-space-size=6144 npm run typecheck exits 0: substantive coverage + ratchet PASSED; 0 errors in EACH of the three changed TypeScript files (all are covered and have no diagnostic allowance). Existing tree diagnostics remain outside the lane; no baseline was modified.
Process-list verification: sandbox denies pgrep; this builder ran its compiler processes sequentially. No global no-other-tsc assertion is made. Machine load was left to the DL as instructed.
Disk: no cleanup; 0 bytes freed.

Exact commit message: fix(canvas): preserve typed boolean factor state wording

Plan: L25B · Simplest approach? Y — reuse the existing state reader and vocabulary; producer unit projection still needed · Net src lines: +6
