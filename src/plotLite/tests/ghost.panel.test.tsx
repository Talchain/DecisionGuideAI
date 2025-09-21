/// <reference types="vitest" />
import React from 'react'
import { expect, test } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { setGhost } from '../state'
import { GhostPanel } from '../GhostPanel'

// Ensure we start with clean state each test

test('renders a card for each draft', () => {
  setGhost({
    drafts: [
      {
        id: 'x',
        title: 'Raise Pro to £114',
        why: 'margin ↑',
        suggestion_confidence: 0.7,
        parse_json: {},
        parse_json_hash: 'h1',
        critique: [],
      },
    ],
  })
  const { getByText } = render(<GhostPanel />)
  expect(getByText(/Raise Pro to £114/)).toBeTruthy()
  cleanup()
  setGhost({ drafts: [] })
})
