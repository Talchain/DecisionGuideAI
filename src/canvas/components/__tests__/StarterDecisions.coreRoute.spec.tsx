// @vitest-environment-options {"url": "https://staging--olumi.netlify.app/#/canvas"}
/**
 * On the core route (staging's default, #2914) the saved examples are not offered: every one is a scenario saved before
 * the living model, and the core route refuses its first Run (`legacy_scenario`, served 22 Oct). Contrast: the same empty
 * canvas on `?ai=conventional` still offers them.
 */
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('../../ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))

import { StarterDecisions } from '../StarterDecisions'
import { useCanvasStore } from '../../store'

describe('StarterDecisions on the core route', () => {
  beforeEach(() => { useCanvasStore.setState({ nodes: [], edges: [] }) })
  afterEach(() => { cleanup(); window.location.hash = '#/canvas' })

  it('a plain staging link (the core route) offers no saved example', () => {
    render(<StarterDecisions />)
    expect(screen.queryByTestId('starter-decisions')).toBeNull()
    expect(screen.queryByText('Open the example scenario')).toBeNull()
  })

  it('contrast: ?ai=conventional on the same empty canvas still offers them', () => {
    window.location.hash = '#/canvas?ai=conventional'
    render(<StarterDecisions />)
    expect(screen.getByTestId('starter-decisions')).toBeTruthy()
  })
})
