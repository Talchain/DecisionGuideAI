/**
 * THIN CLIENT — a signed-in browser keeps no local copy of the model.
 *
 * Each row that asserts "nothing written / nothing read" has its CONTRAST row first: the same call as a guest DOES
 * write and read, so a gate that never applied (or a storage mock that drops everything) cannot pass vacuously.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { __resetThinClientForTests, isThinClientSession, loadThinLayout } from '../thinClient'
import { clearAutosave, loadAutosave, saveAutosave, type AutosaveData } from '../../store/scenarios'
import { __resetPersistenceSessionForTests, setPersistenceSessionActive } from '../../../lib/persistenceSession'

const SESSION_KEY = 'sb-testproject-auth-token'
const MAIN_SLOT = 'olumi-canvas-autosave'

function slot(label: string): AutosaveData {
  return {
    timestamp: Date.now(),
    scenarioId: 'scenario-1',
    nodes: [{ id: 'n1', type: 'option', position: { x: 10, y: 20 }, data: { label } }],
    edges: [],
  } as unknown as AutosaveData
}

describe('thin client: the model is never written or read locally for a signed-in browser', () => {
  beforeEach(() => {
    localStorage.clear()
    clearAutosave()
    __resetThinClientForTests()
    __resetPersistenceSessionForTests()
  })

  it('CONTRAST — a guest (no stored session) still writes and reads the model slot', () => {
    expect(isThinClientSession()).toBe(false)
    saveAutosave(slot('Hire two'))
    expect(localStorage.getItem(MAIN_SLOT)).toContain('Hire two')
    expect(loadAutosave()?.nodes).toHaveLength(1)
    expect(loadThinLayout('scenario-1')).toBeNull()
  })

  it('a stored supabase-js session ⇒ the model slot is NOT written; only the layout is, by node id', () => {
    localStorage.setItem(SESSION_KEY, '{"access_token":"t","user":{"id":"u"}}')
    expect(isThinClientSession()).toBe(true)
    saveAutosave(slot('Hire two'))
    expect(localStorage.getItem(MAIN_SLOT)).toBeNull()
    expect(loadThinLayout('scenario-1')).toEqual({ n1: { x: 10, y: 20 } })
    // No label, value or link is in what this browser kept.
    expect(Object.values(localStorage).join('')).not.toContain('Hire two')
  })

  it("a stored session ⇒ a slot already in the browser (another account's, or pre-sign-in) is never read", () => {
    saveAutosave(slot('Account A model'))
    expect(loadAutosave()?.nodes).toHaveLength(1) // contrast: it is readable as a guest
    localStorage.setItem(SESSION_KEY, '{"access_token":"t"}')
    expect(loadAutosave()).toBeNull()
  })

  it('the published persistence session alone also makes the browser thin', () => {
    expect(isThinClientSession()).toBe(false)
    setPersistenceSessionActive(true)
    expect(isThinClientSession()).toBe(true)
  })

  it("supabase-js's PKCE verifier key is not a session", () => {
    localStorage.setItem('sb-testproject-auth-token-code-verifier', '"verifier"')
    expect(isThinClientSession()).toBe(false)
  })
})
