/**
 * The decision-record COMMIT body, 24 Sep 2026: a `position` ("Not ready to
 * choose") and the text fields as ADDITIVE request keys.
 *
 * ⭐ THE BACKWARDS-COMPATIBILITY CLAIM IS A BYTE CLAIM. An option commit that
 * uses none of the new fields must serialise to EXACTLY the pre-24-Sep string,
 * key order included, so a server that has never heard of the new keys sees
 * the request it has always seen. The golden string below is written out by
 * hand from the pre-change builder (`decisionRecordCommitService.ts` at base
 * 85070dd2, lines 151-162), not derived from the code under test.
 *
 * Each rule has its contrast: the same input WITH the new fields must carry
 * them, and a not-ready commit must carry no option, confidence or expectation.
 *
 * ⚠ RECONCILED 24 SEP 2026: THE REVISIT TEXT NOW ALSO TRAVELS AS
 * `revisit_trigger` (the key CEE stores the words from). So the byte claim is
 * made for an option commit with NO revisit text; with one, today's body is an
 * exact PREFIX and `revisit_trigger` is the only key appended.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({
  supabase: {},
  getSessionIdentity: vi.fn(async () => ({ userId: 'owner-1', accessToken: 'token-1' })),
}))

import {
  buildDecisionRecordCommitBody,
  commitDecisionRecord,
  DECISION_RECORD_TEXT_MAX_CHARS,
  type DecisionRecordCommitInput,
  type NotReadyCommitInput,
  type OptionCommitInput,
} from '../decisionRecordCommitService'

const SCENARIO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const TODAY_OPTION: OptionCommitInput = {
  scenarioId: SCENARIO_ID,
  chosenOptionId: 'opt_b',
  chosenOptionLabel: 'Hire senior technical lead',
  confidence0to100: 70,
  expectationStatement: 'Runway holds above 9 months through Q1.',
  revisitTriggerOrDate: '2026-12-01',
  clientCommitId: 'commit-1',
  expectedOwnerId: 'owner-1',
  isCurrentCapture: () => true,
}

/** TODAY_OPTION with no revisit text, and its pre-24-Sep body, byte for byte. */
const TODAY_OPTION_NO_REVISIT: OptionCommitInput = { ...TODAY_OPTION, revisitTriggerOrDate: undefined }
const TODAY_BODY_NO_REVISIT =
  '{"scenario_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","chosen_option_id":"opt_b",' +
  '"chosen_option_label":"Hire senior technical lead","confidence_0_100":70,' +
  '"expectation_statement":"Runway holds above 9 months through Q1.",' +
  '"client_commit_id":"commit-1"}'

/** The pre-24-Sep body for TODAY_OPTION, byte for byte. */
const TODAY_BODY =
  '{"scenario_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","chosen_option_id":"opt_b",' +
  '"chosen_option_label":"Hire senior technical lead","confidence_0_100":70,' +
  '"expectation_statement":"Runway holds above 9 months through Q1.",' +
  '"revisit_trigger_or_date":"2026-12-01","client_commit_id":"commit-1"}'

const NOT_READY: NotReadyCommitInput = {
  position: 'not_ready',
  scenarioId: SCENARIO_ID,
  revisitTriggerOrDate: 'When the market data lands',
  rationale: 'The options turn on a market we have not sized.',
  keyAssumption: 'Senior candidates are available this quarter.',
  nextAction: 'Size the senior hiring market by Friday.',
  clientCommitId: 'commit-2',
  expectedOwnerId: 'owner-1',
  isCurrentCapture: () => true,
}

type FetchMock = ReturnType<typeof vi.fn<Parameters<typeof fetch>, Promise<Response>>>
let fetchMock: FetchMock

function response(body: Record<string, unknown>, status: number): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response
}

