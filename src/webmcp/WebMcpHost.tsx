/**
 * EXPERIMENT ONLY — headless host for Olumi's WebMCP site tools
 * (branch experiment/webmcp-investor-demo, olumi-programme-docs#76; never merged).
 *
 * Inert unless the `webmcp` flag is on AND the page exposes `document.modelContext`.
 * Mounted inside MaybeConversationProvider so the tools reach the SAME singleton
 * conversation the UI's own controls use (it never calls useConversation itself).
 * Delete this directory and its one mount line to remove the experiment.
 */
import { useEffect, useRef, useState } from 'react'
import { isWebMcpEnabled } from '../flags'
import { useOptionalConversationContext } from '../canvas/conversation/ConversationContext'
import { getModelContext } from './modelContext'
import { probeTools } from './probeTools'
import { olumiTools, proposalTools, PROPOSAL_TOOLS_LIVE, type ConversationBridge } from './olumiTools'
import { registerOnce } from './registry'
import { adoptScenarioFromUrl } from './scenarioFromUrl'
import { SiteToolsStatus } from './SiteToolsStatus'

export function WebMcpHost() {
  const conversation = useOptionalConversationContext()
  const [available] = useState(() => getModelContext() !== null)
  // Tools are registered once; they read the latest conversation through this ref.
  const latest = useRef(conversation)
  latest.current = conversation

  useEffect(() => {
    if (!isWebMcpEnabled()) return undefined
    if (adoptScenarioFromUrl()) return undefined
    const mc = getModelContext()
    if (mc === null) {
      console.info('[webmcp] document.modelContext unavailable; no tools registered')
      return undefined
    }
    const bridge: ConversationBridge = {
      sendMessage: (text, opts) => {
        const c = latest.current
        if (!c) throw new Error('Olumi conversation is not available on this page')
        return c.sendMessage(text, opts)
      },
      isThinking: () => latest.current?.isThinking === true,
      latestAssistantText: () => {
        const msgs = latest.current?.messages ?? []
        for (let i = msgs.length - 1; i >= 0; i -= 1) {
          const m = msgs[i] as { role?: string; content?: unknown }
          if (m.role === 'assistant') return typeof m.content === 'string' ? m.content : null
        }
        return null
      },
    }
    const tools = [...probeTools(), ...olumiTools(bridge), ...(PROPOSAL_TOOLS_LIVE ? proposalTools(bridge) : [])]
    const cleanup = registerOnce(mc, tools)
    return cleanup ?? undefined
  }, [])
  return isWebMcpEnabled() ? <SiteToolsStatus available={available} /> : null
}
