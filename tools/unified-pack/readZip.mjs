// tools/unified-pack/readZip.mjs
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

/**
 * Reads a zip file using unzip -p (deterministic, no extended attributes).
 * Returns entries sorted by name for stable ordering.
 */
export async function readZip(zipPath) {
  try {
    // List all files in the zip using -Z1 for simple list
    const { stdout: listOut } = await execAsync(`unzip -Z1 "${zipPath}"`)
    const entries = listOut.split('\n').filter(l => l.trim() && !l.endsWith('/'))

    // Sort entries for determinism
    entries.sort()

    // Read each file
    const files = []
    for (const name of entries) {
      try {
        const { stdout } = await execAsync(`unzip -p "${zipPath}" "${name}"`, {
          encoding: 'buffer',
          maxBuffer: 100 * 1024 * 1024 // 100MB per file
        })
        files.push({ name, content: stdout })
      } catch (err) {
        // Skip entries that can't be read
      }
    }

    return files
  } catch (err) {
    throw new Error(`Failed to read zip ${zipPath}: ${err.message}`)
  }
}

/**
 * Reads manifest.json from a zip file and parses it.
 */
export async function readManifest(zipPath) {
  try {
    const { stdout } = await execAsync(`unzip -p "${zipPath}" manifest.json`, {
      encoding: 'utf8'
    })
    return JSON.parse(stdout)
  } catch (err) {
    throw new Error(`Failed to read manifest.json from ${zipPath}: ${err.message}`)
  }
}