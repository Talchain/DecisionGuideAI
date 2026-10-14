// Real local Postgres only. Never reads a Supabase URL/key or connects externally.
// Usage: node race.mjs ../../migrations/20261011100000_checked_guest_copy_function.sql
// The lookup->insert sleep is test instrumentation in BOTH RPC bodies, not a migration change.
// One ephemeral cluster; fresh database per scenario; real sessions/transactions/locks.
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const migration = process.argv[2]
if (!migration) { console.error('no migration given'); process.exit(2) }
const checked = fs.readFileSync(migration, 'utf8')
const legacy = fs.readFileSync(new URL('../../migrations/20261001222932_copy_guest_scenario_20261001.sql', import.meta.url), 'utf8')
const setup = fs.readFileSync(new URL('setup.sql', import.meta.url), 'utf8')
const LOOKUP_END = "    RETURN pg_catalog.jsonb_build_object('scenario_id', v_existing, 'created', false);\n  END IF;\n"
const LOCK = /  PERFORM pg_catalog\.pg_advisory_xact_lock\([\s\S]*?\n  \);\n/
const ROLES = 'create role anon nologin; create role authenticated nologin; create role service_role nologin;'
if (!setup.includes(ROLES)) throw new Error('setup role injection point missing')
for (const [name, sql] of [['legacy', legacy], ['checked', checked]]) {
  if (sql.split(LOOKUP_END).length !== 2 || !LOCK.test(sql)) throw new Error(`${name} injection point changed`)
}
const widen = sql => sql.replace(LOOKUP_END, LOOKUP_END + '  PERFORM pg_catalog.pg_sleep(0.3);\n')
const shippedChecked = widen(checked), widenedLegacy = widen(legacy)
const unlockedChecked = shippedChecked.replace(LOCK, '')
if (unlockedChecked === shippedChecked) throw new Error('lock control did not mutate checked source')
const U = n => `00000000-0000-0000-0000-0000000000${n}`
const ME = U('0a'), OTHER = U('0b'), GUEST = U('a1')
const GRAPH = { nodes: [{ id: 'goal', kind: 'goal', label: 'Checked guest state' }], edges: [] }
const MOVED_GRAPH = { nodes: [{ id: 'goal', kind: 'goal', label: 'Writer committed a different graph' }], edges: [] }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
function assert(claim, detail) { if (!claim) throw new Error(JSON.stringify(detail)) }
const results = []
async function record(name, run) {
  try { const observed = await run(); results.push({ name, pass: true, observed }); console.log('PASS', name, JSON.stringify(observed)) }
  catch (error) { results.push({ name, pass: false, error: error.message }); console.error('FAIL', name, error.stack) }
}
// Reserve a loopback port; no remote address/configuration can enter the connection factory.
const reservation = net.createServer()
await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve) })
const port = reservation.address().port
await new Promise(resolve => reservation.close(resolve))
const dir = fs.mkdtempSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '.run10-race-'))
const server = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'local-race', port,
  persistent: false, postgresFlags: ['-c', 'listen_addresses=127.0.0.1'],
  onLog: message => console.log('[local postgres]', message), onError: message => console.error('[local postgres]', message) })
