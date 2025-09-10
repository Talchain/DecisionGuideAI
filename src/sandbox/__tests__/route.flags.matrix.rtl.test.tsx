// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderSandbox } from '@/test/renderSandbox'
import { SandboxRoute } from '@/sandbox/routes/SandboxRoute'

describe('SandboxRoute flag matrix', () => {
  it('Mounts legacy canvas when Strategy Bridge is off', async () => {
    renderSandbox(<SandboxRoute boardId="route-x" />, {
      sandbox: true,
      strategyBridge: false,
      realtime: false,
      voting: false,
    })
    const tablist = screen.queryByRole('tablist', { name: /Right panel tabs/i })
    expect(tablist).toBeNull()
  })

  it('Mounts three-panel shell when Strategy Bridge is on (tabs present)', async () => {
    renderSandbox(<SandboxRoute boardId="route-x" />, {
      sandbox: true,
      strategyBridge: true,
      realtime: false,
      voting: false,
    })
    const tablist = await screen.findByRole('tablist', { name: /Right panel tabs/i })
    expect(tablist).toBeTruthy()
    expect(screen.getByRole('tab', { name: /Goals & OKRs/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Intelligence/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Review/i })).toBeInTheDocument()
  })

  it('Voting badge present only when voting flag is on', async () => {
    // Off
    renderSandbox(<SandboxRoute boardId="route-x" />, {
      sandbox: true,
      strategyBridge: true,
      realtime: false,
      voting: false,
    })
    expect(screen.queryByText(/Collaborative Voting/i)).toBeNull()

    // On
    renderSandbox(<SandboxRoute boardId="route-x" />, {
      sandbox: true,
      strategyBridge: true,
      realtime: false,
      voting: true,
    })
    expect(screen.getByText(/Collaborative Voting/i)).toBeInTheDocument()
  })
})
