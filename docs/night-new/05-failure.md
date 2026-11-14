# 5 — Brief → building → failure → retry

PASSED as a controlled offline failure path, not a provider-outage test. Three separate discarded-first-model store copies received the exact funding brief through the real composer. Each create POST returned 202; each displayed a drafting state, then one failure card and one Try again. Real pointer retry returned 202, displayed drafting again and ended in failure. The saved brief is retained verbatim in a disclosure; reload keeps the failed job and retry.

All six building and retry-failed captures at 2000 / 1128 / 133 were opened. Paths: `05-failure/draft-<size>-building.png` and `draft-<size>-retry-failed.png`. Side-by-side SHEET files accompany them. Readback results: three passes, two accepted job requests per size, one retry control, no unlisted mutations, retained brief equals the saved View brief.

The test server substitutes a 3-second throwing function for the caller. Six invocations reached that offline function; none reached an AI provider or provider adapter, and no request could be sent. No prompt files, credentials or environment files were loaded. This proves the served state transitions and retained-input control, not successful generation or provider recovery.
