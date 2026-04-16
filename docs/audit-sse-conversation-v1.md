# Audit: SSE Consumer, Conversation State & Response Handling

**Date:** 2026-04-01
**Scope:** Read-only audit — no code changes
**Branch:** staging

---

## Task 1 — SSE Consumer Flow

The app has **three SSE consumer implementations** serving different backends.

### 1.1 Orchestrator SSE (CEE)

| Property | Value |
|---|---|
| File | `src/canvas/conversation/turnService.ts:401` |
| Function | `streamOrchestratorTurn()` — async generator |
| Endpoint | `POST /bff/orchestrate/v1/turn/stream` (proxied) |
| Transport | `fetch()` + `getReader()` manual SSE parsing |
| Parser | `parseSSELines()` at `turnService.ts:341` |
| Heartbeat | 30 s (`STREAM_HEARTBEAT_MS`, line 78) |
| Overall timeout | 120 s (`STREAM_TIMEOUT_MS`, line 77) |
| Shape guard | `validateStreamEventShape()` from `validateResponse.ts` |

**SSE event types (typed union at `types.ts:590-598`):**

| Event | Handler location | State update |
|---|---|---|
| `turn_start` | `useConversation.ts:2301` | Captures `routing` mode; clears elapsed timer |
| `text_delta` | `useConversation.ts:2311` | Buffers delta in `frameBufRef`; schedules RAF flush to `updateMessage` |
| `tool_start` | `useConversation.ts:2321` | Sets `isProvisional: true` + `toolLoadingState` label |
| `block` | `useConversation.ts:2327` | Appends block to `streamBlocksRef`; updates message |
| `progress` | `useConversation.ts:2332` | Updates `toolLoadingState` with CEE progress message |
| `tool_result` | `useConversation.ts:2340` | Clears `toolLoadingState` |
| `turn_complete` | `useConversation.ts:2344` | Final RAF flush; calls `handleEnvelope(event.envelope)` |
| `error` | `useConversation.ts:2358` | Appends error to partial text or replaces; adds retry chip if recoverable |

**Error / timeout / disconnect handling:**

- **Heartbeat timeout:** If no SSE activity for 30 s, `AbortController` aborts the stream.
- **Overall timeout:** 120 s hard cap via `setTimeout` + `AbortController`.
- **Fallback to non-streaming:** On HTTP 404 or 501 before first event (`STREAM_FALLBACK_STATUSES` at line 316), transparently calls `callOrchestratorTurn()` and yields a synthetic `turn_complete`.
- **Stream stuck (no turn_complete or error):** Finalises placeholder message with `isStreaming: false`, `synthetic: true`, and a retry chip (`useConversation.ts:2388-2407`).
- **AbortError:** Caller-initiated cancellation — silently ignored.

**Telemetry (`StreamTelemetry` at line 321):** Tracks TTFB, TTFT (first token), TTFB (first block), total duration, completion status, event/delta counts, text diff (streamed vs envelope).

### 1.2 PLoT Engine SSE

| Property | Value |
|---|---|
| File | `src/adapters/plot/v1/sseClient.ts:49` |
| Function | `runStream()` |
| Endpoint | `POST /v1/stream` via PLoT proxy |
| Transport | `fetch()` + `getReader()` manual SSE parsing |
| Heartbeat | 20 s (`TIMEOUTS.STREAM_HEARTBEAT_MS`, `constants.ts:13`) |

**SSE event types (defined at `types.ts:111-122`):**

| Event | Handler | Purpose |
|---|---|---|
| `started` / `RUN_STARTED` | `onStarted()` | Returns `run_id` |
| `progress` | `onProgress()` | 0–100% (capped at 90%), throttled 100 ms |
| `interim` | `onInterim()` | Interim findings array (currently no-op in UI) |
| `heartbeat` | (resets timer) | Keep-alive |
| `complete` / `COMPLETE` | `onComplete()` | Final result + diagnostics + CEE enrichment |
| `error` / `ERROR` | `onError()` | Structured error with code/message/retry_after |
| `CANCELLED` | `onError()` | Explicit cancellation |

