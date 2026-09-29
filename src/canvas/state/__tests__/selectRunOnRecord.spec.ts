/**
 * `selectRunOnRecord` — the server's run state says whether this scenario has been Run (P0 Shared Data builder, #72
 * 5890601642). Only a COMPLETED Run counts, current or overtaken by an edit.
 */
import { describe, it, expect } from 'vitest'
import { selectRunOnRecord } from '../analysisStateSelector'

const at = (kind: string) => ({ run_state: { kind } }) as never

describe('selectRunOnRecord', () => {
  it.each([
    ['complete_current', true],
    ['complete_stale', true],
    ['never_run', false],
    ['running', false],
    ['failed', false],
  ])('%s → %s', (kind, expected) => {
    expect(selectRunOnRecord(at(kind))).toBe(expected)
  })
  it('no verdict, or one without a run state → false', () => {
    expect(selectRunOnRecord(null)).toBe(false)
    expect(selectRunOnRecord(undefined)).toBe(false)
    expect(selectRunOnRecord({} as never)).toBe(false)
  })
})
