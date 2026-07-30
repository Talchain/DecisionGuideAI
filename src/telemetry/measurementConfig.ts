/**
 * measurementConfig — the ONE file that carries a human ruling as DATA.
 *
 * ROADMAP 1.68. Everything structural about the measurement seam is decided in
 * code and cannot be reshaped by the answers below: the event families, the
 * call sites, the event names, the closed payload schemas, the never-capture
 * list, the activation posture, and the four specs. What remains is a handful
 * of numbers and vocabularies, and they all live here so that changing the
 * ruling is a one-file data edit rather than a re-instrumentation.
 *
 * Values below are the measurement paper's own recommendations, used as
 * defaults. They are NOT a claim that the ruling has been made.
 *
 * ⚠ ONE THING THAT IS NOT A BUILD DEPENDENCY, recorded here because it is the
 * decision most likely to be mistaken for one: whether a WITHOUT-OLUMI baseline
 * session is wanted has ZERO instrumentation impact. It is session design.
 * Nothing in this module or `measurementEvents.ts` changes either way.
 */

export const MEASUREMENT_CONFIG = {
  /**
   * Which measures the testing window is scoped to. Informational — no code
   * branches on it. It exists so the scope is recorded next to the numbers that
   * implement it rather than in a document that drifts from them.
   */
  measuresInScope: ['M1', 'M2', 'M3', 'M5'] as const,

  /**
   * Participant-tag vocabulary. `[]` = untagged, which is the shipped state:
   * no tag is emitted, and `session_started.participant_tag` is `null`.
   *
   * ⚠ PARKED. Populating this is a deliberate act with a PII consequence, and
   * it is coupled to `participantTagsArePseudonymous` below. Do not populate it
   * with anything that identifies a person (no names, no emails, no initials) —
   * a tag is a pseudonym or it is identity, and identity has its own channel.
   */
  participantTags: [] as readonly string[],

  /**
   * Settles the `identifyUser` posture question. `true` asserts that whatever
   * appears in `participantTags` is a pseudonym with no standalone link to a
   * person.
   *
   * ⚠ This flag does NOT make `src/lib/posthog.ts`'s `identifyUser` safe by
   * itself — that function sends `email` and `display_name` on a separate,
   * deliberate PostHog channel (`posthog.identify`), and with pre-provisioned
   * tester accounts those are named individuals. That posture is a HUMAN
   * ruling and is PARKED, not decided here. Nothing in this file changes it.
   */
  participantTagsArePseudonymous: true,

  /**
   * Dwell-time bucket boundaries, in milliseconds. A raw millisecond dwell is
   * a high-resolution behavioural fingerprint; the bucket floor is the signal
   * the measures actually need. `bucketDwellMs` below is the only place the
   * boundaries are applied, so changing this array changes every dwell event
   * at once.
   */
  dwellBucketsMs: [1_000, 5_000, 15_000, 60_000] as readonly number[],

  /**
   * Top-N window for counting a resolve-next recommendation as "followed".
   * 3 = the user acted on any of the top three ranked factors; 1 = only the
   * leader counts.
   */
  convergenceRankWindow: 3,
} as const

/**
 * Bucket a raw dwell in ms down to the floor of its `dwellBucketsMs` band.
 *
 * Returns 0 for anything below the first boundary. Deliberately a floor, not a
 * label: a number keeps the event property arithmetic-friendly while carrying
 * no more resolution than the band.
 */
export function bucketDwellMs(rawMs: number): number {
  if (!Number.isFinite(rawMs) || rawMs <= 0) return 0
  let floor = 0
  for (const boundary of MEASUREMENT_CONFIG.dwellBucketsMs) {
    if (rawMs >= boundary) floor = boundary
    else break
  }
  return floor
}

/**
 * The participant tag to attach to `session_started`, or `null` when untagged.
 *
 * Reads the vocabulary only — it never derives a tag from the user, the
 * account, or the URL. An empty vocabulary means untagged, which is the
 * shipped state.
 */
export function resolveParticipantTag(): string | null {
  return MEASUREMENT_CONFIG.participantTags.length === 1
    ? MEASUREMENT_CONFIG.participantTags[0]
    : null
}