**Error codes:** `BAD_INPUT` (400), `RATE_LIMITED` (429), `LIMIT_EXCEEDED` (413), `SERVER_ERROR` (5xx), `TIMEOUT`, `GATEWAY_TIMEOUT` (504), `NETWORK_ERROR`, `CANCELLED`.

**Fallback:** On `NOT_FOUND`, `SERVER_ERROR`, or `TIMEOUT`, `httpV1Adapter.ts` retries via sync `POST /v1/run` (lines 854-871).

**Retry:** Exponential backoff, max 3 attempts, 1 s base, 10 s max, +/-20% jitter (`constants.ts:18-23`). 429 respects `Retry-After` header.

### 1.3 Generic SSE Client (Gateway/Critique)

| Property | Value |
|---|---|
| File | `src/lib/sseClient.ts` |
| `openStream()` | Lines 176-354 — EventSource-based, events: `hello`, `token`, `cost`, `done`, `cancelled`, `limited`, `aborted` |
| `openJobsStream()` | Lines 30-153 — EventSource-based, events: `queued`, `running`, `failed`, `progress`, `done`, `cancelled` |
| Reconnect | 1 retry max, 50 ms delay, `lastEventId` resume semantics |
| Cancel | `POST /cancel` (idempotent 202/409) |

### 1.4 Final response assembly (Orchestrator path)

1. Streaming events accumulate text (`text_delta` → `frameBufRef` → RAF flush) and blocks (`block` → `streamBlocksRef`).
2. `turn_complete` delivers the full `OrchestratorResponseEnvelopeV2`.
3. `handleEnvelope()` (`useConversation.ts:1507+`) validates, transforms, and stores the response (see Task 3).
4. Streaming placeholder message is either updated or replaced by `handleEnvelope`.

---

## Task 2 — Conversation State Management

### 2.1 State container

| Property | Value |
|---|---|
| Store type | React `useState` in `useConversation()` hook |
| Location | `useConversation.ts:999` — `const [messages, setMessages] = useState<ConversationMessage[]>([])` |
| Stable ref | `messagesRef.current` (`useConversation.ts:1148`) — updated on every `addMessage()` for closure stability in `buildRequest` |
| Scope | Session-scoped; cleared on scenario switch (`useConversation.ts:2700-2712`) |

### 2.2 ConversationMessage shape

Defined at `types.ts:15-50`:

| Field | Type | Purpose |
|---|---|---|
| `id` | `string` | UUID |
| `role` | `'user' \| 'assistant'` | Message author |
| `content` | `string` | Main text |
| `blocks?` | `ConversationBlock[]` | Structured inline content |
| `actionChips?` | `ActionChip[]` | Suggested action buttons |
| `timestamp` | `Date` | Creation time |
| `clientTurnId?` | `string` | Echoed from request for dedup |
| `synthetic?` | `boolean` | UI-only (welcome, error, fallback) |
| `sessionDivider?` | `string` | Session boundary marker |
| `displayContent?` | `string` | Visible text (may differ from `submittedPrompt`) |
| `submittedPrompt?` | `string` | Actual prompt sent to orchestrator |
| `_threadMeta?` | `{ entryId, origin, entryStatus, redactionState }` | Track 3 hydration metadata |
| `isStreaming?` | `boolean` | True during `text_delta` phase |
| `isProvisional?` | `boolean` | True during tool-backed turns until `turn_complete` |
| `toolLoadingState?` | `string \| null` | Status text during tool execution |
| `insights?` | `Insight[]` | Deterministic CEE insights |
| `baseRateChips?` | `BaseRateChipSet` | Ephemeral base rate elicitation chips |

### 2.3 When is an assistant turn added to state?

