# Brief 5.8B — D6 Advanced metadata verification + orphan-string scan

Per the brief: D6 is verify-only. The metadata block was already in place at
[`AdvancedSection.tsx:334-411`](../src/components/results/AdvancedSection.tsx#L334-L411)
inside the `expertMode &&` gate before this brief began. No restore was
needed — Paul confirmed this disposition during the planning step.

## Rows verified

The block iterates over the following `<dl>` rows when `expertMode === true`:

| Row | Source | Field |
| --- | --- | --- |
| Stability | `stability` | percent |
| Simulation quality | `nSamples` | localised count + " simulations" |
| Sensitive assumptions | `fragileEdgeCount` | integer |
| Stable edges | `robustEdgeCount` | integer |
| Graph size | `nodeCount`, `edgeCount` | "{N} nodes, {M} edges" |
| Identifiability | `identifiability` | sentence-cased label |
| Seed | `seedUsed` | mono integer |
| Hash | `responseHash` | truncated `slice(0, 12)…` + copy button |

Each row is independently gated on its own value being present, so missing
upstream data leaves the affected row empty rather than emitting `undefined`.

The existing `AdvancedSection.spec.tsx` (19 cases, all passing) covers the
full matrix:
  - Each row renders when its field is present + `expertMode === true`.
  - `Hash` row absent when `expertMode === false` (regression guard).
  - `Hash` row absent when `expertMode === false` AND auto-expand fires.
  - Whole "Analysis details" section absent in default (non-expert) mode.

No code changes needed — D6 is verification only.

## Orphan-string scan

Per the brief, scan for orphan strings flagged in the planning phase:

```
$ rg "Stability sensitive" src/
src/components/results/ResultsFooter.tsx:21        comment only
src/components/results/__tests__/ResultsFooter.spec.tsx:* test fixtures (ignore)

$ rg "a307a04" src/
(no matches)

$ rg "62% of influence" src/
src/components/results/__tests__/ResultsFooter.spec.tsx:* test fixture (ignore)
```

Findings:

  - **`a307a04`** — clean. The hash mentioned in the original brief was the
    staging deploy commit; it does not surface in any production code path.
  - **`Stability sensitive`** — surfaces in production via
    `getStabilityDisplayLabel()` → `ResultsFooter` (`src/components/results/utils/getStabilityDisplayLabel.ts:50`).
    The footer renders strings like `"Stability sensitive · 62% of influence · 97%"`.
    This is the legacy footer the **D8 re-skin will replace** with the
    wireframe stacked layout (status dot + "Stable result" /
    "Sensitive to assumptions" / "Provisional result" + meta + Rerun).
    No D6 production removal needed — owned by D8.
  - **`62% of influence`** — same path as above; templated via
    `${Math.round(influencePct * 100)}% of influence` in ResultsFooter.tsx:47.
    Will be removed when D8 re-skins the footer.

The brief noted that test fixture removal is out of scope for these scans:
test files keep their copies because they assert the absence of the
strings in production output (regression guards).