async function sentBody(input: DecisionRecordCommitInput): Promise<string> {
  await commitDecisionRecord(input)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  return (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string
}

beforeEach(() => {
  fetchMock = vi.fn<Parameters<typeof fetch>, Promise<Response>>(async () =>
    response({ record_id: 'rec-1', review_date: '2026-12-01T00:00:00.000Z', review_date_source: 'user_set' }, 201),
  )
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the option commit is byte-identical when the new fields are unused', () => {
  it('⭐ with no revisit text, serialises to exactly the pre-24-Sep body', async () => {
    expect(await sentBody(TODAY_OPTION_NO_REVISIT)).toBe(TODAY_BODY_NO_REVISIT)
  })

  it('an explicit position of "option" is still not sent (absent means option)', async () => {
    expect(await sentBody({ ...TODAY_OPTION_NO_REVISIT, position: 'option' })).toBe(TODAY_BODY_NO_REVISIT)
  })

  it.each([
    ['empty', ''],
    ['whitespace', '   '],
  ])('%s new text fields are not sent', async (_label, blank) => {
    expect(
      await sentBody({ ...TODAY_OPTION_NO_REVISIT, rationale: blank, keyAssumption: blank, nextAction: blank }),
    ).toBe(TODAY_BODY_NO_REVISIT)
  })

  it('⭐ with a revisit text, today\'s body is an exact PREFIX and ONLY revisit_trigger is appended, carrying the same words', async () => {
    const raw = await sentBody(TODAY_OPTION)
    expect(raw).toBe(`${TODAY_BODY.slice(0, -1)},"revisit_trigger":"2026-12-01"}`)
  })
})

describe('CONTRAST: the new fields are sent when used, after today’s keys', () => {
  it('appends rationale, key_assumption, revisit_trigger and next_action, and leaves today’s keys untouched', async () => {
    const raw = await sentBody({
      ...TODAY_OPTION,
      rationale: 'Best current choice given hiring constraints.',
      keyAssumption: 'The hiring market stays open.',
      nextAction: 'Brief the board on Tuesday.',
    })
    expect(raw).not.toBe(TODAY_BODY)
    // Today's body is an exact PREFIX: nothing existing moved or changed.
    expect(raw.startsWith(TODAY_BODY.slice(0, -1) + ',')).toBe(true)
    const body = JSON.parse(raw) as Record<string, unknown>
    expect(Object.keys(body).slice(-4)).toEqual(['rationale', 'key_assumption', 'revisit_trigger', 'next_action'])
    expect(body.rationale).toBe('Best current choice given hiring constraints.')
    expect(body.key_assumption).toBe('The hiring market stays open.')
    expect(body.next_action).toBe('Brief the board on Tuesday.')
    expect('position' in body).toBe(false)
  })

  it('the revisit text travels under BOTH keys: the existing one (review date) and revisit_trigger (the stored words)', () => {
    const body = buildDecisionRecordCommitBody({
      ...TODAY_OPTION,
      revisitTriggerOrDate: 'When runway falls below 9 months',
    })
    expect(body.revisit_trigger_or_date).toBe('When runway falls below 9 months')
    expect(body.revisit_trigger).toBe('When runway falls below 9 months')
  })

  it('CONTRAST: no revisit text, no revisit_trigger key (never an empty string)', () => {
    for (const revisitTriggerOrDate of [undefined, '', '   ']) {
      const body = buildDecisionRecordCommitBody({ ...TODAY_OPTION, revisitTriggerOrDate })
      expect('revisit_trigger' in body).toBe(false)
    }
  })
})

describe('one bound for all four texts: CEE\'s 1000', () => {
  it('pins the bound CEE and @talchain/schemas 0.57.0 enforce', () => {
    expect(DECISION_RECORD_TEXT_MAX_CHARS).toBe(1000)
  })

  const TEXT_INPUTS: ReadonlyArray<readonly [string, (v: string) => Partial<OptionCommitInput>]> = [
    ['rationale', (v) => ({ rationale: v })],
    ['key_assumption', (v) => ({ keyAssumption: v })],
    ['next_action', (v) => ({ nextAction: v })],
    ['revisit_trigger', (v) => ({ revisitTriggerOrDate: v })],
  ]

  it.each(TEXT_INPUTS)('%s at exactly 1000 chars is sent', (wireKey, withText) => {
    const value = 'x'.repeat(DECISION_RECORD_TEXT_MAX_CHARS)
    const body = buildDecisionRecordCommitBody({ ...TODAY_OPTION, ...withText(value) })
    expect(body[wireKey]).toBe(value)
  })

  it.each(TEXT_INPUTS)('%s over 1000 chars is NOT sent (CEE would refuse the whole record), and the rest still goes', (wireKey, withText) => {
    const value = 'x'.repeat(DECISION_RECORD_TEXT_MAX_CHARS + 1)
    const body = buildDecisionRecordCommitBody({ ...TODAY_OPTION, ...withText(value) })
    expect(wireKey in body).toBe(false)
    expect(body.chosen_option_id).toBe('opt_b')
    expect(body.confidence_0_100).toBe(70)
  })

  it('an over-long revisit text still drives the review date (its existing key is unchanged)', () => {
    const value = 'x'.repeat(DECISION_RECORD_TEXT_MAX_CHARS + 1)
    const body = buildDecisionRecordCommitBody({ ...TODAY_OPTION, revisitTriggerOrDate: value })
    expect(body.revisit_trigger_or_date).toBe(value)
  })
})

describe('stored_text_fields — the ONLY licence for an account claim about a text', () => {
  it('passes CEE\'s confirmed fields through, in canonical order', async () => {
    fetchMock.mockResolvedValue(
      response({
        record_id: 'rec-1',
        review_date: '2026-12-01T00:00:00.000Z',
        review_date_source: 'user_set',
        stored_text_fields: ['next_action', 'rationale'],
      }, 201),
    )
    const result = await commitDecisionRecord(TODAY_OPTION)
    expect(result).toMatchObject({ status: 'saved', storedTextFields: ['rationale', 'next_action'] })
  })

  it('TODAY\'S CEE sends no list: nothing is confirmed', async () => {
    const result = await commitDecisionRecord(TODAY_OPTION)
    expect(result).toMatchObject({ status: 'saved', storedTextFields: [] })
  })

  it.each([
    ['unknown names', ['rationale', 'chosen_option_label', 'prediction']],
    ['a non-array', 'rationale'],
    ['null', null],
  ])('%s are never read as a confirmation', async (_label, raw) => {
    fetchMock.mockResolvedValue(
      response({ record_id: 'rec-1', review_date: '2026-12-01', review_date_source: 'user_set', stored_text_fields: raw }, 201),
    )
    const result = await commitDecisionRecord(TODAY_OPTION)
    if (result.status !== 'saved') throw new Error('expected saved')
    expect(result.storedTextFields).toEqual(Array.isArray(raw) ? ['rationale'] : [])
  })
})

describe('the not-ready commit', () => {
  it('sends the position and the reasoning text, and NO option, confidence or expectation', () => {
    const body = buildDecisionRecordCommitBody(NOT_READY)
    expect(body).toEqual({
      scenario_id: SCENARIO_ID,
      position: 'not_ready',
      revisit_trigger_or_date: 'When the market data lands',
      client_commit_id: 'commit-2',
      rationale: 'The options turn on a market we have not sized.',
      key_assumption: 'Senior candidates are available this quarter.',
      revisit_trigger: 'When the market data lands',
      next_action: 'Size the senior hiring market by Friday.',
    })
    for (const absent of ['chosen_option_id', 'chosen_option_label', 'confidence_0_100', 'expectation_statement']) {
      expect(absent in body).toBe(false)
    }
  })

  it('TODAY’S CEE answer (400 invalid_confidence) is reported as an error, never as saved', async () => {
    fetchMock.mockResolvedValue(
      response({ error: 'invalid_confidence', code: 'invalid_confidence', message: 'confidence_0_100 must be a number between 0 and 100 inclusive' }, 400),
    )
    const result = await commitDecisionRecord(NOT_READY)
    expect(result).toEqual({
      status: 'error',
      code: 'invalid_confidence',
      message: 'confidence_0_100 must be a number between 0 and 100 inclusive',
    })
  })

  it('CONTRAST: a server that accepts it returns saved with the record id', async () => {
    const result = await commitDecisionRecord(NOT_READY)
    expect(result).toMatchObject({ status: 'saved', recordId: 'rec-1' })
  })
})