| Path | When added | Initial state | Location |
|---|---|---|---|
| **Streaming** | Before `turn_complete` (immediately on stream start) | Empty placeholder: `{ content: '', isStreaming: true }` | `useConversation.ts:2281-2288` |
| **Non-streaming** | After `turn_complete` (inside `handleEnvelope`) | Fully populated | `useConversation.ts:2012-2023` |
| **User turn** | Before request sent | Populated with user text | `useConversation.ts:2135-2143` |
| **System event** | No user bubble added | Sentinel `[system]` — never rendered | `useConversation.ts:2153-2161` |

**Turn is added BEFORE validation** but AFTER request construction. Validation happens inside `handleEnvelope()` after streaming completes or HTTP response arrives.

### 2.4 Can a turn be removed or replaced?

| Operation | Condition | Location |
|---|---|---|
| Tail removal | Last message is `synthetic: true` (on retry) | `useConversation.ts:2681-2687` |
| Streaming update | Placeholder repurposed via `updateMessage()` | `useConversation.ts:2281-2386` |
| Stuck finalisation | Stream ended without `turn_complete`/`error` | `useConversation.ts:2391-2407` |
| Full clear | Scenario switch | `useConversation.ts:2700-2712` |

### 2.5 conversation_history assembly

| Property | Value |
|---|---|
| Function | `buildHistory()` at `useConversation.ts:353-375` |
| Called from | `buildRequest()` at line 1237 |
| Input | `messagesRef.current` |
| Output | `ConversationTurnPair[]` — `{ role, content }` pairs only |
| Window | Last 5 pairs (10 messages) — `MAX_HISTORY_PAIRS = 5` |

**Filters applied during assembly:**

1. Skip `synthetic` messages (line 359)
2. Skip assistant turns with non-conversational content via `isNonConversationalContent()` (line 361) — empty strings, "I received your message but couldn't...", "I'm ready to help with your decision.", `[system]` sentinel
3. Skip `[system]` sentinel messages (line 363)
4. Track 3 hydration filter: only `origin === 'conversation'`, `entryStatus === 'complete'`, `redactionState === 'full'` (lines 366-370)

**Transformation:** Only `role` and `content` passed. Blocks, chips, metadata, timestamps all stripped. `extractAssistantText()` (lines 398-424) unwraps JSON-wrapped strings before storage.

---

## Task 3 — Response Type Handling

All orchestrator responses route through `handleEnvelope()` at `useConversation.ts:1507+`.

| Response type | How detected | Handler/processing | Stored in history? | Displayed? |
|---|---|---|---|---|
| **Normal V2 envelope with text** | `assistant_text` present + `validateResponse()` passes | `handleEnvelope()` → validate → extract text → store | Yes (plain text via `buildHistory`) | Yes — MessageBubble |
| **V2 envelope with blocks only** | `assistant_text` empty/null, blocks array non-empty | Blocks normalised via `adaptCEEBlock()`; no fallback text injected when blocks present | Yes (empty content, but blocks via `addMessage`) | Yes — blocks rendered via InlineBlocks |
| **Silent system event response** | `mode === 'system'` in turn options | No user bubble; assistant response stored normally; errors fail silently | Assistant turn: yes. User sentinel: no | Assistant bubble: yes. User bubble: no |
| **Error envelope** | `envelope.analysis_error && !envelope.analysis_response` | Error propagated to results panel via `store.resultsError()` | Depends on whether assistant_text accompanies it | Error shown in results panel, not chat |
| **Legacy XML response** | `response_version` absent or < 2 | `stripDiagnostics()` removes `<diagnostics>` XML blocks + preamble lines | Yes (after stripping) | Yes |
| **Raw JSON string (in MessageBubble)** | Content starts with `{` and contains `"text"` | `extractFromRawJson()` in MessageBubble.tsx:31-38 parses and extracts `.text`; on failure: "I have a response but it didn't render correctly" | Yes (raw JSON stored; extraction is render-time only) | Extracted text displayed |
| **GraphPatchBlock (proposal)** | `block.type === 'graph_patch'` | Auto-apply if `auto_apply === true`; stamped with `graph_hash_at_proposal`; stock acknowledgement text suppressed | Yes | Patch card rendered in chat; graph mutations applied on canvas |
| **SSE timeout/disconnect** | Heartbeat timer (30 s) or overall timeout (120 s) | Stream aborted; placeholder finalised with `synthetic: true` + retry chip | Yes (as synthetic) | Yes — error text + retry chip |

