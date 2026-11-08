# Arch lane C (PL-21, PL-22): handover

8 Nov 2026. Session: "Arch lane C: validate the View at the UI boundary". Branch `wip/arch-view-validate` (DGAI). The worktree is
`~/olumi-work/worktrees/dgai-arch-view-validate`, a blobless clone; node_modules is a symlink to dgai-build.

## Base
- `poc/r25-ui` at 234f27e359f71a10e142742108d616dabcd22bc0. The DL re-based the lane here on 8 Nov; it was c6e1186c.
- The rebase replayed 4 commits cleanly. Pre-rebase tip: 2ffd5a77.

## Done
- **The validator:** `src/olumiView/validateView.ts`. It walks the vendored `view.v3.json` with gen-types.mjs's keyword set, CSP-safe.
- **Its cases:** `src/olumiView/__tests__/validateView.spec.ts`.
  - It agrees with Ajv on every vendored View and on several hundred mutants.
  - Cases: draft, gated, past version and malformed.
  - Three mutants turn it red.
- **The import map (PL-22):** `import-map.md` (verdict and cut order) and `import-map-raw.md` (the per-module table). At c6e1186c:
  73 imports reach 42 old `src/canvas` modules (re-derived).
- **The entry edit:** `entry-edit.patch`, 3 lines in `client.ts` readView plus the real-path rows. Locally it is RED without the edit and
  GREEN with it, measured at 2ffd5a77. It is deliberately NOT applied.
- **Plan rows** PL-21 and PL-22 are updated in the plan artifact.

## UI session's ruling (8 Nov): validator and spec only for now
1. **Tolerate unknown keys at run time:** check required keys and types only. Core n2c already serves `strategy`, `badge.words`,
   `badge.icon` and `marks`.
2. **Re-vendor from the core N2 pairs with:** strategy-n2c (cba67b49 → cd99ab32), which the DL must confirm. NOT 043895af. The UI
   session has this queued for after N2 lands.
3. **Fixtures first:** re-read the 22 failing fixtures from that core, including store.spec's hand-built `view()`. Add the entry edit
   in the same change, so no spec goes red for even one commit.
4. **Words:** yes to a separate constant for a View that fails the check: "Olumi sent this scenario in a shape this page cannot show.
   Reload the page; if this stays, Olumi needs an update." Needs the DL's OK.

## Open: the exact next step
- Make unknown keys tolerated at run time (`validateView`), while keeping a strict mode for the Ajv differential.
- Drop the 043895af re-vendor commit, and make the draft rows schema-driven.
- Re-run validateView.spec, then contract.spec + client.spec and the typecheck.
- Push, get a fresh Codex check, and send the DL the READY SHA.
- Do not touch N2 integration files until N2 is on candidate.

## UNVERIFIED
- Which of the 28 setTeamFetch specs go red with the entry edit. Only PR CI can tell. store.spec will, by reading its code.
- Whether the old-canvas mounts are what keeps the bundle at 9.84 MB.
- Whether LensBar's placement helpers are pure.
