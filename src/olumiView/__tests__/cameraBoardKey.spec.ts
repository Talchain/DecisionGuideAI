/**
 * Look defect 4 (Paul's look check, R5, via github-3c 5 Nov; shot 0-first-model-proposal on the R5 candidate: the question card's top at
 * y ≈ 25, under the lens bar, its words cut): the first model arrives as a pending proposal, "before version 1", with no version. The
 * lane's camera framed a board only per version id, so that board was never framed. It is framed per shown board: the version, else
 * the pending proposal. Fixtures: core's proposal golden (a proposal held on version 1) and the same View before any version.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { boardKeyOf } from '../camera'

const proposal: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'proposal.view.json'), 'utf8'))
const first: View = { ...proposal, version: null } // the first model: a proposal before version 1
const european: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'european.view.json'), 'utf8'))

describe('the camera frames each shown board', () => {
  it('the first model, a proposal before any version, has a board to frame', () => {
    expect([first.version, first.proposal?.id != null]).toEqual([null, true])
    expect(boardKeyOf('s_1', first)).toBe(`s_1:p${first.proposal!.id}`)
  })
  it('a version is framed by its id, as before (a proposal held on it does not move the camera)', () => {
    expect(boardKeyOf('s_1', proposal)).toBe(`s_1:v${proposal.version!.id}`)
    expect(boardKeyOf('s_1', european)).toBe(`s_1:v${european.version!.id}`)
  })
  it('CONTRAST: no scenario, no View, or nothing shown: no board', () => {
    expect([boardKeyOf(null, european), boardKeyOf('s_1', null), boardKeyOf('s_1', { ...first, proposal: null })]).toEqual(['', '', ''])
  })
})