**Invalid/unexpected response stored in history?**
- Raw JSON blobs: **Yes** — stored verbatim in `content`; only extracted at render time in `MessageBubble.extractFromRawJson()`. This means `buildHistory()` sends raw JSON to the LLM on subsequent turns, unless `extractAssistantText()` catches it first.
- Repair log lines (`[DEFAULT_EXISTS_PROBABILITY]`, `[STD_FLOOR]`, etc.): Stripped by `stripRepairLogLines()` in `validateResponse.ts:55-63` **before** storage.

---

## Task 4 — System Event Sending

### 4.1 Event types

**Wire-safe (sent to CEE) — `WireSystemEventType`:**

| Type | Trigger | Source |
|---|---|---|
| `direct_graph_edit` | User modifies graph (add/remove/update node or edge) | `useGraphEditEvents.ts` |
| `direct_analysis_run` | User triggers analysis directly | Manual action |
| `patch_accepted` | User accepts a graph_patch proposal | MessageBubble action |
| `patch_dismissed` | User dismisses a graph_patch proposal | MessageBubble action |
| `feedback_submitted` | User submits thumb up/down feedback | FeedbackRow |

**Internal-only (never sent):**

| Type | Purpose |
|---|---|
| `session_resume` | `useSessionResumeEvent.ts` — re-sync on page load |
| `undo_draft` | Internal undo tracking |

### 4.2 Wire serialisation

| Property | Value |
|---|---|
| Function | `serializeSystemEvent()` at `systemEvents.ts:66-84` |
| Wire format | `{ event_type, timestamp (ISO-8601), event_id (UUID), details }` |
| Pre-filter | Events not in `CEE_V3_KNOWN_TYPES` set are dropped silently (line 68) |

### 4.3 Request construction

1. `sendSystemEvent()` in `useConversation.ts` calls `serializeSystemEvent(event)` (line 2231)
2. If result is `null` (unknown type), event is dropped
3. `buildRequest()` called with `systemEventWire` (line 2232)
4. Routes to `buildSystemEventTurnRequest()` in `turn-request-builder.ts:250-265`
5. Request includes `system_event` field + `_turn_type: 'system_event'` (stripped before network send)
6. User message set to `SYSTEM_MESSAGE_SENTINEL` (`'[system]'`, line 85)

### 4.4 Response handling differences

| Aspect | Normal turn | System event turn |
|---|---|---|
| User bubble | Rendered | Not rendered (`MessageBubble.tsx:130-131` — returns null for sentinel) |
| Assistant response | Standard handling | Standard handling (same `handleEnvelope` path) |
| Error handling | Error bubble shown to user | Fails silently — logged in DEV only (`useConversation.ts:2512-2520`) |
| History inclusion | User + assistant stored | User sentinel excluded by `buildHistory`; assistant stored |

### 4.5 Debouncing

Graph edit system events use a **1.5 s debounce window** (`useGraphEditEvents.ts:21`, `DEBOUNCE_MS = 1500`). Changes are batched via a `DiffAccumulator` that tracks changed node/edge IDs, operations (add/update/remove), and changed field names. Position-only changes are excluded. Max 50 IDs per batch (`MAX_IDS_PER_BATCH`).

---

## Task 5 — Feature Flag Inventory

All flags defined in `src/flags.ts`. Only flags affecting conversation, SSE, or response handling listed.

