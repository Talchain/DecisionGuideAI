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
  /**
   * Per-row outcome lines. NAMED APART from `historyHeading` above, which is a
   * heading over a mixed list: a row states which of the two happened to THAT
   * recommendation, and a heading cannot do that for it.
   */
  historyDismissed: 'Set aside as not relevant.',
  historyAddressed: 'Addressed',
  /** Prefix on an objection carried onto the trail. The user's words follow. */
  historyDisputed: 'You disagreed',
  empty: 'No recommendations need attention right now.', // (spec)
  staleLabel: 'From your last completed analysis',
  workThrough: 'Work through this with Olumi', // (spec — ask icon-button title + aria-label)
  workThroughDraft: (title: string) => `Help me work through: ${title}`, // (spec — drawer prefill)
  focusOnCanvas: 'Focus on canvas', // (spec)
  notRelevant: 'Not relevant', // (spec)
  markAddressed: 'Mark as addressed',
  inProgressPill: 'In progress', // (spec — rec-state pill)
  reopenedPill: 'Reopened',
  // Stage 2 — honest severity badge labels (en-GB, sentence case). Rendered
  // ONLY from the producer's four-value `category`; absent = no badge. The
  // labels match the guidance-strip vocabulary so the surfaces read as one.
  severityLabel: {
    must_fix: 'Must fix',
    should_fix: 'Should fix',
    could_fix: 'Could fix',
    technique: 'Technique',
  } as const,
  reopenedPrefix: 'Reopened:',
  tryThisLead: 'Try this', // (spec — bold info lead-in, followed by a space + tip)
  dismissedNotice: 'Recommendation dismissed', // (spec — toast copy)
  undo: 'Undo',
  addressedNotice: 'Marked as addressed',
  focusFailedNotice: 'That element is no longer on the canvas',

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * ⭐⭐ THE SUCCEEDED STATE — the terminal state this panel did not have.
   * ─────────────────────────────────────────────────────────────────────────
   *
   * `empty` above is correct for a team that has been shown nothing, and it was
   * WRONG for a team that had worked through everything: "No recommendations
   * need attention right now" reads as *nothing was found* to someone who has
   * just addressed six things. The panel went quiet at the one moment it should
   * have had the most to say, and the trail that proves the work was folded
   * behind a collapsed toggle.
   *
   * ⚠ EVERY SENTENCE HERE IS A COUNT WE HOLD, NEVER A VERDICT WE DO NOT.
   * "Your reasoning looks solid" is the claim this deliberately does not make —
   * nobody measured it. Addressed and set-aside are counted APART because they
   * are different acts: setting a finding aside is a legitimate judgement and
   * is not the same as working through it, and one sentence covering both
   * would flatter the second into the first.
   */
  completedAllAddressed: (n: number) =>
    n === 1
      ? 'You have worked through the one finding Olumi raised.'
      : `You have worked through all ${n} findings Olumi raised.`,
  completedAllSetAside: (n: number) =>
    n === 1
      ? 'The one finding Olumi raised has been set aside.'
      : `All ${n} findings Olumi raised have been set aside.`,
  completedMixed: (addressed: number, setAside: number) =>
    `You have worked through ${addressed} of Olumi's findings and set aside ${setAside}.`,
  /**
   * ⭐ THE COACHING LINE, AND THE REASON THIS STATE EARNS ITS PLACE. An empty
   * findings list invites closure — the team reads silence as a clean bill of
   * health. Naming the limit of the instrument is the critical-thinking move
   * the panel exists to make, and it is a statement about OLUMI, which we can
   * make honestly, rather than about the model, which we cannot.
   */
  completedLimit:
    'Olumi raises what it can detect. Working through every finding is not the same as the model being right.',
  /**
   * The way out of a terminal state. It is the question the limit sentence
   * provokes, and it carries `challenge_assumption` — an accepted CEE intent —
   * so the ask arrives as decision science rather than as chat.
   */
  completedChallenge: 'Ask what this analysis might be missing',
  completedChallengeDraft:
    'What might this analysis be missing? Challenge the assumptions it rests on.',
} as const
