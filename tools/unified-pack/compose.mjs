#!/usr/bin/env node
// tools/unified-pack/compose.mjs
import { readdir, stat, mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile as readFileAsync } from 'node:fs/promises'
import { readZip, readManifest } from './readZip.mjs'
import { computeFileSHA256, verifyChecksums } from './checksums.mjs'
import { renderSLOSummary, renderBadge } from './renderSummary.mjs'

const execAsync = promisify(exec)
const __dirname = dirname(fileURLToPath(import.meta.url))

// Stable JSON stringify with proper replacer
function stableStringify(obj) {
  return JSON.stringify(obj, (key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val).sort().reduce((sorted, k) => {
        sorted[k] = val[k]
        return sorted
      }, {})
    }
    return val
  }, 2)
}

// Parse CLI args
function parseArgs() {
  const args = process.argv.slice(2)
  const opts = {
    uiPack: null,
    engineIn: null,
    claudeIn: null,
    out: null,
    date: null,
    maxZipBytes: 52428800, // 50MB
    maxTotalBytes: 157286400, // 150MB
    print: false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--ui-pack') opts.uiPack = args[++i]
    else if (arg === '--engine-in') opts.engineIn = args[++i]
    else if (arg === '--claude-in') opts.claudeIn = args[++i]
    else if (arg === '--out') opts.out = args[++i]
    else if (arg === '--date') opts.date = args[++i]
    else if (arg === '--max-zip-bytes') opts.maxZipBytes = parseInt(args[++i], 10)
    else if (arg === '--max-total-bytes') opts.maxTotalBytes = parseInt(args[++i], 10)
    else if (arg === '--print') opts.print = true
  }

  if (!opts.uiPack || !opts.engineIn || !opts.claudeIn || !opts.out) {
    console.error('Symptom: Missing required CLI arguments')
    console.error('Likely cause: --ui-pack, --engine-in, --claude-in, and --out are all required')
    console.error('Minimal patch plan: Provide all required flags')
    process.exit(1)
  }

  return opts
}

// Discover latest pack in a directory
async function discoverLatestPack(dir, pattern) {
  try {
    const entries = await readdir(dir)
    const zips = entries.filter(e => e.endsWith('.zip') && e.includes(pattern))

    if (zips.length === 0) return null

    // Parse date and shortsha from filename: *_YYYY-MM-DD_UTC_<shortsha>.zip
    const parsed = zips.map(z => {
      const match = z.match(/(\d{4}-\d{2}-\d{2})_UTC_([a-f0-9]+)\.zip$/)
      if (match) {
        return { file: z, date: match[1], sha: match[2] }
      }
      return null
    }).filter(Boolean)

    if (parsed.length === 0) {
      // Fallback to mtime if no date in filename
      const stats = await Promise.all(zips.map(async z => {
        const s = await stat(join(dir, z))
        return { file: z, mtime: s.mtime.getTime() }
      }))
      stats.sort((a, b) => b.mtime - a.mtime)
      return join(dir, stats[0].file)
    }

    // Sort: (1) date desc, (2) sha lexical desc
    parsed.sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date)
      return b.sha.localeCompare(a.sha)
    })

    return join(dir, parsed[0].file)
  } catch (err) {
    return null
  }
}

