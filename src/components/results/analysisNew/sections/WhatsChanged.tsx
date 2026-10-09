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
import { linkRowText } from '../runDeltaLinkWords'
import type { NoiseVerdict, RunDeltaFrame, RunDeltaInputRow, RunDeltaInputsView, RunDeltaMovement, RunDeltaView } from '../runDeltaView'
import { useCanvasStore } from '../../../../canvas/store'
import { selectWinShareWithheldReason, selectWinSharesWithheld } from '../../../../canvas/state/winShareGate'

export const WHATS_CHANGED_TESTID = 'analysis-new-whats-changed'

/**
 * Said when the producer sent no comparable pair for ANY option (an empty `win_probabilities`); shared with the canvas's
 * compact summary. ⛔ TRUE UNDER EVERY CAUSE THE EMPTY LIST HAS: the earlier Run's figures were withheld (R3 5936720411:
 * the investor moment, the first Run with figures, read "nothing to compare here"), the current Run's are withheld, or
 * the options do not match. It names no cause because the wire carries none yet (CANVAS 5936762171: 52f8cd adds a typed
 * reason; RC's "The options can be compared for the first time" then renders on `prior_withheld`).
 */
export const WHATS_CHANGED_NO_PAIRS = 'No option has figures from both runs to compare.'

/**
 * 0.70.0, RC's UNWITHHELD (contract RERUN-EXPLANATION): the earlier Run withheld its figures, so this is the FIRST
 * comparison. Said ONLY on the producer's typed `win_probabilities_unavailable === 'prior_withheld'`, never inferred from
 * an empty array; it claims no movement, because there were no earlier figures (`RX-NO-MOVEMENT-WITHOUT-PRIOR`).
 */
export const WHATS_CHANGED_FIRST_COMPARISON = 'The options can be compared for the first time.'

/**
 * `frame: 'versions'` twin of the same typed reason: the version compared FROM recorded no figures, so nothing is
 * compared. "For the first time" is a claim about Run order, which two saved versions do not have.
 */
export const WHATS_CHANGED_FROM_VERSION_WITHHELD =
  'The recorded result for the version compared from has no figures to compare.'

/**
 * ONE line in place of every per-option movement when the goal's direction or comparison changed between the pair
 * (`RunDeltaView.goalFramingChanged`). Science's words (github-d5, 5 Oct), frame-neutral ("results", not "runs"), so
 * it reads true for re-runs and saved versions. It fires ONLY on the goal's direction or comparison side; a changed
 * target figure with the same direction leaves shares comparable and keeps the verdicts.
 */
export const WHATS_CHANGED_GOAL_FRAMING_CHANGED =
  'These two results answer different questions: the goal’s direction changed between them, so each option’s share isn’t comparable. Compare results made with the same direction to see what changed.'

/** The sentence for an empty `win_probabilities`, by the producer's typed reason. */
export function noPairsText(view: Pick<RunDeltaView, 'winProbabilitiesUnavailable' | 'frame' | 'goalFramingChanged'>): string {
  if (view.goalFramingChanged) return WHATS_CHANGED_GOAL_FRAMING_CHANGED
  if (view.winProbabilitiesUnavailable !== 'prior_withheld') return WHATS_CHANGED_NO_PAIRS
  return view.frame === 'versions' ? WHATS_CHANGED_FROM_VERSION_WITHHELD : WHATS_CHANGED_FIRST_COMPARISON
}

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
  if (v === 'within_noise') return 'Too small to tell apart from ordinary run-to-run variation.'
  if (v === 'not_noise_qualified') return 'This pair gives no basis for saying whether that is a real difference.'
  return null
}

/** Why an option can be missing from the movements: only options in BOTH analyses have a pair (contract scope). */
export const MOVEMENT_SCOPE_TEXT = 'Only options that appear in both analyses are listed here.'

