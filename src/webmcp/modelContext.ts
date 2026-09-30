/**
 * EXPERIMENT ONLY — branch experiment/webmcp-investor-demo (olumi-programme-docs#76).
 *
 * The slice of WebMCP this experiment uses. ChatGPT Desktop site tools implement
 * `document.modelContext` (renamed from `navigator.modelContext` in July 2026),
 * imperative registration only, top-level page only. Nothing else is probed.
 */

export interface WebMcpToolAnnotations {
  readOnlyHint?: boolean
  untrustedContentHint?: boolean
  consequentialHint?: boolean
}

export type WebMcpResult = Record<string, unknown>

export interface WebMcpTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: WebMcpToolAnnotations
  execute: (args: Record<string, unknown>, ctx?: { signal?: AbortSignal }) => Promise<WebMcpResult>
}

export interface ModelContextLike {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => unknown
}

export function getModelContext(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): ModelContextLike | null {
  const mc = (doc as unknown as { modelContext?: unknown } | undefined)?.modelContext
  return mc && typeof (mc as ModelContextLike).registerTool === 'function' ? (mc as ModelContextLike) : null
}
