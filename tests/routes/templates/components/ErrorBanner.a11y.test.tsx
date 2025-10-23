import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe, configureAxe } from 'vitest-axe'
import { ErrorBanner } from '../../../../src/routes/templates/components/ErrorBanner'
import type { ErrorV1 } from '../../../../src/adapters/plot'

configureAxe({
  rules: {
    'color-contrast': { enabled: false }
  }
})

describe('ErrorBanner A11y', () => {
  it('has no violations for BAD_INPUT', async () => {
    const error: ErrorV1 = { schema: 'error.v1', code: 'BAD_INPUT', error: 'Test' }
    const { container } = render(<ErrorBanner error={error} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })

  it('has no violations for RATE_LIMITED', async () => {
    const error: ErrorV1 = { schema: 'error.v1', code: 'RATE_LIMITED', error: 'Test', retry_after: 10 }
    const { container } = render(<ErrorBanner error={error} retryAfter={10} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})
