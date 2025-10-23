import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AppPoC from '../../src/poc/AppPoC'

describe('Navigation Dedupe', () => {
  it('renders exactly one bottom navigation', () => {
    render(
      <MemoryRouter initialEntries={['/#/canvas']}>
        <AppPoC />
      </MemoryRouter>
    )
    
    const navElements = screen.getAllByRole('navigation')
    expect(navElements).toHaveLength(1)
  })
})