| Flag | Env var | Default | What it gates | Compile-time / Runtime |
|---|---|---|---|---|
| `orchestratorV2` | `VITE_ENABLE_ORCHESTRATOR_V2` | false | Route all sends through POST /orchestrate/v1/turn | Runtime (localStorage override) |
| `orchestratorStreaming` | `VITE_FEATURE_ORCHESTRATOR_STREAMING` | false | SSE progressive rendering via /stream endpoint | Runtime |
| `v3SystemEvents` | `VITE_ENABLE_V3_SYSTEM_EVENTS` | false | CEE v3 wire format for system events | Runtime |
| `legacyDirectRun` | `VITE_ENABLE_LEGACY_DIRECT_RUN` | true | Direct PLoT /v1/run alongside orchestrator (dual-path) | Runtime |
| `orchestratorRenderingV2` | `VITE_FEATURE_ORCHESTRATOR_RENDERING_V2` | false | SafeRichText, commentary collapse, review card tone styling | Runtime |
| `deterministicCee` | `VITE_FEATURE_DETERMINISTIC_CEE` | false | New block types (comparison, premortem, flip_analysis, proposal, exercise) + InsightsStrip | Runtime |
| `threadPersist` | `VITE_FEATURE_THREAD_PERSIST` | false | Persist conversation to Supabase | Runtime |
| `threadHydrate` | `VITE_FEATURE_THREAD_HYDRATE` | false | Hydrate conversation on scenario resume + stale block revalidation | Runtime |
| `sseStreaming` | `VITE_FEATURE_SSE` | false | Legacy SSE flag (superseded by `orchestratorStreaming`) | Runtime |
| `preAnalysisEnriched` | `VITE_FEATURE_PRE_ANALYSIS_ENRICHED` | false | Receipt block, evidence gaps, model notes in blocks | Runtime |
| `graphLens` | `VITE_FEATURE_GRAPH_LENS` | false | Post-analysis canvas filtering (affects what graph_state is sent) | Runtime |

**Flag usage in conversation code:**
- `useConversation.ts:13` imports: `isOrchestratorV2Enabled`, `isOrchestratorStreamingEnabled`, `isThreadHydrateEnabled`, `isThreadPersistEnabled`, `isOrchestratorRenderingV2Enabled`
- `MessageBubble.tsx:22` imports: `isOrchestratorRenderingV2Enabled`, `isDeterministicCeeEnabled`
- `InlineBlocks.tsx:29` imports: `isPreAnalysisEnrichedEnabled`, `isDeterministicCeeEnabled`
- `DraftChat.tsx:36-44` reads `VITE_ENABLE_ORCHESTRATOR_V2` directly (avoids Vite transform issues)

---

## Task 6 — Message Rendering Pipeline

### 6.1 Text processing chain (MessageBubble.tsx)

| Step | Function | Location | Purpose |
|---|---|---|---|
| 1 | `extractFromRawJson()` | `MessageBubble.tsx:31-38` | Safety net: parse JSON blobs, extract `.text` field |
| 2 | `sanitiseFactorIds()` | `MessageBubble.tsx:42-48` | Replace `fac_xxx` IDs with human-readable labels |
| 3 | `safeRichText()` | `MessageBubble.tsx:177` | HTML sanitisation — allowlist: `strong`, `br`, `ul`, `li` only |

**Trigger:** `extractFromRawJson` applied only when NOT user AND NOT streaming (line 139). Streaming messages render incrementally; JSON extraction is post-completion only.

### 6.2 Empty / null / error text handling

| Condition | Behaviour | Location |
|---|---|---|
| `SYSTEM_MESSAGE_SENTINEL` | Returns null — never renders | `MessageBubble.tsx:131` |
| Streaming + no text + no tool loading | Shows thinking indicator | `MessageBubble.tsx:150-162` |
| Empty text + no blocks + no graph_patch | `FALLBACK_TEXT` injected by `validateResponse()` | `validateResponse.ts:132-134` |
| Non-conversational text + has blocks | Text cleared, blocks rendered | `useConversation.ts:1966-1969` |

