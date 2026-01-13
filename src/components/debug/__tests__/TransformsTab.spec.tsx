import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TransformsTab } from '../TransformsTab'

describe('TransformsTab', () => {
  it('shows fallback when neither stages nor transforms are available', () => {
    render(<TransformsTab trace={{ pipeline: { status: 'success' } }} />)
    expect(screen.getByText(/Detailed transform data requires CEE update/i)).toBeInTheDocument()
  })

  it('renders pipeline stages and expands stage details', () => {
    render(
      <TransformsTab
        trace={{
          pipeline: {
            status: 'success',
            stages: [
              { name: 'draft', status: 'success', duration_ms: 123, details: { a: 1 } },
              { name: 'validate', status: 'skipped', duration_ms: 0 },
            ],
            node_extraction: {
              raw: { decision: 1, goal: 1, option: 0 },
              normalised: { decision: 1, goal: 1, option: 0 },
              validated: { decision: 1, goal: 1, option: 0 },
            },
            transforms: [],
          },
        }}
      />
    )

    expect(screen.getByText('Pipeline Stages')).toBeInTheDocument()
    expect(screen.getByText('draft')).toBeInTheDocument()

    const viewButtons = screen.getAllByRole('button', { name: 'View Details' })
    fireEvent.click(viewButtons[0])

    expect(screen.getByText(/"a": 1/)).toBeInTheDocument()

    // transforms empty => "none"
    expect(screen.getByText('Transforms')).toBeInTheDocument()
    expect(screen.getByText('none')).toBeInTheDocument()

    // artefact chain uses node_extraction
    expect(screen.getByText(/Artefact Chain Summary/)).toBeInTheDocument()
    expect(screen.getByText(/Raw/)).toBeInTheDocument()
    expect(screen.getByText(/Validated/)).toBeInTheDocument()
  })
})
