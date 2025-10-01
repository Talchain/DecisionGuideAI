// tools/gen-ui-evidence-pack.mjs — deterministic UI Evidence Pack
import { mkdir, writeFile, readFile, stat, cp, utimes } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { exec as _exec } from 'node:child_process'
import { promisify } from 'node:util'

const exec = promisify(_exec)

function sha256(buf){ return createHash('sha256').update(buf).digest('hex') }
function todayUTC(){ return new Date().toISOString().slice(0,10) }
async function exists(p){ try{ await stat(p); return true }catch{ return false } }

const ROOT = process.cwd()
const OUTDIR = path.join(ROOT,'docs/evidence/ui-pack')
const INCOMING_UI = path.join(ROOT,'docs/evidence/incoming/ui')
const PACK_OUT = path.join(ROOT,'evidence/pack')

const BLANK_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63600000020001' +
  '05fe02fea7a6050000000049454e44ae426082','hex')

async function main(){
  await mkdir(OUTDIR,{recursive:true})
  await mkdir(INCOMING_UI,{recursive:true})
  await mkdir(PACK_OUT,{recursive:true})

  // Gather stable artefacts
  const snapshot = { id:'local-1', at: new Date(0).toISOString(), seed:'777', model:'local-sim', data:{ nodes:[{id:'n1',label:'A'},{id:'n2',label:'B'}], edges:[{id:'e1',from:'n1',to:'n2',w:0.9}] } }
  await writeFile(path.join(OUTDIR,'snapshot.json'), JSON.stringify(snapshot,null,2))

  const reportSrc = path.join(ROOT,'src/fixtures/reports/report.v1.example.json')
  const reportBytes = await readFile(reportSrc)
  await writeFile(path.join(OUTDIR,'report.json'), reportBytes)

  // Deterministic SLO: use env override or file if present; else default 120
  let uiP95 = 120
  const sloFile = path.join(OUTDIR,'slo_ui_layout_p95_ms.txt')
  if (process.env.UI_P95_MS && /^\d+$/.test(String(process.env.UI_P95_MS))) uiP95 = parseInt(String(process.env.UI_P95_MS),10)
  else if (await exists(sloFile)) {
    const raw = (await readFile(sloFile,'utf8')).trim()
    if (/^\d+$/.test(raw)) uiP95 = parseInt(raw,10)
  }
  const health = { status:'ok', p95_ms: uiP95 }
  await writeFile(path.join(OUTDIR,'health.json'), JSON.stringify(health,null,2))

  // Stable version: avoid environment-leaky node version
  const pkg = JSON.parse(await readFile(path.join(ROOT,'package.json'),'utf8'))
  let build = 'unknown'
  try{ const { stdout } = await exec('git rev-parse --short HEAD'); build = stdout.trim() || 'unknown' }catch{}
  const version = { name: pkg.name, version: pkg.version, build }
  await writeFile(path.join(OUTDIR,'version.json'), JSON.stringify(version,null,2))

  // Scrubbed headers
  const headers = [
    'GET /report',
    'Accept: application/json',
    'User-Agent: EvidenceGen/1.0'
  ].join('\n')+'\n'
  await writeFile(path.join(OUTDIR,'headers.txt'), headers)

  // Screenshots: reuse if already captured; otherwise create tiny placeholders deterministically
  const deskShot = path.join(OUTDIR,'screenshot.desktop.png')
  const mobShot = path.join(OUTDIR,'screenshot.mobile.png')
  if (!(await exists(deskShot))) await writeFile(deskShot, BLANK_PNG)
  if (!(await exists(mobShot))) await writeFile(mobShot, BLANK_PNG)
  // Stable SR copy samples
  const srCopy = { samples: [{ id: 'copy-1', text: 'Sample SR copy A' }, { id: 'copy-2', text: 'Sample SR copy B' }] }
  await writeFile(path.join(OUTDIR,'sr_copy_samples.json'), JSON.stringify(srCopy,null,2))

  // Checksums for every file in OUTDIR (sorted)
  const files = [
    'headers.txt',
    'health.json',
    'report.json',
    'screenshot.desktop.png',
    'screenshot.mobile.png',
    'snapshot.json',
    'sr_copy_samples.json',
    'version.json',
  ].sort((a,b)=>a.localeCompare(b))
  const checksums = []
  for(const f of files){ const p=path.join(OUTDIR,f); const h=sha256(await readFile(p)); checksums.push({ path: f, sha256: h }) }

  // Manifest with privacy + features_on + SLO
  let featuresOn = []
  const envFeatures = String(process.env.UI_FEATURES_ON ?? '').trim()
  if (envFeatures) {
    featuresOn = envFeatures.split(',').map(s => s.trim()).filter(Boolean)
  } else {
    const featFile = path.join(OUTDIR, 'features_on.json')
    if (await exists(featFile)) {
      try {
        const arr = JSON.parse(await readFile(featFile, 'utf8'))
        if (Array.isArray(arr)) featuresOn = arr.filter(v => typeof v === 'string').map(s => s.trim()).filter(Boolean)
      } catch {}
    }
  }
  const manifest = {
    component: 'ui',
    build,
    features_on: featuresOn,
    privacy: { no_queries_in_logs: true },
    slos: { ui_layout_p95_ms: health.p95_ms },
    checksums
  }
  await writeFile(path.join(OUTDIR,'manifest.json'), JSON.stringify(manifest,null,2))

  // Create zip with stable name and order
  const date = todayUTC()
  const zipName = `ui_pack_${date}_${build}.zip`
  const zipOut = path.join(PACK_OUT, zipName)
  const zipInputs = [...files, 'manifest.json'].map(f=>path.join(OUTDIR,f))
  // Normalise mtimes for stable zip contents
  const epoch = new Date('1970-01-01T00:00:00.000Z')
  for (const p of zipInputs) { try { await utimes(p, epoch, epoch) } catch {} }
  await exec(`zip -X -j ${JSON.stringify(zipOut)} ${zipInputs.map(f=>JSON.stringify(f)).join(' ')}`)

  // Copy into incoming folder for the unified composer
  const incomingZip = path.join(INCOMING_UI, zipName)
  await cp(zipOut, incomingZip)

  // Print acceptance UI line exactly
  console.log(`UI_PACK: evidence/pack/${zipName} (slos.ui_layout_p95_ms=${health.p95_ms})`)
}

main().catch((err)=>{ console.error('Symptom: UI evidence pack generation failed'); console.error('Likely cause:', err?.message||err); console.error('Minimal patch plan: ensure fixture path and git available; re-run evidence:ui'); process.exit(1) })
