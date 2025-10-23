import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe, configureAxe } from 'vitest-axe'
import { SummaryCard } from '../../../../src/routes/templates/components/SummaryCard'
import type { ReportV1 } from '../../../../src/adapters/plot'

configureAxe({
  rules: {
    'color-contrast': { enabled: false } // Disable canvas-dependent rule
  }
})

const mockReport: ReportV1 = {
  schema: 'report.v1',
  meta: { seed: 1337, response_id: 'test', elapsed_ms: 100 },
  model_card: { response_hash: 'sha256:abc123def456', response_hash_algo: 'sha256', normalized: true },
  results: { conservative: 120, likely: 150, optimistic: 180, units: 'percent', unitSymbol: '%' },
  confidence: { level: 'medium', why: 'Limited data available' },
  drivers: []
}

describe('SummaryCard A11y', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<SummaryCard report={mockReport} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })

  it('has no violations with hash copy action', async () => {
    const { container } = render(<SummaryCard report={mockReport} onCopyHash={() => {}} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
