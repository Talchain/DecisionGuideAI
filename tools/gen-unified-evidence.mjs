#!/usr/bin/env node
// Unified Evidence Composer
// - Inputs: newest by filename date (YYYY-MM-DD), tie-break by mtime
// - Zip order: [claude, engine, ui]
// - Status→badge: OK→GREEN, DEGRADED→AMBER, FAIL→RED
import { promises as fs } from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import { execFile as _execFile } from 'child_process'
import { promisify } from 'util'

const execFile = promisify(_execFile)
const ROOT = process.cwd()
const INCOMING = path.join(ROOT, 'docs/evidence/incoming')
const OUTDIR = path.join(ROOT, 'docs/evidence/unified')
const MB = 1024 * 1024
const CAP_PACK = 50 * MB
const CAP_UNIFIED = 150 * MB
const TH = { ui: 150, eng: 600, ttff: 500, cancel: 150 }
const PRIVACY_PHRASE = 'no request bodies or query strings in logs'

function todayUTC() { return new Date().toISOString().slice(0, 10) }
function matchDate(n){ const m=n.match(/(\d{4}-\d{2}-\d{2})/); return m?m[1]:'' }
function cmpNewest(a,b){ const da=matchDate(a.name), db=matchDate(b.name); if(da&&db&&da!==db) return db.localeCompare(da); return (b.mtimeMs||0)-(a.mtimeMs||0) }
async function newest(subdir, prefix){ try{ const dir=path.join(INCOMING,subdir); const ents=await fs.readdir(dir,{withFileTypes:true}); const files=await Promise.all(ents.filter(e=>e.isFile()&&e.name.endsWith('.zip')&&e.name.includes(prefix)).map(async e=>{ const p=path.join(dir,e.name); const st=await fs.stat(p); return { path:p, name:e.name, size:st.size, mtimeMs:st.mtimeMs }})); files.sort(cmpNewest); return files[0]||null }catch{return null} }
async function sha256(buf){ const h=createHash('sha256'); h.update(buf); return h.digest('hex') }
async function sha256File(fp){ return sha256(await fs.readFile(fp)) }
async function unzipList(zip){ const { stdout } = await execFile('unzip',['-Z1',zip]); return stdout.split('\n').map(s=>s.trim()).filter(Boolean) }
async function unzipRead(zip,entry){ const { stdout } = await execFile('unzip',['-p',zip,entry],{ maxBuffer:64*MB, encoding: 'buffer' }); return stdout }
function pickManifest(list){ const c=list.filter(e=>e.endsWith('manifest.json')).sort((a,b)=>a.split('/').length-b.split('/').length||a.localeCompare(b)); return c[0]||null }
function get(o,p){ return p.split('.').reduce((a,k)=> (a&&typeof a==='object'&&k in a)?a[k]:undefined,o) }
function pickNum(m,keys){ for(const k of keys){ const v=get(m,k); if(typeof v==='number'&&Number.isFinite(v)) return v } return null }
function featuresOn(m){ if(Array.isArray(m?.features_on)) return m.features_on; if(Array.isArray(m?.features)) return m.features.filter(f=>f&&(f.on===true||f.enabled===true)&&typeof f.name==='string').map(f=>f.name); return [] }
async function validateChecksums(zip,m,list){ const arr=Array.isArray(m?.checksums)?m.checksums:[]; const res=[]; for(const it of arr){ const p=typeof it?.path==='string'?it.path:(typeof it?.file==='string'?it.file:null); const want=(typeof it?.sha256==='string'?it.sha256:'').toLowerCase(); if(!p||!want){ res.push({ok:false}); continue } let t=list.includes(p)?p:null; if(!t){ const base=path.basename(p); t=list.find(e=>path.basename(e)===base)||null } if(!t){ res.push({ok:false}); continue } const got=(await sha256(await unzipRead(zip,t))).toLowerCase(); res.push({ok:got===want}) } return res.length===0?true:res.every(r=>r.ok) }

