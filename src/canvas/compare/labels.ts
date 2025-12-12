// ============================================================================
// COMPARISON UX LABELS
// ============================================================================
//
// PURPOSE: Explicit, consistent labels for all comparison UX.
// This file is the single source of truth for comparison text.
//
// USAGE:
//   import { COMPARE_LABELS } from '@/canvas/compare/labels'
//
//   <label>{COMPARE_LABELS.runSlots.A}</label>  // "Run A"
//   <span>{COMPARE_LABELS.views.split}</span>   // "Side-by-Side"
// ============================================================================

/**
 * Labels for run selection slots
 */
export const RUN_SLOT_LABELS = {
  /** First run in comparison (left side) */
  A: 'Run A',
  /** Second run in comparison (right side) */
  B: 'Run B',
} as const

/**
 * Labels for comparison view modes
 */
export const VIEW_MODE_LABELS = {
  /** Side-by-side canvas view */
  split: 'Side-by-Side',
  /** Changes-only list view */
  changes: 'Changes Only',
} as const

/**
 * Labels for diff status badges
 */
export const DIFF_STATUS_LABELS = {
  added: 'added',
  removed: 'removed',
  modified: 'modified',
  unchanged: 'unchanged',
} as const

/**
 * Labels for comparison summary text
 */
export const SUMMARY_LABELS = {
  /** Header label for summary section */
  header: 'Summary:',
  /** Label for node diff count */
  nodes: 'Nodes:',
  /** Label for edge diff count */
  edges: 'Edges:',
  /** Label for top changes count */
  topChanges: 'Top changes:',
  /** Text when no changes detected */
  noChanges: 'No changes',
} as const

/**
 * Labels for comparison types (for analytics/logging)
 */
export const COMPARISON_TYPE_LABELS = {
  /** Compare two different analysis runs */
  runVsRun: 'run_vs_run',
  /** Compare current state vs snapshot */
  currentVsSnapshot: 'current_vs_snapshot',
  /** Compare two snapshots */
  snapshotVsSnapshot: 'snapshot_vs_snapshot',
} as const

export type RunSlot = keyof typeof RUN_SLOT_LABELS
export type ViewMode = keyof typeof VIEW_MODE_LABELS
export type DiffStatus = keyof typeof DIFF_STATUS_LABELS
export type ComparisonType = keyof typeof COMPARISON_TYPE_LABELS

/**
 * Consolidated labels export
 */
export const COMPARE_LABELS = {
  runSlots: RUN_SLOT_LABELS,
  views: VIEW_MODE_LABELS,
  diffStatus: DIFF_STATUS_LABELS,
  summary: SUMMARY_LABELS,
  types: COMPARISON_TYPE_LABELS,
} as const
