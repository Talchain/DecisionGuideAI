// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Canvas } from '@/whiteboard/Canvas'

function mountWithAPI(decisionId = 'style-doc') {
  let api: any = null
  const ui = <div style={{ width: 800, height: 600 }}><Canvas decisionId={decisionId} embedded onAPIReady={(a) => { api = a }} /></div>
  const utils = render(ui)
  return { api, ...utils }
}

describe('Canvas style panel attribute toggle', () => {
  it('sets data-dg-style-open on root and toggles via API', async () => {
    const { api, container } = mountWithAPI()
    const root = container.querySelector('[data-dg-style-open]') as HTMLElement | null
    expect(root).toBeTruthy()
    expect(root!.getAttribute('data-dg-style-open')).toBe('true')

    // Toggle closed
    api.setStyleOpen(false)
    expect(root!.getAttribute('data-dg-style-open')).toBe('false')

    // Toggle open
    api.toggleStyle()
    expect(root!.getAttribute('data-dg-style-open')).toBe('true')
  })
})
