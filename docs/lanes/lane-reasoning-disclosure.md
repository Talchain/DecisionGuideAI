# Lane — Show-reasoning progressive disclosure (ROADMAP 1.42, UI half)

**Branch:** `claude-ui/reasoning-disclosure` (worktree, base `origin/staging` @ `d991ad5a`)
**Zone:** Conversation surface only — `src/flags.ts`, `src/canvas/conversation/types.ts`,
`src/canvas/conversation/useConversation.ts`, `src/canvas/conversation/MessageBubble.tsx`,
`src/canvas/conversation/Conversation.module.css`.

## Context

Paul ruled **VERBATIM-with-label**: when CEE (built in parallel, same ROADMAP item) sends a
top-level `_reasoning` string on an assistant turn response, the UI shows it verbatim behind a
collapsed-by-default disclosure toggle headed exactly "Model reasoning (verbatim)" — no summary,
no markdown rendering, no editorial framing.

## Contract (verified, no parser change needed)

`_reasoning` is an unknown key at the UI's pinned `@talchain/schemas` (0.13.1). It is not in
`KNOWN_OLUMI_TOP_LEVEL_KEYS` (`src/v5/responseParser.ts:180-189`), so
`splitAdditiveExtensions`/`splitBlocksTolerance` demote it into the non-enumerable
`ADDITIVE_EXTENSIONS_KEY` (`'__additive__'`) sidecar (`responseParser.ts:196-218,697`) rather than
dropping it. This is the same mechanism that already carries Phase 3 blocks and other additive
top-level keys — verified by reading, not assumed. **No change to `responseParser.ts` in this
lane.**

## Implementation (additive only)

1. **`src/flags.ts`** — new flag `reasoningDisclosure` (`isReasoningDisclosureEnabled`), pattern-matched
   on `isDeterministicCeeEnabled`. `VITE_FEATURE_REASONING_DISCLOSURE` env / `feature.reasoningDisclosure`
   localStorage. **Default OFF** (no `defaultValue: true`) — sporadic CEE field with no contract
   guarantee yet.
2. **`src/canvas/conversation/types.ts`** — `ConversationMessage.reasoning?: string`.
3. **`src/canvas/conversation/useConversation.ts`** (V5 `addMessage` success site, `text_only` +
   `blocks` targets):
   - `extractReasoningSidecar()` reads `(target.response as OlumiResponseWithExtensions)[ADDITIVE_EXTENSIONS_KEY]?.['_reasoning']`
     — imports `ADDITIVE_EXTENSIONS_KEY` / `OlumiResponseWithExtensions` from `../../v5/responseParser`,
     never touches the strict `OlumiResponse` surface.
   - Accepts only a non-empty (post-trim) string; whitespace-only/non-string is rejected.
   - Length-capped at 20,000 chars with a disclosed `'\n\n[reasoning truncated]'` suffix — the
     accepted string itself is **never trimmed** (verbatim fidelity; only used to test for
     emptiness).
   - Attached as `message.reasoning`, **never merged into `message.content`** — `content` only ever
     carries `assistant_text` (that field feeds `extractFromRawJson` / clamp-truncation in
     `MessageBubble.tsx`, which reasoning must bypass entirely).
   - Gated on `isReasoningDisclosureEnabled()`; when off, the sidecar is never read.
4. **`src/canvas/conversation/MessageBubble.tsx`** — on assistant messages
   (`!isUser && message.reasoning && isReasoningDisclosureEnabled()`, defense-in-depth flag check
   mirroring the existing `isDeterministicCeeEnabled()` gate on `InsightsStrip`), inserted between
   the prose Show-more toggle and `InsightsStrip`:
   - A collapsed-by-default toggle (`aria-expanded`, `data-testid="message-show-reasoning"`) mirroring
     the existing Show-more toggle's expanded-state pattern.
   - Expands to a muted panel (`bg-panel-hover` + `border-default`, distinct from the answer bubble —
     no `bg-{colour}-light`, no answer-bubble styling) headed **exactly** "Model reasoning (verbatim)".
   - Body is a plain React text child (`<p>{message.reasoning}</p>`, `white-space: pre-wrap`) — **no
     `dangerouslySetInnerHTML`, no markdown pipeline.** React's default text-node escaping makes this
     XSS-safe by construction (a literal `<script>` string renders as inert text, pinned by test).
   - Renders nothing when `message.reasoning` is absent (sporadic field) or the flag is off.
