/**
 * Strengthen your model — copy (en-GB, sentence case, no em dashes).
 * All user-facing strings live here for the copy-hygiene scan.
 */
export const STRENGTHEN_COPY = {
  title: 'Strengthen your model',
  summary: (addressed: number, worth: number) => `${addressed} addressed · ${worth} worth checking`,
  showMore: (n: number) => `Show ${n} more`,
  showFewer: 'Show fewer',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  historyToggle: 'Show addressed and dismissed',
  historyHeading: 'Addressed or dismissed',
  historyEmpty: 'Nothing addressed yet.',
  empty: 'Nothing to strengthen right now.',
  staleLabel: 'From your last completed analysis',
  workThrough: 'Work through with Olumi',
  focusOnCanvas: 'Focus on canvas',
  notRelevant: 'Not relevant',
  markAddressed: 'Mark as addressed',
  reopenedPrefix: 'Reopened:',
  signalLabel: 'Signal:',
  whyLabel: 'Why:',
  tryLabel: 'Try this:',
} as const
