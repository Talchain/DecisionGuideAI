// Layout constants for the AI panel v2 (Batch 2 — state-led redesign).
//
// The panel is no longer driven by user-managed Compact/Conv/Focus tabs.
// State is derived from canvas + analysis state plus an explicit
// minimise/float toggle the user can apply.
//
// States:
//   1 — no model        → full-panel WelcomeComposer, analysis HIDDEN
//   2 — model, no run   → 35% analysis / 65% AI split
//   3 — post-analysis   → 65% analysis / 35% AI split
//   4 — minimised       → 48px AI bar at the bottom; analysis fills the rest
//   5 — floating        → AI undocked as a draggable window; right panel = 100% analysis
//
// State 2/3 ratios can be adjusted by the user via the vertical resize
// drag handle (the AIHeaderStrip background).

// ── Right-panel sizing ──────────────────────────────────────────────
export const AI_PANEL_V2_WIDTH = 400
export const PANEL_RIGHT_MARGIN = 12
export const PANEL_BOTTOM_OFFSET_CSS = 'calc(var(--bottombar-h, 0px) + 1rem)'

// ── Vertical-split min-heights (State 2 / State 3) ──────────────────
export const AI_ZONE_MIN_HEIGHT = 200
export const ANALYSIS_ZONE_MIN_HEIGHT = 200

// ── State-driven default ratios ─────────────────────────────────────
// State 2: pre-analysis. AI dominates so the conversation is the primary
// surface while the readiness card lives compactly above it.
export const PRE_ANALYSIS_AI_RATIO = 0.65
// State 3: post-analysis. Analysis dominates so results read at a glance;
// the AI sits beneath for follow-up questions.
export const POST_ANALYSIS_AI_RATIO = 0.35

// ── AI header strip (replaces PullTab) ──────────────────────────────
// 28px header bar at the top of the AI zone. Hosts minimise + float
// icons and doubles as the vertical resize drag handle (cursor
// `ns-resize` on its background; icon hit-areas suppress the drag).
export const AI_HEADER_STRIP_HEIGHT = 28

// ── Minimised bar (State 4) ────────────────────────────────────────
// 48px single-line input + cog + send + expand icon.
export const MINIMISED_BAR_HEIGHT = 48

// ── Floating panel (State 5) ───────────────────────────────────────
export const FLOATING_DEFAULT_WIDTH = 400
export const FLOATING_DEFAULT_HEIGHT = 500
export const FLOATING_MIN_WIDTH = 320
export const FLOATING_MIN_HEIGHT = 300
// Max dims are computed live from viewport: 60% wide, 80% tall.
export const FLOATING_MAX_WIDTH_FRACTION = 0.6
export const FLOATING_MAX_HEIGHT_FRACTION = 0.8
export const FLOATING_HEADER_HEIGHT = 32
// Default mount position is anchored to the right edge so undocking
// reads as a sideways move, not a teleport to (0,0).
export const FLOATING_DEFAULT_RIGHT_OFFSET = 24
export const FLOATING_DEFAULT_TOP_OFFSET = 80

// ── Keyboard step for vertical resize ──────────────────────────────
export const ARROW_KEY_RESIZE_PX = 20

// ── Z-index stack ──────────────────────────────────────────────────
// Matches OutputsDock (900) for the docked panel. Floating panel sits
// above canvas / docked panel chrome but below modal dialogs.
export const Z_AI_PANEL_BASE = 900
export const Z_FLOATING_PANEL = 950

// ── Panel "view" (what the layout is actually rendering) ───────────
// `state` (welcome / pre-analysis / post-analysis) is derived from canvas
// + conversation state. `display` is the user-selected presentation
// (docked / minimised / floating). `view` collapses them into one
// pattern-matched value the layout switches on.
export type AIPanelState = 'welcome' | 'pre-analysis' | 'post-analysis'
export type AIPanelDisplay = 'docked' | 'minimised' | 'floating'
export type AIPanelView =
  | { kind: 'welcome' }
  | { kind: 'docked'; state: 'pre-analysis' | 'post-analysis' }
  | { kind: 'minimised'; previousState: 'pre-analysis' | 'post-analysis' }
  | { kind: 'floating'; previousState: 'pre-analysis' | 'post-analysis' }
