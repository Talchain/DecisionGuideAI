# AI panel v2 — UX batch 1 walkthrough

**Date:** 2026-05-17
**Branch:** `claude/stoic-jang-052395`
**Origin staging at start of batch:** `c6e26f50` (pushed at end of round 1)
**Local commits ahead of `origin/staging`:** 3 — `05ab2390`, `434805f4`, `c75de727` (and a follow-up commit on top of this doc update)
**Flag:** `FF_AI_PANEL_V2` (default `false`)

This doc captures concrete runtime artefacts for each UX-batch-1 acceptance row. The first round (12 commits) was already pushed to staging; this batch sits locally pending review.

---

## Acceptance row → concrete artefact

### Fix 1 — Analysis zone shows OutputsDock, AI zone shows conversation

At 1280×800, FF on, empty graph (welcome state). Runtime DOM probe:

```json
{
  "analysisZoneMounted": true,
  "aiZoneMounted": true,
  "outputsDockEmbedded": "true",
  "outputsDockAriaLabel": null
}
```

- `analysis-zone` testid present (top of right column) — hosts `<OutputsDock embedded />`
- `ai-panel-v2-layout` testid present (bottom) — hosts `<AIZone />`
- Inner OutputsDock `data-embedded="true"` → embedded host path taken
- Inner aside has no `aria-label` when embedded — outer aside's `aria-label="Analysis"` carries the user-facing label (P1.4)

### Fix 2 + Fix 4 — Mode control: icon-only, two non-current modes

At 1280×800 (active mode = compact, Focus disabled because viewport < 1440):

```json
[
  { "mode": "ai-panel-v2-mode-conversation", "tabIndex": "0", "disabled": false },
  { "mode": "ai-panel-v2-mode-focus", "tabIndex": "-1", "disabled": true  }
]
```

- Only the two non-current modes render. The active mode (Compact) is implicit — not in the tablist.
- `tabIndex=0` on the enabled icon (P1.1): Tab-reachable.
- Disabled icons get `tabIndex=-1` so keyboard users skip them.
- No "Conv" truncation — labels are `aria-label` strings ("Conversation mode", "Focus mode") plus sr-only spans.

### Fix 3 — First-use welcome composer

At 1280×800 with `messages.length === 0`:

```json
{
  "zoneState": "welcome",
  "guidanceText": "Describe your decision, the options you’re weighing, and what a good outcome looks like.",
  "inputBarVariant": "welcome",
  "textareaPlaceholder": ""
}
```

- `data-state="welcome"` on the zone wrapper
- Guidance text matches the brief verbatim
- `AIInputBar` carries `data-variant="welcome"` (taller resting height 96px, max 168px, auto-focused on mount)
- Placeholder is empty — the guidance text above the field carries the prompt so the placeholder doesn't duplicate it (avoids the visual "two rows of the same text" we caught in QA)

### Fix 5 — Typography (panel-v2 surface)

```
$ grep -rE "text-lg|text-xl|text-2xl|text-base|text-sm[^_a-z]|text-xs[^_a-z]" \
    src/canvas/ai-panel-v2 src/canvas/conversation/components/EntityLink.tsx
(no matches)
```

Every text element in the panel-v2 surface uses `typo('panelHeader' | 'panelBody' | 'panelMeta')` + semantic colour tokens.

### P0.1 — Singleton invariant: one `useConversation()` across the v2 tree

Live test output:

```
✓ AIPanelV2Layout calls useConversation() exactly once across both zones
✓ the embedded OutputsDock wrapper does not call useConversation
```

`SingletonInvariant.spec.tsx` spies on the hook at the module level and asserts the count is exactly 1 across `<AIPanelV2Layout />` (which now owns the singleton at the layout level rather than literally inside `AIZone` — see code comment in `AIPanelV2Layout.tsx` for the architecture-deviation note).

`EmbeddedSendWiring.spec.tsx` adds a separate guard: the `embeddedSendMessage` prop AIPanelV2Layout passes to OutputsDock IS the singleton conversation's `sendMessage` (same reference), AND is the same reference AIZone receives. Calling the embedded send invokes the singleton mock exactly once.

### P0.2 — Welcome state registers `_sendMessage`

`Prefill.spec.tsx`:

```
✓ registers _prefillChat in welcome state and it writes to the visible AIInputBar
✓ registers _sendMessage in welcome state so context-menu Ask AI works before the first message
✓ un-registers both callbacks on unmount so stale refs do not silently no-op
```

Context-menu "Ask AI" polls `useGuidanceStore.getState()._sendMessage` and calls it. In welcome state ConversationPanel doesn't mount, so the panel's own registration effect never fires; AIZone's welcome `useEffect` registers both callbacks instead.

### P1.1 — Mode icons keyboard-navigable

At 1500×900 with Focus enabled:

```json
{
  "convTabIndex": "0",
  "focusTabIndex": "0",
  "focusDisabled": false
}
```

At 1280×800 (Focus disabled):

```json
{
  "convTabIndex": "0",
  "focusTabIndex": "-1",
  "focusDisabled": true
}
```

