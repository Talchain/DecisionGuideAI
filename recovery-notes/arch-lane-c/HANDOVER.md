# Arch lane C (PL-21, PL-22): handover

8 Nov 2026. Session: "Arch lane C: validate the View at the UI boundary". Branch `wip/arch-view-validate` (DGAI). The worktree is
`~/olumi-work/worktrees/dgai-arch-view-validate`, a blobless clone; node_modules is a symlink to dgai-build.

## Base
- `poc/r25-ui` at 234f27e359f71a10e142742108d616dabcd22bc0. The DL re-based the lane here on 8 Nov; it was c6e1186c.
- The rebase replayed 4 commits cleanly. Pre-rebase tip: 2ffd5a77.

## Done (on 234f27e3)
- **The validator:** `src/olumiView/validateView.ts` walks the vendored `view.v3.json` with gen-types.mjs's keyword set, CSP-safe.
  - By default (`'ignore'`) it ignores fields the schema does not declare, per the UI session's ruling, and checks every declared field.
  - `'strict'` keeps core's closure.
- **Its cases:** `src/olumiView/__tests__/validateView.spec.ts`, 23/23.
  - Both modes are held to Ajv on every vendored View and on mutants.
  - Cases: draft (schema-driven), gated, past version, malformed, link fields, and skew (n2c fields ignored).
  - Five mutants each turn it red.
  - contract.spec + client.spec, the pair build-ui-dist.sh runs, are green.
- **The 043895af schema re-vendor is reverted.** The UI session will vendor from the core N2 pairs with, after N2 lands.
  `view.v3.json` and `types.ts` are as at 234f27e3 (core 6192ad6b).
- **The import map (PL-22):** `import-map.md` (verdict and cut order) and `import-map-raw.md` (table). At c6e1186c: 73 imports reach
  42 old `src/canvas` modules (re-derived). 234f27e3 touches only StrategyCompose and its spec.
- **The entry edit:** `entry-edit.patch`, NOT applied.
  - It adds `client.ts` readView's check and a new constant, `VIEW_NOT_DRAWABLE` ("Olumi sent this scenario in a shape this page
    cannot show. Reload the page; if this stays, Olumi needs an update."). The UI session said yes to these words; they need the DL's OK.
  - It also adds the real-path rows: readView → useViewStore.
  - RED without the check line (3 failing), GREEN with it (27/27).
- **Plan rows** PL-21 and PL-22 are updated in the plan artifact.

## The UI session's conditions before the entry edit lands
1. Unknown keys are tolerated: DONE in the validator.
2. Re-vendor from the core N2 pairs with: strategy-n2c (cba67b49 → cd99ab32), which the DL must confirm. The UI session holds it.
3. In the same change as the entry edit, re-read the 22 failing fixtures from that core, plus store.spec's hand-built `view()`.
   No spec may go red for even one commit.

## Open: the exact next step
- A fresh Codex check on the change (`git diff 234f27e3..HEAD -- src/`). Then send the DL the READY SHA.
- After N2 is on candidate and the UI session re-vendors, the entry edit lands with the fixture refresh. It is the UI session's call
  or this lane's, by agreement.
- Do not touch N2 integration files until N2 is on candidate.

## UNVERIFIED
- Which of the 28 setTeamFetch specs go red with the entry edit. Only PR CI can tell. store.spec will, by reading its code. Fewer
  will now, because unknown keys are ignored.
- Whether the old-canvas mounts are what keeps the bundle at 9.84 MB.
- Whether LensBar's placement helpers are pure.
