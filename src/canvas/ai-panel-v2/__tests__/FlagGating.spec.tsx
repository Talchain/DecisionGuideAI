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

  it('FF on: AI panel v2 mounts; DraftChat is hidden (singleton contract)', () => {
    // Step 2-4 contract: under FF on, AIZone owns the conversation. DraftChat
    // is unmounted so exactly one `useConversation()` instance is active —
    // satisfies the approved plan's singleton checkpoint (correction #9).
    // Context-menu "Ask AI" still works because it routes through the
    // `_sendMessage` callback registered by AIZone's ConversationPanel; the
    // `setShowDraftChat(true)` call is a harmless no-op.
    vi.spyOn(flags, 'isAiPanelV2Enabled').mockReturnValue(true)
    render(<RightPanelMount />)
    expect(screen.getByTestId('stub-outputs-dock')).toBeInTheDocument()
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
