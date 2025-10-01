import { describe, it, expect, beforeEach } from 'vitest'
import { listScenarios, saveScenario, deleteScenario, getScenarioById, encodeScenarioToUrlParam, tryDecodeScenarioParam, type ScenarioV1 } from '../scenarios'

function clearLS() { try { localStorage.removeItem('scenarios.v1') } catch {} }

describe('scenarios store helpers', () => {
  beforeEach(() => { clearLS() })

  it('save → list → delete flow', () => {
    let items = listScenarios()
    expect(items.length).toBe(0)
    const rec: ScenarioV1 = { v: 1, id: 'demo-1', name: 'Demo', seed: '1234', budget: '1.0', model: 'gpt-4o-mini' }
    saveScenario(rec)
    items = listScenarios()
    expect(items.length).toBe(1)
    expect(getScenarioById('demo-1')?.name).toBe('Demo')
    deleteScenario('demo-1')
    items = listScenarios()
    expect(items.length).toBe(0)
  })

  it('encode/decode round-trip', () => {
    const param = encodeScenarioToUrlParam({ v: 1, name: 'Demo', seed: '1234', budget: '1.0', model: 'gpt-4o-mini' })
    const dec = tryDecodeScenarioParam(param)
    expect(dec?.name).toBe('Demo')
    expect(dec?.seed).toBe('1234')
    expect(dec?.budget).toBe('1.0')
    expect(dec?.model).toBe('gpt-4o-mini')
  })

  it('invalid base64 returns null', () => {
    const dec = tryDecodeScenarioParam('!not-base64!')
    expect(dec).toBeNull()
  })
})
