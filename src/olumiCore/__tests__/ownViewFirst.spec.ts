/**
 * Who owes their own view first is core's word (the View's `gated`, olumi.view/3): DGAI holds exactly whom core holds, and a View
 * without the field holds nobody. Rows from core's goldens, whose `gated` core wrote.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../../olumiView/client'
import { ownViewPending } from '../ownViewFirst'

const golden = (n: string) => JSON.parse(readFileSync(path.resolve(`src/olumiView/golden/${n}.view.json`), 'utf8')) as View

describe('own view first follows core', () => {
  it('a viewer core holds (whatif: Cy has given no view and did not write the brief)', () => expect(ownViewPending(golden('whatif'))).toBe(true))
  it('a viewer core does not hold (proposal: its viewer wrote the brief)', () => expect(ownViewPending(golden('proposal'))).toBe(false))
  it('a View without the field: nobody is held', () => {
    const v = golden('whatif') as unknown as Record<string, unknown>
    delete v.gated
    expect(ownViewPending(v as unknown as View)).toBe(false)
  })
})
