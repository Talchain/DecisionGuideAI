/**
 * "What's changed" — the run-over-run consequence, on the Reasoning tab.
 *
 * ⭐⭐ IT RENDERS TWO CLAIMS AND KEEPS THEM APART, because they answer different
 * questions and the producer constrains only one of them:
 *
 *   COMPARABILITY (`attribution_case`) — were these two analyses worked out on a
 *     basis that lets you compare them, and may the difference be put down to
 *     what you changed?
 *   MOVEMENT (`win_probabilities`) — what actually moved, and is the movement
 *     bigger than the run-to-run noise?
 *
 * Fusing them is the defect this surface was rewritten to avoid: all three of
 * `C0_identical` with differing scores, `C1_attributable` with no movement, and
 * `C2_unpaired` with identical scores PARSE against the installed schema, so no
 * sentence may derive one from the other. `runDeltaView.ts` carries the full
 * account.
 *
 * ⚠ NOTHING HERE COMPUTES. Every number and every tag is the producer's; this
 * file chooses words and renders them.
 */

import { typography } from '../../../../styles/typography'
import { surface } from '../panelSurfaces'
import type { NoiseVerdict, RunDeltaMovement, RunDeltaView } from '../runDeltaView'

export const WHATS_CHANGED_TESTID = 'analysis-new-whats-changed'

/**
 * A score, as a percentage.
 *
 * ⚠ ROUNDING FOR DISPLAY IS NOT COMPUTATION — it changes no claim, and the
 * producer's own value is carried unaltered in `data-prior` / `data-current` so
 * a reviewer can check the render against the wire.
 */
const pct = (v: number): string => `${Math.round(v * 100)}%`

/**
 * ⭐⭐ THE NOISE TAG, TURNED INTO WORDS — ONE FUNCTION, BECAUSE THERE ARE TWO
 * SENTENCE SITES AND THE SECOND ONE SHIPPED WITHOUT IT.
 *
 * `MovementLine` read `noise_verdict` correctly from the first draft. The LEADER
 * line, three elements further down, was gated on `changed` ALONE and never read
 * the verdict at all — so it stated a definite change of the highest-scoring
 * option as fact. That is not a corner case: CEE hardcodes `not_noise_qualified`
 * as the leader's verdict at its only assignment (`build-run-delta.ts:508`), with
 * its own note that this state means "no honest band exists for this quantity on
 * this pair, rendered as direction only". So on 100% OF EMISSIONS TODAY the
 * product asserted a leadership change the producer had explicitly declined to
 * qualify.
 *
 * ⚠ The three states are "deliberately never collapsible — a consumer renders the
 * tag verbatim". Keeping the mapping in ONE place is what stops a third sentence
 * site being added later without it.
 */
export function noiseQualifier(v: NoiseVerdict): string | null {
  if (v === 'within_noise') return 'Too small to tell apart from ordinary run-to-run movement.'
  if (v === 'not_noise_qualified') return 'This pair gives no basis for saying whether that is a real difference.'
  return null
}

/** What a person is told about ONE option's movement. */
function MovementLine({ m }: { m: RunDeltaMovement }): JSX.Element {
  const name = m.label ?? 'An option this run does not name'
  // ⛔ `not_noise_qualified` IS DIRECTION ONLY. The contract: "reported as
  // direction only, never dressed as signal" — so the two numbers are withheld
  // rather than printed with a caveat, because a caveat under a precise figure
  // is read as precision.
  const body = m.mayShowMagnitude
    ? `${name}: ${pct(m.prior)} → ${pct(m.current)}`
    : `${name}: ${m.direction === 'up' ? 'scored higher' : m.direction === 'down' ? 'scored lower' : 'scored the same'} than last time`

  const qualifier = noiseQualifier(m.noiseVerdict)

  return (
    <li
      className={`${typography.panelBody} text-text m-0`}
      data-testid={`${WHATS_CHANGED_TESTID}-movement`}
      data-option-id={m.optionId}
      data-noise-verdict={m.noiseVerdict}
      data-prior={m.prior}
      data-current={m.current}
    >
      {body}
      {qualifier ? (
        <span className={`${typography.panelMeta} text-text-light block`}>{qualifier}</span>
      ) : null}
    </li>
  )
}

