import { describe, it, expect, beforeEach, vi } from 'vitest'
import { adoptScenarioFromUrl } from '../scenarioFromUrl'

const ID = '815ae68b-9964-47de-bfcb-8b256e1287fa'
function loc(href: string) {
  return { href, replace: vi.fn() } as unknown as Location
}

describe('adoptScenarioFromUrl (experiment)', () => {
  beforeEach(() => localStorage.removeItem('olumi-canvas-current-scenario-id'))

  it('sets the app’s current-scenario key from ?olumi_scenario and reloads once, without the param', () => {
    const l = loc(`https://x--olumi.netlify.app/?olumi_scenario=${ID}#/canvas`)
    expect(adoptScenarioFromUrl(l)).toBe(true)
    expect(localStorage.getItem('olumi-canvas-current-scenario-id')).toBe(ID)
    expect(l.replace).toHaveBeenCalledWith('https://x--olumi.netlify.app/#/canvas')
  })

  it('does not reload when already current, and ignores anything that is not a uuid', () => {
    localStorage.setItem('olumi-canvas-current-scenario-id', ID)
    const same = loc(`https://x--olumi.netlify.app/?olumi_scenario=${ID}#/canvas`)
    expect(adoptScenarioFromUrl(same)).toBe(false)
    expect(same.replace).not.toHaveBeenCalled()
    const bad = loc('https://x--olumi.netlify.app/?olumi_scenario=../../etc#/canvas')
    expect(adoptScenarioFromUrl(bad)).toBe(false)
    expect(localStorage.getItem('olumi-canvas-current-scenario-id')).toBe(ID)
  })
})
