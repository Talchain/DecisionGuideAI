/**
 * SourceProvenancePill — unit tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SourceProvenancePill } from '../SourceProvenancePill'

describe('SourceProvenancePill', () => {
  it('shows "From brief" for brief_extraction', () => {
    render(<SourceProvenancePill source="brief_extraction" />)
    expect(screen.getByText('From brief')).toBeInTheDocument()
  })

  it('shows "AI estimate" for cee_inference', () => {
    render(<SourceProvenancePill source="cee_inference" />)
    expect(screen.getByText('AI estimate')).toBeInTheDocument()
  })

  it('shows "User edited" for user', () => {
    render(<SourceProvenancePill source="user" />)
    expect(screen.getByText('User edited')).toBeInTheDocument()
  })

  it('shows "Not set" for undefined when showWhenAbsent=true (default)', () => {
    render(<SourceProvenancePill source={undefined} />)
    expect(screen.getByText('Not set')).toBeInTheDocument()
  })

  it('renders nothing for undefined when showWhenAbsent=false', () => {
    const { container } = render(<SourceProvenancePill source={undefined} showWhenAbsent={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('uses outlined pill pattern (bg-transparent)', () => {
    render(<SourceProvenancePill source="cee_inference" />)
    const pill = screen.getByText('AI estimate')
    expect(pill.className).toContain('bg-transparent')
  })

  it('uses info border for brief_extraction', () => {
    render(<SourceProvenancePill source="brief_extraction" />)
    const pill = screen.getByText('From brief')
    expect(pill.className).toContain('border-info/30')
  })

  it('uses warning border for cee_inference', () => {
    render(<SourceProvenancePill source="cee_inference" />)
    const pill = screen.getByText('AI estimate')
    expect(pill.className).toContain('border-warning/30')
  })

  it('uses success border for user', () => {
    render(<SourceProvenancePill source="user" />)
    const pill = screen.getByText('User edited')
    expect(pill.className).toContain('border-success/30')
  })
})
