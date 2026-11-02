import { describe, it, expect, afterEach } from 'vitest'
import { scenarioPath, isV10Location } from '../v10'
import { withMethodPrefix } from '../V10MethodChips'

describe('v10 presentation (#/canvas2)', () => {
  afterEach(() => { window.location.hash = '' })

  it('keeps a v10 scenario in v10 after the first save, and leaves the current design unchanged', () => {
    window.location.hash = '#/canvas2'
    expect(isV10Location()).toBe(true)
    expect(scenarioPath('s1')).toBe('/canvas2/s1')
    window.location.hash = '#/canvas'
    expect(isV10Location()).toBe(false)
    expect(scenarioPath('s1')).toBe('/scenario/s1')
  })

  it('a method chip swaps only the prefix and keeps what the person wrote', () => {
    expect(withMethodPrefix('Challenge it: ', '')).toBe('Challenge it: ')
    expect(withMethodPrefix('Challenge it: ', 'the newsletter')).toBe('Challenge it: the newsletter')
    expect(withMethodPrefix('Outside view on: ', 'Challenge it: the newsletter')).toBe('Outside view on: the newsletter')
  })
})
