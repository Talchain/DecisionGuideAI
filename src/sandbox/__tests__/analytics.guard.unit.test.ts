import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// Guard to prevent regressions in telemetry event names across sandbox code.
// Scans source files for track('sandbox_*') usages and asserts the event
// name is one of the allow-listed names.

describe('Analytics event naming guard (sandbox)', () => {
  const allowed = new Set([
    'sandbox_model',
    'sandbox_projection',
    'sandbox_trigger',
    'sandbox_bridge',
    'sandbox_panel',
    'sandbox_diff',
    'sandbox_snapshot',
    'sandbox_vote',
    'sandbox_alignment',
    'sandbox_review',
    'sandbox_delta_reapply',
    'sandbox_rival_edit',
    'history_archived',
  ])

  function collectSandboxEvents(dir: string): string[] {
    const events: string[] = []
    const stack = [dir]
    while (stack.length) {
      const cur = stack.pop()!
      const items = fs.readdirSync(cur, { withFileTypes: true })
      for (const ent of items) {
        if (ent.name.startsWith('.') || ent.name === '__tests__') continue
        const p = path.join(cur, ent.name)
        if (ent.isDirectory()) {
          stack.push(p)
        } else if (/\.(tsx?|jsx?)$/.test(ent.name)) {
          const text = fs.readFileSync(p, 'utf8')
          const re = /track\(\s*['"](sandbox_[a-zA-Z0-9_]+)['"]/g
          let m: RegExpExecArray | null
          while ((m = re.exec(text))) {
            events.push(m[1])
          }
        }
      }
    }
    return events
  }

  it('only uses allow-listed sandbox_* events', () => {
    const here = path.dirname(fileURLToPath(import.meta.url))
    const root = path.resolve(here, '../../') // src/
    const sandboxDir = path.join(root, 'sandbox')
    const events = collectSandboxEvents(sandboxDir)
    // Filter duplicates for readable failure output
    const unique = Array.from(new Set(events))
    const unknown = unique.filter(e => !allowed.has(e))
    expect(unknown).toEqual([])
  })

  it('payload guard: representative events include decisionId and ts', async () => {
    const { track } = await import('@/lib/analytics')
    // Should not throw due to setup guard expecting decisionId and ts
    track('sandbox_panel', { op: 'tab_select', decisionId: 'd1', tab: 'goals', ts: Date.now() })
    track('sandbox_bridge', { op: 'open', decisionId: 'd1', ts: Date.now() })
  })
})
