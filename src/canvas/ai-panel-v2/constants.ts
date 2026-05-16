// Layout constants for the AI panel v2 split layout. All values are pixels
// unless suffixed otherwise. Kept here so tests and runtime share one source
// of truth.

export const AI_PANEL_V2_WIDTH = 400
export const AI_ZONE_MIN_HEIGHT = 200
export const ANALYSIS_ZONE_MIN_HEIGHT = 200

// Default ratio when no user override exists. Matches the Compact preset
// from the design proposal.
export const COMPACT_AI_RATIO = 0.30
export const CONVERSATION_AI_RATIO = 0.55

// Mode highlight thresholds — `ratio` = AI-zone height / panel height.
// Outside both ranges the nearest mode is highlighted (free position).
// Per the brief's correction #1.
export const MODE_THRESHOLDS = {
  compact: { min: 0.25, max: 0.40 },
  conversation: { min: 0.41, max: 0.65 },
} as const

// Pull-tab sizing (brief §4.1, correction #12):
// 64px total effective hit area; 160×36 visible label strip centred
// horizontally; ~28px transparent drag zone above the labels covering the
// resize boundary.
export const PULL_TAB_HEIGHT = 64
export const PULL_TAB_LABEL_HEIGHT = 36
export const PULL_TAB_LABEL_WIDTH = 160

// Focus-mode viewport rules (brief §4.5).
export const FOCUS_MIN_VIEWPORT = 1440
export const FOCUS_FULL_VIEWPORT = 1600

// Focus column dimensions + snap-back tolerance (brief §4.6).
export const FOCUS_COLUMN_DEFAULT = 400
export const FOCUS_COLUMN_MIN = 320
export const FOCUS_SNAP_THRESHOLD = 20

// Collapsed-strip width at 1440–1599px viewports (brief §4.5).
export const ANALYSIS_TAB_STRIP_WIDTH = 48

// Vertical drag arrow-key step (brief §11.4).
export const ARROW_KEY_RESIZE_PX = 20

// Stacking layer for the AI panel chrome — matches OutputsDock (900) so the
// two fixed-position right-side panels share the same level: above canvas,
// below modal/dialog overlays.
export const Z_AI_PANEL_BASE = 900

// Focus-mode chrome sits above the right dock when it visually replaces the
// dock with a 48px strip. The click-outside scrim sits below OutputsDock so
// the expanded dock remains interactive while outside clicks still close it.
export const Z_FOCUS_COLUMN = Z_AI_PANEL_BASE
export const Z_ANALYSIS_SCRIM = Z_AI_PANEL_BASE - 10
export const Z_ANALYSIS_OVERLAY = Z_AI_PANEL_BASE + 20

export type AIPanelMode = 'compact' | 'conversation' | 'focus'
