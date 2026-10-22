// @vitest-environment-options {"url": "https://staging--olumi.netlify.app/#/canvas"}
/**
 * On the core route (staging's default) no worksheet ever reaches the lens: the turn contract carries none, and Olumi's
 * failure stories land in the chat (served 22 Oct, CEE 381977c0: ask answered in chat, tool_calls [], lens still read "has
 * not imagined"). The lens never claims Olumi has not imagined it; it says where the stories arrive. Contrast: ?ai=conventional.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { LensInfoPanel } from '../LensInfoPanel'
import { useCanvasStore } from '../../store'

vi.mock('../../conversation/askAi', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../conversation/askAi')>()
  return { ...real, askAiStage: () => 'ran-current' as never }
})

describe('"If it failed" on the core route', () => {
  beforeEach(() => {
    localStorage.setItem('feature.graphLens', '1')
    useCanvasStore.setState({
      nodes: [{ id: 'o1', type: 'option', data: { label: 'Hire' }, position: { x: 0, y: 0 } }] as never,
      lens: { ...useCanvasStore.getState().lens, active: 'premortem' },
    } as never)
  })
  afterEach(() => {
    cleanup(); window.location.hash = '#/canvas'
    localStorage.removeItem('feature.graphLens')
    useCanvasStore.setState({ nodes: [] as never, lens: { ...useCanvasStore.getState().lens, active: 'full' } } as never)
  })

  it('never says Olumi has not imagined it; it says the stories arrive in the chat, and still offers the ask', () => {
    render(<LensInfoPanel />)
    const key = screen.getByTestId('premortem-not-yet')
    expect(key.textContent).not.toContain('has not imagined')
    expect(screen.getByTestId('premortem-in-chat').textContent).toBe('Olumi’s failure stories arrive in the chat.')
    expect(screen.getByTestId('premortem-ask')).toBeTruthy()
  })

  it('CONTRAST: ?ai=conventional, where a worksheet can come back, keeps its "not yet" line', () => {
    window.location.hash = '#/canvas?ai=conventional'
    render(<LensInfoPanel />)
    expect(screen.getByTestId('premortem-not-yet').textContent).toContain('Olumi has not imagined this model failing yet.')
    expect(screen.queryByTestId('premortem-in-chat')).toBeNull()
  })
})
