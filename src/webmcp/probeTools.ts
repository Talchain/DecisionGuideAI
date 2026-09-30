/**
 * EXPERIMENT ONLY — Gate A probes (#76). Each answers one question about ChatGPT
 * Desktop site tools on the real Olumi page: discovery + invocation (ping),
 * result truncation (large), and write-confirmation friction (write). None of
 * them reads or changes Olumi state.
 */
import type { WebMcpTool } from './modelContext'

const EMPTY_SCHEMA = { type: 'object', properties: {}, additionalProperties: false } as const

const LARGE_BLOCK_CHARS = 3000

function largeText(): string {
  const lines: string[] = []
  for (let i = 1; lines.join('\n').length < LARGE_BLOCK_CHARS; i += 1) {
    lines.push(`line ${String(i).padStart(3, '0')}: probe text for truncation measurement`)
  }
  return lines.join('\n')
}

export function probeTools(): WebMcpTool[] {
  return [
    {
      name: 'olumi_ping',
      description: 'Check that Olumi site tools are connected on this page. Read only; changes nothing.',
      inputSchema: EMPTY_SCHEMA,
      annotations: { readOnlyHint: true },
      execute: async () => ({
        ok: true,
        message: 'Olumi WebMCP connected',
        page: typeof location === 'undefined' ? null : location.host,
        at: new Date().toISOString(),
      }),
    },
    {
      name: 'olumi_probe_large',
      description:
        'Test tool: returns about 3,000 characters ending in a marker, to check whether long results are cut off. Read only; changes nothing.',
      inputSchema: EMPTY_SCHEMA,
      annotations: { readOnlyHint: true },
      execute: async () => {
        const text = largeText()
        return { ok: true, chars: text.length, text, end_marker: 'END-OF-PROBE-7f446a08' }
      },
    },
    {
      name: 'olumi_probe_write',
      description:
        'Test tool declared as a write so the confirmation step can be observed. It changes nothing in Olumi and reports that.',
      inputSchema: EMPTY_SCHEMA,
      execute: async () => ({ ok: true, changed: false, message: 'Probe only: nothing in Olumi was changed.' }),
    },
  ]
}