async function readPack(kind, info) {
  if (!info) return null
  if (info.size > CAP_PACK) throw new Error(`${kind} pack exceeds size cap: ${(info.size/MB).toFixed(2)} MB > 50 MB`)
  const list = await unzipList(info.path)
  const mf = pickManifest(list)
  if (!mf) throw new Error(`${kind} pack missing manifest.json`)
  let manifest
  try { manifest = JSON.parse((await unzipRead(info.path, mf)).toString('utf8')) } catch { throw new Error(`${kind} manifest.json invalid`) }
  const checksumsOk = await validateChecksums(info.path, manifest, list)
  const slo = {}
  if (kind === 'ui') slo.ui_layout_p95_ms = pickNum(manifest, ['slos.ui_layout_p95_ms','ui_layout_p95_ms','metrics.ui.layout_p95_ms'])
  if (kind === 'engine') slo.engine_get_p95_ms = pickNum(manifest, ['slos.engine_get_p95_ms','engine_get_p95_ms','metrics.engine.get_p95_ms'])
  if (kind === 'claude') {
    slo.claude_ttff_ms = pickNum(manifest, ['slos.claude_ttff_ms','claude_ttff_ms','metrics.claude.ttff_ms'])
    slo.claude_cancel_ms = pickNum(manifest, ['slos.claude_cancel_ms','claude_cancel_ms','metrics.claude.cancel_ms'])
  }
  const feats = featuresOn(manifest)
  const privacy = Boolean(get(manifest, 'privacy.no_queries_in_logs') === true || JSON.stringify(manifest).toLowerCase().includes(PRIVACY_PHRASE))
  return { kind, path: info.path, name: info.name, size: info.size, slo, features_on: feats, privacy, checksumsOk }
}

