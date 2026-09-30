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

import { useState } from 'react'
import { typography } from '../../../../styles/typography'
import { action, surface } from '../panelSurfaces'
import { INPUT_ROWS_SHOWN_FIRST } from '../runDeltaView'
import type { NoiseVerdict, RunDeltaInputRow, RunDeltaInputsView, RunDeltaMovement, RunDeltaView } from '../runDeltaView'
import { useCanvasStore } from '../../../../canvas/store'
import { selectWinShareWithheldReason, selectWinSharesWithheld } from '../../../../canvas/state/winShareGate'

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
function MovementLine({ m, sharedQualifier }: { m: RunDeltaMovement; sharedQualifier: boolean }): JSX.Element {
  const name = m.label ?? 'An option this run does not name'
  // ⛔ `not_noise_qualified` IS DIRECTION ONLY. The contract: "reported as
  // direction only, never dressed as signal" — so the two numbers are withheld
  // rather than printed with a caveat, because a caveat under a precise figure
  // is read as precision.
  const body = m.mayShowMagnitude
    ? `${name}: ${pct(m.prior)} → ${pct(m.current)}`
    : `${name}: ${m.direction === 'up' ? 'scored higher' : m.direction === 'down' ? 'scored lower' : 'scored the same'} than last time`

  const qualifier = sharedQualifier ? null : noiseQualifier(m.noiseVerdict)

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

/** One input row: "Pro price, Raise to £60: £59 → £60". Words only — the values are the producer's. */
function inputRowText(row: RunDeltaInputRow): string {
  if (row.change === 'changed') return `${row.subject}: ${row.before} → ${row.after}`
  if (row.kind === 'option') return row.change === 'added' ? `${row.subject} joined the comparison` : `${row.subject} left the comparison`
  if (row.change === 'added') return `${row.subject}: now ${row.after}`
  return `${row.subject}: ${row.before}, now not set`
}

function InputChanges({ inputs }: { inputs: RunDeltaInputsView | null }): JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  if (inputs === null) return null
  if (inputs.coverage === 'not_recorded') {
    return (
      <p className={`${typography.panelMeta} text-text-light mt-2 mb-0`} data-testid={`${WHATS_CHANGED_TESTID}-inputs-not-recorded`}>
        The earlier run did not record its inputs, so only the result is compared here.
      </p>
    )
  }
  if (inputs.rows.length === 0) {
    return (
      <p className={`${typography.panelMeta} text-text-light mt-2 mb-0`} data-testid={`${WHATS_CHANGED_TESTID}-inputs-unchanged`}>
        Both runs used the same inputs.
      </p>
    )
  }
  const shown = expanded ? inputs.rows : inputs.rows.slice(0, INPUT_ROWS_SHOWN_FIRST)
  return (
    <div className="mt-3" data-testid={`${WHATS_CHANGED_TESTID}-inputs`} data-coverage={inputs.coverage}>
      <p className={`${typography.panelMeta} text-text-light m-0`} data-testid={`${WHATS_CHANGED_TESTID}-inputs-heading`}>Changed between the two runs</p>
      <ul className="list-none p-0 mt-1 mb-0 space-y-1">
        {shown.map((row) => (
          <li key={row.key} className={`${typography.panelBody} text-text m-0`} data-testid={`${WHATS_CHANGED_TESTID}-input-row`} data-kind={row.kind} data-change={row.change}>
            {inputRowText(row)}
          </li>
        ))}
      </ul>
      {inputs.rows.length > INPUT_ROWS_SHOWN_FIRST ? (
        <button
          type="button"
          className={`${typography.panelMeta} ${action('inline')} mt-1`}
          data-testid={`${WHATS_CHANGED_TESTID}-inputs-toggle`}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show fewer' : `See all ${inputs.rows.length} changes`}
        </button>
      ) : null}
      {inputs.coverage === 'partial' ? (
        <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-testid={`${WHATS_CHANGED_TESTID}-inputs-partial`}>
          Some inputs could not be compared between these two runs.
        </p>
      ) : null}
    </div>
  )
}

