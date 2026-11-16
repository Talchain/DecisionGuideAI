/** Codex 008e: a scenario that holds a kept idea, with no model and nothing pending, takes a MESSAGE (core's chat floor answers it in words),
 *  never a new brief that would start another scenario. Contrast: the same empty scenario with no kept idea still takes a brief. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../../../client'
import { takesBrief } from '../../../ViewChat'

const fixture = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session', `${n}.view3.json`), 'utf8'))
const empty = (v: View): View => ({ ...v, version: null, proposal: null, model: null, draft: null, chat: [] } as unknown as View)
const kept = [{ id: 7, turn: 3, text: 'Phone booked visitors first.', by: 'olumi', kept_by: { id: '1', name: 'Sam' }, at: '2026-11-16T12:00:00Z', concerns: [] }]

describe('takesBrief with kept ideas', () => {
  it('no model, nothing pending, a kept idea held: a message, not a brief', () => {
    expect(takesBrief('s_x', { ...empty(fixture('after-find-first')), kept } as unknown as View)).toBe(false)
  })
  it('contrast: the same empty scenario with no kept idea still takes a brief', () => {
    expect(takesBrief('s_x', empty(fixture('after-find-first')))).toBe(true)
    expect(takesBrief('s_x', { ...empty(fixture('after-find-first')), kept: [] } as unknown as View)).toBe(true)
  })
})
