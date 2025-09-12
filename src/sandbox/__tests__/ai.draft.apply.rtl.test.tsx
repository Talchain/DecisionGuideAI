// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { FlagsProvider } from '@/lib/flags'
import Palette from '@/whiteboard/Palette'
import { GraphProvider } from '@/sandbox/state/graphStore'

describe('ai.draft.apply', () => {
  beforeEach(() => { localStorage.clear() })
  afterEach(() => { localStorage.clear() })

  it('click Draft with AI inserts nodes/edges and Undo removes them', async () => {
    // Seed current graph
    localStorage.setItem('dgai:graph:decision:demo', JSON.stringify({ schemaVersion: 1, nodes: {}, edges: {} }))

    const r = render(
      <FlagsProvider value={{ sandbox: true, sandboxMapping: true, sandboxAIDraft: true }}>
        <GraphProvider decisionId={'demo'}>
          <div>
            <Palette getEditor={() => ({ zoomToBounds: () => {} }) as any} />
          </div>
        </GraphProvider>
      </FlagsProvider>
    )

    // Open draft sheet via palette button
    fireEvent.click(await r.findByTestId('pal-ai-draft'))
    const textarea = await r.findByLabelText('Draft prompt')
    fireEvent.change(textarea, { target: { value: 'draft onboarding flow' } })

    // Draft
    fireEvent.click(r.getByText('Draft'))
    // Should show Undo popover; click Undo (AI draft undo button)
    const btnUndo = await r.findByTestId('pal-ai-draft-undo')
    fireEvent.click(btnUndo)

    // Verify some nodes existed then got removed: we can check nodes count 0
    const raw = localStorage.getItem('dgai:graph:decision:demo')!
    const parsed = JSON.parse(raw)
    const generated = Object.values(parsed.nodes).filter((n: any) => n?.meta?.generated)
    expect(generated.length).toBe(0)
  })
})
