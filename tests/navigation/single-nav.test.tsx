import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AppPoC from '../../src/poc/AppPoC'

describe('Navigation Dedupe', () => {
  it('renders exactly one bottom navigation', () => {
    // AppPoC already has HashRouter, don't wrap it again
    render(<AppPoC />)
    
    const navElements = screen.getAllByRole('navigation')
    expect(navElements).toHaveLength(1)
  })
})