5. **Persistence (`useThreadPersistence.ts`)** — **no code change.** The hook's assistant-message
   mapping explicitly enumerates the fields it persists (`content`, `blocks`/`structuredBlocks`,
   `suggested_actions`/`actionChips`, `clientTurnId`, snapshot ids) with no spread of the message
   object — `reasoning` was never on that list and is naturally excluded. Confirmed by reading the
   hook, not by adding a guard. Reasoning is therefore ephemeral / session-only by construction: a
   page reload or thread-hydration replay never resurrects it.

## Tests (RED-first verified below)

- `src/canvas/conversation/__tests__/MessageBubble.reasoning.spec.tsx` (7 tests): collapsed by
  default; expands with the exact "Model reasoning (verbatim)" header; collapses again on second
  click; byte-verbatim rendering including a literal `<script>alert(1)</script>` string rendered as
  escaped/inert text (`panel.querySelector('script')` is null, `innerHTML` contains `&lt;script&gt;`,
  `textContent` contains the verbatim payload) — pins the XSS-safety property; renders nothing when
  reasoning is absent (flag on); renders nothing when the flag is off (reasoning present); never
  renders on user messages.
- `src/canvas/conversation/__tests__/useConversation.reasoning.spec.ts` (8 tests): sidecar → `message.reasoning`
  when the flag is on; reasoning never lands in `message.content`; absent sidecar / absent `_reasoning`
  key / non-string / whitespace-only value all leave `message.reasoning` undefined; oversized value
  is capped with the disclosed truncation suffix; flag off means `message.reasoning` stays undefined
  even when CEE sent a valid `_reasoning`.

RED-first: both new spec files were written against the pre-implementation tree state
(`message.reasoning` typed but never populated, no `MessageBubble` toggle) and failed as expected
(`message-show-reasoning` / `message.reasoning` not found) before the corresponding implementation
commit; green after.

## Verification

- **Typecheck:** `pnpm run typecheck` (`tsc -p tsconfig.ci.json --noEmit`) — clean.
- **Targeted vitest** (both new spec files + 5 sibling `MessageBubble.*.spec.tsx` files, run
  together): 57 passed / 0 failed.
- **Lint:** `pnpm run lint` on the touched files — 0 errors (a handful of pre-existing warnings in
  `useConversation.ts`, none on lines this lane touches).
- **`--changed` sweep:** 1 pre-existing failure, unrelated to this lane —
  `useConversation.hook.spec.ts > timeout progression > aborts and shows error at 60s` fails with
  `No "getV5Endpoint" export is defined on the "../../../v5/v5Adapter" mock` (that spec's
  hand-rolled `v5Adapter` mock only stubs `callV5Turn`, not `getV5Endpoint`, which the real
  `sendTurn` now calls unconditionally at `useConversation.ts:2967`). Verified byte-identical on
  unmodified `origin/staging @ d991ad5a` via `git stash` (41/67 tests fail when the file is run in
  isolation, on **both** the base commit and this branch) — a pre-existing gap in that spec's mock
  surface, not a regression from this lane. Not chased (out of scope; global "authoritative gate,
  don't substitute ad-hoc fixes" doctrine cuts the other way too — fixing someone else's spec mock
  is a separate lane).
- Full local suite NOT run (OOMs by policy per repo `CLAUDE.md`).

## Notes for the reviewer

- Flag defaults OFF everywhere (`VITE_FEATURE_REASONING_DISCLOSURE` unset). No user-visible change
  on staging until CEE ships `_reasoning` **and** the flag is flipped on.
- No `UI-SEM-*` tag needed — this lane adds no semantic transform; the reasoning string is
  displayed byte-for-byte, never interpreted.
- Depends on the CEE-side half of ROADMAP 1.42 (built in parallel) actually emitting `_reasoning`;
  until then this lane is inert dead code behind the flag.