export function WhatsChanged({ view }: { view: RunDeltaView | null }): JSX.Element | null {
  // ⛔ ABSENCE RENDERS NOTHING — never an "everything is fine" arm. The producer
  // withholds the block for several reasons that all reach the client as one
  // silence, so there is no honest sentence to print here.
  if (!view) return null

  return (
    <section
      /*
        ⛔⛔ A CONSTANT TONE, AND THE REASON IS THE SEPARATION THIS FILE EXISTS FOR.
        This was `surface(view.attributable ? 'info' : 'neutral')` — PART A
        choosing the tone of the container that ENCLOSES PART B. This repo's own
        dictionary makes that a claim: `panelSurfaces.ts` defines `neutral` as
        "No claim. The default for a box that groups without judging." and `info`
        as "Worth stopping on."

        So `C2_unpaired` carrying three producer-certified `signal` movements was
        framed "no claim", and `C1_attributable` with an empty movement list was
        framed "worth stopping on". The prose kept the two statements apart and
        the STYLING fused them — the one channel a prose guard cannot see.

        `neutral` is correct here on its own terms: this box groups two
        independent statements and judges neither.
      */
      className={surface('neutral')}
      data-testid={WHATS_CHANGED_TESTID}
      data-attributable={view.attributable ? 'true' : 'false'}
      role="status"
      aria-labelledby={`${WHATS_CHANGED_TESTID}-title`}
    >
      <h3 id={`${WHATS_CHANGED_TESTID}-title`} className={`${typography.panelHeader} text-text m-0`}>
        What&rsquo;s changed
      </h3>

      <p
        className={`${typography.panelBody} text-text mt-1.5 mb-0`}
        data-testid={`${WHATS_CHANGED_TESTID}-comparability`}
      >
        {view.comparability}
      </p>

      {view.attributionLimit ? (
        <p
          className={`${typography.panelBody} text-text mt-1 mb-0`}
          data-testid={`${WHATS_CHANGED_TESTID}-attribution-limit`}
        >
          {view.attributionLimit}
        </p>
      ) : null}

      {view.movementsUnavailable ? (
        // ⚠ "NO COMPARABLE PAIR", NEVER "NOTHING MOVED". An empty list is the
        // producer saying it could not match any option across the two runs.
        <p
          className={`${typography.panelMeta} text-text-light mt-2 mb-0`}
          data-testid={`${WHATS_CHANGED_TESTID}-no-pairs`}
        >
          No option could be matched across these two analyses, so there is nothing to compare here.
        </p>
      ) : (
        <ul className="list-none p-0 mt-2 mb-0 space-y-1.5" data-testid={`${WHATS_CHANGED_TESTID}-movements`}>
          {view.movements.map((m) => (
            <MovementLine key={m.optionId} m={m} />
          ))}
        </ul>
      )}

      {/*
        ⛔ A PARTIAL LIST READ AS A COMPLETE ONE IS A CLAIM ABOUT THE OPTIONS THAT
        ARE NOT IN IT. The producer builds `win_probabilities` from options it
        could match across BOTH runs, so an option that exists in only one of them
        is absent BY CONSTRUCTION — and the surface previously represented
        "movement unknown" only at whole-array grain (`movements.length === 0`).
        A list of two options out of three therefore said nothing about the third
        while looking exhaustive.

        ⚠ This line states the SCOPE rather than counting the gap. Naming which
        options are missing needs the current option set, which this module is
        deliberately not given — and a count derived here would be the
        client-side computation the contract forbids. The scope is always true
        and removes the false implication without inventing a number.
      */}
      {view.movements.length > 0 ? (
        <p
          className={`${typography.panelMeta} text-text-light mt-1.5 mb-0`}
          data-testid={`${WHATS_CHANGED_TESTID}-movement-scope`}
        >
          Only options that appear in both analyses are listed here.
        </p>
      ) : null}

      {/*
        ⛔ THIS LINE NAMES NOBODY UNLESS BOTH IDS ARRIVED. The contract is
        explicit that an absent id means the producer is not entitled to make a
        claim on that side — never that no such option existed — and that a
        consumer must not name one.
      */}
      {view.leader.changed ? (
        <p
          className={`${typography.panelMeta} text-text-light mt-2 mb-0`}
          data-testid={`${WHATS_CHANGED_TESTID}-highest-scoring`}
          data-may-name={view.leader.mayName ? 'true' : 'false'}
          data-noise-verdict={view.leader.noiseVerdict}
        >
          {view.leader.mayName && view.leader.priorLabel && view.leader.currentLabel
            ? `In this model, the option with the highest score moved from ${view.leader.priorLabel} to ${view.leader.currentLabel}.`
            : 'In this model, the option with the highest score is not the same one as last time.'}
          {/*
            ⛔ THE QUALIFIER IS NOT OPTIONAL DECORATION — IT IS WHAT MAKES THE
            SENTENCE ABOVE TRUE. Without it this states a leadership change as
            settled fact on every emission CEE produces today.
          */}
          {noiseQualifier(view.leader.noiseVerdict) ? (
            <span className={`${typography.panelMeta} text-text-light block`}>
              {noiseQualifier(view.leader.noiseVerdict)}
            </span>
          ) : null}
        </p>
      ) : null}
    </section>
  )
}
