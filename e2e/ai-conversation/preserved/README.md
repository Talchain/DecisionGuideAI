# Preserved context from the AI Conversation session of 24–25 Sep 2026

This folder holds everything that existed **only** in that session's cloud container, so a reclaimed container loses nothing. It sits on the `witness/ai-conversation-local` branch, which is **never merged**.

The authoritative handover is on staging: `docs/handover/ai-conversation-chat-panel-2026-09-25.md`.

| Path | What it is | Status |
|---|---|---|
| `cee/aiconv-agent-lane-answer-shape-5d4309b7.patch` | CEE commit `5d4309b7` (never pushed; this session has no CEE push access): derives `_answer_shape` from the final Agent reply on `/agent/v1/turn`, deterministically and provider-free | **Superseded** by Runtime's CEE #1914 (merged `fe4c796a`). Kept for reference only; do not apply without comparing against #1914 |
| `cee/route-harness/*/…​.txt` | The no-network vitest setup (`prb-no-network.setup.ts`), config and runner used to generate the route-captured OpenAI Run fixtures from CEE's own route test double: no model calls, and it refuses to start unless provider keys are empty. Renamed `.txt` so the UI typecheck gate ignores them | Tools. `c673223-variant` generated the route bodies `prb/cee-c673223.*.route-body.json` (inside the scratch archive); `prb-variant` generated `e2e/ai-conversation/fixtures/prb-route-c933aabf-explicit-run.json`. NOT to be confused with `src/canvas/conversation/__tests__/fixtures/openai-route-coaching-journey.c673223.json` on staging, which is a REAL served OpenAI-route capture (R&C's `coaching-witness.mjs`, CEE staging `c673223`) |
| `ui/scratch-percard-on-u4b-*.patch` | An earlier base adaptation (on the U4b train) of #2013's per-card leader-claim carrier | The final version is branch `fix/ai-conversation-per-card-leader-claim` @ `20a90b32` (#2013, closed, APPROVED) |
| `plans/ai-conversation-overnight.md` | The lane's chronological working log and plan, 24–25 Sep | Historical; the handover supersedes it |
| `plans/ai-conversation-workstream-eventual-wombat.md` | The original increment-1 plan (slice A / B) | Historical |
| `scratch-archive-2026-09-25.tgz` (11 MB) | The session scratchpad: served route bodies (`prb/`), mutation evidence (`mut/`), exploration notes, PR drafts, `morning-test.md`, evidence screenshots not already on this branch (`ev13/`, `ev14/`, `witness/`), and #1982 visual A/B composites | Excluded as regenerable or already preserved: test logs, #69 JSON dumps (public on GitHub), the extracted `@talchain/schemas` package, raw screenshot repeats, `.bak` copies |

Scanned for secrets before commit: the only matches are guards that REQUIRE `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` to be empty.
