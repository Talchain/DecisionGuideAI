# Turn Resilience Investigation Report

**Date:** 17 March 2026
**Branch:** `fix/poc-testing-ui-fixes`
**Context:** Manual PoC testing found three issues in the turn service layer.

---

## I1: Client-side Timeout — CONFIRMED, FIXED

### Symptom
Complex briefs (~250 words, 7 factors, 3 options) timed out with `signal is aborted without reason`. CEE took ~27s for a simpler brief; complex briefs likely need 40-60s.

### Root Cause
Flat 60s timeout applied to all turn types regardless of complexity.

| Constant | Value | Location |
|----------|-------|----------|
| `ORCHESTRATOR_TIMEOUT_MS` | 60s | `turnService.ts:74` |
| `STREAM_TIMEOUT_MS` | 120s | `turnService.ts:75` |
| `STREAM_HEARTBEAT_MS` | 30s | `turnService.ts:76` |
| `TIMEOUT_MS` (UI) | 60s | `useConversation.ts:92` |
| Netlify edge fn | no explicit timeout | `netlify.toml:122` |

Turn type was NOT considered. `resolvedTurnType` was computed at line 1677, **after** the timeout timer started at line 1649.

### Fix Applied
1. Replaced flat `TIMEOUT_MS = 60_000` with dynamic `getTimeoutMs(turnType, triggerSurface)`:
   - `explicit_generate` and `analyse_now` turns: **120s**
   - All other turns: **60s** (unchanged)
2. Moved `resolvedTurnType` computation before timeout timer setup.
3. Bumped `ORCHESTRATOR_TIMEOUT_MS` in `turnService.ts` from 60s to 120s (safety net — UI timeout fires first).
4. Added elapsed-time indicator: after 15s, the loading hint updates every 5s with elapsed time (e.g., "Building your decision model... 20s").

### Files Changed
- `src/canvas/conversation/useConversation.ts` — dynamic timeout, elapsed timer
- `src/canvas/conversation/turnService.ts` — bumped service-level timeout

---

## I2: Streaming vs Non-streaming Path Divergence — CEE BACKEND ISSUE

### Symptom
Same decision brief produces different routing outcomes:
- **Localhost** (streaming: false): `/turn` POST → intent gate matched `generate_model` → invoked `draft_graph`
- **Staging** (streaming: true): `/turn/stream` POST → intent gate returned `routing: "llm", tool: null` → conversational response (hallucinated "I've drafted a model")

### Investigation Findings

**Streaming flag determination:**
- `VITE_FEATURE_ORCHESTRATOR_STREAMING` in `src/flags.ts:311-314`
- Resolved via `isOrchestratorStreamingEnabled()` (line 510)
- Cascade: `localStorage['feature.orchestratorStreaming']` → `import.meta.env.VITE_FEATURE_ORCHESTRATOR_STREAMING` → default `false`
- NOT set in `netlify.toml` build env — must be set in Netlify dashboard if enabled on staging

**Request payload:** Identical for both paths. `buildRequest()` is called the same way regardless of streaming flag. Confirmed by reading the code — no conditionals based on streaming in request construction.

**BFF proxy:** Same `orchestrator-proxy.ts` edge function handles both routes. `/turn` maps to CEE `/orchestrate/v1/turn`, `/turn/stream` maps to CEE `/orchestrate/v1/turn/stream`.

**UI telemetry:** `generate_model_no_draft` detection already exists for both streaming (line 1850) and non-streaming (line 1875) paths.

### Conclusion
Root cause is **server-side**: the CEE `/turn/stream` endpoint's intent gate routes differently than `/turn` for identical payloads. No UI code changes needed. A separate CEE brief has been dispatched.

---

## I3: Conversation History Lost After Timeout — CONFIRMED, FIXED

### Symptom
After first-turn timeout, retry sends `conversation_history: array(0)`. CEE sees empty conversation.

### Root Cause
React state batching causes a stale closure in `buildRequest`:

1. Line 1601: `addMessage({role: 'user', ...})` → calls `setMessages(prev => [...prev, msg])`
2. Line 1675: `buildRequest({text: message, ...})` → calls `buildHistory(messages, 5)` at line 936
3. React **batches** the `setMessages` update. `buildRequest` reads `messages` from its `useCallback` closure, which still holds the pre-update array.
4. The `message` field IS sent separately (line 1133), so the current turn text reaches CEE. But **prior context from the `messages` array is stale**.

### Fix Applied
Mirrored `messages` state into a `useRef` (same pattern used for streaming refs at line 873):

1. Added `messagesRef` ref alongside other refs
2. Synced ref in `addMessage`, `updateMessage`, and all 5 direct `setMessages` call sites (hydration success/failure, scenario reset, retry cleanup, clearHistory)
3. Changed `buildHistory(messages, 5)` → `buildHistory(messagesRef.current, 5)` in `buildRequest`
4. Updated `buildRequest` dependency array from `[messages]` → `[]` (ref has stable identity)

### Files Changed
- `src/canvas/conversation/useConversation.ts` — `messagesRef` pattern
