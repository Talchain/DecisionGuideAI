/**
 * UI restore stage 1, rows 3 and 4 (DL ruling 10 Nov): a scenario waiting for its brief opens on the dock's rail with the welcome composer
 * on the canvas. The one rule both read (ViewWelcome.tsx awaitsBriefOf): decided only for the scenario on screen.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { awaitsBriefOf } from '../ViewWelcome'

const held: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'bakery.view.json'), 'utf8'))
const empty = { ...held, version: null, proposal: null } as View

describe('a scenario waiting for its brief', () => {
  it('a new scenario core holds nothing for (not yet named, or named) waits for its brief', () => {
    expect(awaitsBriefOf({ uuid: null, sid: null, view: null }, null)).toBe(true)
    expect(awaitsBriefOf({ uuid: 'u1', sid: null, view: null }, 'u1')).toBe(true)
  })
  it('a scenario core holds with no model and no proposal waits; one with a model does not', () => {
    expect(awaitsBriefOf({ uuid: 'u1', sid: 's_1', view: empty }, 'u1')).toBe(true)
    expect(held.version).not.toBeNull()
    expect(awaitsBriefOf({ uuid: 'u1', sid: 's_1', view: held }, 'u1')).toBe(false)
  })
  it('must not change: nothing is decided while the View held is another scenario\'s, or its own is not read yet', () => {
    expect(awaitsBriefOf({ uuid: 'u0', sid: null, view: null }, 'u1')).toBe(false)
    expect(awaitsBriefOf({ uuid: null, sid: null, view: null }, 'u1')).toBe(false)
    expect(awaitsBriefOf({ uuid: 'u1', sid: 's_1', view: null }, 'u1')).toBe(false)
  })
})
