#!/usr/bin/env node
import { promises as fs } from 'node:fs'
import path from 'node:path'

async function ensureDir(p){ try{ await fs.mkdir(p,{recursive:true}) }catch{} }

async function readJson(p){ try{ return JSON.parse(await fs.readFile(p,'utf8')) }catch{ return null } }

function uniq(arr){ return Array.from(new Set(arr)) }

async function main(){
  const root = process.cwd()
  const specPath = path.join(root,'docs/spec/flags-canvas.json')
  const uiManifestPath = path.join(root,'docs/evidence/ui-pack/manifest.json')
  const outDir = path.join(root,'docs/evidence/flags')
  const outPath = path.join(outDir,'manifest_drift.json')

  const expected = Array.isArray(await readJson(specPath)) ? await readJson(specPath) : []
  const uiManifest = await readJson(uiManifestPath)
  if(!uiManifest){
    console.error('Symptom: flags drift check cannot find UI manifest')
    console.error('Likely cause: UI evidence pack not generated yet')
    console.error('Minimal patch plan: run npm run evidence:ui then re-run flags drift')
    process.exit(1)
  }
  const declared = Array.isArray(uiManifest?.features_on) ? uiManifest.features_on : []
  const expSet = new Set(expected)
  const decSet = new Set(declared)
  const missing = uniq(expected.filter(f=>!decSet.has(f)))
  const extra = uniq(declared.filter(f=>!expSet.has(f)))
  const status = extra.length>0 ? 'FAIL' : (missing.length>0 ? 'WARN' : 'PASS')

  await ensureDir(outDir)
  const payload = { expected, declared, missing, extra, status }
  await fs.writeFile(outPath, JSON.stringify(payload,null,2))

  if(status==='FAIL'){
    console.error('Flags drift: FAIL')
    console.error('Extra (not in spec):', JSON.stringify(extra))
    process.exit(1)
  }
  if(status==='WARN'){
    console.warn('Flags drift: WARN (missing from UI):', JSON.stringify(missing))
  } else {
    console.log('Flags drift: PASS')
  }
}

main().catch(err=>{ console.error('Symptom: flags drift script failed'); console.error('Likely cause:', err?.message||err); console.error('Minimal patch plan: fix malformed JSON inputs; rerun'); process.exit(1) })
