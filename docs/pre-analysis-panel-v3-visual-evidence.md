# Pre-analysis panel v3 — visual hierarchy close-out evidence

**Scope:** the section-separation / visual-hierarchy pass (commit `6e40b04f`), className-only across 10 files in `src/canvas/components/pre-analysis-v3/`. Flag `preAnalysisV3` default OFF. Local commits only.

This note is the durable acceptance evidence (screenshots in-session were ephemeral). The structural invariants below are now also locked by an automated test — `src/canvas/components/pre-analysis-v3/__tests__/hierarchyContract.spec.tsx`.

## Reproducing the tests

The v3 tests transitively import the canvas store, which imports `src/lib/supabase.ts`. That module **throws at import time** if Supabase env vars are absent (unless the E2E flag is set) — this is **repo-wide**, not v3-specific (every store-importing test, including the ~1,093 legacy pre-analysis tests, has the same requirement). Local dev satisfies it via a gitignored `.env.local`; a clean shell or external reviewer must supply dummy values:

```bash
VITE_SUPABASE_URL=http://127.0.0.1 VITE_SUPABASE_ANON_KEY=dummy \
  npx vitest run src/canvas/components/pre-analysis-v3
```

Result: 15 files, 276 tests pass (271 prior + 5 new hierarchy-contract assertions).

> **Recommended follow-up (separate test-infra lane, not done here to avoid cross-cutting a visual lane):** commit a `.env.test` with dummy `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, or add a `test.env` block to `vitest.config.ts`, so the whole suite is clean-shell reproducible without the inline prefix. Verify it does not override real CI env before landing.

## Hierarchy contract (locked by `hierarchyContract.spec.tsx`)

| Invariant | Mechanism |
|---|---|
| Header owns the **only** `border-b` in the panel | Hero dropped its `border-b`; test asserts exactly one `border-b` element |
| Hero owns no separator rule | neither `border-b` nor `border-t` on the hero root |
| Sharpen / Your decision / Advanced / Footer each own one `border-t` | single top rule per section |
| Exactly one neutral header strip | Sharpen header carries static `bg-panel-hover`; disclosure triggers must NOT (they'd lose their hover affordance) |
| Disclosure bodies always mounted, `hidden` when closed | valid `aria-controls` target; no focusable leakage when collapsed |

Spacing scale: 24px between major sections (`py-4` either side of a 1px rule), 12px between groups (`mt-3`), ~4–6px between rows (`py-0.5` / `space-y`). Documented deviations: Sharpen signal rows `py-2` (hairline-bordered), intra-hero steps `mt-4` (calm zone), disclosure/footer trigger rows `py-3` (action-bar height).

## Functional verification (live browser, staging services, post-pass)

Every interactive element was exercised after the structural changes; all passed: health bars + low/medium/good cues; footer coherence + Analyse gating; success field commit by Enter and by Save, invalid-input kept-not-committed (blur path additionally covered by `InlineField.spec`); check-estimate drill + save (`user_override`, bar moves); Add-value vs Check differentiation on missing-value rows; add option / add risk (bars update, inputs clear); Sharpen reveal (Show N more ↔ Show fewer); Actions-menu keyboard (open → Arrow → Escape returns focus); per-group collapse + Expand/Collapse all; best-next-step ladder action; spark delivery (tab switch + bubble); Advanced disclosure; flag-off → legacy panel, flag-on → v3.

Caveat: programmatic `blur` cannot be exercised in the headless harness (no trusted `focusout` to React's `onBlur`); the shared `commit()` is proven via Enter + Save live and the blur→hint path is green in `InlineField.spec`.

## States walkthrough (before → after)

- **Collapsed default:** before, every boundary was an identical thin divider at uniform `py-3`, reading as one list; after, the `bg-panel-hover` strip marks Sharpen and single consistent rules separate the rest with ~24px of quiet around each seam.
- **Your decision expanded:** before, "Your decision" (14px) and "Frame" (12px) read at near-equal weight with groups touching; after, groups carry 12px gaps, coach lines are italicised below the data rows, and entity-shape anchors distinguish group headers.
- **Advanced expanded / missing-success / CEE-coaching / missing-factor-values:** all render with the same coherent section rhythm; the estimates group shows "Add value" on valueless rows and dimmed priority labels.

## Open design-exploration item (separate lane)

Single Sharpen band (shipped) vs a uniform banded-header system across all sections — a first-principles design decision, not an incremental tweak. The single band was chosen deliberately (synthesis rejected striping the disclosure triggers, which would force a token fork / kill their hover affordance).
