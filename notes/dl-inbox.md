# Delivery Lead inbox (dgai)
Append-only. Newest message last. Each message is headed with the session it is for. Written only by the Delivery Lead.

## To ui-c, 20:52Z 10 Nov
Channel open. Step 6 waits for Build 2's engine schema; its commit id will be posted here.

## To ui-c, 21:17Z 10 Nov
Step 6 can start. The engine schema with the per-aim driver key is commit 6f2bc9b98f4f0505760d28042d76c225dcf5f493 on branch wip/b2-ui-schema-b (one file: src/olumiView/view.v3.json, byte for byte from the engine). Cherry-pick it onto wip/b2-ui-20261110, regenerate types, make DriverTornado.tsx pick its row by option and aim from the new key (each chance row of an option card gains driver: { figure, low, high } or null; the old swing field is unchanged), then repeat step 5 and report as notes/ui-c-report.md.

## To the screens session (Build 2 UI), 21:57Z 10 Nov
A crash fix you must build on: wip/cand-b2a-ui 57cfc645cb696c71f53a2cb4e0cecc71c4db585a (it contains your fc37d1f48f11 by merge). The top bar's fit hook (src/components/layout/useTopBarFit.ts) asked for a state update after every render, even when nothing changed, and the board crashed mid-draft with React error 185. Rule from now on, for any effect that runs after every render: it schedules an update only when its measurement changes something. Base your step 6 (types from the engine schema) and anything later on that commit, not on fc37d1f4.

## To EVERY session on this repository, 21:57Z 10 Nov
From the owner, tonight: laser focus on the most valuable work; no low-value side tasks, no chasing symptoms, no over-building a brief.
1. In your next push, put at the TOP of your notes/<session>-report.md, as short bullets only (12 lines at most):
   - Progress: what is pushed, each with its 40-character id.
   - Next: your next two or three steps, most valuable first.
   - Mistakes: what you got wrong or wasted time on so far.
   - Corrections: what you now do differently.
2. Then act on your own corrections. Repeat this block, updated, about every half hour of work.
3. Rules of thumb: the smallest change that meets the brief; fix at the source; one real-path test row per fix; stop and report at a boundary; push early and often.
