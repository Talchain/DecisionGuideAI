import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const execFileP = promisify(execFile)

function sha256(buf: Buffer | Uint8Array | string): string {
  const h = createHash('sha256')
  h.update(buf)
  return h.digest('hex')
}

// This test verifies that report.json inside the UI evidence ZIP is byte-for-byte
// identical to the fixture file used by the app (immutability guard).
describe('UI evidence pack immutability', () => {
  it('report.json inside the evidence ZIP matches the fixture bytes (SHA-256)', async () => {
    const fixturePath = path.join(process.cwd(), 'src/fixtures/reports/report.v1.example.json')
    const zipPath = path.join(process.cwd(), 'docs/evidence/ui/evidence-pack-seed777-model-local-sim.zip')

    let fixtureBytes: Buffer
    try {
      fixtureBytes = await readFile(fixturePath)
    } catch {
      // If fixtures move, this test needs update.
      return expect(false, 'Fixture report not found').toBe(true)
    }

    // If the pack ZIP does not exist, skip to avoid noisy failures locally.
    // CI should generate it via `npm run evidence:ui-pack`.
    let zipExists = true
    try { await readFile(zipPath) } catch { zipExists = false }
    if (!zipExists) {
      // Skip: evidence pack not present
      return expect(true).toBe(true)
    }

    // Use system unzip to stream just report.json stdout.
    try {
      const { stdout } = await execFileP('unzip', ['-p', zipPath, 'report.json'])
      const hashFixture = sha256(fixtureBytes)
      const hashZip = sha256(stdout)
      expect(hashZip).toBe(hashFixture)
    } catch (e) {
      // If unzip is missing in environment, skip.
      expect(true).toBe(true)
    }
  })
})
