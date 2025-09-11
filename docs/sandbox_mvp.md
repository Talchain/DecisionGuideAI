# Scenario Sandbox MVP — 90-second Tester Guide

Route
- /#/decisions/demo/sandbox

What to try (keyboard or toolbar)
- Draw: press R (or click Rect), then drag on the canvas
- Text: press T (or click Text), then click to place text
- Select / Move: press V (or click Select), then drag shapes
- Pan: hold Space and drag
- Zoom: trackpad pinch or Cmd/Ctrl + scroll; toolbar has +, −, Fit
- Undo / Redo: ⌘Z / CTRL+Z and ⇧⌘Z / CTRL+Y; toolbar has Undo/Redo
- Save → Reload → Restore → Reset:
  - Save: click Save to write a local snapshot now
  - Reload the page
  - Restore: click Restore to load the local snapshot
  - Reset: click Reset to clear the board and local snapshot

Notes
- If you see “Working locally — cloud sync unavailable”, the board is still fully usable and autosaves locally. You can Save/Restore/Reset from the toolbar.
- Tip: a short one-time hint appears near the toolbar; click “Got it” to dismiss. It won’t show again on this device.

Feedback
- Use the “Send feedback” button (top-right). It opens an email with your environment details. Include any screenshots or short notes about what felt confusing or slow.

---

## Combined Route (Panels + Canvas) — Quick Start

Route
- `/#/decisions/demo/sandbox/combined`

What to try
- Panels toggle: Click “Hide panels” or press ⌥P. When collapsed, a 20px peek handle appears at the left edge (click to re-open).
- Divider resize: Drag the divider or focus it and use ←/→ (±16px). Width is clamped to [240, 560] and to viewport minus a minimum canvas width.
- Style panel: Click “Style” in the header to toggle TLDraw’s style/inspector. It is collapsed by default. State persists per decision.
- Save/Restore/Reset: Header actions operate on local storage only. Save persists immediately; Restore loads from local; Reset asks you to type RESET and offers a 10s Undo banner.
- Mobile tabs: On small viewports, use the “Panels | Canvas” tabs to switch while keeping both mounted.

Accessibility (spot checks)
- Divider has `role="separator"` with `aria-orientation="vertical"` and announces width via `aria-live="polite"` on release.
- When panels are collapsed, the `<aside>` subtree is inert (not focusable) and removed from the tab order.
- Alt/Option+P does not toggle when focus is inside text inputs or content-editable elements.

Preview env
- Ensure preview has Sandbox + Whiteboard + Snapshots enabled; Debug flags off. The combined route does not require backend changes.
