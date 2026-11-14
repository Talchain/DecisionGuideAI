# Old UI baseline validation — 14 November 2026

Branch: `wip/scenario-ui-old-night`. UI code and dist build: `7a74e199993e6275ccafdaee8933caabf09fc075` (also the served HTML `x-build-id`). The following documentation commit changes no UI code. The final branch head is recorded in the external OUT file.

Dist: `/Users/paulslee/olumi-work/paul-copy-ui/scenario-ui-old-night/dist`.

Evidence root (E): `/Users/paulslee/olumi-work/ui-evidence/look/night-old/`. Final OUT: `E/OUT.md`. Dist digest: `6933e5050b536b185e4433957f8b9973e65f5fc639ac830303efd4c718465825`; the exact algorithm and 137 file hashes are in `E/DIST-MANIFEST.json`.

Six local repair commits, in the requested order; never pushed. No main changes, engine edits, provider calls, or protected-port probes. Only port 4131 served, against SQLite backup copies of the supplied non-protected test stores. The test service had no admin credential, no provider implementation, and a zero-call cap. It is stopped (`E/server-stopped.json`).

## Acceptance

The named screenshots below were opened and inspected. PASSED means the tested old-look baseline, not general product acceptance. Large boards pan at reading size; the entire model is not simultaneously visible at the smaller sizes. Long panel content scrolls. The checked editor, finding and panel actions remain readable and distinct.

| Item | Result | Before screenshot | Final screenshots, relative to E |
| --- | --- | --- | --- |
| 1. Aim | PASSED | `before-pending-2000-board.png`; `reproduce-pending-1128-reading-zoom.png` | `final-approved-2000-board.png`, `final-approved-1128-board.png`, `final-pending-2000-board.png`, `final-pending-1128-board.png` |
| 2. Failed reply | PASSED | `reproduce-pending-2000-failure.png` shows both notices together | `final-pending-2000-failure.png`, `final-pending-1128-failure.png`: one notice, one Try again, retained message |
| 3. Reveal | PASSED | `before-pair-2000-board.png`, `before-pair-1128-reload.png` | `final-pair-{2000,1128}-kept.png`, `-team.png`, `-reload.png`, `-return.png`, `-closed.png`: correct record heading, saved receipt, no repeat dock, return to origin |
| 4. Tabs | PASSED | `before-approved-1128-board.png` | `final-approved-2000-board.png`, `final-approved-1128-board.png`: full labels on one row; horizontal scrolling remains available below this width |
| 5. Opening camera | PASSED | `before-approved-1128-board.png`, `before-pending-1128-board.png`: 0.415667 | Six `final-{approved,pending}-{2000,1128,1504-133}-board.png` captures: readable full faces, aim visible, overflow pans |
| 6. Names and conditions | PASSED | `before-pending-2000-board.png` | `final-{approved,pending}-{2000,1128}-conditions.png`: complete finding title, conditions and uncertainty exposed by clicking Details; no hover needed |

The six opening captures cover 2000×1200, 1128×707, and 2000×1200 at 133% (1504×902 CSS pixels, DPR 1.33). Their actual PNG dimensions were checked. `SHEET-final-boards.png` is a 2432×1112 contact sheet; the full source screenshots are authoritative.

Additional acceptance at both sizes: `final-approved-{2000,1128}-editor-typed.png` shows the figure label, GBP unit, typed input and actions. `final-pending-{2000,1128}-proposal-actions.png` shows the existing approval controls after scrolling. Neither was submitted.

The final runtime report (`E/final-verification.json`) records nine contexts, zero page errors, zero unexpected attempted writes, readable opening zooms, no clipped reading-face titles/leads, and exact finding-title matches. The final 1128 pending disclosure was recaptured with the pointer outside the canvas (`E/supplement-pending-1128.json`) because an unrelated hover card had covered its first capture.

The final collaboration fixture was reset before this build's test. The UI saved `POST /differences/team_size/steps` with 201. Its server receipt appears in both the dock and Team panel, survives reload, and is present on manual reopen. All three tested contexts returned to the same camera matrix and tab as before manual opening. The heading is the original record's supplied label, **Team size added**, rather than its summary-card host, Monthly spend. Automatic opening now waits for layout and framing to settle before capturing a return camera.

## Checks and boundary

`E/release-checks.log`: 54/54 focused tests and typecheck coverage + ratchet PASSED on the frozen source. 6816 of 6856 tracked TypeScript files loaded, 40 declared out of scope. The gate retains 1947 pre-existing diagnostics versus its 2055 baseline; no baseline was edited. `E/build-final.log`: production Vite build passed, with existing chunk warnings. All heavy jobs used heavy.sh; after initial default-ceiling waits, the supported 45 load ceiling was used. Browser runs used the requested single-browser lock and released it.

The pending board is the supplied recorded first draft before any approval (`s_a30668165d74`), not a new provider draft tonight. The approved board is `s_e399f8a9d922`. Both are served by the reviewed test engine `f6447f702ed631c0b655be055c9719a4f32e2585`. The separate two-person funding fixture is `s_10af6c5feed7`.

Not executed: live drafting or retry, saved figure/recalculation, proposal approval, a second-person UI reload, other browser engines, or secondary-tab journeys. These need their normal authorized test setup; this delivery claims their inspected readability only. The retained disagreement itself was saved through the actual non-AI API.

Upstream words remain unchanged: the approved reply repeats “5 months 5 months” and a currency range; finding titles use “not yet confirmed by them”; the pair's model still says Not run and cannot compare the figures' effects. These belong to the View producer. Reopen when corrected View output is served, then recapture the same states. The frontend invents no missing chance and does not repair these sentences.

Product test: the repairs make the team's aim, assumptions, uncertainty and retained disagreement inspectable, while keeping approval and judgement with the person. No new scientific result or recommendation is claimed.
