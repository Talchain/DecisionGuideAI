/**
 * ResultsLink — unit tests
 *
 * Verifies clicking triggers setActiveOutputTab with the correct tab value
 * for each inspector→results mapping.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResultsLink } from '../shared/ResultsLink'
import { useUIStore } from '../../../../stores/uiStore'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ResultsLink', () => {
  it('renders the label text', () => {
    render(<ResultsLink label="See all drivers" tab="results" />)
    expect(screen.getByText('See all drivers')).toBeTruthy()
  })

  it('factor → "See all drivers" sets activeOutputTab to "results"', () => {
    const spy = vi.spyOn(useUIStore.getState(), 'setActiveOutputTab')
    render(<ResultsLink label="See all drivers" tab="results" />)
    fireEvent.click(screen.getByText('See all drivers'))
    expect(spy).toHaveBeenCalledWith('results')
    spy.mockRestore()
  })

  it('option → "Compare all options" sets activeOutputTab to "compare"', () => {
    const spy = vi.spyOn(useUIStore.getState(), 'setActiveOutputTab')
    render(<ResultsLink label="Compare all options" tab="compare" />)
    fireEvent.click(screen.getByText('Compare all options'))
    expect(spy).toHaveBeenCalledWith('compare')
    spy.mockRestore()
  })

  it('goal → "View full results" sets activeOutputTab to "results"', () => {
    const spy = vi.spyOn(useUIStore.getState(), 'setActiveOutputTab')
    render(<ResultsLink label="View full results" tab="results" />)
    fireEvent.click(screen.getByText('View full results'))
    expect(spy).toHaveBeenCalledWith('results')
    spy.mockRestore()
  })

  it('outcome → "See all contributions" sets activeOutputTab to "results"', () => {
    const spy = vi.spyOn(useUIStore.getState(), 'setActiveOutputTab')
    render(<ResultsLink label="See all contributions" tab="results" />)
    fireEvent.click(screen.getByText('See all contributions'))
    expect(spy).toHaveBeenCalledWith('results')
    spy.mockRestore()
  })

  it('renders as a button element', () => {
    render(<ResultsLink label="Test" tab="results" />)
    const el = screen.getByText('Test')
    expect(el.tagName).toBe('BUTTON')
  })
})
