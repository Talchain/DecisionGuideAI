/**
 * Who owes their own view first (PILOT-PACK 1.1): an invited member, in a team, with a model to be anchored by, who has not given,
 * skipped or had revealed a view in this round. Rows from core's whatif golden (Ada 1 made it; Bea 5 and Cy 18 were invited).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../../olumiView/client'
import { ownViewPending } from '../ownViewFirst'

const golden = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/whatif.view.json'), 'utf8')) as View
const bea = { ...golden, you_id: '5', you: 'Bea', collab: { ...golden.collab, shared: [], mine: [] } } as View
const INVITED = new Set(['5', '18'])

describe('own view first', () => {
  it('Bea, invited, nothing given: owes it', () => expect(ownViewPending(bea, INVITED)).toBe(true))
  it('Ada, whom nobody invited: does not', () => expect(ownViewPending({ ...bea, you_id: '1', you: 'Ada' } as View, INVITED)).toBe(false))
  it('invitations not read: decides nothing', () => expect(ownViewPending(bea, null)).toBe(false))
  it('alone in the scenario: nobody to be anchored against', () => expect(ownViewPending({ ...bea, collab: { ...bea.collab, alone: true } } as View, INVITED)).toBe(false))
  it('no model yet: nothing of Olumi\'s to anchor her', () => expect(ownViewPending({ ...bea, model: null } as View, INVITED)).toBe(false))
  it('skipped: does not', () => expect(ownViewPending({ ...bea, collab: { ...bea.collab, mine: [{ id: 4, text: '', shared: false, skip: true }] } } as View, INVITED)).toBe(false))
})