/** Which way one option's score went, in the words `movementText` uses for a direction-only movement. */
export function directionWords(m: Pick<RunDeltaMovement, 'direction'>, frame: RunDeltaFrame = 'rerun'): string {
  // "the same AS", never "the same than" (Acceptance #87 5996584359).
  if (m.direction !== 'up' && m.direction !== 'down') {
    return `scored the same ${frame === 'versions' ? 'as in the version compared from' : 'as last time'}`
  }
  const verb = m.direction === 'up' ? 'scored higher' : 'scored lower'
  return `${verb} ${frame === 'versions' ? 'than in the version compared from' : 'than last time'}`
}

/**
 * ONE option's movement in plain words, no figures (Compare's default read; the figures sit behind Result details).
 * The direction, then the producer's noise verdict verbatim: `signal` is the only verdict that may say the movement
 * is beyond ordinary run-to-run variation; the other two say exactly what `noiseQualifier` says.
 */
export function movementVerdictText(m: Pick<RunDeltaMovement, 'direction' | 'noiseVerdict'>): string {
  const direction = directionWords(m)
  const sentence = `${direction.charAt(0).toUpperCase()}${direction.slice(1)}`
  if (m.noiseVerdict === 'signal') return `${sentence}, beyond ordinary run-to-run variation.`
  return `${sentence}. ${noiseQualifier(m.noiseVerdict)}`
}

/**
 * ONE option's movement in words ("Option B: 41% → 55%"). Exported so the canvas's compact summary
 * (`graphChanges/RunChangesSummary`) says exactly what this section says, never a second phrasing.
 */
export function movementText(m: RunDeltaMovement, frame: RunDeltaFrame = 'rerun'): string {
  const name = m.label ?? (frame === 'versions' ? 'An option this result does not name' : 'An option this run does not name')
  // ⛔ `not_noise_qualified` IS DIRECTION ONLY. The contract: "reported as
  // direction only, never dressed as signal" — so the two numbers are withheld
  // rather than printed with a caveat, because a caveat under a precise figure
  // is read as precision.
  return m.mayShowMagnitude
    ? `${name}: ${pct(m.prior)} → ${pct(m.current)}`
    : `${name}: ${directionWords(m, frame)}`
}

