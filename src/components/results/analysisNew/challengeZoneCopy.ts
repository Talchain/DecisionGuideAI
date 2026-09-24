/**
 * Reasoning V2 — the words the "Challenge the thinking" zone adds, and ONLY
 * those. Every sentence that already has an owner is imported from it at the
 * call site (`ANALYSIS_NEW_COPY`, `STRENGTHEN_COPY`, the method catalogue), so
 * nothing here is a second spelling of an existing claim.
 *
 * ⚠ LABELS, NOT CLAIMS. Everything below names a control or a provenance
 * ("you chose this"). None of it says what the run found, which option is
 * ahead, or whether a technique applies here.
 */
export const CHALLENGE_ZONE_COPY = {
  /** V2 prototype's closed disclosure under the challenge (`challengeHTML`). */
  assumptionsAndEvidence: 'Assumptions and evidence',
  /** The drivers kicker. Not "What moves the outcome": that names the full section below it. */
  driversKicker: 'Top drivers',
  /** The card's one AI act: runs the existing intervention or method route. */
  workThrough: 'Work through this with Olumi',
  /** The overflow trigger's accessible name. */
  moreOptions: 'More options',
  /** Opens the grounded item's basis (why it was raised). */
  whyThis: 'Why this?',
  /** Retires the grounded item through the Strengthen lifecycle. */
  notUseful: 'Not useful right now',
  /**
   * The kicker over a method the reader picked themselves. Provenance only:
   * it says who chose it, never that it applies here.
   */
  methodYouChose: 'Method you chose',
  /** Row act: routes the row's subject to the Model tab. */
  inspectInModel: 'Inspect in Model',
  /** Row act: opens the ask drawer about this row. */
  askAboutThis: 'Ask Olumi about this',
  /**
   * Opens the reader's own inline note. A SECOND act beside the AI icon, not
   * a replacement for it: the icon is still the primary AI act (ruling
   * `c5806258826.md` §3); this is the reader's own words, sent through the
   * same existing ask route rather than a new write path.
   */
  respond: 'Respond',
  /** The inline field's accessible label. Never a composed question — the
   * heading above it already carries the producer's title verbatim. */
  respondLabel: 'Your thinking',
  respondPlaceholder: 'Your thinking…',
  respondCancel: 'Cancel',
  respondSend: 'Send',
} as const
