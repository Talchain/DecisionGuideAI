import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import { useConversation, type UseConversationReturn } from './useConversation'

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