export function WhatsChanged({ view }: { view: RunDeltaView | null }): JSX.Element | null {
  // ⭐⭐ WIN SHARES FOLLOW THE LEADER CLAIM (CURRENT-READ-v1 row 9; AIQ #75 5912710392). Every movement line is one
  // option's WIN SHARE, prior → current (or its direction). When the producer withheld the leader (any reason) a
  // per-option share change singles an option out in numbers, so the lines give way to the reason line, once, and
  // the leader-change line names no option. Comparability and the attribution limit stay. Read through
  // `winShareGate`; hooks sit above the early return. A PERMITTED run renders exactly as before.
  const winSharesAreWithheld = useCanvasStore(selectWinSharesWithheld)
  const winShareReasonLine = useCanvasStore(selectWinShareWithheldReason)
  // ⛔ ABSENCE RENDERS NOTHING — never an "everything is fine" arm. The producer
  // withholds the block for several reasons that all reach the client as one
  // silence, so there is no honest sentence to print here.
  if (!view) return null
  const leaderMayName = view.leader.mayName && !winSharesAreWithheld
  // Two or more rows with one producer verdict: its qualifier is said once.
  const verdicts = new Set(view.movements.map((m) => m.noiseVerdict))
  const shared =
    view.movements.length >= 2 && verdicts.size === 1 ? noiseQualifier(view.movements[0].noiseVerdict) : null
  const inputsLead = (winSharesAreWithheld || view.movementsUnavailable) && (view.inputs?.rows.length ?? 0) > 0

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

      {view.comparedWith ? (
        <p className={`${typography.panelMeta} text-text-light mt-1 mb-0`} data-testid={`${WHATS_CHANGED_TESTID}-compared-with`}>
          {view.comparedWith}
        </p>
      ) : null}

      {/*
        SC-24: WHAT CHANGED IN THE INPUTS — after the outcome, before the limit (result first, ChatGPT 5914416431).
        When no outcome can be shown (win shares withheld, or no option matched across the pair), the input rows lead
        instead, so the section never invents a result.
      */}
      {inputsLead ? <InputChanges inputs={view.inputs} /> : null}

      {winSharesAreWithheld ? (
        // Row 9: no per-option share change — the reason line in its place.
        <p
          className={`${typography.panelMeta} text-text-light mt-2 mb-0`}
          data-testid={`${WHATS_CHANGED_TESTID}-win-shares-withheld`}
        >
          {winShareReasonLine}
        </p>
      ) : view.movementsUnavailable ? (
        // ⚠ "NO COMPARABLE PAIR", NEVER "NOTHING MOVED". An empty list is the
        // producer saying it could not match any option across the two runs.
        <p
          className={`${typography.panelMeta} text-text-light mt-2 mb-0`}
          data-testid={`${WHATS_CHANGED_TESTID}-no-pairs`}
        >
          No option could be matched across these two analyses, so there is nothing to compare here.
        </p>
      ) : (
        <>
        {shared ? (
          <p className={`${typography.panelMeta} text-text-light mt-2 mb-0`} data-testid={`${WHATS_CHANGED_TESTID}-shared-qualifier`}>
            {shared}
          </p>
        ) : null}
        <ul className="list-none p-0 mt-2 mb-0 space-y-2" data-testid={`${WHATS_CHANGED_TESTID}-movements`}>
          {view.movements.map((m) => (
            <MovementLine key={m.optionId} m={m} sharedQualifier={shared !== null} />
          ))}
        </ul>
        </>
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
      {view.movements.length > 0 && !winSharesAreWithheld ? (
        <p
          className={`${typography.panelMeta} text-text-light mt-2 mb-0`}
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
          data-may-name={leaderMayName ? 'true' : 'false'}
          data-noise-verdict={view.leader.noiseVerdict}
        >
          {leaderMayName && view.leader.priorLabel && view.leader.currentLabel
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
      {inputsLead ? null : <InputChanges inputs={view.inputs} />}

      <p
        className={`${typography.panelBody} text-text mt-2 mb-0`}
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
    </section>
  )
}
