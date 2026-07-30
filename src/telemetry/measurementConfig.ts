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

import { trackEvent } from '../lib/posthog'

export const MEASUREMENT_CONFIG = {
  /**
   * Which measures the testing window is scoped to. Informational — no code
   * branches on it. It exists so the scope is recorded next to the numbers that
   * implement it rather than in a document that drifts from them.
   */
  measuresInScope: ['M1', 'M2', 'M3', 'M5'] as const,

  /**
   * Participant tag — **DEPLOY-WIDE, EXACTLY ZERO OR ONE ENTRY.**
   *
   * ⚠ READ THIS BEFORE POPULATING IT. This is NOT a roster. There is no
   * per-session selection mechanism anywhere in the app: nothing maps a browser
   * session to one entry of a list. So the only meanings that exist are:
   *
   *   []            → untagged. The shipped state. `participant_tag` is null.
   *   ['P3']        → THIS DEPLOY tags every session 'P3'.
   *   ['P1','P2',…] → **NOT SUPPORTED.** There is nothing to choose between
   *                   them, so a list cannot silently "work".
   *
   * The natural reading of the word "vocabulary" is a roster, and acting on
   * that reading would run the whole testing window untagged with nothing red —
   * and per-participant attribution is UNRECOVERABLE after the window closes.
   * So `resolveParticipantTag()` FAILS LOUD on length > 1 rather than returning
   * null: it warns and emits a visible violation event. See below.
   *
   * Also: a tag is a pseudonym or it is identity. No names, no emails, no
   * initials — identity has its own deliberate channel (`posthog.identify`).
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

/** Emitted when `participantTags` is configured in a way that cannot work. */
export const MEASUREMENT_CONFIG_VIOLATION_EVENT = 'ui.measurement_config_violation'

/**
 * The participant tag to attach to `session_started`, or `null` when untagged.
 *
 * Reads the configured value only — it never derives a tag from the user, the
 * account, or the URL.
 *
 * ⚠ THIS USED TO RETURN `null` SILENTLY FOR ANY LENGTH OTHER THAN 1. That made
 * the single most likely misconfiguration — populating it as a roster,
 * `['P1'..'P8']` — indistinguishable from "deliberately untagged": no error, no
 * warning, a green build, and an entire testing window recorded with no
 * per-participant attribution. That attribution cannot be reconstructed
 * afterwards, so a silent failure here is not a degraded measurement, it is a
 * destroyed one.
 *
 * It now fails LOUD: a console warning plus a
 * `ui.measurement_config_violation` event carrying the COUNT (never the tags —
 * a tag is a pseudonym and the violation report is not a place to publish the
 * roster). It still returns null, because emitting an arbitrary element of a
 * list nobody can choose between would be worse than emitting nothing.
 *
 * Pinned by `src/telemetry/__tests__/measurementConfig.spec.ts`.
 */
export function resolveParticipantTag(): string | null {
  const tags = MEASUREMENT_CONFIG.participantTags
  if (tags.length === 1) return tags[0]
  if (tags.length > 1) {
    const message =
      `[measurement] participantTags has ${tags.length} entries. It is DEPLOY-WIDE and ` +
      'supports exactly 0 or 1 — there is no per-session selection mechanism, so a list ' +
      'cannot be applied. Every session in this deploy will be recorded UNTAGGED, and ' +
      'per-participant attribution is unrecoverable once the window closes. Set exactly ' +
      'one tag per deploy, or leave it empty deliberately.'
    try {
      console.warn(message)
    } catch {
      /* never break the app over a warning */
    }
    try {
      trackEvent(MEASUREMENT_CONFIG_VIOLATION_EVENT, {
        setting: 'participantTags',
        // COUNT ONLY. The tags themselves are pseudonyms, not diagnostics.
        configured_count: tags.length,
      })
    } catch {
      /* telemetry must never break the app */
    }
  }
  return null
}
