// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { renderSandbox } from '@/test/renderSandbox'
import CombinedSandboxRoute from '@/whiteboard/CombinedSandboxRoute'

// Note: This is a scaffold to ensure IDE alias resolution stays healthy.
// Marked skipped until Export Report feature is implemented under its own flag.

describe.skip('Export Report (scaffold)', () => {
  it('mounts CombinedSandboxRoute under sandbox flag (scaffold)', async () => {
    const ui = (
      <MemoryRouter initialEntries={["/decisions/demo/sandbox/combined"]}>
        <Routes>
          <Route path="/decisions/:decisionId/sandbox/combined" element={<CombinedSandboxRoute />} />
        </Routes>
      </MemoryRouter>
    )
    renderSandbox(ui, { sandbox: true })
    expect(true).toBe(true)
  })
})
