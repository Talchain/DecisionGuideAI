// Isolated evidence server. No provider adapters, keys, environment files or prompt files are loaded.
import http from 'node:http'
import { Store } from '/Users/paulslee/olumi-work/worktrees/d-words-night/src/store/store.ts'
import { Service } from '/Users/paulslee/olumi-work/worktrees/d-words-night/src/app/service.ts'
import { createApp } from '/Users/paulslee/olumi-work/worktrees/d-words-night/src/server/app.ts'
import { uiFrom, buildOf } from '/Users/paulslee/olumi-work/worktrees/d-words-night/src/server/ui.ts'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
const core = execFileSync('git', ['-C', '/Users/paulslee/olumi-work/worktrees/d-words-night', 'rev-parse', 'HEAD'], {encoding:'utf8'}).trim()
if (core !== 'a4ecada53048ab457e8d1f270766d1d915b8d120') throw new Error('Evidence View source pin moved')
const apps = new Map(), stores = new Map()
let selected = 'approved', calls = 0
function app(tag) {
  if (!/^(approved|pending|approve-(?:2000|1128|133)|discard-(?:2000|1128|133)|pair|pair-(?:2000|1128|133)|pair-main-(?:2000|1128|133)|edit-(?:2000|1128|133)|failure-(?:2000|1128|133))$/.test(tag)) throw new Error('Unknown evidence copy')
  if (!apps.has(tag)) {
    const store = new Store(resolve('.night-data', tag, 'olumi.db')); stores.set(tag, store)
    const service = new Service(store, { prompts: {draft:'Offline failure test',update:'Offline failure test',coach:'Offline failure test',descriptions:{}}, flags: [], today: () => '2026-11-14', commit: core,
      caller: async () => { calls++; await new Promise(r => setTimeout(r, 3000)); throw new Error('Offline evidence run: providers disabled before any request') } })
    apps.set(tag, createApp({service, page: () => ({html:'',js:''}), adminKey:'night-new-isolated-evidence-admin', commit:core, secureCookie:false,
      ui:uiFrom('/Users/paulslee/olumi-work/paul-copy-ui/scenario-ui-new-night/dist'), build:buildOf('/Users/paulslee/olumi-work/paul-copy-ui/scenario-ui-new-night/dist'), ...(tag.startsWith('failure-') ? {} : {calls:{cap:0,used:()=>0}})}))
  }
  return apps.get(tag)
}
const server = http.createServer((req,res) => {
  if (req.url?.startsWith('/night/select/')) { selected = req.url.slice('/night/select/'.length); app(selected); res.end('Selected isolated copy'); return }
  if (req.url === '/night/calls') { res.setHeader('content-type','application/json'); res.end(JSON.stringify({blocked: calls, providerRequests:0, core})); return }
  app(selected).emit('request',req,res)
})
server.listen(4132,'127.0.0.1',() => console.log(`Isolated evidence server :4132, core ${core}, providers disabled`))
process.on('SIGTERM', () => server.close(() => process.exit(0)))
