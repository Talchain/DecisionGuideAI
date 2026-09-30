/**
 * EXPERIMENT ONLY — headless host for Olumi's WebMCP site tools
 * (branch experiment/webmcp-investor-demo, olumi-programme-docs#76; never merged).
 *
 * Inert unless the `webmcp` flag is on AND the page exposes `document.modelContext`.
 * Mounted inside MaybeConversationProvider so later tools can reach the same
 * singleton conversation the UI's own buttons use. Delete this file and its one
 * mount line to remove the experiment.
 */
import { useEffect } from 'react'
import { isWebMcpEnabled } from '../flags'
import { getModelContext } from './modelContext'
import { probeTools } from './probeTools'
import { registerOnce } from './registry'

export function WebMcpHost(): null {
  useEffect(() => {
    if (!isWebMcpEnabled()) return undefined
    const mc = getModelContext()
    if (mc === null) {
      console.info('[webmcp] document.modelContext unavailable; no tools registered')
      return undefined
    }
    const cleanup = registerOnce(mc, probeTools())
    return cleanup ?? undefined
  }, [])
  return null
}
