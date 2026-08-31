/**
 * optionComputeStatus — the narrowing and the predicate, pinned against the
 * PRODUCER'S DECLARED CONTRACT rather than against a capture.
 *
 * ## Why this file cannot be the live corpus, and why that is deliberate
 *
 * `optionComputeStatusDivergence.spec.ts` drives the twelve captured payloads
 * through the real mapper — and DERIVES, in its own assertions, that every
 * status the live wire has ever sent here is `'computed'`. So the corpus is
 * one-directional: it certifies that nothing real is suppressed, and certifies
 * NOTHING about `'failed'` or `'partial'`, because neither has ever arrived.
 *
 * That is a real gap, and the honest way to ship one is to pin it explicitly
 * rather than let a green suite imply coverage it does not have (trap 22f). So
 * this file covers the other direction from the only other authority available:
 * the producer's own DECLARATION.
 *
 *   · ISL `src/models/response_v2.py:405` — `status: Literal["computed",
 *     "partial", "failed"]`, a REQUIRED field on `OptionResultV2`.
 *   · ISL `src/utils/response_builder.py:92-110` — `determine_option_status`,
 *     the only producer of it: `n_valid === 0 → "failed"`; `ratio <
 *     MIN_VALID_RATIO (0.8) → "partial"`; otherwise `"computed"`.
 *   · PLoT `src/routes/v2/run.ts` (staging `d37c8cfd`) — `isCrownableCandidate`
 *     and `isFailedIslOption`, both of which treat an ABSENT status as the
 *     legacy V1 shape, i.e. as computed.
 *
 * Every expectation below names the producer statement it answers to. An
 * expectation written from my own reading of what a token OUGHT to mean would
 * be a perfect score on the wrong exam (trap 13c).
 *
 * ## ⚠ AND THE CLASS THE CONTRACT ADMITS BUT THE PRODUCER NEVER SENDS
 *
 * `@talchain/schemas` 0.48.0 types
 * `EnrichmentOptionComparisonEntrySchema.status` as a BARE
 * `z.ZodOptional<z.ZodString>` — NOT the enum its producer actually emits
 * (contrast its sibling `outcome.percentiles_source`, which the same file types
 * as a real `z.ZodEnum`). So an arbitrary string is a LEGAL payload, and a
 * corpus that omits a value class the contract admits cannot certify the code
 * over that class (trap 13d). The unknown-token cases below are that class.
 */

import { describe, it, expect } from 'vitest'
import {
  OPTION_COMPUTE_STATUSES,
  narrowOptionComputeStatus,
  narrowOptionComputeStatusReason,
} from '../../../adapters/plot/optionComputeStatus'
import {
  optionComputationFailed,
  optionComputationProducedResult,
} from '../utils/notAnalysedOptions'

describe('the vocabulary matches the PRODUCER’s declared Literal', () => {
  it('is exactly ISL’s three tokens, in the producer’s own order', () => {
    // ⭐ THE DRIFT ALARM. If PLoT/ISL ever add a fourth token, this list is what
    // has to change with it — and until it does, the mapper narrows the new
    // token to `undefined` and the option renders on the ordinary path. That is
    // the pre-existing behaviour rather than a new falsehood, but it is not the
    // honest one either, and this pin is where a reader is told so. A gap
    // recorded in the suite is honest; a gap invisible to it is how a
    // vocabulary silently goes short (trap 12: the hand-maintained mirror).
    expect([...OPTION_COMPUTE_STATUSES]).toEqual(['computed', 'partial', 'failed'])
  })
})

describe('narrowOptionComputeStatus — absent in, absent out', () => {
  it('passes each producer token through unchanged', () => {
    for (const token of OPTION_COMPUTE_STATUSES) {
      expect(narrowOptionComputeStatus(token)).toBe(token)
    }
  })

  it('narrows an UNRECOGNISED string to undefined — the class the contract admits', () => {
    // The bare `z.string()` class. Each of these is a legal payload under the
    // shared contract and none is a token the producer declares.
    for (const rogue of ['error', 'skipped', 'unavailable', 'COMPUTED', 'failed ', '']) {
      expect(narrowOptionComputeStatus(rogue), `${JSON.stringify(rogue)}`).toBeUndefined()
    }
    // ⚠ `'error'` and `'skipped'` are in this list for a reason recorded in
    // PLoT's own source: an exemption list there once named exactly those two
    // as per-option statuses, and PLoT's ROADMAP 2.744 note records that ISL
    // CANNOT EMIT THEM — they are ENVELOPE-level values — so nothing was ever
    // exempt and a whole run's comparison was discarded. They are the estate's
    // documented near-miss tokens, which is precisely why they must narrow away
    // here rather than be quietly accepted.
  })

  it('narrows every non-string to undefined', () => {
    for (const rogue of [undefined, null, 0, 1, true, false, {}, [], NaN]) {
      expect(narrowOptionComputeStatus(rogue)).toBeUndefined()
    }
  })
})

