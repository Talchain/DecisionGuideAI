/**
 * Strengthen your model — copy (en-GB, sentence case, no em dashes).
 * All user-facing strings live here for the copy-hygiene scan.
 * Strings marked (spec) are verbatim from the build-ready v6 prototype copy deck.
 */
export const STRENGTHEN_COPY = {
  title: 'Strengthen your model',
  summary: (addressed: number, worth: number) => `${addressed} addressed · ${worth} worth checking`,
  showMore: (n: number) => `Show ${n} more`,
  showFewer: 'Show fewer',
  expandAll: 'Expand all',
  collapseAll: 'Collapse all',
  // Deliberate deviation from the prototype's icon-button aria ('Show
  // addressed recommendations'): the panel lists dismissed items too, so the
  // visible footer text-button names both honestly.
  historyToggle: 'Show addressed and dismissed',
  historyHeading: 'Addressed or dismissed', // (spec)
  historyEmpty: 'Nothing addressed yet.', // (spec)
  empty: 'No recommendations need attention right now.', // (spec)
  staleLabel: 'From your last completed analysis',
  workThrough: 'Work through this with Olumi', // (spec — ask icon-button title + aria-label)
  workThroughDraft: (title: string) => `Help me work through: ${title}`, // (spec — drawer prefill)
  focusOnCanvas: 'Focus on canvas', // (spec)
  notRelevant: 'Not relevant', // (spec)
  markAddressed: 'Mark as addressed',
  inProgressPill: 'In progress', // (spec — rec-state pill)
  reopenedPill: 'Reopened',
  reopenedPrefix: 'Reopened:',
  tryThisLead: 'Try this', // (spec — bold info lead-in, followed by a space + tip)
  dismissedNotice: 'Recommendation dismissed', // (spec — toast copy)
  undo: 'Undo',
  addressedNotice: 'Marked as addressed',
  focusFailedNotice: 'That element is no longer on the canvas',
} as const