/** What a person is told about ONE option's movement. */
function MovementLine({ m, sharedQualifier, frame }: { m: RunDeltaMovement; sharedQualifier: boolean; frame?: RunDeltaFrame }): JSX.Element {
  const body = movementText(m, frame)

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
/** Exported for the canvas's compact summary, so both surfaces say one thing. */
/** How a sizing literal reads, for a sizing change RC's contract has no sentence for (any other transition). */
export function inputRowText(row: RunDeltaInputRow): string {
  return inputRowTextForFrame(row, 'rerun')
}

function inputRowTextForFrame(row: RunDeltaInputRow, frame: RunDeltaFrame): string {
  const link = linkRowText(row, frame)
  if (link !== null) return link
  if (row.change === 'changed') return `${row.subject}: ${row.before} → ${row.after}`
  if (row.kind === 'option') return row.change === 'added' ? `${row.subject} joined the comparison` : `${row.subject} left the comparison`
  // AIQ #75 5918248701: a link added or removed is structure, not a value — say so, never "now on" / "now not set".
  if (row.kind === 'link') return row.change === 'added' ? `${row.subject} added to the model` : `${row.subject} removed from the model`
  if (row.change === 'added') return `${row.subject}: now ${row.after}`
  return `${row.subject}: ${row.before}, now not set`
}

/** The row's sentence in a given frame: the words the Compare tab's row layout (`InputChangeRows`) reads out. */
export function inputRowSentence(row: RunDeltaInputRow, frame: RunDeltaFrame = 'rerun'): string {
  return inputRowTextForFrame(row, frame)
}

/**
 * The Compare tab's link from a row to the canvas (CANVAS, lease DL #75 5920620752 / UNDO grant 5920635710).
 * Returns the row's focus action, `null` when nothing on the current canvas stands for it, or `undefined` when the
 * surface has no canvas link at all (the Reasoning receipt). The ids behind it are the row's own, never its key text.
 */
export type InputRowFocus = (row: RunDeltaInputRow) => (() => void) | null | undefined
/**
 * Hover / keyboard-focus lighting of the row's element on the canvas (CANVAS, DL #85 5939855664), by the same identity
 * as `InputRowFocus`. `null` = nothing on the canvas stands for the row, so nothing lights.
 */
export type InputRowLight = (row: RunDeltaInputRow) => { on: () => void; off: () => void } | null

/** `frame: 'versions'`: either saved version's recorded result may be the one without inputs, so neither is "earlier". */
export const INPUTS_NOT_RECORDED_TEXT_VERSIONS =
  'One of these recorded results did not record its inputs, so only the results are compared here.'
export const INPUTS_NOT_RECORDED_TEXT = 'The earlier run did not record its inputs, so only the result is compared here.'
/**
 * "Same input VALUES", not "same inputs" (DL 5936794868): a provenance-only change (an Accept of Olumi's estimate) leaves
 * every value equal and still changes the model, so "the same inputs" would be false on it. Until 52f8cd's typed row names
 * that change, this is the sentence that is true for both an identical rerun and an Accept.
 */
export const INPUTS_UNCHANGED_TEXT = 'Both runs used the same input values.'
export const INPUTS_PARTIAL_TEXT = 'Some inputs could not be compared between these two runs.'

/**
 * What an EMPTY input list means, by coverage — the one wording both this section and the canvas's compact summary use
 * (R3 5936613334: the canvas said "The inputs were not recorded" over a `complete` pair, a second phrasing that was false).
 * `null` when there are rows, or no input comparison at all (a pre-SC-24 delta: nothing is said).
 * ⛔ "Same inputs" is true ONLY on `complete` + no rows (AIQ 5921719917). On `partial` the producer could not compare
 * every input, so an empty list is NOT "nothing changed" — the partial line wins (served 4f61c322: an option-setting
 * edit read "Both runs used the same inputs", CANVAS 5921676745; DL re-balance 5921830092).
 */
export function emptyInputsText(inputs: RunDeltaInputsView | null, frame: RunDeltaFrame = 'rerun'): string | null {
  if (inputs === null) return null
  if (inputs.coverage === 'not_recorded') return frame === 'versions' ? INPUTS_NOT_RECORDED_TEXT_VERSIONS : INPUTS_NOT_RECORDED_TEXT
  if (inputs.rows.length > 0) return null
  return inputs.coverage === 'complete' ? INPUTS_UNCHANGED_TEXT : INPUTS_PARTIAL_TEXT
}

/**
 * The input rows of a run pair: Reasoning's own list, also mounted by the Compare tab, so the two surfaces show one
 * change list in one style. `flush`: the list opens its section (Compare), so it takes no top margin of its own.
 */
export function InputChanges({ inputs, rowFocus, rowLight, frame, flush = false }: { inputs: RunDeltaInputsView | null; rowFocus?: InputRowFocus; rowLight?: InputRowLight; frame?: RunDeltaFrame; flush?: boolean }): JSX.Element | null {
  const [expanded, setExpanded] = useState(false)
  if (inputs === null) return null
  const empty = emptyInputsText(inputs, frame)
  if (empty !== null) {
    const id = inputs.coverage === 'not_recorded' ? 'inputs-not-recorded' : inputs.coverage === 'complete' ? 'inputs-unchanged' : 'inputs-partial'
    return (
      <p className={`${typography.panelMeta} text-text-light ${flush ? 'mt-0' : 'mt-2'} mb-0`} data-testid={`${WHATS_CHANGED_TESTID}-${id}`}>
        {empty}
      </p>
    )
  }
  const shown = expanded ? inputs.rows : inputs.rows.slice(0, INPUT_ROWS_SHOWN_FIRST)
  return (
    <div className={flush ? undefined : 'mt-3'} data-testid={`${WHATS_CHANGED_TESTID}-inputs`} data-coverage={inputs.coverage}>
      <p className={`${typography.panelMeta} text-text-light m-0`} data-testid={`${WHATS_CHANGED_TESTID}-inputs-heading`}>Changed between the two runs</p>
      <ul className="list-none p-0 mt-1 mb-0 space-y-1">
        {shown.map((row) => {
          const focus = rowFocus?.(row)
          const light = focus ? rowLight?.(row) ?? null : null
          return (
            <li key={row.key} className={`${typography.panelBody} text-text m-0`} data-testid={`${WHATS_CHANGED_TESTID}-input-row`} data-entity-id={row.entityId} data-kind={row.kind} data-change={row.change} data-on-canvas={focus === undefined ? undefined : focus === null ? 'false' : 'true'}>
              {focus ? (
                <button
                  type="button"
                  className={`${action('inline')} text-left`}
                  data-testid={`${WHATS_CHANGED_TESTID}-input-row-focus`}
                  aria-label={`Show on the canvas: ${inputRowTextForFrame(row, frame ?? 'rerun')}`}
                  onClick={focus}
                  onMouseEnter={light?.on}
                  onMouseLeave={light?.off}
                  onFocus={light?.on}
                  onBlur={light?.off}
                >
                  {inputRowTextForFrame(row, frame ?? 'rerun')}
                </button>
              ) : (
                inputRowTextForFrame(row, frame ?? 'rerun')
              )}
              {/* A removed input already says it left; a changed one with nothing drawn says why a click does nothing. */}
              {focus === null && row.change !== 'removed' ? (
                <span className={`${typography.panelMeta} text-text-light`} data-testid={`${WHATS_CHANGED_TESTID}-input-row-off-canvas`}> · not on the canvas now</span>
              ) : null}
            </li>
          )
        })}
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

export function WhatsChanged({ view, rowFocus, rowLight }: { view: RunDeltaView | null; rowFocus?: InputRowFocus; rowLight?: InputRowLight }): JSX.Element | null {
  // ⭐⭐ WIN SHARES FOLLOW THE LEADER CLAIM (CURRENT-READ-v1 row 9; AIQ #75 5912710392). Every movement line is one
  // option's WIN SHARE, prior → current (or its direction). When the producer withheld the leader (any reason) a
  // per-option share change singles an option out in numbers, so the lines give way to the reason line, once, and
  // the leader-change line names no option. Comparability and the attribution limit stay. Read through
  // `winShareGate`; hooks sit above the early return. A PERMITTED run renders exactly as before.
  const currentWinSharesAreWithheld = useCanvasStore(selectWinSharesWithheld)
  const currentWinShareReasonLine = useCanvasStore(selectWinShareWithheldReason)
  // ⛔ ABSENCE RENDERS NOTHING — never an "everything is fine" arm. The producer
  // withholds the block for several reasons that all reach the client as one
  // silence, so there is no honest sentence to print here.
  if (!view) return null
  // Saved pairs are already qualified against BOTH bound Runs by the producer;
  // its delta omits unlicensed figures/IDs. Today's Run cannot override that pair.
  const winSharesAreWithheld = view.frame === 'versions' ? false : currentWinSharesAreWithheld
  const winShareReasonLine = view.frame === 'versions' ? null : currentWinShareReasonLine
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
      {inputsLead ? <InputChanges inputs={view.inputs} rowFocus={rowFocus} rowLight={rowLight} frame={view.frame} /> : null}

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
          {noPairsText(view)}
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
            <MovementLine key={m.optionId} m={m} sharedQualifier={shared !== null} frame={view.frame} />
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
          {MOVEMENT_SCOPE_TEXT}
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
            ? view.frame === 'versions'
              ? `Between these two results, the option with the highest score moved from ${view.leader.priorLabel} to ${view.leader.currentLabel}.`
              : `In this model, the option with the highest score moved from ${view.leader.priorLabel} to ${view.leader.currentLabel}.`
            : view.frame === 'versions'
              ? 'The option with the highest score is not the same one in these two results.'
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
      {inputsLead ? null : <InputChanges inputs={view.inputs} rowFocus={rowFocus} rowLight={rowLight} frame={view.frame} />}

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