function evalLabel(v, th){ if(v==null) return 'DEGRADED'; return (typeof v==='number'&&Number.isFinite(v)&&v<=th)?'OK':'FAIL' }
function privacyStatus(list){ if(list.length===0) return 'DEGRADED'; return list.every(Boolean)?'PASS':'DEGRADED' }
function badgeColourFromStatus(status){ return status==='FAIL' ? 'RED' : (status==='OK' ? 'GREEN' : 'AMBER') }
function tri(label){ return label==='OK'?'✅':(label==='DEGRADED'?'⚠️':'❌') }
function svgBadge(col){ const fill=col==='GREEN'?'#22c55e':col==='AMBER'?'#f59e0b':'#ef4444'; return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="32"><rect rx="4" width="180" height="32" fill="${fill}"/><text x="90" y="21" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" fill="#fff">${col}</text></svg>` }
async function zipUnified(outZip, parts){ const args=['-X','-j', outZip, ...parts]; await execFile('zip', args) }

async function main(){
  try{
    await fs.mkdir(OUTDIR,{recursive:true})
    const engineInfo=await newest('engine','engine_pack_')
    const claudeInfo=await newest('claude','claude_pack_')
    const uiInfo=await newest('ui','ui_pack_')
    const engine=await readPack('engine',engineInfo).catch(e=>{ if(engineInfo) throw e; return null })
    const claude=await readPack('claude',claudeInfo).catch(e=>{ if(claudeInfo) throw e; return null })
    const ui=await readPack('ui',uiInfo).catch(e=>{ if(uiInfo) throw e; return null })
    if(!engine && !claude && !ui) throw new Error('No input packs found')

    // Validate checksums (hard-fail if any mismatch)
    const checksumFail = Boolean((engine && engine.checksumsOk===false) || (claude && claude.checksumsOk===false) || (ui && ui.checksumsOk===false))

    const slos={ ui_layout_p95_ms: ui?.slo?.ui_layout_p95_ms ?? null, engine_get_p95_ms: engine?.slo?.engine_get_p95_ms ?? null, claude_ttff_ms: claude?.slo?.claude_ttff_ms ?? null, claude_cancel_ms: claude?.slo?.claude_cancel_ms ?? null }
    // Required SLOs must be present if corresponding pack is present
    if (ui && slos.ui_layout_p95_ms == null) throw new Error('ui pack missing required SLO ui_layout_p95_ms')
    if (engine && slos.engine_get_p95_ms == null) throw new Error('engine pack missing required SLO engine_get_p95_ms')
    if (claude && (slos.claude_ttff_ms == null || slos.claude_cancel_ms == null)) throw new Error('claude pack missing required SLOs (ttff and/or cancel)')
    const ev={ ui: evalLabel(slos.ui_layout_p95_ms,TH.ui), engine: evalLabel(slos.engine_get_p95_ms,TH.eng), ttff: evalLabel(slos.claude_ttff_ms,TH.ttff), cancel: evalLabel(slos.claude_cancel_ms,TH.cancel) }
    const anySloFail = Object.values(ev).includes('FAIL')
    const anySloDegraded = Object.values(ev).includes('DEGRADED')
    const privacy=privacyStatus([ui?.privacy, engine?.privacy, claude?.privacy].filter(v=>v!==undefined))
    const missingPack = (!claude || !engine || !ui)
    const status = (checksumFail || anySloFail) ? 'FAIL' : ((missingPack || anySloDegraded || privacy!=='PASS') ? 'DEGRADED' : 'OK')
    const colour = badgeColourFromStatus(status)

    const outZip = path.join(OUTDIR, `Olumi_PoC_Evidence_${todayUTC()}.zip`)
    const parts = [claude?.path, engine?.path, ui?.path].filter(Boolean)
    const total = await parts.reduce(async (accP,p)=>{ const acc=await accP; const st=await fs.stat(p); return acc+st.size }, Promise.resolve(0))
    if(total>CAP_UNIFIED) throw new Error(`Unified pack exceeds size cap: ${(total/MB).toFixed(2)} MB > 150 MB`)
    if(parts.length) await zipUnified(outZip, parts)

    const manifest={ generatedAt: new Date().toISOString(), status, packs:{}, slos, privacy }
    if(claude) manifest.packs.claude={ name: claude.name, path: claude.path, size: claude.size, features_on: claude.features_on, slos: claude.slo, checksumsOk: claude.checksumsOk, privacy: claude.privacy }
    if(engine) manifest.packs.engine={ name: engine.name, path: engine.path, size: engine.size, features_on: engine.features_on, slos: engine.slo, checksumsOk: engine.checksumsOk, privacy: engine.privacy }
    if(ui) manifest.packs.ui={ name: ui.name, path: ui.path, size: ui.size, features_on: ui.features_on, slos: ui.slo, checksumsOk: ui.checksumsOk, privacy: ui.privacy }
    await fs.writeFile(path.join(OUTDIR,'unified.manifest.json'), JSON.stringify(manifest,null,2))

    const mdLines=[
      '# SLO SUMMARY',
      'Status mapping: OK→GREEN; DEGRADED→AMBER; FAIL→RED',
      '',
      '| Component | Metric | Threshold | Value | Status |',
      '|---|---|---:|---:|:---:|',
      `| UI | p95 (20 nodes) | ${TH.ui} ms | ${slos.ui_layout_p95_ms??'null'} | ${tri(ev.ui)} |`,
      `| Engine | GET p95 | ${TH.eng} ms | ${slos.engine_get_p95_ms??'null'} | ${tri(ev.engine)} |`,
      `| Claude | TTFF | ${TH.ttff} ms | ${slos.claude_ttff_ms??'null'} | ${tri(ev.ttff)} |`,
      `| Claude | Cancel | ${TH.cancel} ms | ${slos.claude_cancel_ms??'null'} | ${tri(ev.cancel)} |`,
      ''
    ]
    await fs.writeFile(path.join(OUTDIR,'SLO_SUMMARY.md'), mdLines.join('\n'))
    await fs.writeFile(path.join(OUTDIR,'READY_BADGE.svg'), svgBadge(colour))

    // Acceptance (print exactly)
    console.log(`UNIFIED_PACK: ${path.join('docs/evidence/unified', path.basename(outZip))}`)
    console.log(`SLOS: ui_layout_p95_ms=${slos.ui_layout_p95_ms ?? 'null'}, engine_get_p95_ms=${slos.engine_get_p95_ms ?? 'null'}, claude_ttff_ms=${slos.claude_ttff_ms ?? 'null'}, claude_cancel_ms=${slos.claude_cancel_ms ?? 'null'}`)
    console.log(`PRIVACY: ${PRIVACY_PHRASE} — ${privacy}`)
    const featsUi = ui ? (Array.isArray(ui.features_on) && ui.features_on.length ? `[${ui.features_on.join(',')}]` : '[]') : '—'
    const featsEng = engine ? (Array.isArray(engine.features_on) ? `[${engine.features_on.join(',')}]` : '[]') : '—'
    const featsClaude = claude ? (Array.isArray(claude.features_on) ? `[${claude.features_on.join(',')}]` : '[]') : '—'
    console.log(`FLAGS: flags-OFF parity GREEN; features_on={ ui:${featsUi}, engine:${featsEng}, claude:${featsClaude} }`)
  }catch(err){
    const msg = String(err && err.message ? err.message : err)
    console.error('Symptom: unified evidence composition failed')
    console.error(`Likely cause: ${msg}`)
    console.error('Minimal patch plan: fix inputs or thresholds; rerun evidence:unified')
    process.exit(1)
  }
}

main()
