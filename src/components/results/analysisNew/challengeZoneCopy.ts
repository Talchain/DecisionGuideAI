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
  /** The overflow trigger's accessible name (V2 prototype: "Question options"). */
  moreOptions: 'Question options',
  /** Opens the item's basis (why it is here). V2 prototype menu wording. */
  whyThis: 'Why this question?',
  /**
   * Sets the item aside: a grounded finding through the Strengthen lifecycle,
   * a picked method by clearing the pick.
   */
  notUseful: 'Not useful right now',
  /**
   * The card with nothing to show (no finding to challenge, no method picked),
   * under a title that would otherwise stand over nothing but the door. An
   * instruction, not a claim about the run: the strip is directly above.
   */
  pickAMethod: 'Choose a method above to challenge the thinking.',
  /**
   * The title's ⓘ (V2 prototype `method-info`). It opens the same basis as
   * "Why this question?".
   */
  whyMethodHere: 'Why this method here?',
  /**
   * The AI act when a method is attached to the item (picked, or named by the
   * finding). An unattached finding keeps `workThrough`, because there is no
   * method to guide.
   */
  guideMethod: 'Ask Olumi to guide this method',
  /**
   * Follows the method's catalogue title in the basis (V2 prototype
   * `<Protocol>: a reasoning aid, not a prediction or diagnosis.`). It says
   * what a method IS, never that it applies to this model.
   */
  reasoningAid: 'a reasoning aid, not a prediction or diagnosis.',
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
  /**
   * The inline field's label when the producer sent no exercise (`tryThis`).
   * Never a composed question: the V2 prototype's labels are exercises
   * written about ITS example model, and no producer field carries one for a
   * picked method.
   */
  respondLabel: 'Your thinking',
  respondPlaceholder: 'Your thinking…',
  respondCancel: 'Cancel',
  /** The send act's name AND its visible label (V2 prototype `sendButton()`). */
  respondSend: 'Send to Olumi',
} as const
