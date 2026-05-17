import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Light-weight stubs for the heavy real components so this test stays at the
// MOUNTING level — the goal is to assert which children the FF gate selects,
// not to exercise OutputsDock / DraftChat / AIPanelV2Layout internals.
vi.mock('../../components/OutputsDock', () => ({
  OutputsDock: () => <div data-testid="stub-outputs-dock" />,
}))
vi.mock('../../components/DraftChat', () => ({
  DraftChat: () => <div data-testid="stub-draft-chat" />,
}))
vi.mock('../AIPanelV2Layout', () => ({
  AIPanelV2Layout: () => <div data-testid="stub-ai-panel-v2" />,
}))
// PanelErrorBoundary is a thin wrapper; render its children directly so the
// assertions stay focused on the gating contract.
vi.mock('../../components/PanelErrorBoundary', () => ({
  PanelErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { RightPanelMount } from '../RightPanelMount'
import * as flags from '../../../flags'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('RightPanelMount — FF_AI_PANEL_V2 mounting contract', () => {
  it('FF off: legacy bottom chat + dock render, no AI panel v2', () => {
    vi.spyOn(flags, 'isAiPanelV2Enabled').mockReturnValue(false)
    render(<RightPanelMount />)
    expect(screen.getByTestId('stub-outputs-dock')).toBeInTheDocument()
    expect(screen.getByTestId('stub-draft-chat')).toBeInTheDocument()
    expect(screen.queryByTestId('stub-ai-panel-v2')).toBeNull()
  })

  it('FF on: AI panel v2 mounts; OutputsDock + DraftChat are NOT mounted by RightPanelMount', () => {
    // Updated contract (Fix 1): under FF on, AIPanelV2Layout owns the
    // entire right-panel surface and mounts <OutputsDock embedded />
    // internally. RightPanelMount must NOT also mount OutputsDock or
    // DraftChat — that would either double-mount the dock or leave the
    // legacy chat overlay around. Singleton invariant (correction #9)
    // requires exactly one OutputsDock and exactly one useConversation
    // surface; the embedded OutputsDock inside AIPanelV2Layout fulfills
    // the first; AIZone fulfills the second.
    vi.spyOn(flags, 'isAiPanelV2Enabled').mockReturnValue(true)
    render(<RightPanelMount />)
    expect(screen.queryByTestId('stub-outputs-dock')).toBeNull()
    expect(screen.getByTestId('stub-ai-panel-v2')).toBeInTheDocument()
    expect(screen.queryByTestId('stub-draft-chat')).toBeNull()
  })

  it('ReactFlowGraph mounts RightPanelMount (production wiring sanity check)', () => {
    // Belt-and-braces: ensure the production graph shell renders the
    // extracted component. Catches accidental inlining or removal that the
    // mounting tests above can't see because they render RightPanelMount
    // directly.
    const source = readFileSync(resolve(__dirname, '../../ReactFlowGraph.tsx'), 'utf8')
    expect(source).toMatch(/<RightPanelMount\s*\/>/)
    // Guard against the legacy inline shape coming back: if a future change
    // re-inlines OutputsDock or DraftChat directly into ReactFlowGraph, the
    // RightPanelMount FF gating is bypassed and this test fails fast.
    expect(source).not.toMatch(/<PanelErrorBoundary panel="Results">\s*<OutputsDock\s*\/>\s*<\/PanelErrorBoundary>/)
    expect(source).not.toMatch(/<PanelErrorBoundary panel="Draft Chat">\s*<DraftChat\s*\/>/)
  })
})
