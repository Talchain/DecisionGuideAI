/**
 * The "Assumptions and evidence" door's own words, from the V2 prototype's
 * `insightsHTML()` (`Olumi_Reasoning_Prototype_V2.html`, design audit B8).
 *
 * ⛔ NOTHING HERE SAYS ANYTHING ABOUT THE RUN. The kicker names the list, the
 * labels name what a control does. Every sentence about the run — a driver's
 * name, the gap's headline and detail — stays the view model's, verbatim.
 */
export const ASSUMPTIONS_DOOR_COPY = {
  /** The prototype's microheading over the ranked drivers. */
  kicker: 'Driver order in this model',
  /** The same list on a stale run: it is the LAST run's order, not the model's. */
  kickerStale: 'Last run · driver order',
  /** Tooltip + accessible name of a driver row's ✦. */
  askDriver: 'Ask Olumi why this driver matters',
  /** The editable draft that ✦ opens with: the user's question, not a claim. */
  askDriverDraft: (label: string): string => `Why does ${label} matter so much in this model?`,
  /** Tooltip on a driver's name, which opens its review. The name itself is the accessible name. */
  reviewDriver: 'Review this in the model',
  /** Tooltip + accessible name of the gap's ✦. */
  askGap: 'Ask Olumi how to investigate this',
  /** The text act under the gap that opens the assumption's review. */
  examine: 'Examine that assumption',
} as const