// Simple schema validation without external dependencies
async function validateManifest(manifest, schemaPath) {
  // Validate component enum
  if (!['ui', 'engine', 'claude'].includes(manifest.component)) {
    throw new Error(`Invalid component: ${manifest.component}`)
  }

  // Validate required fields
  if (!manifest.build || !manifest.slos || !manifest.checksums) {
    throw new Error('Missing required fields: build, slos, or checksums')
  }

  // Validate checksums array
  if (!Array.isArray(manifest.checksums)) {
    throw new Error('checksums must be an array')
  }

  for (const cs of manifest.checksums) {
    // Support both object format and string format
    let sha256
    if (typeof cs === 'string') {
      const parts = cs.trim().split(/\s+/)
      if (parts.length < 2) {
        throw new Error(`Invalid checksum string format: ${cs}`)
      }
      sha256 = parts[0]
    } else if (cs.file && cs.sha256) {
      sha256 = cs.sha256
    } else {
      throw new Error('Each checksum must have file and sha256 fields or be in "sha256 file" format')
    }

    if (!/^[a-f0-9]{64}$/.test(sha256)) {
      throw new Error(`Invalid SHA-256 format: ${sha256}`)
    }
  }

  // Component-specific SLO validation
  if (manifest.component === 'ui') {
    if (typeof manifest.slos.ui_layout_p95_ms !== 'number' || manifest.slos.ui_layout_p95_ms <= 0) {
      throw new Error('ui component requires slos.ui_layout_p95_ms > 0')
    }
  }
  if (manifest.component === 'engine') {
    if (typeof manifest.slos.engine_get_p95_ms !== 'number' || manifest.slos.engine_get_p95_ms <= 0) {
      throw new Error('engine component requires slos.engine_get_p95_ms > 0')
    }
  }
  if (manifest.component === 'claude') {
    if (typeof manifest.slos.claude_ttff_ms !== 'number' || manifest.slos.claude_ttff_ms <= 0) {
      throw new Error('claude component requires slos.claude_ttff_ms > 0')
    }
    if (typeof manifest.slos.claude_cancel_ms !== 'number' || manifest.slos.claude_cancel_ms <= 0) {
      throw new Error('claude component requires slos.claude_cancel_ms > 0')
    }
  }
}

