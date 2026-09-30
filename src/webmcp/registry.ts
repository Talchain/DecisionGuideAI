/**
 * EXPERIMENT ONLY — idempotent registration plus a tiny call log (#76 brief §19).
 *
 * WebMCP rejects a duplicate tool name, and React StrictMode / remounts would
 * register twice. One module-level controller owns the live registration; a
 * second register() call is a no-op until the owner's cleanup aborts it.
 */
import type { ModelContextLike, WebMcpResult, WebMcpTool } from './modelContext'

export interface WebMcpCallRecord {
  tool: string
  at: string
  ms: number
  outcome: 'ok' | 'error'
  error?: string
}

interface WebMcpDiagnostics {
  registered: string[]
  calls: WebMcpCallRecord[]
  lastError?: string
}

const MAX_CALLS = 50
const diagnostics: WebMcpDiagnostics = { registered: [], calls: [] }
let owner: AbortController | null = null

function expose(): void {
  if (typeof window !== 'undefined') {
    ;(window as unknown as { __olumiWebMcp?: WebMcpDiagnostics }).__olumiWebMcp = diagnostics
  }
}

function instrument(tool: WebMcpTool): WebMcpTool {
  return {
    ...tool,
    execute: async (args, ctx): Promise<WebMcpResult> => {
      const started = Date.now()
      const record: WebMcpCallRecord = { tool: tool.name, at: new Date(started).toISOString(), ms: 0, outcome: 'ok' }
      try {
        const result = await tool.execute(args ?? {}, ctx)
        return result
      } catch (err) {
        record.outcome = 'error'
        record.error = err instanceof Error ? err.message : String(err)
        return { ok: false, error: 'tool_failed', detail: record.error }
      } finally {
        record.ms = Date.now() - started
        diagnostics.calls.push(record)
        if (diagnostics.calls.length > MAX_CALLS) diagnostics.calls.shift()
        console.info('[webmcp] call', record)
      }
    },
  }
}

/** Registers `tools` once. Returns the cleanup to run on unmount, or null if already registered. */
export function registerOnce(mc: ModelContextLike, tools: WebMcpTool[]): (() => void) | null {
  if (owner !== null) return null
  const controller = new AbortController()
  owner = controller
  diagnostics.registered = []
  expose()
  for (const tool of tools) {
    try {
      void Promise.resolve(mc.registerTool(instrument(tool), { signal: controller.signal })).catch((err: unknown) => {
        diagnostics.lastError = `${tool.name}: ${err instanceof Error ? err.message : String(err)}`
        console.warn('[webmcp] registerTool rejected', diagnostics.lastError)
      })
      diagnostics.registered.push(tool.name)
    } catch (err) {
      diagnostics.lastError = `${tool.name}: ${err instanceof Error ? err.message : String(err)}`
      console.warn('[webmcp] registerTool threw', diagnostics.lastError)
    }
  }
  console.info('[webmcp] registered', diagnostics.registered)
  return () => {
    controller.abort()
    if (owner === controller) owner = null
    diagnostics.registered = []
  }
}

/** Test seam only. */
export function __resetWebMcpRegistryForTests(): void {
  owner?.abort()
  owner = null
  diagnostics.registered = []
  diagnostics.calls = []
  delete diagnostics.lastError
}

export function getWebMcpDiagnostics(): Readonly<WebMcpDiagnostics> {
  return diagnostics
}
