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
import type { RunDeltaMovement, RunDeltaView } from '../runDeltaView'

export const WHATS_CHANGED_TESTID = 'analysis-new-whats-changed'

/**
 * A score, as a percentage.
 *
 * ⚠ ROUNDING FOR DISPLAY IS NOT COMPUTATION — it changes no claim, and the
 * producer's own value is carried unaltered in `data-prior` / `data-current` so
 * a reviewer can check the render against the wire.
 */
const pct = (v: number): string => `${Math.round(v * 100)}%`

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

  const qualifier =
    m.noiseVerdict === 'within_noise'
      ? 'Too small to tell apart from ordinary run-to-run movement.'
      : m.noiseVerdict === 'not_noise_qualified'
        ? 'This pair gives no basis for saying whether that is a real difference.'
        : null

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
      className={surface(view.attributable ? 'info' : 'neutral')}
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
        ⛔ THIS LINE NAMES NOBODY UNLESS BOTH IDS ARRIVED. The contract is
        explicit that an absent id means the producer is not entitled to make a
        claim on that side — never that no such option existed — and that a
        consumer must not name one.
      */}
      {view.leader?.changed ? (
        <p
          className={`${typography.panelMeta} text-text-light mt-2 mb-0`}
          data-testid={`${WHATS_CHANGED_TESTID}-highest-scoring`}
          data-may-name={view.leader.mayName ? 'true' : 'false'}
        >
          {view.leader.mayName && view.leader.priorLabel && view.leader.currentLabel
            ? `The option scoring highest moved from ${view.leader.priorLabel} to ${view.leader.currentLabel}.`
            : 'The option scoring highest is not the same one as last time.'}
        </p>
      ) : null}
    </section>
  )
}
