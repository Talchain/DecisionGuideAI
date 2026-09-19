/**
 * THE BUNDLE CAN SAY WHAT THE CLIENT'S DELIVERY SCHEDULE DID.
 *
 * ## The gap, measured 19 Sep 2026
 *
 * A completed analysis did not reach a user and they ran it again. Walking that
 * failure needs one fact above all: **did the client's schedule arm, and did it
 * fire?** A real export was searched for every key matching
 * `provisional|delivery|poll|attempt|armed|schedule` — **zero hits.** The
 * schedule's outcome went to `logger.debug`, and `drop_console` removes that
 * from the production bundle, so on a deployed build no record existed at all.
 *
 * Two conclusions were drawn from that silence and both were wrong.
 *
 * ## The three states this distinguishes, which nothing could before
 *
 *   `null`              never armed this session
 *   `{ outcome: null }` armed and still running at export time
 *   `{ outcome: 'x' }`  armed and settled, with its verdict
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetDeliveryRecordForTest,
  readDeliveryRecord,
  recordDeliveryArmed,
  recordDeliverySettled,
} from '../provisionalDeliveryRecord'

const KEY = 'scenario-abc:2026-09-19T10:45:02.000Z'

beforeEach(() => __resetDeliveryRecordForTest())

describe('the client can say what its delivery schedule did', () => {
  it('⛔ NEVER ARMED reads as null — the state that was unanswerable', () => {
    expect(
      readDeliveryRecord(),
      'a bundle exported before any run must not imply an attempt',
    ).toBeNull()
  })

  it('⛔ ARMED BUT UNSETTLED is distinguishable from never armed', () => {
    recordDeliveryArmed(KEY)
    const r = readDeliveryRecord()
    expect(r, 'PRECONDITION: arming writes a record').not.toBeNull()
    expect(r!.run_key).toBe(KEY)
    expect(r!.outcome, 'still running — and that is a fact, not an absence').toBeNull()
    expect(r!.settled_at).toBeNull()
    expect(Date.parse(r!.armed_at), 'armed_at is a real timestamp').not.toBeNaN()
  })

  it('records the outcome verbatim when it settles', () => {
    recordDeliveryArmed(KEY)
    recordDeliverySettled(KEY, 'delivered')
    const r = readDeliveryRecord()!
    expect(r.outcome).toBe('delivered')
    expect(Date.parse(r.settled_at!)).not.toBeNaN()
    expect(r.armed_at, 'arming time survives settling').not.toBe('')
  })

  /**
   * ⛔ THE ARM THAT STOPS A LATE ABORT REWRITING HISTORY. The schedule runs up
   * to 130s; a run replaced mid-flight can settle AFTER its successor armed, and
   * attributing that outcome to the new run would make the record lie about the
   * run the user is actually looking at.
   */
  it('⛔ a settle for a superseded run is ignored', () => {
    recordDeliveryArmed(KEY)
    const NEXT = 'scenario-abc:2026-09-19T10:52:00.000Z'
    recordDeliveryArmed(NEXT)
    recordDeliverySettled(KEY, 'aborted')

    const r = readDeliveryRecord()!
    expect(r.run_key, 'the current run is the one that armed last').toBe(NEXT)
    expect(r.outcome, 'the stale outcome must not attach to it').toBeNull()
  })

  /**
   * ⚠ THE DISCRIMINATOR. Without it, an implementation that ignored EVERY
   * settle would satisfy the arm above.
   */
  it('⛔ and a settle for the CURRENT run is not ignored', () => {
    recordDeliveryArmed(KEY)
    recordDeliverySettled(KEY, 'delivered')
    expect(readDeliveryRecord()!.outcome).toBe('delivered')
  })

  it('keeps ONE record, not a history — a module that never unmounts must not grow', () => {
    recordDeliveryArmed('a:1')
    recordDeliveryArmed('b:2')
    recordDeliveryArmed('c:3')
    expect(readDeliveryRecord()!.run_key).toBe('c:3')
  })

  /**
   * ⛔ NO USER TEXT. This rides an exhaust channel that gets pasted into chats.
   * The record's whole shape is four fields and this pins that it stays four.
   */
  it('⛔ carries identifiers and timestamps only', () => {
    recordDeliveryArmed(KEY)
    recordDeliverySettled(KEY, 'delivered')
    expect(Object.keys(readDeliveryRecord()!).sort()).toEqual([
      'armed_at',
      'outcome',
      'run_key',
      'settled_at',
    ])
  })
})
