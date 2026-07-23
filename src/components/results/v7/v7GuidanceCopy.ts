/**
 * v7GuidanceCopy — all UI-authored copy for the V7 L6 surfaces: the
 * "What to do next" guidance list, the held-proposal card, and the
 * "Challenge your assumptions" bias section (V7 Lane L6).
 *
 * British English, sentence case, no all-caps, no em dashes in prose. Category
 * labels mirror the conversation GuidanceStrip verbatim (Must fix / Should fix
 * / Could fix / Technique) so the two surfaces cannot disagree about what a
 * producer `category` means. The model-limit caveat is the SAME sentence
 * V7SharpenLine ships, kept identical on purpose so the two honest-caveat
 * surfaces read as one voice.
 *
 * Copy only — no thresholds, no data, no inference lives here.
 */

/** The single model-limit caveat, shared verbatim with V7SharpenLine. */
export const V7_MODEL_LIMIT_CAVEAT =
  'Olumi can point to what the model implies, but not guarantee the real world behaves the same.'

export const V7_GUIDANCE_COPY = {
  guidance: {
    heading: 'What to do next',
    subtitle: 'Ordered by how much it matters.',
    /** Producer four-value category labels — verbatim GuidanceStrip wording. */
    categoryLabel: {
      must_fix: 'Must fix',
      should_fix: 'Should fix',
      could_fix: 'Could fix',
      technique: 'Technique',
    } as const,
    /** One item is shown open; the rest are counted behind this toggle. */
    showMore: (n: number) => `Show ${n} more`,
    showFewer: 'Show fewer',
    /** Honest action affordances (spec row 9). Each maps to ONE action type;
     * an unknown action type renders none of these (fail closed). */
    action: {
      focus: 'Focus',
      workThrough: 'Work through it',
      /** run_exercise — the label names the exercise the producer chose. */
      runExercise: (exercise: string) => {
        const name = exercise.replace(/_/g, ' ').trim()
        return name ? `Try a ${name}` : 'Try it'
      },
    },
  },

  proposal: {
    heading: 'Proposed change',
    /** Count of changes bundled in the proposal (≤3 shown, rest counted). */
    changesMore: (n: number) => `+${n} more`,
    /** The card is display only: the ONE live confirm lives on the chat card
     * that proposed the change (single-owner doctrine, UI PR #424). This label
     * points there — it is a pointer, never a second confirm. */
    reviewLabel: 'Review in chat',
    pointerNote: 'Confirm or dismiss this in the chat where it was proposed.',
    /** Shown when the proposal names an unresolved change count only. */
    changeCount: (n: number) => `${n} proposed ${n === 1 ? 'change' : 'changes'}`,
  },

  bias: {
    heading: 'Challenge your assumptions',
    subtitle: 'Thinking patterns worth a second look.',
    /** Micro-intervention effort, from the producer estimate. */
    minutes: (n: number) => `About ${n} min`,
    /** Precedes the micro_intervention.steps list. */
    stepsLabel: 'Try this',
  },
} as const
