import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe, configureAxe } from 'vitest-axe'
import { WhyPanel } from '../../../../src/routes/templates/components/WhyPanel'
import type { ReportV1 } from '../../../../src/adapters/plot'

configureAxe({
  rules: {
    'color-contrast': { enabled: false }
  }
})

const mockReport: ReportV1 = {
  schema: 'report.v1',
  meta: { seed: 1337, response_id: 'test', elapsed_ms: 100 },
  model_card: { response_hash: 'hash', response_hash_algo: 'sha256', normalized: true },
  results: { conservative: 100, likely: 150, optimistic: 200 },
  confidence: { level: 'medium', why: 'test' },
  drivers: [{ label: 'Test driver', polarity: 'up', strength: 'high' }]
}

describe('WhyPanel A11y', () => {
  it('has no accessibility violations', async () => {
    const { container } = render(<WhyPanel report={mockReport} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