describe('narrowOptionComputeStatusReason — emptiness is absence', () => {
  it('carries a real sentence verbatim, trimmed', () => {
    expect(narrowOptionComputeStatusReason('  Analysis could not be completed  ')).toBe(
      'Analysis could not be completed',
    )
  })

  it('treats empty and whitespace-only as ABSENT, not as a reason', () => {
    // An empty string is absence wearing a present field's clothes — the same
    // rule `buildOptionsComparison` already applies to `storyHeadlines`.
    for (const empty of ['', '   ', '\n\t']) {
      expect(narrowOptionComputeStatusReason(empty)).toBeUndefined()
    }
    for (const nonString of [undefined, null, 0, {}, []]) {
      expect(narrowOptionComputeStatusReason(nonString)).toBeUndefined()
    }
  })
})

describe('the predicate — gated on the emitted value, never on falsiness', () => {
  it('FAILED is the only token that means "no usable result"', () => {
    // ISL `response_builder.py:103-104`: `if n_valid == 0: return "failed"`.
    // Zero finite samples ⇒ no distribution ⇒ nothing attached to the option is
    // a measurement.
    expect(optionComputationProducedResult('failed')).toBe(false)
    expect(optionComputationFailed('failed')).toBe(true)
  })

  it('PARTIAL is a DISCLOSURE and keeps its result', () => {
    // `0 < n_valid/n_total < 0.8`. The samples EXIST; ISL emits a full outcome
    // block and raises LOW_EFFECTIVE_SAMPLES alongside. A `status !==
    // 'computed'` predicate would swallow it and discard results ISL honestly
    // computed — this is the assertion that stops that being written.
    expect(optionComputationProducedResult('partial')).toBe(true)
    expect(optionComputationFailed('partial')).toBe(false)
  })

  it('COMPUTED keeps its result', () => {
    expect(optionComputationProducedResult('computed')).toBe(true)
  })

  it('ABSENT implies nothing and stays on the ordinary path', () => {
    // The legacy V1 shape (ISL's V1 `OptionResult` has no status field), and
    // also what the mapper produces for an out-of-vocabulary token. Matches
    // PLoT's `isCrownableCandidate`, which treats an absent status as computed —
    // a UI that classified the same option differently from the service that
    // crowned it would be a second authority on one question (trap 21).
    expect(optionComputationProducedResult(undefined)).toBe(true)
    expect(optionComputationFailed(undefined)).toBe(false)
  })

  it('the two spellings are ONE authority, not two', () => {
    // `optionComputationFailed` exists so the render forks read positively; it
    // must never become a second, drifting definition. Checked across the whole
    // domain the predicate can see, including absence.
    for (const status of [...OPTION_COMPUTE_STATUSES, undefined] as const) {
      expect(optionComputationFailed(status)).toBe(!optionComputationProducedResult(status))
    }
  })

  it('an unrecognised wire token reaches the predicate as ABSENT, and is not suppressed', () => {
    // The end-to-end shape of the trap-13d class: narrowing first, then the
    // predicate. A future PLoT token must not silently start suppressing
    // options — it renders on the ordinary path, exactly as before this change.
    expect(optionComputationProducedResult(narrowOptionComputeStatus('some_future_token'))).toBe(
      true,
    )
    // CONTRAST CONTROL in the same assertion pair: the real token still
    // suppresses. Without it, a narrowing that returned `undefined` for
    // EVERYTHING would pass the line above (trap 13e).
    expect(optionComputationProducedResult(narrowOptionComputeStatus('failed'))).toBe(false)
  })
})