### 6.3 Block rendering

- `<InlineBlocks>` component renders blocks after text (`MessageBubble.tsx:201-212`)
- Max 4 visible blocks per turn; "Show more" toggle for overflow
- Block types supported: `commentary`, `review_card`, `fact`, `graph_patch`, `framing`, `brief`, `model_receipt`, `evidence`, `artefact`, `comparison`, `premortem`, `flip_analysis`, `proposal`, `exercise`
- Unknown block types render a fallback card (never crash)

### 6.4 Insight cards

- `<InsightsStrip>` renders between text and blocks (`MessageBubble.tsx:198-200`)
- Gated behind `isDeterministicCeeEnabled()` flag
- Severity-based styling: important / warning / info
- Entity IDs in insights replaced with node labels via `labelMap` lookup

### 6.5 Progressive disclosure

- Character threshold: 300 chars (`CLAMP_CHAR_THRESHOLD`)
- Finds natural truncation points: paragraph break → sentence end → word break
- Only truncates when >= 150 chars OR >= 3 sentences would be hidden

### 6.6 Render-time guards

| Guard | What it catches |
|---|---|
| `extractFromRawJson()` | Raw JSON blobs from fallback parser |
| `sanitiseFactorIds()` | Internal `fac_xxx` entity IDs |
| `safeRichText()` | XSS via restricted HTML allowlist |
| Sentinel check | `[system]` messages never rendered |

---

## Task 7 — Divergence from v3 Architecture Spec

### 7.1 UI is passthrough only (F.6)

**Finding: Multiple semantic transforms exist in `handleEnvelope()`.**

The UI performs the following text mutations between receiving the envelope and storing/rendering:

| Transform | Location | Description | Passthrough violation? |
|---|---|---|---|
| `extractAssistantText()` | `useConversation.ts:1856` | Unwraps JSON-wrapped `assistant_text` | No — format recovery |
| `stripDiagnostics()` | `useConversation.ts:1862` | Removes `<diagnostics>` XML blocks (legacy path only) | No — legacy compat |
| `stripRepairLogLines()` | `validateResponse.ts:55-63` | Removes `[DEFAULT_EXISTS_PROBABILITY]`, `[STD_FLOOR]`, etc. | No — CEE internal leak defense |
| Chip-text dedup | `useConversation.ts:1869-1887` | Strips trailing list items that duplicate chip labels | **Yes** — suppresses LLM-generated text |
| Coaching dedup | `useConversation.ts:1889-1917` | Suppresses/collapses `assistant_text` matching `graph_patch.summary` (exact, substring, or >60% word overlap) | **Yes** — semantic suppression |
| Structural violation interception | `useConversation.ts:1921-1932` | Pattern-matches structural violation text; replaces with safe message | **Yes** — text substitution |
| Stock acknowledgement suppression | `useConversation.ts:1940-1950` | Suppresses "Changes applied.", "Got it.", "Noted." when `graph_patch` present | **Yes** — text suppression |

**Summary:** 4 transforms are legitimate format recovery / defense. **4 transforms perform semantic suppression** of LLM-generated text, violating the F.6 passthrough principle. These are pragmatic workarounds for CEE output quality issues.

### 7.2 Blocks rendered from typed data

**Finding: Mostly compliant.**

- 14 block types have typed definitions in `types.ts`
- `adaptCEEBlock()` normalises CEE wire format (including `block_type` → `type` mapping)
- Unknown block types render a fallback card rather than crashing
- No ad-hoc HTML string parsing — all blocks use typed React components

### 7.3 Chips include `action_type` and `parameters`

**Finding: Partially compliant.**

- `ActionChip` interface includes `action_type?: string` and `parameters?: Record<string, unknown>` (`types.ts:389-391`)
- CEE sends `prompt` field which `validateResponse` maps to `message` (lines 91-95)
- Not all chips have `action_type` — it's optional. Deterministic CEE chips include it; LLM-generated chips may not.

