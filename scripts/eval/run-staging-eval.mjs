#!/usr/bin/env node
// Staging conversation API eval — 7 scenarios, SSE by default, sync with --sync.
//
// Usage:
//   node scripts/eval/run-staging-eval.mjs
//   node scripts/eval/run-staging-eval.mjs --sync
//   node scripts/eval/run-staging-eval.mjs --scenarios=s1,s2
//
// Env: ASSIST_API_KEY required (loaded from .env.local). CEE_BASE_URL optional.

import 'dotenv/config'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

// Load .env.local explicitly (dotenv/config only reads .env).
const here = path.dirname(url.fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
const envLocal = path.join(repoRoot, '.env.local')
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal })

import { SCENARIOS } from './scenarios/index.mjs'
import { createContext } from './harness.mjs'
import { newUuid } from './state.mjs'
import { writeReports, printConsole } from './report.mjs'

function parseArgs(argv) {
  const out = { mode: 'stream', scenarioFilter: null }
  for (const a of argv) {
    if (a === '--sync') out.mode = 'sync'
    else if (a === '--stream') out.mode = 'stream'
    else if (a.startsWith('--scenarios=')) out.scenarioFilter = a.slice('--scenarios='.length).split(',').map((s) => s.trim()).filter(Boolean)
  }
  return out
}

async function main() {
  const { mode, scenarioFilter } = parseArgs(process.argv.slice(2))

  if (!process.env.ASSIST_API_KEY) {
    console.error('ERROR: ASSIST_API_KEY is not set. Put it in .env.local or the environment.')
    process.exit(2)
  }

  const startedAt = new Date().toISOString()
  console.log(`\nStarting staging eval — transport=${mode}, started ${startedAt}\n`)

  const results = []
  const scenarios = scenarioFilter
    ? SCENARIOS.filter((s) => scenarioFilter.some((f) => s.NAME.startsWith(f)))
    : SCENARIOS

  for (const scenario of scenarios) {
    console.log(`→ ${scenario.NAME}: ${scenario.DESCRIPTION}`)
    const ctx = createContext({ scenarioId: newUuid() })
    let result
    try {
      result = await scenario.run(ctx, mode)
    } catch (err) {
      console.error(`  ! ${scenario.NAME} threw:`, err?.message ?? err)
      result = {
        name: scenario.NAME,
        pass: false,
        logs: ctx.turnLogs,
        failures: [`scenario_threw:${err?.message ?? String(err)}`],
      }
    }
    results.push(result)
    console.log(`  ${result.pass ? '✓' : '✗'} ${scenario.NAME} (${result.logs.length} turns)${result.failures.length ? '  — ' + result.failures.join(' · ') : ''}\n`)
  }

  const finishedAt = new Date().toISOString()

  const outDir = path.join(repoRoot, 'eval-results')
  const { jsonPath, mdPath } = writeReports({ results, mode, startedAt, finishedAt, outDir })

  console.log('')
  printConsole(results)
  console.log(`\nJSON: ${path.relative(repoRoot, jsonPath)}`)
  console.log(`MD:   ${path.relative(repoRoot, mdPath)}`)

  const allPassed = results.every((r) => r.pass)
  process.exit(allPassed ? 0 : 1)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(2)
})
