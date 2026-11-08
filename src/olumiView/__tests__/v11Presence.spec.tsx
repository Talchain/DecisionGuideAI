/**
 * V11 team presence (Paul, 6 Nov): the scenario's other members as initial discs in the header; names from core, the viewer marked
 * "(you)" as the Team tab words it; a click opens the Team tab. Bound by identity on a real View.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { TeamPresence } from '../TeamPresence'

const real: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', 'consulting-marks.view3.json'), 'utf8'))
const setView = (view: View | null) => useViewStore.setState({ uuid: '00000000-0000-4000-8000-a88ba245176e', sid: real.id, view, status: view ? 'ready' : 'none', error: null, stale: false, at: null })

beforeEach(() => setView(real))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('team presence in the header (real View)', () => {
  it('draws one disc per other member, each its own initial, in core’s order', () => {
    expect(real.members.map((m) => m.name)).toEqual(['Paul', 'Priya', 'Tom', 'Maya'])
    expect(real.you_id).toBe(real.members[3]!.id)
    render(<TeamPresence />)
    const discs = real.members.slice(0, 3).map((m) => screen.getByTestId(`team-presence-${m.id}`))
    expect(discs.map((d) => d.textContent)).toEqual(['P', 'P', 'T'])
    expect(screen.queryByTestId(`team-presence-${real.you_id}`)).toBeNull()
    expect(screen.getAllByTestId(/^team-presence-/)).toHaveLength(3)
  })

  it('names every member in core’s words, the viewer marked (you), without relying on colour', () => {
    render(<TeamPresence />)
    const btn = screen.getByRole('button', { name: /Paul, Priya, Tom, Maya \(you\)/ })
    expect(btn).toHaveAttribute('title', expect.stringContaining('Maya (you)'))
    expect(btn.getAttribute('title')).not.toContain('Paul (you)')
  })

  it('opens the Team tab on click', () => {
    const spy = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab').mockImplementation(() => {})
    render(<TeamPresence />)
    fireEvent.click(screen.getByRole('button', { name: /Maya \(you\)/ }))
    expect(spy).toHaveBeenCalledWith('team')
  })

  it('draws nothing with no View, or a scenario of one member', () => {
    setView(null)
    expect(render(<TeamPresence />).container).toBeEmptyDOMElement()
    cleanup()
    setView({ ...real, members: [real.members[3]!] })
    expect(render(<TeamPresence />).container).toBeEmptyDOMElement()
  })
})
