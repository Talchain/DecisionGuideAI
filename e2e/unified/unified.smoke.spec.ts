import { test, expect } from '@playwright/test'
import { promises as fs } from 'node:fs'
import path from 'node:path'

test.describe('@evidence unified artefacts smoke', () => {
  test('manifest and badge alignment', async () => {
    const root = process.cwd()
    const out = path.join(root, 'docs/evidence/unified')
    const manifestPath = path.join(out, 'unified.manifest.json')
    const badgePath = path.join(out, 'READY_BADGE.svg')

    // Files exist
    await expect(async () => { await fs.stat(manifestPath) }).not.toThrow()
    await expect(async () => { await fs.stat(badgePath) }).not.toThrow()

    const manifestRaw = await fs.readFile(manifestPath, 'utf8')
    const manifest = JSON.parse(manifestRaw)
    expect(typeof manifest.status).toBe('string')

    const badge = await fs.readFile(badgePath, 'utf8')
    const map: Record<string, 'GREEN'|'AMBER'|'RED'> = { OK: 'GREEN', DEGRADED: 'AMBER', FAIL: 'RED' }
    const expected = map[manifest.status] || 'AMBER'
    expect(badge).toContain(expected)
  })
})
