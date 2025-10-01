// tools/unified-pack/checksums.mjs
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

/**
 * Computes SHA-256 checksum for a buffer.
 */
export function computeSHA256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Computes SHA-256 checksum for a file.
 */
export async function computeFileSHA256(filePath) {
  const buffer = await readFile(filePath)
  return computeSHA256(buffer)
}

/**
 * Normalises checksum format to {file, sha256}.
 * Handles both object format and string format "sha256 ./file".
 */
function normaliseChecksum(cs) {
  if (typeof cs === 'string') {
    // Parse "sha256  ./file" or "sha256 file" format
    const parts = cs.trim().split(/\s+/)
    if (parts.length >= 2) {
      return { sha256: parts[0], file: parts[1].replace(/^\.\//, '') }
    }
  }
  if (cs.file && cs.sha256) {
    return { sha256: cs.sha256, file: cs.file.replace(/^\.\//, '') }
  }
  throw new Error(`Invalid checksum format: ${JSON.stringify(cs)}`)
}

/**
 * Verifies checksums for files extracted from a zip.
 * @param {Array<{name: string, content: Buffer}>} files - Files from readZip
 * @param {Array<{file: string, sha256: string} | string>} checksums - Expected checksums
 * @throws {Error} if any checksum fails
 */
export function verifyChecksums(files, checksums) {
  const fileMap = new Map(files.map(f => [f.name, f.content]))
  const errors = []

  for (const cs of checksums) {
    const { file, sha256: expected } = normaliseChecksum(cs)

    // Skip self-referential checksums (manifest.json, checksums.txt)
    if (file === 'manifest.json' || file === 'checksums.txt') {
      continue
    }

    const content = fileMap.get(file)
    if (!content) {
      errors.push(`Missing file: ${file}`)
      continue
    }

    const actual = computeSHA256(content)
    if (actual !== expected) {
      errors.push(`Checksum mismatch for ${file}: expected ${expected}, got ${actual}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`Checksum verification failed:\n${errors.join('\n')}`)
  }
}