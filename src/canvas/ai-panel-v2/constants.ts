// Layout constants for the AI panel v2 split layout. All values are pixels
// unless suffixed otherwise. Kept here so tests and runtime share one source
// of truth.
//
// Step 1 ships only the constants that are actually consumed today. Mode
// thresholds, pull-tab sizing, and Focus-mode tuning land alongside their
// implementation in later steps to avoid carrying unused symbols in the
// public surface.

export const AI_PANEL_V2_WIDTH = 400
export const AI_ZONE_MIN_HEIGHT = 200
export const ANALYSIS_ZONE_MIN_HEIGHT = 200

// Default ratio when no user override exists. Matches the Compact preset
// from the design proposal.
export const COMPACT_AI_RATIO = 0.30

// Stacking layer for the AI panel chrome — matches OutputsDock (900) so the
// two fixed-position right-side panels share the same level: above canvas,
// below modal/dialog overlays.
export const Z_AI_PANEL_BASE = 900

export type AIPanelMode = 'compact' | 'conversation' | 'focus'
