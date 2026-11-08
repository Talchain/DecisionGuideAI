# Arch lane C (PL-21, PL-22): handover

8 Nov 2026. Session: "Arch lane C: validate the View at the UI boundary". Branch `wip/arch-view-validate` (DGAI). The worktree is
`~/olumi-work/worktrees/dgai-arch-view-validate`, a blobless clone; node_modules is a symlink to dgai-build.

## Base
- `poc/r25-ui` at 234f27e359f71a10e142742108d616dabcd22bc0. The DL re-based the lane here on 8 Nov; it was c6e1186c.
- The rebase replayed 4 commits cleanly. Pre-rebase tip: 2ffd5a77.

## Done (on 234f27e3)
- **The validator:** `src/olumiView/validateView.ts` walks the vendored `view.v3.json` with gen-types.mjs's keyword set, CSP-safe.
  - By default (`'ignore'`) it ignores fields the schema does not declare, per the UI session's ruling, and checks every declared field.
  - One exception, from the Codex FAIL: inside a union of object shapes, a key a sibling shape declares is refused.
  - `'strict'` keeps core's closure.
- **Its cases:** `src/olumiView/__tests__/validateView.spec.ts`, 27/27. They also pass on core e61bdb2f's schema (dry run).
  - Both modes are held to Ajv on every vendored View and on mutants.
  - Cases: draft (schema-driven), gated, past version, malformed, link fields, and skew (n2c fields ignored).
  - Six mutants each turn it red.
  - contract.spec + client.spec, the pair build-ui-dist.sh runs, are green.
- **The 043895af schema re-vendor is reverted.** The UI session will vendor from the core N2 pairs with, after N2 lands.
  `view.v3.json` and `types.ts` are as at 234f27e3 (core 6192ad6b).
- **The import map (PL-22):** `import-map.md` (verdict and cut order) and `import-map-raw.md` (table). At c6e1186c: 73 imports reach
  42 old `src/canvas` modules (re-derived). 234f27e3 touches only StrategyCompose and its spec.
- **The entry edit:** `entry-edit.patch`, NOT applied.
  - It adds `client.ts` readView's check and a new constant, `VIEW_NOT_DRAWABLE`: "Olumi sent this scenario in a shape this page
    cannot show, so it is not drawn. Reload the page; if this message stays, the Olumi team needs to look at it."
  - The UI session said yes to a separate constant. These words were revised after Codex said "Olumi needs an update" overstates
    the cause. They need the DL's OK.
  - It also adds the real-path rows: readView → useViewStore.
  - RED without the check line (3 failing), GREEN with it (30/30).
- **Plan rows** PL-21 and PL-22 are updated in the plan artifact.

## DL rulings (8 Nov)
- The core to take the schema from is the N2 candidate **e61bdb2fb9b0a482281cee756f99ec399f0b22bf**. It contains strategy-n2c
  cd99ab32 and was `candidate`'s tip on 8 Nov. It already has PR 7's required `links[].records`, plus `strategy` and `draft`.
- The `VIEW_NOT_DRAWABLE` sentence is approved as written.
- The entry edit lands only **after N2 is served**.

## The recipe for the one post-N2 change (no spec red for even one commit)
Dry-run in a throwaway worktree from this branch at 71d992a9 (8 Nov). With these steps, validateView.spec + client.spec +
contract.spec all pass: **130/130**.
1. From core e61bdb2f, copy byte for byte into `src/olumiView/`:
   - `schema/view.v3.json` → `view.v3.json`;
   - the 7 goldens `src/view/__tests__/golden/<n>.view3.json` → `golden/<n>.view.json`, for pricing, studio, bakery, european,
     app-launch, s_ce285b3617bb and proposal;
   - `src/view/__tests__/golden/dock.oracle.json` → `golden/dock.oracle.json`. Core's served sentence changed ("… never meets it"), so
     without the oracle 2 contract rows go red.
2. `node scripts/olumi-view/gen-types.mjs`.
3. Re-read from that core the 22 View files that fail its schema in the page's mode: `fixtures-vs-e61bdb2f.txt`, produced by
   `fixture-check.mjs`; run it from the DGAI root. Also re-read `store.spec.ts`'s hand-built `view()`.
   - First faults: 13 files miss `session` or `brief`; 8 miss `badge.words` (now required); growth-reveal misses `links[].records`.
4. `git apply recovery-notes/arch-lane-c/entry-edit.patch`: RED without it (3 failing), GREEN with it (31/31).
5. The rest of the suite is unmeasured here (28 specs use setTeamFetch): PR CI is the measure.

## Open: the exact next step
- After N2 is served, the recipe above runs as one change. The UI session owns steps 1–3 (its queued re-vendor); this lane's patch
  is step 4.
- Optional while waiting, if the DL clears it: PL-22 cut 1 (hoist the constants the View borrows from old-state modules), as a
  separate PR.

## UNVERIFIED
- Which of the 28 setTeamFetch specs go red with the entry edit. Only PR CI can tell. store.spec will, by reading its code. Fewer
  will now, because unknown keys are ignored.
- Whether the old-canvas mounts are what keeps the bundle at 9.84 MB.
- Whether LensBar's placement helpers are pure.
