// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'
import { IntelligencePanel } from '@/sandbox/panels/IntelligencePanel'
import { ThemeProvider } from '@/contexts/ThemeContext'

// Simple a11y smoke to ensure structure is sane. No timers required.

describe('IntelligencePanel a11y', () => {
  it('has no obvious accessibility violations', async () => {
    const { container } = render(
      <ThemeProvider>
        <IntelligencePanel decisionId="axe-intel" />
      </ThemeProvider>
    )
    const results = await axe(container)
    expect(results.violations).toHaveLength(0)
  })
})