### P1.2 — Focus analysis-zone height calc

Inline style of `[data-testid="ai-panel-v2-analysis-zone"]` after entering Focus + opening a tab at 1500×900:

```
position: fixed;
top: 12px;
right: 12px;
width: 400px;
z-index: 900;
transition: height var(--duration-base, 300ms) ease-out;
bottom: calc(var(--bottombar-h, 0px) + 1rem);
```

Explicit `top` + `bottom` — no more malformed `calc(... - var(--bottombar-h) + 1rem)` from string-splicing `PANEL_BOTTOM_OFFSET_CSS`.

### P1.3 — Embedded OutputsDock DS v5 tokens

Visible chrome under `embedded={true}`:
- Sticky header: `bg-panel border border-default rounded-t-2xl` (was raw `rgba(...)`)
- Tab buttons: `typo('panelMeta')` instead of `typography.caption`; active state `text-info bg-info/10 border-info` (was inline `rgba(82,163,200,0.15)`)
- Verify-count badge: `typo('panelMeta')` instead of `fontSize: 11`

FF-off chrome untouched.

### P1.4 — Single-container claim + duplicate aria-label

- Comment in `AIPanelV2Layout` updated to truthfully describe the two-fixed-positioned-siblings architecture.
- Embedded inner aside omits `aria-label="Outputs dock"` so screen readers don't announce nested duplicates (outer aside carries `aria-label="Analysis"`).

### Viewport buckets — three-column Focus at 1680×900

```json
{
  "activeMode": "focus",
  "viewportMode": "full",
  "analysis_right": "12px",
  "analysis_width": "400px",
  "ai_right": "424px",
  "ai_width": "400px",
  "tabStripVisible": false
}
```

- Analysis zone at right 12-412 (400px), AI column at right 424-824 (400px), 12px gutter. No overlap.

### Tab-strip overlay at 1500×900

Closed-tab state:

```json
{ "activeMode": "focus", "viewportMode": "tab-strip", "analysisHidden": "true", "stripVisible": true }
```

Open-tab state (after clicking results in the strip):

```json
{ "analysisHidden": "false", "analysisRight": "12px", "analysisWidth": "400px" }
```

---

## Tests + lint

```
$ npx vitest run src/canvas/ai-panel-v2 src/canvas/conversation/components/__tests__
 Test Files  13 passed (13)
      Tests  81 passed (81)
```

The +1 over the prior round comes from a standalone-branch regression
guard in the rewritten `EmbeddedSendWiring.spec.tsx` (asserts that the
non-embedded `<OutputsDock />` still calls `useConversation` exactly
once). The other four tests in that file now exercise the real embedded
host through to a body child (`ModelTabBody.onSendMessage` captured by
reference) rather than mocking the wrapper itself.

```
$ npm run typecheck
> tsc -p tsconfig.ci.json --noEmit
(clean)
```

```
$ npx eslint src/canvas/ai-panel-v2 src/canvas/conversation/components
✖ 0 problems
```

`OutputsDock.tsx` carries 6 pre-existing unused-import warnings (lines
88, 94, 95, 294, 1863) that pre-date this branch — `git blame` shows
them landed on staging. They are intentionally out of scope here; the
"lint clean" claim above is scoped to the touched directories
(`src/canvas/ai-panel-v2` + `src/canvas/conversation/components`), not
the dock file itself.

---

## What's local vs pushed

```
$ git log --oneline origin/staging..HEAD
c75de727 fix(ai-panel-v2): discriminated embedded prop + ownership doc + per-row walkthrough
434805f4 fix(ai-panel-v2): singleton invariant + welcome _sendMessage + a11y + DS v5
05ab2390 fix(ai-panel-v2): UX batch 1 — critical layout + welcome state + mode redesign
```

A follow-up commit sits on top of this snapshot with: no-op fallback
removed from `OutputsDockEmbeddedHost` (the discriminated union already
requires the prop at compile time — a runtime crash is the desired
signal if someone bypasses the types), `EmbeddedSendWiring.spec.tsx`
rewritten to render the real OutputsDock (no wrapper mock; the
`ModelTabBody.onSendMessage` capture proves the prop flows through the
real host + body code path), this doc updated to match the
`git log origin/staging..HEAD` output above, and the lint-clean claim
narrowed to the directories it actually covers.

`FINAL_DELIVERY.md` from the original delivery sweep still references the 12 commits that were pushed to staging at `c6e26f50` — it's accurate as historical record of the original delivery and unchanged here. UX batch 1 + this round are appended above.

## Architecture deviation note

The approved plan's correction #9 wording was "useConversation() is called exactly once at the top of AIZone". With Fix 1's restructure (AIPanelV2Layout owning both zones), the hook moved one level up to the layout — same singleton instance, threaded as a prop into both children. The invariant (one conversation, asserted by `SingletonInvariant.spec.tsx`) is preserved; the LOCATION changed. Code comment in `AIPanelV2Layout.tsx` documents the deviation; tests + this walkthrough reference the invariant by name ("single conversation instance") rather than the call site.
