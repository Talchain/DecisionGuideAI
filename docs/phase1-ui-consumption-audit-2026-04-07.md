# Phase 1: UI consumption of CEE output audit
**Date:** 7 April 2026
**Scope:** Read-only investigation. Maps every UI-side path that consumes CEE SSE output: stream handlers, text rendering, block/chip rendering, conversation history, graph canvas integration, right-hand panel integration. No code changes.

> **Note on the file sizes used during this audit:**
> `useConversation.ts` is **2,957 lines** (not 2,500 as flagged in earlier audits). It really is the god-file.
> `InlineBlocks.tsx` is **1,550 lines**. `turnService.ts` is **691 lines**. `turn-request-builder.ts` is **389 lines**.
> All line numbers in this report were verified against the working tree at HEAD `5778323e` on `staging`.

---

## 1. SSE consumption map

### 1.1 Where the SSE connection is established

- **Endpoint:** [src/canvas/conversation/turnService.ts:70-72](src/canvas/conversation/turnService.ts#L70-L72)
  ```ts
  import.meta.env.VITE_ORCHESTRATOR_BASE
    ? `${import.meta.env.VITE_ORCHESTRATOR_BASE}/orchestrate/v1/turn`
    : '/bff/orchestrate/v1/turn'
  ```
  Default goes through the BFF proxy `/bff/orchestrate/v1/turn` → `cee-staging.onrender.com/orchestrate/v1/turn`.
- **Stream URL:** [src/canvas/conversation/turnService.ts:81-82](src/canvas/conversation/turnService.ts#L81-L82) — `${ORCHESTRATOR_URL}/stream` unless `VITE_ORCHESTRATOR_STREAM_BASE` overrides.
- **Connection:** plain `fetch()` POST with `Accept: text/event-stream` (around [turnService.ts:392](src/canvas/conversation/turnService.ts#L392), function `streamOrchestratorTurn`). Uses an `AbortController` for cancellation. Heartbeat watchdog `STREAM_HEARTBEAT_MS = 30_000` (line 77). Falls back to non-streaming `callOrchestratorTurn()` on 404/501 / fallback statuses.
- **Lifecycle:** consumed via `for await (const event of streamOrchestratorTurn(...))` inside `useConversation.ts` (line 2487). Cleanup in finally block.

### 1.2 Event routing — switch/case in useConversation

The single switch lives in [src/canvas/conversation/useConversation.ts:2488-2573](src/canvas/conversation/useConversation.ts#L2488-L2573). Every event type the UI handles:

| Event type      | Line | Handler behaviour |
|-----------------|------|-------------------|
| `turn_start`    | 2489 | Captures `event.routing` (`'deterministic' \| 'llm'`) into `streamRoutingRef.current`. Clears long-running and elapsed-time timers. |
| `text_delta`    | 2499 | Pushes `event.delta` into `frameBufRef.current`, schedules a RAF flush via `scheduleStreamFlush()`. Clears thinking/progress label on first delta. |
| `tool_start`    | 2509 | Sets `isProvisional: true` on the message and updates `toolLoadingState` via `mapToolLoadingLabel(event.tool_name)`. |
| `block`         | 2515 | Appends `event.block` to `streamBlocksRef.current` and re-renders message with full blocks array. |
| `progress`      | 2520 | If `event.message`, sets it as `toolLoadingState`. |
| `tool_result`   | 2528 | Clears `toolLoadingState`. No payload storage — tool results are status markers; the actual data arrives via `block` and `turn_complete`. |
| `turn_complete` | 2532 | Cancels pending RAF, captures `event.envelope`, calls `handleEnvelope(event.envelope, turnClientId)`, clears `streamingMsgIdRef.current`. |
| `error`         | 2546 | Flushes pending RAF buffer, builds `priorText`, calls `cleanupStreamRefs()`, renders the error (with retry chip if `event.recoverable`). If prior text exists it appends `\n\n---\n\nerrText`; otherwise it replaces and marks `synthetic: true`. |

The defined union of event types lives in [src/canvas/conversation/types.ts:596-604](src/canvas/conversation/types.ts#L596-L604).

### 1.3 text_delta — accumulation and real-time XML stripping

- **Accumulation:** RAF-batched. Tokens go into `frameBufRef.current` (a `string[]`). The flush function is `flushStreamFrame` at [useConversation.ts:1292-1306](src/canvas/conversation/useConversation.ts#L1292-L1306):
  ```ts
  streamTextRef.current += buf.join('')
  const raw = streamTextRef.current
  const cleaned = streamRoutingRef.current === 'deterministic'
    ? stripRepairLogLines(raw)
    : stripRepairLogLines(stripDiagnostics(raw))
  updateMessage(msgId, { content: cleaned })
  ```
  So **every RAF frame**, the cumulative text is cleaned before going to the message.
- **Routing-mode gate:** when `streamRoutingRef.current === 'deterministic'`, `stripDiagnostics` is **skipped** entirely. Only `stripRepairLogLines` runs. For `'llm'` routing, both run.
- **stripDiagnostics implementation:** [useConversation.ts:312-347](src/canvas/conversation/useConversation.ts#L312-L347). Three-stage regex:
  1. Remove `<diagnostics>…</diagnostics>` (multiline, non-greedy).
  2. Remove bare preamble lines matching `^\s*Mode:\s+\w+[.:]\s*Stage:\s+\w+[.:][^\n]*$`.
  3. Strip `<response>…<assistant_text>…</assistant_text>…</response>` envelope, including a partial-stream branch (line 333) and a "tag arrived but content hasn't" suppression (line 338) that returns `''` to prevent raw `<response>` from flashing for one frame.
- **stripRepairLogLines:** [src/canvas/conversation/validateResponse.ts:55](src/canvas/conversation/validateResponse.ts#L55). Removes `[repair: …]` log lines.

### 1.4 block — storage and turn association

- Stored in `streamBlocksRef.current` ([useConversation.ts:1283](src/canvas/conversation/useConversation.ts#L1283)).
- Each `block` event spreads into a new array and immediately calls `updateMessage(msgId, { blocks: streamBlocksRef.current })` ([line 2516-2517](src/canvas/conversation/useConversation.ts#L2516-L2517)).
- Association with the current turn is implicit: `streamingMsgIdRef.current` is the message id created at the top of `sendTurn`, and all stream events flow into that message until `turn_complete` clears it.

### 1.5 tool_result — handling

- **The tool_result handler does almost nothing** — it just clears `toolLoadingState` ([line 2528-2530](src/canvas/conversation/useConversation.ts#L2528-L2530)). No payload extraction.
- The actual tool output (graph patches, analysis results) reaches the UI via `block` events (graph_patch blocks) or via the final `turn_complete` envelope (`envelope.analysis_response`).

### 1.6 turn_complete — final assembly via handleEnvelope

`handleEnvelope` lives at [useConversation.ts:1634-2211](src/canvas/conversation/useConversation.ts#L1634-L2211). It does a substantial post-process pass:

1. **Validation/repair** via `validateResponse(envelope, requestId)` ([line 1654](src/canvas/conversation/useConversation.ts#L1654)).
2. **Auto-apply patches** — loop at [line 1859-1881](src/canvas/conversation/useConversation.ts#L1859-L1881) finds blocks with `auto_apply === true` and calls `applyAutoApplyPatch(patchBlock)`.
3. **assistantText extraction** ([line 2016](src/canvas/conversation/useConversation.ts#L2016)) via `extractAssistantText(envelope.assistant_text ?? '')` — handles JSON-wrapped text.
4. **Format detection** ([line 2018-2023](src/canvas/conversation/useConversation.ts#L2018-L2023)):
   ```ts
   const isV2Format = typeof rawEnvelope.response_version === 'number'
     && rawEnvelope.response_version >= 2
   if (!isV2Format) {
     assistantText = stripDiagnostics(assistantText)
   }
   ```
   **V2 (deterministic, `response_version >= 2`) skips XML stripping at handleEnvelope time entirely.** V1 (LLM) reapplies stripDiagnostics defensively.
5. **Full-draft branch** ([line 2027-2033](src/canvas/conversation/useConversation.ts#L2027-L2033)) — for `patch_type === 'full_draft'`, **all subsequent text filters are skipped** so coaching prose is preserved verbatim. Falls back to streamed text if envelope text is empty.
6. **Non-full-draft filter chain** ([line 2034-2135](src/canvas/conversation/useConversation.ts#L2034-L2135)):
   - Strip trailing list-prefixed lines that duplicate chip labels/messages (line 2041-2059).
   - Patch-summary dedup: exact/substring match → suppress; ≥60% word overlap → collapse to first sentence (line 2064-2090).
   - Commentary block dedup (`deduplicateAgainstCommentary`) at line 2095-2100.
   - **Structural-violation interception** (line 2104-2115): replaces raw CEE error text matching `/this change would leave a node/i` etc. with `"I wasn't able to make that change safely…"`
   - Stock acknowledgement suppression when a graph_patch block is present (line 2122-2133): `/^changes applied\.?$/i`, `/^noted\.?$/i`, etc.
7. **Empty/non-conversational guard** (line 2150-2175). Suppresses messages whose text is empty AND has no blocks; sets `synthetic: true` so they are excluded from history.
8. **Final write** (line 2181-2208):
   - If a streaming message exists, `updateMessage()` overwrites with the cleaned text + blocks + chips + `isStreaming: false`. **Streamed content is replaced by the post-processed envelope text (with a fallback to streamed text if envelope is the FALLBACK_TEXT placeholder).**
   - Otherwise `addMessage()` creates a new assistant message.

### 1.7 Error handling

- Stream `error` event (line 2546-2572): flushes RAF, preserves prior streamed text by appending `\n\n---\n\n{errText}` (or replaces with `synthetic: true` if no prior text), adds a "Try again" retry chip when `event.recoverable`.
- HTTP/timeout/disconnect handled in `turnService.ts` (around lines 661-671) with completion status `'disconnect'`/`'timeout'`.
- `buildErrorMessage` at [useConversation.ts:350-367](src/canvas/conversation/useConversation.ts#L350-L367) maps statuses to user-facing strings.

### 1.8 ASCII handler diagram

```
fetch POST /bff/orchestrate/v1/turn/stream  (Accept: text/event-stream)
        │
        ▼
streamOrchestratorTurn() ── async iterable of SSE events
        │
        ▼
useConversation.ts switch (line 2488):

   turn_start ─────► streamRoutingRef = 'deterministic' | 'llm'
   text_delta ─────► frameBufRef.push  ─►  RAF flush ─►
                        flushStreamFrame()
                          raw = streamTextRef
                          cleaned = (deterministic) ? stripRepairLogLines(raw)
                                                    : stripRepairLogLines(stripDiagnostics(raw))
                          updateMessage({ content: cleaned })
   tool_start  ─────► updateMessage({ toolLoadingState: label, isProvisional: true })
   block       ─────► streamBlocksRef.append ─► updateMessage({ blocks })
   progress    ─────► updateMessage({ toolLoadingState: event.message })
   tool_result ─────► updateMessage({ toolLoadingState: null })
   turn_complete ───► handleEnvelope(envelope) ─► auto-apply patches,
                        extract+filter text, write final message
   error       ─────► flush, append/replace, retry chip
```

### 1.9 Critical question — what happens when text_delta contains XML?

**Answer:** Real-time stripping in `flushStreamFrame` (line 1292-1306) prevents user-visible flashes, but only when `streamRoutingRef.current !== 'deterministic'`. The strip runs against the **cumulative** stream text every RAF frame, so as new tokens arrive the regex re-evaluates and removes any XML that has been completed. The partial-envelope branch in `stripDiagnostics` (line 333-342) explicitly handles the half-arrived case — if `<response>` has arrived but `<assistant_text>` hasn't, the cleaned text is set to `''` for that frame.

For deterministic routing, **no XML stripping happens during streaming**. The system trusts CEE to send plain text. If XML somehow arrived, it would be visible to the user for the duration of the turn.

At `turn_complete`, the final cleanup at line 2022 only runs when `response_version < 2`, so V2/deterministic envelopes also skip the defensive strip there.

---

## 2. Conversation rendering

### 2.1 Component tree for an assistant turn

```
ConversationPanel  (src/canvas/conversation/ConversationPanel.tsx)
  └ ChatThread     (src/canvas/conversation/zones/ChatThread.tsx)
      └ ChatMessage  (src/canvas/conversation/zones/ChatMessage.tsx:54)
          └ MessageBubble  (src/canvas/conversation/MessageBubble.tsx:116)
              ├ text via dangerouslySetInnerHTML{ safeRichText(content) }   (line 189-195)
              ├ InlineBlocks  (src/canvas/conversation/InlineBlocks.tsx:161)
              │   └ BlockRenderer dispatcher  (line 237-330)
              │       ├ CommentaryBlockRenderer
              │       ├ ReviewCardBlockRenderer
              │       ├ FactBlockRenderer
              │       ├ GraphPatchBlockRenderer  (line 898-1318)
              │       ├ FramingBlockRenderer
              │       ├ BriefBlockRenderer
              │       ├ ModelReceiptBlock        (gated: isPreAnalysisEnrichedEnabled)
              │       ├ EvidenceBlockRenderer
              │       ├ ArtefactBlockComponent   (sandboxed iframe)
              │       ├ ComparisonBlockRenderer  (gated: isDeterministicCeeEnabled)
              │       ├ PremortemBlockRenderer   (gated)
              │       ├ FlipAnalysisBlockRenderer (gated)
              │       ├ ProposalBlockRenderer    (gated, line 1422)
              │       └ ExerciseBlockRenderer    (gated, sandboxed iframe)
              └ SuggestedChips  (src/canvas/conversation/zones/SuggestedChips.tsx:59)
```

### 2.2 Message component

`ChatMessage` at [src/canvas/conversation/zones/ChatMessage.tsx:54-110](src/canvas/conversation/zones/ChatMessage.tsx#L54-L110). Props include the `ConversationMessage`, callbacks `onChipClick`, `onRetry`, `onPatchAccept`, `onPatchDismiss`, `onFeedback`, `onArtefactMessage`, `onProposalConfirm`, plus `patchBlockStates` and `patchRejections` Maps. It categorises the message ('action' / 'research' / 'answer') based on which block types are present (line 20-27) and delegates rendering to `MessageBubble`.

### 2.3 Text rendering

- Primary: `MessageBubble` at [src/canvas/conversation/MessageBubble.tsx:116-240](src/canvas/conversation/MessageBubble.tsx#L116-L240).
- Pipeline (lines 147-195):
  1. **JSON safety net** (line 31-40, 152-153): if content looks like raw JSON with a `.text` field, extract it. Only post-streaming (not during).
  2. **Factor ID sanitisation** (line 42-49): replaces internal `fac_xxx` ids with human-readable labels.
  3. **Progressive disclosure** (line 53-98, 156-161): truncates assistant messages >600 chars at natural boundaries; "Show more" toggle.
  4. **HTML render** (line 189-195):
     ```tsx
     dangerouslySetInnerHTML={{
       __html: safeRichText(...) + (isStreaming ? '<span class="streaming-cursor" aria-hidden="true">|</span>' : ''),
     }}
     ```
- `safeRichText` at [src/canvas/utils/safeRichText.ts:107-261](src/canvas/utils/safeRichText.ts#L107-L261). Supports only `**bold**`, `- bullets`, `\n` line breaks, `# headings` (rendered as `<strong>`), pipe-tables, and `---`/`***` rules. Allowlist of tags is `<strong>`, `<br>`, `<ul>`, `<li>` (line 30). XSS protection: decode XML entities → escape all HTML → apply markdown transforms → strip disallowed tags. **No links, no images, no code blocks, no inline emphasis.**

### 2.4 Block rendering

- Dispatcher: `BlockRenderer` at [src/canvas/conversation/InlineBlocks.tsx:237-330](src/canvas/conversation/InlineBlocks.tsx#L237-L330). Container `InlineBlocks` at line 161-219 enforces a max-4-visible display with "Show more" expansion.
- Block badge dot palette at line 65-84.
- **Every block type defined in the `ConversationBlock` union has a renderer.** No dead block types found in the dispatcher. Several are gated by feature flags (`isDeterministicCeeEnabled()` for `comparison`, `premortem`, `flip_analysis`, `proposal`, `exercise`; `isPreAnalysisEnrichedEnabled()` for `model_receipt`).
- Unknown types fall through to `null` at line 328 (suppressed silently).

### 2.5 Chip rendering

- Component: `SuggestedChips` at [src/canvas/conversation/zones/SuggestedChips.tsx:59-238](src/canvas/conversation/zones/SuggestedChips.tsx#L59-L238).
- Source: chips come from `envelope.suggested_actions` (extracted in `handleEnvelope` at [useConversation.ts:1813](src/canvas/conversation/useConversation.ts#L1813) via `enforceChipBudget`).
- Type: `ActionChip` at [types.ts:381-399](src/canvas/conversation/types.ts#L381-L399). Fields: `id`, `label`, `intent`, `message?`, `prompt?`, `role?`, `action_type?`, `parameters?`.
- Click handler at line 86-92 calls `onChipClick(chip)` → `ConversationPanel.handleChipClick` → `useConversation.sendChip(chip)`.
- **Filter:** only chips with `.message` or `.prompt` are rendered. **Budget:** `MAX_SUGGESTED_ACTIONS = 3` (legacy: 2).
- Historical chips render to `null` (line 71) — chips disappear after the turn.

### 2.6 Graph patch blocks — accept/dismiss flow

`GraphPatchBlockRenderer` at [InlineBlocks.tsx:898-1318](src/canvas/conversation/InlineBlocks.tsx#L898-L1318). User sees "Review suggested changes" eyebrow, an operation summary ("3 factors, 2 options, 1 goal"), proposal items, and Accept/Dismiss buttons.

- **Accept click** (line 1296) → `handleAcceptWithStalenessCheck` (line 1004-1014) compares `block.graph_hash_at_proposal` against current graph hash; on mismatch shows staleness warning, otherwise calls `onAccept(stateKey, block)`.
- `onAccept` resolves to `ConversationPanel.handlePatchAccept` at [ConversationPanel.tsx:128-281](src/canvas/conversation/ConversationPanel.tsx#L128-L281). This is **not local-state-only**:
  - Validates ops against `KNOWN_OPS` set (line 148-164); on unknown op sends `sendSystemEvent({ type: 'patch_dismissed', payload: { reason: 'unsupported_operation' } })`.
  - Calls `plot.validatePatch({ graph, operations })` (line 167-171).
  - On success: `useCanvasStore.setState({ nodes: validatedGraph.nodes, edges: validatedGraph.edges })` (line 180-183) wrapped in `beginExternalGraphMutation('patch_apply')` / `endExternalGraphMutation()`. Pushes history. Falls back to `applyAutoApplyPatch(block)` if PLoT didn't return a full graph.
  - Sets state to `'accepted'`, clears guidance items by target id, then **sends a system event** `sendSystemEvent({ type: 'patch_accepted', payload: { patch_id, operations, applied_graph_hash } })` (line 208-215).
- **Dismiss** (line 283-308): sets state to `'dismissed'`, sends `sendSystemEvent({ type: 'patch_dismissed', payload: { patch_id } })`.

### 2.7 ProposalBlock — DIFFERENT path (and the prior audit was almost right)

`ProposalBlockRenderer` at [InlineBlocks.tsx:1422-1491](src/canvas/conversation/InlineBlocks.tsx#L1422-L1491):

```ts
const handleApply = useCallback(() => {
  setState('accepted')
  onProposalConfirm?.(block.proposal_id)
}, [block.proposal_id, onProposalConfirm])
```

This **does NOT mutate the canvas** and **does NOT call `plot.validatePatch`**. It only:
1. Sets local state to `'accepted'`.
2. Invokes the optional `onProposalConfirm` callback with the bare `proposal_id`.

`onProposalConfirm` resolves to `handleProposalConfirm` at [ConversationPanel.tsx:117-122](src/canvas/conversation/ConversationPanel.tsx#L117-L122):

```ts
const handleProposalConfirm = useCallback(
  (proposalId: string) => {
    void sendMessage(`confirm:${proposalId}`, {
      debugSource: 'proposal_confirm',
      debugVisibleText: 'Apply proposed changes',
    })
  }, ...)
```

**It sends a literal user-style message string `confirm:abc-123` back through `sendMessage`.** This is wired up — it is not "no API call" — but the contract is unusual. There is no `proposal_confirmed` system event; the orchestrator is expected to recognise the literal `confirm:` prefix in the `message` field of a normal conversation turn. There is no `chip_metadata`, no dedicated turn type. The previous audit's claim that "Apply only sets local state with no API call" is **incorrect** but the underlying smell — that ProposalBlock has a much weaker commitment-to-side-effect than GraphPatchBlock — is real.

There is also no ProposalBlock rejection path: the Cancel button at line 1473-1481 just sets local state to `'cancelled'` with no callback fire at all.

### 2.8 System event messages — visibility

System events (`patch_accepted`, `patch_dismissed`, `feedback_submitted`, `direct_graph_edit`, `direct_analysis_run`) are defined in [types.ts:415-438](src/canvas/conversation/types.ts#L415-L438). They are **not rendered as visible conversation messages**. The associated turn responses can be flagged `routing === 'system_event_silent'`, in which case `handleEnvelope` at around line 1636-1648 in `useConversation.ts` updates the message to `synthetic: true, content: ''`, suppressing it from the thread. The user sees only the resulting block state change (e.g. graph_patch card flipping to "Applied").

### 2.9 Critical question — does plain-text + clean turn_complete work as-is?

**Yes, the rendering pipeline is fully compatible.** Specifically:
- `MessageBubble` → `safeRichText` handles plain text identically to current text. The only requirement is markdown-lite (`**bold**`, `- bullets`, `\n`).
- `InlineBlocks` dispatcher is independent of text format — every block type has a renderer.
- `SuggestedChips` consumes `envelope.suggested_actions` directly, independent of text.
- `GraphPatchBlockRenderer` and `ProposalBlockRenderer` both depend only on block fields, not text format.

What would break / change:
- The `isV2Format` branch in `handleEnvelope` (line 2018-2023) needs the orchestrator to set `response_version >= 2`. If it does, the V1 strip path never fires and is dead.
- All the dedup logic in lines 2041-2133 still runs unless we also bump format detection. It is harmless on plain text but several heuristics (chip-label dedup, patch-summary dedup) may unnecessarily mutate text. Suggest leaving them on for safety, removing later.
- The streaming-time `stripDiagnostics` call (line 1304) is gated on routing mode — if `turn_start.routing === 'deterministic'` is set, it's skipped. So no work to do there.

---

## 3. Conversation history management (UI side)

### 3.1 Storage location

- Primary: React `useState` in `useConversation.ts` (around line 1117): `const [messages, setMessages] = useState<ConversationMessage[]>([])`.
- Mirror ref `messagesRef` updated on every set, used for closure-stable reads (around line 1264-1268).
- Type: `ConversationMessage` at [types.ts:15-53](src/canvas/conversation/types.ts#L15-L53). Fields include `id`, `role`, `content`, `blocks?`, `actionChips?`, `timestamp`, `clientTurnId?`, `synthetic?`, `displayContent?`, `submittedPrompt?`, `isStreaming?`, `toolLoadingState?`, `insights?`, `_threadMeta?`.

### 3.2 What gets stored per assistant turn

The write site is in `handleEnvelope` at [useConversation.ts:2181-2208](src/canvas/conversation/useConversation.ts#L2181-L2208):

```ts
if (streamingMsgIdRef.current) {
  const streamedText = streamTextRef.current
  const isFallback = assistantText === FALLBACK_TEXT
  const finalContent = (isFallback && streamedText.trim()) ? streamedText : assistantText
  updateMessage(streamingMsgIdRef.current, {
    content: finalContent,             // CLEANED text (XML stripped, deduped, filtered)
    blocks: hasBlocks ? orderedBlocks : undefined,
    actionChips: chips.length > 0 ? chips : undefined,
    insights,
    baseRateChips,
    isStreaming: false,
    isProvisional: false,
    toolLoadingState: null,
  })
} else {
  const assistantMsg: ConversationMessage = {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: assistantText,            // CLEANED text
    blocks: hasBlocks ? orderedBlocks : undefined,
    actionChips: chips.length > 0 ? chips : undefined,
    insights,
    baseRateChips,
    timestamp: new Date(),
    clientTurnId: envelope.client_turn_id,
  }
  addMessage(assistantMsg)
}
```

So the stored `content` is **the cleaned, post-processed text**, not the raw envelope, not the streamed accumulation. Every transform from §1.6 has run by this point.

`blocks` are stored as the prioritised + normalised array. `actionChips` are budget-enforced. The raw envelope itself is **not** persisted on the message.

### 3.3 What gets sent to CEE on the next turn

- `buildHistory` at [useConversation.ts:402-425](src/canvas/conversation/useConversation.ts#L402-L425):
  ```ts
  export function buildHistory(messages, maxPairs) {
    const pairs = []
    for (const msg of messages) {
      if (msg.synthetic) continue
      if (msg.role === 'assistant' && isNonConversationalContent(msg.content)) continue
      if (msg.content === SYSTEM_MESSAGE_SENTINEL) continue
      if (msg._threadMeta) {
        if (msg._threadMeta.origin !== 'conversation') continue
        if (msg._threadMeta.entryStatus !== 'complete') continue
        if (msg._threadMeta.redactionState !== 'full') continue
      }
      pairs.push({ role: msg.role, content: msg.content })
    }
    return pairs.slice(-(maxPairs * 2))
  }
  ```
- Default `maxPairs` is 5, called from `buildRequest`. The output is `ConversationTurnPair[] = [{ role, content }]`.
- Wire packaging in `buildConversationTurnRequest` at [src/services/turn-request-builder.ts:194-215](src/services/turn-request-builder.ts#L194-L215). The history is injected as the `conversation_history` field of the request. Allow-list at [line 131](src/services/turn-request-builder.ts#L131):
  ```
  conversation: ['scenario_id', 'client_turn_id', 'conversation_history', 'message',
                 'graph_state', 'selected_elements', 'chip_metadata', 'analysis_state', '_turn_type']
  ```

### 3.4 History sanitisation (UI side)

Two places:
1. **At write time** (handleEnvelope §1.6 / §3.2): all the XML stripping, dedup, structural-violation interception, stock-ack suppression. By the time `content` is stored, the text is already clean.
2. **At read time** (`buildHistory`): excludes `synthetic`, non-conversational content (`isNonConversationalContent` covers empty strings, error fallback phrases, stock acks), `[system]` sentinel, hydrated entries with non-`conversation` origin or non-`complete` status.

There is **no second-pass XML strip in buildHistory** — it relies on what's already in `content`.

### 3.5 Display vs payload — same data?

**Yes, same field.** Both the conversation panel (via `MessageBubble` reading `message.content`) and the payload (via `buildHistory` reading `msg.content`) consume the same string. There is a `displayContent` override field on `ConversationMessage` (used for chip-initiated user messages so the user sees the chip label instead of the raw message text), but for assistant messages there is no separation.

### 3.6 Critical question — diagnostic XML round-trip

If a previous assistant turn had `<diagnostics>Mode: INTERPRET...</diagnostics><response><assistant_text>Your model shows...</assistant_text></response>`:

| Layer | What it sees |
|-------|--------------|
| **(a) Displayed to user** | `Your model shows...` only. The streaming flush at line 1304 strips the `<diagnostics>` block and unwraps the `<response>` envelope frame-by-frame. At `turn_complete`, the same strip is reapplied (V1 only) so the final `content` is just the inner text. |
| **(b) Stored in history** | `Your model shows...` only. `content` is the cleaned text, not the raw envelope. |
| **(c) Sent to CEE next turn** | `Your model shows...` only. `buildHistory` reads the same cleaned `content` field; no re-introduction of XML. |

**Caveat 1:** if `streamRoutingRef.current === 'deterministic'` the streaming-time strip is skipped. If CEE were to send XML to a deterministic-routed turn, it would be visible during streaming until `turn_complete` overwrites with the envelope text — and the envelope text is also not stripped when `response_version >= 2`. So XML in a V2 envelope **would persist to display, history, and the next turn's payload.**

**Caveat 2:** the `_threadMeta` filter in buildHistory (line 416-420) only applies to entries that came from thread hydration. Live-turn messages have no `_threadMeta`, so the filter is a no-op for them — the cleaning relies entirely on `handleEnvelope` having done its job.

---

## 4. Graph canvas integration

### 4.1 Graph patch application path

When CEE sends a graph patch:

```
SSE 'block' event ──► streamBlocksRef.append ──► (per-frame)
                                                    │
turn_complete ──► handleEnvelope() ──► validateResponse()
                                          │
                                          ├─ adaptCEEBlock per block (block_type → type, normalise data)
                                          │
                                          ├─ for each block in orderedBlocks where block.auto_apply === true:
                                          │     applyAutoApplyPatch(block)
                                          │
                                          └─ otherwise: stored on message.blocks for user accept/dismiss
```

- **`applyAutoApplyPatch`** lives in [src/canvas/conversation/utils/applyPatch.ts](src/canvas/conversation/utils/applyPatch.ts). Sorts ops via `sortPatchOperations` (line 47) into `add_node → add_edge → update → remove` order. Builds normalised nodes via `buildNode` (line 57-81): extracts `kind` (or `d.type`), defaults to `'factor'`, strips RF internals (`selected`, `dragging`, `position`, etc.), preserves CEE fields (`label`, `category`, `observed_state`, `interventionKeys`). Builds edges via `buildEdge` (line 87-155): maps signed CEE strength mean → canvas weight + direction, preserves V3 metadata. Applies via `useCanvasStore.setState()` (bulk).
- **Auto-apply detection** in `handleEnvelope` at [useConversation.ts:1859-1881](src/canvas/conversation/useConversation.ts#L1859-L1881). Iterates blocks and calls `applyAutoApplyPatch` for each `auto_apply: true`. Sets `setFullDraftAppliedAt()` if ≥3 nodes were added (cosmetic flag for the canvas).
- **Manual accept** for non-auto-apply blocks goes through `ConversationPanel.handlePatchAccept` (§2.6) → `plot.validatePatch` → `useCanvasStore.setState({ nodes, edges })` (line 180-183). The validated graph from PLoT replaces the canvas wholesale; if PLoT doesn't return a graph, falls back to `applyAutoApplyPatch(block)` (line 188).

### 4.2 auto_apply behaviour difference

- **Auto-apply true:** runs through `applyAutoApplyPatch` directly inside `handleEnvelope` (no PLoT validation, no user prompt, no `patch_accepted` system event).
- **Auto-apply false (or absent):** block stays on the message; user must click Accept; flow goes through `plot.validatePatch` and emits a `patch_accepted` system event.

So the two paths have different validation guarantees: user-accepted patches are PLoT-validated, auto-applied ones are not.

### 4.3 Graph state assembly for CEE

In `buildRequest` at [useConversation.ts:1396-1445](src/canvas/conversation/useConversation.ts#L1396-L1445):

```ts
const ceeNodes = store.nodes.map((n) => {
  const d = n.data ?? {}
  const rawKind = (d as any).kind ?? n.type ?? 'factor'
  const out = { id: n.id, kind: CEE_VALID_KINDS.has(rawKind) ? rawKind : 'factor', label: ... }
  for (const [key, value] of Object.entries(d)) {
    if (RF_NODE_BLOCKLIST.has(key) || value === undefined) continue
    if (key === 'observedState') { out.observed_state = value; continue }
    out[key] = value
  }
  return out
})

const ceeEdges = store.edges.map((e) => {
  // canvas weight [0,2] + direction → signed mean clamped to [-1, +1] (UI-SEM-035)
  const weight = clamp(d.weight ?? 0.5, 0, 2)
  const direction = d.direction === 'negative' ? -1 : 1
  const mean = clamp(direction * weight, -1, 1)
  return { from: e.source, to: e.target, strength: { mean, std? }, exists_probability?, effect_direction?, edge_type }
})

const graphState = { nodes: ceeNodes, edges: ceeEdges }
```

**Key facts:**
- Read directly from `useCanvasStore.getState()` (the `store` ref) at the moment `buildRequest` runs — there is no cached graph state between turns.
- Empty graph → `{ nodes: [], edges: [] }`. The wire validator at [turn-request-builder.ts:355+](src/services/turn-request-builder.ts) requires the field to exist; empty arrays are valid.
- `RF_NODE_BLOCKLIST` strips RF internals; `observedState` is renamed to `observed_state`.
- This is the **only** place graph state is assembled for outbound CEE traffic.

### 4.4 Critical question — does graph_state get lost between turns? (bd076d01)

**No, not at the assembly layer.** Reading the code today:
- `applyAutoApplyPatch` at the end of turn 1 mutates the canvas store via `useCanvasStore.setState()`. After this returns, `store.nodes` and `store.edges` contain the new draft.
- Turn 2's `buildRequest` reads `store.nodes` / `store.edges` directly from `useCanvasStore.getState()`. There is no intermediate cache.
- For the empty-arrays-on-turn-2 symptom to recur today, one of these would need to be true: (a) the auto-apply silently failed, (b) the canvas store was reset between turns, (c) the React Flow `nodes` snapshot used by `buildRequest` is a stale closure. The current `buildRequest` uses `store.nodes` (a snapshot read at call-time), so option (c) is unlikely.
- I did **not** find a regression test that asserts turn 2's payload after a turn 1 draft. `useConversation.systemEvents.spec.ts` (around line 271) asserts shape only.

**Recommendation:** add a regression test that drives a draft on turn 1, awaits auto-apply, then sends turn 2 and asserts `graph_state.nodes.length > 0`.

### 4.5 Analysis trigger path

When CEE returns `analysis_response` in the envelope, `handleEnvelope` writes it to the canvas store at [useConversation.ts:1714-1795](src/canvas/conversation/useConversation.ts#L1714-L1795):

- `store.resultsComplete()` writes `report` (via `mapV2ResponseToReportV1`), `hash`, `enrichment`, `ceeReviewV1`, `ceeTraceV1`, `rawV2Response`.
- Side effect: `useResultsStore.getState().setAnalysisSummary()` (~line 1759) caches a compact summary for next turn's `analysis_state`.

**Important:** there is **no separate orchestrator → PLoT → UI path observed in CEE responses.** Analysis results are returned in-line on the same envelope as blocks/text. PLoT is only called directly from the UI when the user runs analysis from the canvas (via `plot.run(...)`), or for `plot.validatePatch` during patch accept.

---

## 5. Right-hand panel integration

### 5.1 Analysis tab

- Canonical right-hand panel: `OutputsDock` ([src/canvas/components/OutputsDock.tsx](src/canvas/components/OutputsDock.tsx)).
- Analysis tab data sources:
  - `useCanvasStore(s => s.results)` — status, report, hash.
  - `useCanvasStore(s => s.rawV2Response)` — full V2 passthrough.
- **No direct CEE response consumption.** Results flow `CEE envelope → handleEnvelope → store.resultsComplete() → OutputsDock subscribes to canvas store`.

### 5.2 Model tab

- `ModelTabBody` ([src/canvas/components/ModelTabBody.tsx](src/canvas/components/ModelTabBody.tsx)) reads `useCanvasStore(s => s.nodes)` and `s.edges`. Pure reflection of canvas graph state. No AI-generated content rendered directly.

### 5.3 Inspector panels

- Inspector v2 panels ([src/canvas/ui/inspector-v2/panels/](src/canvas/ui/inspector-v2/panels/)) read selection from the canvas store. All node/edge data comes from the canvas store. Form values (confidence, belief, observed_state, weight, direction) are stored on `node.data` / `edge.data`.

### 5.4 analysis_state forwarding

Verified currently included on conversation turns:

- Allow-list at [turn-request-builder.ts:131](src/services/turn-request-builder.ts#L131): `analysis_state` is in the conversation list.
- Comment at line 127: "R11 (updated): analysis_state is now allowed on conversation turns so CEE can…".
- `buildConversationTurnRequest` at line 194-215 includes `analysis_state` conditionally via `isValidExplainAnalysisState(input.analysis_state)` filter (line 204).
- Build site in `buildRequest` at around [useConversation.ts:1447-1523](src/canvas/conversation/useConversation.ts#L1447-L1523) — assembled from `store.results.status` (must be `'complete'`), `store.results.hash`, and `store.rawV2Response` fields. **Omitted when `graphEditedSinceLastRun === true`** (stale guard).
- Shape (when present): `{ option_comparison, robustness, drivers, edge_sensitivity, factor_sensitivity (top 5), analysis_status: 'completed', meta: { response_hash }, repairs_summary, compact_summary }`.
- `analysis_state` is **also** allowed on `explain` and `patch_followup` turns (lines 135-136); intentionally **excluded** from `explicit_generate` and `system_event` (per R11 comments at line 217 and 251).

### 5.5 Critical question — do right-hand panels consume CEE directly?

**No.** Every right-hand surface reads from the canvas store (`useCanvasStore`) or the results store (`useResultsStore`). There is no direct `useConversation` or envelope subscription in `OutputsDock`, `ModelTabBody`, or the inspector panels. **Changing the CEE response envelope shape will not affect these surfaces directly**, provided `handleEnvelope` continues to translate envelope fields into canvas-store mutations correctly.

---

## 6. Unknown unknowns (greps)

### Theme: diagnostics / XML

- `stripDiagnostics` is the only XML-stripping function. Defined in [useConversation.ts:312](src/canvas/conversation/useConversation.ts#L312), used at line 1304 (streaming flush) and line 2022 (turn_complete, V1 only). Re-exported and unit-tested at [src/canvas/conversation/__tests__/stripDiagnostics.spec.ts:8](src/canvas/conversation/__tests__/stripDiagnostics.spec.ts#L8).
- `stripRepairLogLines` defined in [validateResponse.ts:55](src/canvas/conversation/validateResponse.ts#L55), used at flushStreamFrame line 1303 and inside `validateResponse` at [validateResponse.ts:116](src/canvas/conversation/validateResponse.ts#L116).
- The string `<diagnostics>` appears in `stripDiagnostics` regex (line 314), in test fixtures, and in the `Conversation.module.css` (probably class names — irrelevant). It also appears in `useConversation.ts` warning messages.
- The strings `<response>` and `<assistant_text>` only appear inside `stripDiagnostics`. There are **no other XML producers/consumers in src/**.
- A `diagnostics` feature flag exists at [src/flags.ts:64-68](src/flags.ts#L64-L68) (`VITE_FEATURE_DIAGNOSTICS`, default true) — but it controls a debug surface, **not** the SSE strip path. Easy to confuse — worth a clarifying rename at some point.

### Theme: streaming events (text_delta, turn_complete)

- The literal strings `text_delta` and `turn_complete` appear in `useConversation.ts` switch (verified above), in `turnService.ts`, in `types.ts:596-604`, in test fixtures (`fixtures/cee-orchestrator-response.json`, `fixtures/orchestrator-rendering-v2.json`), and in many test files (`historyGuards.spec.ts`, `streamingLifecycle.spec.ts`, `MixedBlocks.integration.spec.tsx`, `validateResponse.spec.ts`).
- (Note: Agent 3 erroneously reported "no matches" for these greps. I re-ran them directly and they exist in many places — Agent 3's grep output was unreliable on this task. All findings in this report come from re-verified greps.)

### Theme: assistant_text

- Used as `envelope.assistant_text` in `handleEnvelope` (line 2016). Also referenced in `extractAssistantText.spec.ts`, in `validateResponse.ts`, in fixture JSON, and as part of the `<response><assistant_text>` envelope strip regex (line 327, 333, 337).
- There is a helper `extractAssistantText` (referenced at line 2016) which handles the JSON-wrapped variant where the orchestrator returns text inside a JSON object (debug fallback).

### Theme: chips / suggested_actions

- `envelope.suggested_actions` consumed at [useConversation.ts:1813](src/canvas/conversation/useConversation.ts#L1813) via `enforceChipBudget`.
- `MAX_SUGGESTED_ACTIONS = 3` at types.ts:403-405.
- `chip_metadata` is the wire-format key (snake_case); `chipMeta` is the in-app camelCase variable. The transformation happens in `dispatchAction` ([useConversation.ts:2829-2831](src/canvas/conversation/useConversation.ts#L2829-L2831)).
- `chipMetadata` type at [turn-request-builder.ts:70-73](src/services/turn-request-builder.ts#L70-L73).

### Theme: block_type / block.type

- Wire format uses `block_type` (snake_case). Internal normalised form uses `type`. The conversion happens in `adaptCEEBlock` (called from `validateResponse` and `handleEnvelope` around line 1654). Block-type checks throughout `handleEnvelope` and `InlineBlocks` use the normalised `block.type`.
- `RF_NODE_BLOCKLIST` includes `'type'` and `'kind'` to prevent React Flow's `type` field leaking into outbound graph state.

### Theme: conversation_history

- `conversation_history` is the wire field; populated by `buildHistory` (line 402-425) → `ConversationTurnPair[]`.
- `messageHistory` is not used in the codebase.
- Required field on every turn type per allow-lists at [turn-request-builder.ts:131-143](src/services/turn-request-builder.ts#L131-L143).

### Theme: SafeRichText

- Single source of truth: [src/canvas/utils/safeRichText.ts](src/canvas/utils/safeRichText.ts) (295 lines). Used by `MessageBubble.tsx` and `InlineBlocks.tsx`.
- A separate, more permissive markdown renderer exists at [src/lib/renderSafeRichText.ts](src/lib/renderSafeRichText.ts) and [src/lib/markdown.ts](src/lib/markdown.ts), used outside the conversation UI (e.g. `BaseNode.tsx`, `StreamOutputDisplay.tsx`). **Two markdown pipelines coexist.** That is a smell.

### Theme: sendTurn / buildRequest

- `sendTurn` at [useConversation.ts:2233-2273+](src/canvas/conversation/useConversation.ts#L2233). Destructures `chipMeta` (verified, not dead) at line 2271 area, forwards via `buildRequest({ ..., chipMeta })`.
- `buildRequest` at [useConversation.ts:1333+](src/canvas/conversation/useConversation.ts#L1333). Closure that reads canvas store + results store and calls the appropriate `buildXxxTurnRequest` builder.
- Builders in [src/services/turn-request-builder.ts](src/services/turn-request-builder.ts): `buildConversationTurnRequest` (line 194), `buildExplicitGenerateTurnRequest`, `buildRunAnalysisTurnRequest`, `buildExplainTurnRequest`, `buildPatchFollowupTurnRequest`, `buildSystemEventTurnRequest`. Each enforces a per-turn-type field allow-list.

### Theme: feature flags

Flags relevant to conversation behaviour (`src/flags.ts`):
- `sseStreaming` (line 31-34) — `VITE_FEATURE_SSE`. Controls whether the streaming path or the non-streaming `callOrchestratorTurn` is used. Logged once per load at [useConversation.ts:2455](src/canvas/conversation/useConversation.ts#L2455).
- `isOrchestratorStreamingEnabled` (imported at useConversation.ts:13).
- `isThreadHydrateEnabled`, `isThreadPersistEnabled` (line 13).
- `isDeterministicCeeEnabled` — gates several block renderers in `InlineBlocks.tsx` (`comparison`, `premortem`, `flip_analysis`, `proposal`, `exercise`).
- `isPreAnalysisEnrichedEnabled` — gates `model_receipt`.
- `diagnostics` (`VITE_FEATURE_DIAGNOSTICS`, default true) — debug surface, **not** the strip pipeline. Easy confusion.

### Theme: TODO/FIXME/HACK comments

Only two related TODOs in `src/canvas/conversation`:
1. [useConversation.ts:1982](src/canvas/conversation/useConversation.ts#L1982): `// TODO: Remove backfill when CEE includes interventions in graph_patch add_node ops.` Workaround copying interventions from `ceeAnalysisReady` onto option nodes after patch apply.
2. [useConversation.hook.spec.ts:1142](src/canvas/conversation/__tests__/useConversation.hook.spec.ts#L1142): `// TODO: streaming path produces synthetic error for hidden sends — needs separate fix`. Known issue with hidden-send timeout handling.
**No HACK comments.** No other TODOs about XML, diagnostics, blocks, chips, or history.

### Theme: test fixtures — real vs mocked CEE

- **Real (golden) fixture:** `src/canvas/conversation/__tests__/fixtures/cee-orchestrator-response.json` — captured real response with 22 operations across 10 nodes and 12 edges. Used by `goldenFixture.spec.ts` to catch adapter regressions.
- **Mock fixtures:** `fixtures/orchestrator-rendering-v2.json` — synthetic responses with multiple block types, used by `orchestratorRenderingV2.spec.tsx`.
- Other fixture: `src/test/fixtures/golden-path-staging-2026-04-05.json`.
- **No Storybook stories for the conversation** — searched and none found.

### Unexpected findings

1. **Two markdown pipelines.** `src/canvas/utils/safeRichText.ts` (conversation) and `src/lib/markdown.ts` + `src/lib/renderSafeRichText.ts` (everywhere else) are independent. Different allowlists, different feature sets. If you change rendering behaviour you have to update two places.
2. **`diagnostics` feature flag is unrelated to the diagnostics-strip path.** The flag controls a debug panel surface; the strip lives in `useConversation.ts` and `validateResponse.ts` and is unconditional (modulo routing mode).
3. **`isV2Format` gate is the only thing standing between V2 envelopes and the V1 dedup chain.** All the patch-summary dedup, commentary dedup, and stock-ack suppression at lines 2034-2133 fire on V2 envelopes too. They are belt-and-braces for now but become noise once CEE's contract is clean.
4. **No test asserts turn 2 graph_state after turn 1 draft.** The bd076d01 regression case is not covered.
5. **`tool_result` handler is essentially a no-op.** All real tool output flows via `block` and `turn_complete.envelope` instead. If we ever want to surface incremental analysis progress, the channel exists and is currently unused.
6. **ProposalBlock confirm path is via a literal `confirm:proposalId` user message string** (§2.7). This is unusual and contractually fragile.
7. **No ProposalBlock cancellation channel.** The Cancel button only sets local state — the orchestrator is never informed.

---

## 7. chipMeta pipeline status

**Status: WIRED AND ACTIVE.** The previous audit (section 4.5) is **out of date**. Chronological trace:

1. **Chip click** → `SuggestedChips.handleClick` ([SuggestedChips.tsx:86-92](src/canvas/conversation/zones/SuggestedChips.tsx#L86-L92)) → `onChipClick(chip)` → `ConversationPanel.handleChipClick` → `useConversation.sendChip(chip)`.

2. **`sendChip`** at [useConversation.ts:2859-2896](src/canvas/conversation/useConversation.ts#L2859-L2896):
   ```ts
   await dispatchAction({
     action_type: chip.action_type,
     parameters: chip.parameters,
     label: chip.label,
     message: messageToSend,
     source: 'chip',
   })
   ```
   (`undo` chips short-circuit to `useCanvasStore.getState().undoDraft()` and don't reach CEE.)

3. **`dispatchAction`** at [useConversation.ts:2818-2857](src/canvas/conversation/useConversation.ts#L2818-L2857):
   ```ts
   const chipMeta = opts.action_type
     ? { action_type: opts.action_type, ...(opts.parameters ? { parameters: opts.parameters } : {}) }
     : undefined
   let turnType = 'conversation'
   if (opts.action_type && ACTION_TO_TURN_TYPE[opts.action_type]) {
     turnType = ACTION_TO_TURN_TYPE[opts.action_type]
   }
   await sendTurn({ message, displayText: opts.label, mode, hidden, source, turnType, chipMeta, chipInitiated: !opts.hidden })
   ```

4. **`sendTurn`** ([useConversation.ts:2233+](src/canvas/conversation/useConversation.ts#L2233)) destructures `chipMeta` and forwards it into `buildRequest({ ..., chipMeta })`.

5. **`buildRequest`** ([useConversation.ts:1333+](src/canvas/conversation/useConversation.ts#L1333)) accepts `chipMeta` in its options and calls `buildConversationTurnRequest({ ..., chip_metadata: opts.chipMeta })`.

6. **`buildConversationTurnRequest`** ([turn-request-builder.ts:194-215](src/services/turn-request-builder.ts#L194-L215)) emits the field:
   ```ts
   ...(input.chip_metadata ? { chip_metadata: input.chip_metadata } : {}),
   ```

7. **Wire** allow-list ([turn-request-builder.ts:131](src/services/turn-request-builder.ts#L131)) includes `chip_metadata` for conversation turns.

**ACTION_TO_TURN_TYPE map** ([useConversation.ts:1029-1044](src/canvas/conversation/useConversation.ts#L1029-L1044)):
```
run_analysis        → run_analysis
explain_result      → explain
compare_options     → explain
what_would_flip     → explain
challenge_assumption→ conversation
set_factor_value    → conversation
add_factor          → conversation
add_option          → conversation
add_constraint      → conversation
adjust_edge_strength→ conversation
remove_factor       → conversation
set_goal_target     → conversation
run_premortem       → explain
draft_graph         → explicit_generate
```

**Chip click vs typed message — what's different in the wire request:**

| | Chip click | Typed message |
|---|---|---|
| `chip_metadata` | `{ action_type: '…', parameters?: {…} }` | absent |
| `_turn_type` | from `ACTION_TO_TURN_TYPE[action_type]`, otherwise heuristic on label | resolved by `resolveUserTurnType(source, hidden)` |
| `hidden` | may be true (e.g. `analyse_now`) | usually false |
| `displayContent` (UI bubble label) | chip's `label` | typed text (same as `message`) |
| `source` | `'chip'` | `undefined` / `'retry'` / etc |

So the UI **does** distinguish chip clicks from typed messages, both in metadata and in turn-type routing. The previous audit was wrong — `chipMeta` is fully wired through six layers and has its own routing map, allow-list entry, and (presumably) CEE-side consumer. **No code change needed here.**

---

## 8. Critical answers (consolidated)

| # | Question | Answer |
|---|----------|--------|
| Q1.9 | What happens when text_delta contains XML? | LLM-routed: stripped per RAF frame in `flushStreamFrame` (line 1304); user never sees raw XML for more than a single frame, and the "tag arrived but content hasn't" branch returns `''` so even that frame is suppressed. **Deterministic-routed: not stripped at all** during streaming AND not stripped at turn_complete (the `isV2Format` gate at line 2018-2023 skips it). For deterministic, the UI trusts CEE absolutely. |
| Q2.9 | Does plain text + clean turn_complete work as-is? | **Yes.** `safeRichText`, `InlineBlocks`, `SuggestedChips`, all block renderers, `GraphPatchBlockRenderer`, and `ProposalBlockRenderer` all consume their inputs without format assumptions. The dedup/strip chain at handleEnvelope lines 2041-2133 still runs and is harmless on plain text but wastes cycles. |
| Q3.6 | Diagnostic XML round-trip — what is displayed / stored / sent? | (a) Displayed: stripped to `Your model shows…` only. (b) Stored: stripped — `message.content` is the post-processed text. (c) Sent next turn: stripped — `buildHistory` reads the same `content`. **Caveat:** if `response_version >= 2`, the strip is bypassed at turn_complete and any leaked XML would persist through the entire chain. |
| Q4.4 | Is graph_state still empty on turn 2 (bd076d01)? | **Not at the assembly layer.** `buildRequest` reads `useCanvasStore.getState().nodes/edges` directly at call time, with no caching. Auto-apply mutates the store synchronously inside `handleEnvelope`. For the symptom to recur today, the store mutation would have to silently fail or the canvas would have to be reset between turns. **No regression test exists** for this specific case — recommend adding one. |
| Q5.5 | Do right-hand panels consume CEE responses directly? | **No.** `OutputsDock`, `ModelTabBody`, and inspector v2 panels all read from `useCanvasStore` / `useResultsStore`. CEE responses reach them only via `handleEnvelope` → `store.resultsComplete()` → store subscription. Envelope shape changes do not affect these surfaces directly. |

---

## 9. Contract change impact assessment

**Hypothetical change:** CEE emits clean plain text in `text_delta` (no XML), and `turn_complete` carries `{ assistant_text: string, blocks: Block[], chips: Chip[], tool_results: … }` with no `<diagnostics>`, `<response>`, `<assistant_text>` XML anywhere.

### (a) Breaks immediately
**Nothing** breaks. The current code already accepts plain text and structured envelopes. The strip functions are no-ops on clean input.

### (b) Degrades silently (functions but is wrong/wasted)

1. **`isV2Format` detection at handleEnvelope:2019** is keyed off `response_version >= 2`. If CEE doesn't bump the version, the V1 strip chain runs unnecessarily — harmless but wasteful, and noise in logs if any false positive triggers.
2. **Patch-summary dedup** (lines 2064-2090) and **commentary dedup** (lines 2095-2100) will continue to fire and may accidentally collapse legitimate prose if CEE's new clean text happens to share words with block summaries. Risk is low but real. Recommend gating these on `response_version < 2` once CEE's contract is firm.
3. **Stock-ack suppression** (lines 2122-2133) silently deletes assistant text matching `^Got it$`, `^Noted$`, etc. when a graph_patch block is present. If the new clean contract sends meaningful follow-up prose alongside a patch, this could erase it.
4. **Chip-label dedup** (lines 2041-2059) silently strips trailing list items that match chip labels. If CEE's clean text legitimately ends with bulleted alternatives, they get stripped.
5. **Structural-violation interception** (lines 2104-2115) replaces certain phrases with `"I wasn't able to make that change safely…"`. If clean CEE text legitimately contains "would leave a node…" in a different sense, it gets clobbered.
6. **`diagnostics` feature flag** (`src/flags.ts:64`) becomes confusingly named — there's no longer any "diagnostics" being stripped in the strip pipeline.
7. **`stripDiagnostics` and `stripRepairLogLines` become dead code** (after the unused-V1 retention period). Worth pruning.

### (c) Works fine

- All SSE event handlers (text_delta, block, tool_start, tool_result, progress, turn_complete, error) — pure passthrough.
- All block renderers — operate on block fields, not text.
- `safeRichText` — handles plain text identically to current.
- All right-hand panels (OutputsDock, ModelTabBody, inspector v2) — read from canvas store, not CEE responses.
- `chipMeta` pipeline (§7) — already fully wired.
- `buildHistory` — pulls cleaned `content`, no XML.
- `buildConversationTurnRequest` — wire format independent of text format.
- Graph state assembly — no dependency on CEE text format.
- `analysis_state` round-trip — no dependency on CEE text format.

### Recommended change order

1. **First:** bump CEE response_version to 2 (or whatever's next) so `isV2Format` flips on. This deactivates `stripDiagnostics` at handleEnvelope.
2. **Then:** wire `streamRoutingRef` from `turn_start.routing = 'deterministic'` — deactivates `stripDiagnostics` at flushStreamFrame. (Already done; just ensure CEE always sets this.)
3. **Then:** gate the V1 dedup chain (lines 2034-2135) behind `!isV2Format` so V2 envelopes go through a thin pass.
4. **Then:** observe in production for one release; remove `stripDiagnostics`, `stripRepairLogLines`, and the V1 dedup chain.
5. **Then:** rename or repurpose the `diagnostics` feature flag.
6. **Then:** consider unifying the two markdown pipelines (`safeRichText` vs `lib/markdown`).

---

## 10. Risks and unexpected findings

### Contradictions vs prior audits / assumptions

1. **`chipMeta` is NOT dead.** The previous audit (referenced as section 4.5) called the whole deterministic chip-routing pipeline inert. It is fully wired through six layers (§7). Whatever audit said this should be marked superseded.
2. **`useConversation.ts` is 2,957 lines, not 2,500 / 2,296 / 2,566.** Earlier figures undercount.
3. **ProposalBlock Apply DOES have an outbound side effect** — it sends `sendMessage("confirm:proposalId")` via `handleProposalConfirm`. The previous audit's claim of "no API call" is wrong, though the underlying smell is real: ProposalBlock uses a contractually fragile literal-prefix message instead of a typed system event, and ProposalBlock Cancel has no outbound channel at all.
4. **GraphPatchBlock Apply is fully wired** to PLoT validation + canvas mutation + a `patch_accepted` system event. Do not confuse it with ProposalBlock.
5. **bd076d01 regression (graph_state empty on turn 2)** is not reproducible from current code reading. Assembly is dynamic at send-time. Add a regression test rather than assume the bug exists today.

### Legacy / dead code worth tracking

1. **`stripDiagnostics` and the V1 dedup chain** become dead once `response_version >= 2` is universal. ~100 lines plus the unit-test file.
2. **`tool_result` handler** is a one-line no-op. If we don't need it, remove it from the switch.
3. **Two markdown pipelines** (`canvas/utils/safeRichText.ts` and `lib/markdown.ts` + `lib/renderSafeRichText.ts`). Worth consolidating in a future cleanup.
4. **`diagnostics` feature flag** misleadingly named — controls debug panel, not strip pipeline.
5. **The `stripDiagnostics` partial-envelope branches** (lines 333-342) handle a streaming corner case that disappears entirely with deterministic routing.

### Active behaviour worth noting before contract change

1. The `streamRoutingRef.current === 'deterministic'` gate (line 1302) is the **only** thing skipping strip during streaming. CEE must reliably emit `routing: 'deterministic'` on `turn_start` for V2 turns.
2. The `isV2Format` gate (line 2019) keys off `response_version >= 2` on the **raw envelope** (not the validated one). CEE must set `response_version` on the envelope CRD field that survives `validateResponse`.
3. The dedup/filter chain at lines 2034-2135 is **not gated** by `isV2Format`. It runs on every non-full-draft turn regardless of routing or version. This is the most likely source of silent text mutation in the post-contract world. See §9(b).
4. Auto-apply patches **bypass `plot.validatePatch`**. If CEE starts emitting `auto_apply: true` on patches that need validation, the canvas will accept them blindly.

---

## Appendix A — file index (with verified line counts)

| File | Lines | Role |
|------|-------|------|
| [src/canvas/conversation/useConversation.ts](src/canvas/conversation/useConversation.ts) | 2,957 | God file: SSE consumption, history mgmt, sendTurn, sendChip, dispatchAction, buildRequest, handleEnvelope, stripDiagnostics |
| [src/canvas/conversation/turnService.ts](src/canvas/conversation/turnService.ts) | 691 | HTTP + SSE plumbing, `streamOrchestratorTurn`, `callOrchestratorTurn` |
| [src/canvas/conversation/InlineBlocks.tsx](src/canvas/conversation/InlineBlocks.tsx) | 1,550 | Block dispatcher and all 14 block renderers |
| [src/canvas/conversation/MessageBubble.tsx](src/canvas/conversation/MessageBubble.tsx) | 326 | Text rendering pipeline |
| [src/canvas/conversation/ConversationPanel.tsx](src/canvas/conversation/ConversationPanel.tsx) | ~500 | Patch accept/dismiss handlers, proposal confirm, feedback |
| [src/canvas/conversation/validateResponse.ts](src/canvas/conversation/validateResponse.ts) | 250 | Envelope validation, `stripRepairLogLines` |
| [src/canvas/conversation/types.ts](src/canvas/conversation/types.ts) | 604 | All conversation types incl. SSE event union |
| [src/canvas/utils/safeRichText.ts](src/canvas/utils/safeRichText.ts) | 295 | Conversation markdown sanitiser |
| [src/services/turn-request-builder.ts](src/services/turn-request-builder.ts) | 389 | Per-turn-type builders + allow-lists |
| [src/canvas/conversation/utils/applyPatch.ts](src/canvas/conversation/utils/applyPatch.ts) | ~240 | `applyAutoApplyPatch`, `buildNode`, `buildEdge` |
| [src/canvas/conversation/zones/SuggestedChips.tsx](src/canvas/conversation/zones/SuggestedChips.tsx) | 238 | Chip rendering |
| [src/canvas/conversation/zones/ChatMessage.tsx](src/canvas/conversation/zones/ChatMessage.tsx) | ~110 | Per-message wrapper |

---

**End of report.**