### 7.4 System events follow the debouncing spec (1.5 s window)

**Finding: Compliant.**

- `useGraphEditEvents.ts:21` — `DEBOUNCE_MS = 1500` (1.5 s)
- Batches structural changes; excludes position-only changes
- Max 50 IDs per batch
- Implements `DiffAccumulator` with per-element operation tracking

### 7.5 Conversation panel uses DS v5 tokens throughout

**Finding: Partially compliant.**

- CSS custom properties reference DS v5 sections (`var(--text-body)`, `var(--bg-panel)`, `var(--info)`, etc.)
- `Conversation.module.css` uses semantic tokens
- Some legacy Tailwind classes may remain (not fully audited at component level)
- DS v5 spec exists at `docs/Design/Olumi_Design_System_v5.md`

---

## Appendix A — Semantic Transforms in handleEnvelope (Full List)

These transforms execute in sequence inside `handleEnvelope()` at `useConversation.ts:1856-1950`:

1. **`extractAssistantText(raw)`** — Detects JSON-wrapped strings (`{...}`); extracts `assistant_text` or `text` field. Prevents raw JSON from reaching the user.

2. **`stripDiagnostics(text)`** (legacy path only) — Removes `<diagnostics>...</diagnostics>` XML blocks and bare preamble lines (`Mode: ...`). Skipped when `response_version >= 2`.

3. **Chip-text dedup** — Strips trailing bulleted/numbered list items whose text matches a chip label or chip message. Prevents LLM echo of suggested actions.

4. **Coaching dedup** — When `graph_patch` block present:
   - Exact/substring match with `graph_patch.summary` → suppress `assistant_text` entirely
   - >60% word overlap → collapse to first sentence only

5. **Structural violation interception** — Pattern-matches phrases like "this change would leave a node", "cannot reach the goal", "structural validation failed" → replaces with "I wasn't able to make that change safely."

6. **Stock acknowledgement suppression** — When `graph_patch` block present, suppresses bare "Changes applied.", "Got it.", "Understood.", "Noted." responses.

7. **`stripRepairLogLines()`** (in `validateResponse`) — Removes PLoT internal repair log lines (`[DEFAULT_EXISTS_PROBABILITY]`, `[STD_FLOOR]`, `[CLAMP_*]`, `[MISSING_*]`, `[FALLBACK_*]`, `[REPAIR:*]`).

---

## Appendix B — Conversation History Contamination Risks

| Risk | Severity | Description |
|---|---|---|
| Raw JSON in history | Medium | `extractFromRawJson()` runs at render-time in `MessageBubble` but NOT in `buildHistory()`. However, `extractAssistantText()` in `handleEnvelope()` catches most JSON-wrapped strings before storage. Gap: if CEE sends a non-object JSON string that passes `extractAssistantText` but triggers `extractFromRawJson` at render time. |
| Suppressed text in history | Low | Chip-text dedup, coaching dedup, and stock ack suppression modify `assistantText` before `addMessage()`, so the cleaned version is stored. History is consistent with what's displayed. |
| System sentinel leakage | None | `buildHistory()` explicitly filters `SYSTEM_MESSAGE_SENTINEL` at line 363. |
| Synthetic message leakage | None | `buildHistory()` explicitly filters `synthetic: true` at line 359. |

---

## Appendix C — Three SSE Clients Summary

| Client | File | Transport | Events | Heartbeat | Fallback |
|---|---|---|---|---|---|
| Orchestrator | `turnService.ts:401` | fetch + getReader | 8 event types | 30 s | HTTP 404/501 → sync call |
| PLoT Engine | `plot/v1/sseClient.ts:49` | fetch + getReader | 7 event types | 20 s | NOT_FOUND/SERVER_ERROR/TIMEOUT → sync `/v1/run` |
| Generic (Gateway) | `lib/sseClient.ts` | EventSource | 7 + 6 event types (two streams) | N/A (EventSource auto-reconnect) | 1 retry, 50 ms delay |
