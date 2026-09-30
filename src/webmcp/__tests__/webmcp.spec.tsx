/**
 * EXPERIMENT ONLY (#76) — Gate A probes: registration is inert without the flag or
 * document.modelContext, idempotent under remount, and no tool accepts identity.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { getModelContext, type WebMcpTool } from '../modelContext'
import { registerOnce, __resetWebMcpRegistryForTests, getWebMcpDiagnostics } from '../registry'
import { probeTools } from '../probeTools'
import { WebMcpHost } from '../WebMcpHost'

vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

type Registered = { tool: WebMcpTool; signal?: AbortSignal }

function fakeModelContext() {
  const registered: Registered[] = []
  return {
    registered,
    registerTool: vi.fn((tool: WebMcpTool, options?: { signal?: AbortSignal }) => {
      if (registered.some((r) => r.tool.name === tool.name && !r.signal?.aborted)) {
        throw new Error(`duplicate tool name ${tool.name}`)
      }
      registered.push({ tool, signal: options?.signal })
      return Promise.resolve()
    }),
  }
}

function live(mc: ReturnType<typeof fakeModelContext>): string[] {
  return mc.registered.filter((r) => !r.signal?.aborted).map((r) => r.tool.name)
}

const IDENTITY_KEYS = /^(scenario_?id|user_?id|org(anisation|anization)?_?id|token|auth.*|approval.*|typed_approval_of)$/i

describe('WebMCP experiment — Gate A probes', () => {
  beforeEach(() => {
    __resetWebMcpRegistryForTests()
    localStorage.removeItem('feature.webmcp')
    delete (document as unknown as { modelContext?: unknown }).modelContext
  })
  afterEach(() => {
    cleanup()
    __resetWebMcpRegistryForTests()
    localStorage.removeItem('feature.webmcp')
    delete (document as unknown as { modelContext?: unknown }).modelContext
  })

  it('reads only document.modelContext', () => {
    expect(getModelContext(document)).toBeNull()
    ;(navigator as unknown as { modelContext?: unknown }).modelContext = fakeModelContext()
    expect(getModelContext(document)).toBeNull()
    delete (navigator as unknown as { modelContext?: unknown }).modelContext
    const mc = fakeModelContext()
    ;(document as unknown as { modelContext?: unknown }).modelContext = mc
    expect(getModelContext(document)).toBe(mc)
  })

  it('registers the three probes exactly once, and again only after cleanup', () => {
    const mc = fakeModelContext()
    const first = registerOnce(mc, probeTools())
    expect(first).not.toBeNull()
    expect(registerOnce(mc, probeTools())).toBeNull()
    expect(live(mc)).toEqual(['olumi_ping', 'olumi_probe_large', 'olumi_probe_write'])
    first?.()
    expect(live(mc)).toEqual([])
    const second = registerOnce(mc, probeTools())
    expect(second).not.toBeNull()
    expect(live(mc)).toEqual(['olumi_ping', 'olumi_probe_large', 'olumi_probe_write'])
  })

  it('declares read-only probes read-only and the write probe without the hint', () => {
    const byName = Object.fromEntries(probeTools().map((t) => [t.name, t]))
    expect(byName.olumi_ping.annotations?.readOnlyHint).toBe(true)
    expect(byName.olumi_probe_large.annotations?.readOnlyHint).toBe(true)
    expect(byName.olumi_probe_write.annotations?.readOnlyHint).toBeUndefined()
  })

  it('no tool schema accepts identity, scenario ownership or approval', () => {
    for (const tool of probeTools()) {
      const props = Object.keys((tool.inputSchema.properties ?? {}) as Record<string, unknown>)
      expect(props.filter((k) => IDENTITY_KEYS.test(k))).toEqual([])
      expect(tool.inputSchema.additionalProperties).toBe(false)
      expect(tool.description.length).toBeLessThanOrEqual(500)
    }
  })

  it('ping and large return what the probes promise, and calls are logged', async () => {
    const mc = fakeModelContext()
    registerOnce(mc, probeTools())
    const ping = mc.registered.find((r) => r.tool.name === 'olumi_ping')!.tool
    await expect(ping.execute({})).resolves.toMatchObject({ ok: true, message: 'Olumi WebMCP connected' })
    const large = mc.registered.find((r) => r.tool.name === 'olumi_probe_large')!.tool
    const out = (await large.execute({})) as { chars: number; end_marker: string }
    expect(out.chars).toBeGreaterThanOrEqual(3000)
    expect(out.end_marker).toBe('END-OF-PROBE-7f446a08')
    expect(getWebMcpDiagnostics().calls.map((c) => c.tool)).toEqual(['olumi_ping', 'olumi_probe_large'])
  })

  it('host is inert with the flag off, even when modelContext exists', () => {
    const mc = fakeModelContext()
    ;(document as unknown as { modelContext?: unknown }).modelContext = mc
    render(<WebMcpHost />)
    expect(mc.registerTool).not.toHaveBeenCalled()
  })

  it('host is inert with the flag on but no modelContext', () => {
    localStorage.setItem('feature.webmcp', '1')
    expect(() => render(<WebMcpHost />)).not.toThrow()
    expect(getWebMcpDiagnostics().registered).toEqual([])
  })

  it('host registers once with the flag on, and unregisters on unmount', () => {
    localStorage.setItem('feature.webmcp', '1')
    const mc = fakeModelContext()
    ;(document as unknown as { modelContext?: unknown }).modelContext = mc
    const { unmount } = render(<WebMcpHost />)
    render(<WebMcpHost />)
    expect(live(mc)).toEqual([
      'olumi_ping', 'olumi_probe_large', 'olumi_probe_write',
      'olumi_get_state', 'olumi_build_model', 'olumi_run_analysis',
    ])
    unmount()
    expect(live(mc)).toEqual([])
  })
})
