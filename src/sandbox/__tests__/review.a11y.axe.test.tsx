// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { ReviewPanel } from '@/sandbox/panels/ReviewPanel'
import { ThemeProvider } from '@/contexts/ThemeContext'

// A11y smoke for Review panel

describe('ReviewPanel a11y', () => {
  it('has no obvious accessibility violations', async () => {
    const { container } = render(
      <ThemeProvider>
        <ReviewPanel decisionId="axe-review" />
      </ThemeProvider>
    )
    const results = await axe(container)
    expect(results.violations).toHaveLength(0)
  })
})