let started = false, databaseNumber = 0
async function withDatabase(checkedBody, run) {
  const database = `guest_copy_race_${databaseNumber++}`
  const maintenance = server.getPgClient('postgres','127.0.0.1')
  try { await maintenance.connect(); await maintenance.query(`CREATE DATABASE ${maintenance.escapeIdentifier(database)}`) }
  finally { await maintenance.end() }
  const clients = []
  const connect = async () => {
    const c = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', password: 'local-race', database,
      application_name: database, connectionTimeoutMillis: 5000 })
    await c.connect(); clients.push(c); return c
  }
  const admin = await connect()
  try {
    await admin.query(databaseNumber === 1 ? setup : setup.replace(ROLES, ''))
    // Legacy source is unchanged in the repository; widened only in this test DB.
    await admin.query(widenedLegacy)
    await admin.query(checkedBody)
    await admin.query('insert into auth.users values ($1,$2),($3,$4)', [ME,'me@local.test',OTHER,'other@local.test'])
    await admin.query('insert into public.scenarios(id,user_id,title,graph,revision) values ($1,null,$2,$3,7)', [GUEST,'Throwaway guest',GRAPH])
    const begin = async (isolation = 'READ COMMITTED') => {
      assert(['READ COMMITTED', 'REPEATABLE READ'].includes(isolation), isolation)
      const c = await connect()
      await c.query(`BEGIN ISOLATION LEVEL ${isolation}`)
      await c.query("SET LOCAL statement_timeout='10s'; SET LOCAL lock_timeout='10s'")
      return c
    }
    const asService = async c => { await c.query('SET LOCAL ROLE service_role'); return c }
    const copySql = (c, kind) => kind === 'checked'
      ? c.query('select public.copy_guest_scenario_checked($1,$2,$3::jsonb,$4) as r', [GUEST,ME,JSON.stringify(GRAPH),7])
      : c.query('select public.copy_guest_scenario($1,$2) as r', [GUEST,ME])
    const finishCopy = async (c, kind) => {
      try { const r = (await copySql(c,kind)).rows[0].r; await c.query('COMMIT'); return {ok:true,...r} }
      catch (error) { await c.query('ROLLBACK'); return {ok:false,code:error.code,message:error.message} }
    }
    const poll = async (label, query, params, matches) => {
      const deadline = Date.now() + 5000
      let rows
      while (Date.now() < deadline) {
        rows = (await admin.query(query,params)).rows
        if (matches(rows)) return rows
        await delay(10)
      }
      throw new Error(`${label}: not observed; last=${JSON.stringify(rows)}`)
    }
    const waitSleep = c => poll('lookup->insert sleep', 'select wait_event from pg_catalog.pg_stat_activity where pid=$1', [c.processID], r => r[0]?.wait_event === 'PgSleep')
    const waitBlockedBy = (blocked, blocker) => poll('real source lock wait', 'select pg_catalog.pg_blocking_pids($1) as blockers', [blocked.processID], r => r[0]?.blockers.includes(blocker.processID))
    const destinations = async () => (await admin.query('select id,user_id,source_scenario_id,graph,graph::text as graph_text from public.scenarios where source_scenario_id=$1 order by id',[GUEST])).rows
    const source = async () => (await admin.query('select user_id,graph,revision from public.scenarios where id=$1',[GUEST])).rows[0]
    return await run({admin,begin,asService,copySql,finishCopy,waitSleep,waitBlockedBy,destinations,source})
  } finally {
    await Promise.allSettled(clients.map(c => c.end()))
  }
}
async function copyingRace(kinds, control) {
  return withDatabase(control ? unlockedChecked : shippedChecked, async h => {
    const clients = await Promise.all(kinds.map(async () => h.asService(await h.begin())))
    // Establish the requested first arrival inside its actual lookup->insert gap,
    // then release the other seven callers while its transaction is still open.
    const first = h.finishCopy(clients[0],kinds[0])
    await h.waitSleep(clients[0])
    const answers = await Promise.all([first,...clients.slice(1).map((c,i) => h.finishCopy(c,kinds[i+1]))])
    const rows = await h.destinations()
    const observed = {first:kinds[0],sessions:kinds,ids:new Set(answers.filter(a=>a.ok).map(a=>a.scenario_id)).size,
      created:answers.filter(a=>a.ok&&a.created).length,rows:rows.length,errors:answers.filter(a=>!a.ok)}
    assert(observed.errors.length === 0, observed)
    assert(rows.every(r => r.user_id === ME && r.source_scenario_id === GUEST && isDeepStrictEqual(r.graph,GRAPH)), rows)
    assert(control ? observed.ids > 1 && observed.created > 1 && observed.rows > 1
      : observed.ids === 1 && observed.created === 1 && observed.rows === 1, observed)
    return observed
  })
}
async function sourceRace(kind, first) {
  return withDatabase(shippedChecked, async h => {
    const writer = await h.begin(), copier = await h.asService(await h.begin())
    const write = async () => {
      if (kind === 'claim') {
        await writer.query('select id from public.scenarios where id=$1 for update',[GUEST])
        await writer.query('update public.scenarios set user_id=$1 where id=$2',[OTHER,GUEST])
      } else await writer.query('update public.scenarios set graph=$1 where id=$2',[MOVED_GRAPH,GUEST])
    }
    let copied, wait, order
    if (first === 'writer') {
      await write() // Hold UPDATE / FOR UPDATE transaction open across the copy's check.
      const pendingCopy = h.finishCopy(copier,'checked')
      wait = await h.waitBlockedBy(copier,writer)
      await writer.query('COMMIT')
      copied = await pendingCopy
      order = ['writer_commit','copy_refused']
      assert(!copied.ok && copied.code === 'CG412', copied)
    } else {
      // Keep the successful checked call's FOR SHARE lock through commit.
      const receipt = (await h.copySql(copier,'checked')).rows[0].r
      const pendingWrite = write()
      // Attach rejection handling immediately while observing the lock wait.
      const completion = pendingWrite.then(()=>({ok:true}),error=>({ok:false,error}))
      wait = await h.waitBlockedBy(writer,copier)
      await copier.query('COMMIT')
      const written = await completion
      if (!written.ok) throw written.error
      await writer.query('COMMIT')
      copied = {ok:true,...receipt}; order = ['copy_commit','writer_commit']
      assert(copied.created === true, copied)
    }
    const rows = await h.destinations(), source = await h.source()
    const shouldCopy = first === 'copy'
    assert(rows.length === (shouldCopy ? 1 : 0), rows)
    if (shouldCopy) assert(rows[0].id === copied.scenario_id && rows[0].user_id === ME
      && rows[0].source_scenario_id === GUEST && isDeepStrictEqual(rows[0].graph,GRAPH), {copied,rows})
    assert(isDeepStrictEqual(source.graph,kind === 'graph' ? MOVED_GRAPH : GRAPH)
      && source.user_id === (kind === 'claim' ? OTHER : null)
      && Number(source.revision) === (kind === 'graph' ? 8 : 7), source)
    return {kind,first,order,lock_wait_observed:wait.length===1,outcome:copied.ok?'created:true / checked graph':'CG412',
      rows:rows.length,copied_graph:rows[0]?.graph??null,source}
  })
}
try {
  await server.initialise(); await server.start(); started = true
  await record('CHECKED_8_SHIPPED',()=>copyingRace(Array(8).fill('checked'),false))
  await record('CHECKED_8_LOCK_REMOVED_CONTROL',()=>copyingRace(Array(8).fill('checked'),true))
  for (const first of ['checked','legacy']) {
    const second = first === 'checked' ? 'legacy' : 'checked'
    const kinds = [...Array(4).fill(first),...Array(4).fill(second)]
    await record(`MIXED_${first.toUpperCase()}_FIRST_SHIPPED`,()=>copyingRace(kinds,false))
    await record(`MIXED_${first.toUpperCase()}_FIRST_CHECKED_LOCK_REMOVED_CONTROL`,()=>copyingRace(kinds,true))
  }
  for (const kind of ['graph','claim']) for (const first of ['writer','copy']) {
    await record(`${kind.toUpperCase()}_${first.toUpperCase()}_FIRST`,()=>sourceRace(kind,first))
  }
  await record('REPEATABLE_READ_REFUSED',()=>withDatabase(shippedChecked, async h => {
    const c = await h.asService(await h.begin('REPEATABLE READ'))
    const before = await h.source()
    const outcome = await h.finishCopy(c,'checked')
    const rows = await h.destinations(), after = await h.source()
    assert(!outcome.ok && outcome.code === '25000'
      && outcome.message === 'copy_guest_scenario_checked: requires READ COMMITTED'
      && rows.length === 0 && isDeepStrictEqual(before,after), {outcome,rows,before,after})
    return {code:outcome.code,rows:rows.length,source_unchanged:isDeepStrictEqual(before,after)}
  }))
} finally {
  if (started) await server.stop()
  fs.rmSync(dir,{recursive:true,force:true})
}
console.log('SCENARIO_TABLE',JSON.stringify(results))
console.log(`SUMMARY ${results.filter(r=>r.pass).length}/${results.length} scenarios PASS`)
process.exitCode = results.some(r=>!r.pass) ? 1 : 0
