import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { useConversation, type UseConversationReturn } from './useConversation'
import { releaseTabBodyFallback } from '../stores/tabBodyFallback'

export interface ConversationContextValue extends UseConversationReturn {
  draft: string
  setDraft: (text: string) => void
  appendDraft: (text: string) => void
  clearDraft: () => void
}

const ConversationContext = createContext<ConversationContextValue | null>(null)

export function ConversationProvider({ children }: { children: ReactNode }) {
  const conversation = useConversation()
  const [draft, setDraft] = useState<string>('')

  const clearDraft = useCallback(() => setDraft(''), [])
  const appendDraft = useCallback((text: string) => setDraft((prev) => prev + text), [])

  const value = useMemo<ConversationContextValue>(
    () => ({ ...conversation, draft, setDraft, appendDraft, clearDraft }),
    [conversation, draft, appendDraft, clearDraft],
  )

  // The session ends here, so no guidance slot may keep a tab-body callback
  // into it (Codex 5807693253). The tab body cannot do this itself: it also
  // unmounts on a dock collapse, where its callbacks must survive. Queued, so
  // it runs after the children's cleanups; another host's slot is never
  // touched — see `stores/tabBodyFallback.ts`.
  useEffect(() => () => { queueMicrotask(releaseTabBodyFallback) }, [])

  return <ConversationContext.Provider value={value}>{children}</ConversationContext.Provider>
}

export function useConversationContext(): ConversationContextValue {
  const ctx = useContext(ConversationContext)
  if (!ctx) {
    throw new Error('useConversationContext must be called inside <ConversationProvider>')
  }
  return ctx
}

export function useOptionalConversationContext(): ConversationContextValue | null {
  return useContext(ConversationContext)
}
