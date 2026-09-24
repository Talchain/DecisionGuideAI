# AI Conversation — served-browser evidence (witness branch, not for merge)

All images come from local `vite`. Every `/proxy/v5/turn` response is fulfilled by Playwright `page.route` from a fixture. **No model calls**: off-origin requests are aborted, and the count of completed off-origin requests is asserted to be 0.

| File | PR / head | What it shows |
|---|---|---|
| `01-card-current.png` | #1961 `d0caf2b3` | Coaching card current: the action is live |
| `02-card-model-moved.png` | #1961 | CEE hash moved: stale notice, action disabled (`aria-describedby` points to the notice) |
| `03-run-chip-refused.png` | #1966 (merged) | Run chip routes to the run gate and refuses out loud. The chip is still clickable; the fix is in progress on `ai-conversation/run-chip-gate-visible` |
| `04-*/05-*` | AI Quality captures, CEE `57f903c` | OpenAI Run replies (pricing complete, hiring blocked) rendered in the dock |
| `06-runcard-current*.png` | #1968 `b94d7a9b` (merge `3922c099`) | Run-turn card, producer v3: current, no notice, live chip |
| `06-runcard-later_run*.png` | #1968 | Same hash, newer run: "Written about an earlier run of this model — the latest run may point somewhere else." Chip disabled |
| `06-runcard-model_changed*.png` | #1968 | Hash changed: "Your model has changed since this was written — it may no longer apply." Chip disabled |
| `06-runcard-not_current*.png` | #1968 | Run not `complete_current`: "Written about an earlier analysis — re-run to check it still holds." Chip disabled |

Limit: Google Fonts is aborted, so the fallback sans replaces Inter.
Re-run: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm exec playwright test -c playwright.aiconversation.config.ts`