// Main compose logic
async function compose() {
  const opts = parseArgs()

  // Discover packs
  // UI pack can be in ui-pack/ or ui/ directory
  let uiPackPath = null
  if (opts.uiPack) {
    const directPath = join(opts.uiPack, 'ui-pack.zip')
    try {
      await stat(directPath)
      uiPackPath = directPath
    } catch {
      // Try ui/ directory instead
      const uiDir = opts.uiPack.replace(/ui-pack$/, 'ui')
      uiPackPath = await discoverLatestPack(uiDir, 'evidence-pack')
    }
  }
  const enginePackPath = await discoverLatestPack(opts.engineIn, 'engine_pack')
  const claudePackPath = await discoverLatestPack(opts.claudeIn, 'claude_pack')

  if (opts.print) {
    console.log(`UI pack: ${uiPackPath || 'NOT FOUND'}`)
    console.log(`Engine pack: ${enginePackPath || 'NOT FOUND'}`)
    console.log(`Claude pack: ${claudePackPath || 'NOT FOUND'}`)
  }

  const packs = [
    { component: 'ui', path: uiPackPath },
    { component: 'engine', path: enginePackPath },
    { component: 'claude', path: claudePackPath }
  ].filter(p => p.path)

  if (packs.length === 0) {
    console.error('Symptom: No packs found')
    console.error('Likely cause: Input directories are empty or files do not match expected patterns')
    console.error('Minimal patch plan: Ensure packs are generated and placed in correct directories')
    process.exit(1)
  }

  // Load and validate each pack
  const components = []
  let totalFiles = 0
  let totalBytes = 0
  const mergedSLOs = {
    ui_layout_p95_ms: null,
    engine_get_p95_ms: null,
    claude_ttff_ms: null,
    claude_cancel_ms: null
  }

  const manifestSchema = join(__dirname, 'manifest.schema.json')

  for (const { component, path: packPath } of packs) {
    // Check size
    const packStat = await stat(packPath)
    if (packStat.size > opts.maxZipBytes) {
      console.error(`Symptom: Pack ${packPath} exceeds max_zip_bytes (${packStat.size} > ${opts.maxZipBytes})`)
      console.error('Likely cause: Pack is too large')
      console.error('Minimal patch plan: Reduce pack size or increase --max-zip-bytes')
      process.exit(1)
    }

    // Read and validate manifest
    let manifest
    try {
      manifest = await readManifest(packPath)
      await validateManifest(manifest, manifestSchema)
    } catch (err) {
      console.error(`Symptom: Failed to validate manifest for ${component}`)
      console.error(`Likely cause: ${err.message}`)
      console.error('Minimal patch plan: Fix manifest.json in source pack')
      process.exit(1)
    }

    // Verify checksums
    try {
      const files = await readZip(packPath)
      verifyChecksums(files, manifest.checksums)
    } catch (err) {
      console.error(`Symptom: Checksum verification failed for ${component}`)
      console.error(`Likely cause: ${err.message}`)
      console.error('Minimal patch plan: Regenerate pack with correct checksums')
      process.exit(1)
    }

    // Compute zip SHA-256
    const zipSHA256 = await computeFileSHA256(packPath)

    // Merge SLOs
    for (const key of Object.keys(mergedSLOs)) {
      if (manifest.slos[key] !== undefined) {
        mergedSLOs[key] = manifest.slos[key]
      }
    }

    components.push({
      component,
      build: manifest.build,
      slos: manifest.slos,
      fileCount: manifest.checksums.length,
      bytes: packStat.size,
      zip_sha256: zipSHA256
    })

    totalFiles += manifest.checksums.length
    totalBytes += packStat.size
  }

  // Check total size
  if (totalBytes > opts.maxTotalBytes) {
    console.error(`Symptom: Total bytes exceed max_total_bytes (${totalBytes} > ${opts.maxTotalBytes})`)
    console.error('Likely cause: Combined packs are too large')
    console.error('Minimal patch plan: Reduce pack sizes or increase --max-total-bytes')
    process.exit(1)
  }

  // Generate date string
  const dateStr = opts.date || new Date().toISOString().split('T')[0].replace(/-/g, '-') + '_UTC'

  // Create output directory
  await mkdir(opts.out, { recursive: true })

  // Compose unified zip (deterministic: stable ordering, no extended attributes)
  const unifiedZipPath = join(opts.out, `Olumi_PoC_Evidence_${dateStr}.zip`)
  const zipInputs = packs.map(p => `"${p.path}"`).join(' ')
  try {
    await execAsync(`zip -j -0 "${unifiedZipPath}" ${zipInputs}`)
  } catch (err) {
    console.error('Symptom: Failed to create unified zip')
    console.error(`Likely cause: ${err.message}`)
    console.error('Minimal patch plan: Check zip command availability and permissions')
    process.exit(1)
  }

  // Generate unified manifest
  const unifiedManifest = {
    generated_at_utc: new Date().toISOString(),
    components,
    slos: mergedSLOs,
    totals: { files: totalFiles, bytes: totalBytes }
  }

  await writeFile(
    join(opts.out, 'unified.manifest.json'),
    stableStringify(unifiedManifest),
    'utf8'
  )

  // Generate SLO_SUMMARY.md
  const summaryMd = renderSLOSummary(mergedSLOs)
  await writeFile(join(opts.out, 'SLO_SUMMARY.md'), summaryMd, 'utf8')

  // Generate READY_BADGE.svg
  const badgeSvg = renderBadge(mergedSLOs)
  await writeFile(join(opts.out, 'READY_BADGE.svg'), badgeSvg, 'utf8')

  // Print acceptance lines
  if (opts.print) {
    console.log(`UNIFIED_PACK: ${unifiedZipPath}`)
    console.log(`SLOS: ui_layout_p95_ms=${mergedSLOs.ui_layout_p95_ms}, engine_get_p95_ms=${mergedSLOs.engine_get_p95_ms}, claude_ttff_ms=${mergedSLOs.claude_ttff_ms}, claude_cancel_ms=${mergedSLOs.claude_cancel_ms}`)
    console.log('PRIVACY: informational only (see component packs)')
    console.log('FLAGS: informational only (see component packs)')
    console.log('ACCEPTANCE:COMPOSER: Created unified zip + manifest + SLO_SUMMARY.md')

    // SLO acceptance
    const sloStatus = Object.entries(mergedSLOs).map(([k, v]) => {
      const icon = v === null ? '⚠️' : (v <= { ui_layout_p95_ms: 150, engine_get_p95_ms: 600, claude_ttff_ms: 500, claude_cancel_ms: 150 }[k] ? '✅' : '❌')
      return `${k}=${v} ${icon}`
    }).join(' / ')
    console.log(`ACCEPTANCE:SLO: ${sloStatus}`)

    console.log('ACCEPTANCE:SIZE: per-zip ≤ 50MB, total ≤ 150MB')
    console.log('ACCEPTANCE:CHECKSUMS: all component checksums verified')
  }
}

compose().catch(err => {
  console.error('Symptom: Unexpected error during composition')
  console.error(`Likely cause: ${err.message}`)
  console.error('Minimal patch plan: Review stack trace and fix underlying issue')
  process.exit(1)
})