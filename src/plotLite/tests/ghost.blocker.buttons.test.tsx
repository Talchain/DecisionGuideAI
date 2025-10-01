// @ts-nocheck
/// <reference types="vitest" />
import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import GhostPanel, { type Draft } from '../GhostPanel'

describe('GhostPanel BLOCKER action buttons', () => {
  it('renders Accept/Edit/Dismiss buttons only for BLOCKER items', () => {
    // Enable the Ghost panel flag
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: (k: string) => (k === 'feature.ghostPanel' ? '1' : null) },
      configurable: true,
    })

    const drafts: Draft[] = [
      {
        id: 'd1',
        critiques: [
          { severity: 'BLOCKER', items: [{ text: 'Crash on submit' }] },
          { severity: 'IMPROVEMENT', items: [{ text: 'Increase contrast' }] },
          { severity: 'OBSERVATION', items: [{ text: 'Good loading state' }] },
        ],
      },
    ]

    render(<GhostPanel drafts={drafts} />)

    // BLOCKER section contains buttons
    const blocker = screen.getByTestId('severity-BLOCKER')
    const btns = within(blocker).getAllByRole('button')
    const labels = btns.map((b) => b.textContent?.trim())
    expect(labels).toEqual(['Accept', 'Edit', 'Dismiss'])

    // IMPROVEMENT section has no buttons
    const improvement = screen.getByTestId('severity-IMPROVEMENT')
    expect(within(improvement).queryAllByRole('button').length).toBe(0)

    // OBSERVATION section has no buttons
    const observation = screen.getByTestId('severity-OBSERVATION')
    expect(within(observation).queryAllByRole('button').length).toBe(0)
  })
})
