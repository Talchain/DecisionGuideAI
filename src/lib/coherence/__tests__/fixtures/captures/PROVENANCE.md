# Capture provenance — cross-surface coherence corpus

⚠ **APPEND-ONLY.** Every file here is a record of what the deployed product ONCE EMITTED.
Adding a capture is fine; **editing one falsifies the record**, and a suite that goes green after
such an edit is agreeing with a history that never happened. If a capture must change, that is a
finding to report, not an edit to make.

Each file is a **byte-identical copy** of its source under `olumi-docs/`, verified with `cmp` at
copy time. The sha256 below is of the copy in this directory; it equals the source's.

| file here | source (`olumi-docs/…`) | sha256 |
|---|---|---|
| `acceptance-2026-08-17-j1r1-t1.json` | `witness-acceptance-2026-08-17/captures/j1r1-t1-event3.json` | `46f7fdcecc016fcfb96dcdc02b6f083fb7ed9d51b34656336de000d3ecf1bdc1` |
| `acceptance-2026-08-17-j4-t2.json` | `witness-acceptance-2026-08-17/captures/j4-t2-event-final.json` | `988d91978c1ac0b82a9e9c0aa153dd2ded8effdf86695d0f9a92a924143b4907` |
| `acceptance-2026-08-17-j4-t4.json` | `witness-acceptance-2026-08-17/captures/j4-t4-event-final.json` | `991ab4e303c93776cc959908db9d667b739e0aaf871d9b3aad79889b5e486b06` |
| `acceptance-2026-08-17-j4-t5.json` | `witness-acceptance-2026-08-17/captures/j4-t5-event-final.json` | `1ad1c530c8248aafc9230ed644613ccbf107bf18139bc910a2958673a1d20fa0` |
| `conditional-winners-2026-08-17-probe-A.json` | `witness-conditional-winners-2026-08-17/captures/probe-A-response-2026-08-17T103146Z.json` | `33a131daf85d0c23034b713d9197eda1c6050efcdc8f5bfe1db1c80e6664bcf7` |
| `seeded-2026-08-17-w2d-analysis-turn.json` | `witness-seeded-2026-08-17/captures/W2-wire-analysis-turn-run-w2d.json` | `64d4bb12756dcbbbd36f4a438da9baa867acf34b662478dbdfc19c51e46dcd2e` |
| `w998-2026-08-16-a1-turn2.json` | `witness-998-2026-08-16/a1-turn2-response.json` | `1474274f58f7391809d53d1327a335e58740f1511ef37f78c6ce2cee24788d6e` |
| `w998-2026-08-16-a1-turn3.json` | `witness-998-2026-08-16/a1-turn3-response.json` | `2bf85204399f14c06cee987b987047da5e8b0e33ee98568cbce4c35d8478acfb` |

## What each one is here to do

| file | state-class | role in the gate |
|---|---|---|
| `…j4-t2` | seeded, deployed 17 Aug | **CX1 + CX6 positive controls.** `complete_current` beside `needs_user_input` with 10 `MISSING_OPTION_VALUE` blockers, and the reply *"Your model already reflects subcontractor cost at 12%…"* about a factor the same payload's blocker calls missing. |
| `…j4-t4` | seeded | **CX6 opposite-direction twin** — names the SAME factor three times as *"still has no effect value"*. Still violates CX1. |
| `…j4-t5` | seeded | **CX1 opposite-direction twin** — identical readiness and blockers one turn later, run gone `complete_stale`. Coherent. |
| `…j1r1-t1` | fresh | `never_run` pre-run turn, every usability boolean false. Coherent; also the SSE-event-wrapper shape. |
| `…w2d` | seeded | **CX4 + CX5 positive controls.** `leader_claim.permitted:false` / `options_do_not_separate` beside two conditional-winner rows naming both options; `no_flip_in_range:true` and `winner_flips:true` for the same two `factor_id`s. |
| `…probe-A` | PLoT `/v2/run` probe | **CX5 opposite-direction twin** — both blocks populated and AGREEING (`flip_reason: found`, `winner_flips: true`). Proves the green is discrimination, not an empty array. |
| `…a1-turn3` | fresh | A fully coherent completed analysis — `complete_current`, `ready`, `permitted: true`. |
| `…a1-turn2` | fresh | A coherent `never_run`. |
