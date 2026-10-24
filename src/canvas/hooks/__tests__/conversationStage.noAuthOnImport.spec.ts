/**
 * Importing the stage ladder never initialises auth (Codex r1 on #2979). The ladder reads a program board's result
 * through `useProgramBoardShowsResult`, whose saved-graph reader needs the session; it loads the auth client inside its
 * read, so a surface that only imports the ladder (every composer and invitation, and the specs that mock the store
 * wholesale) does not pull `lib/supabase` in, which throws at import without its environment.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => { throw new Error('lib/supabase was imported with the stage ladder') })

describe('the stage ladder', () => {
  it('imports without initialising auth', async () => {
    const mod = await import('../useConversationStage')
    expect(typeof mod.useConversationStage).toBe('function')
    expect(typeof mod.useEmptyConversationInvitation).toBe('function')
  })
})
