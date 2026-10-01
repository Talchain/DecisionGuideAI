// Race proof for copy_guest_scenario on a REAL Postgres (PGlite has one connection, so run.mjs cannot race).
// Usage: node race.mjs <migration.sql>   (needs: npm i --no-save embedded-postgres@17.6.0-beta.15 pg)
// N sessions call the function at once, each inside its own open transaction. A pg_sleep is injected between the
// idempotent lookup and the INSERT to hold the race window open. Two variants run on fresh databases:
//   AS SHIPPED     → every session must return the SAME copy id, exactly one created=true, one row.
//   LOCK REMOVED   → the control: must produce MORE than one copy, proving the window is real and the lock closes it.
// Exits 1 unless both hold.
import EmbeddedPostgres from 'embedded-postgres'
import pg from 'pg'
import fs from 'fs'
import os from 'os'
import path from 'path'

const migration = process.argv[2]
if (!migration) { console.error('no migration given'); process.exit(2) }
const N = 8
const sql = fs.readFileSync(migration, 'utf8')
const LOOKUP_END = "    RETURN pg_catalog.jsonb_build_object('scenario_id', v_existing, 'created', false);\n  END IF;\n"
const LOCK = /  PERFORM pg_catalog\.pg_advisory_xact_lock\([\s\S]*?\n  \);\n/
if (sql.split(LOOKUP_END).length !== 2 || !LOCK.test(sql)) { console.error('migration shape changed: injection points not found'); process.exit(2) }
const widened = sql.replace(LOOKUP_END, LOOKUP_END + '  PERFORM pg_catalog.pg_sleep(0.3);\n')
const variants = { 'AS SHIPPED': widened, 'LOCK REMOVED': widened.replace(LOCK, '') }

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guest-copy-race-'))
const port = 54000 + Math.floor(Math.random() * 900)
const server = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'race', port, persistent: false })
await server.initialise(); await server.start()
const U = n => `00000000-0000-0000-0000-0000000000${n}`
const ME = U('0a'), GUEST = U('a1')
const results = {}
try {
  let i = 0
  for (const [name, body] of Object.entries(variants)) {
    const db = `race${i++}`
    await server.createDatabase(db)
    const conn = () => new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'race', database: db })
    const admin = conn(); await admin.connect()
    // Roles are cluster-wide: create them with the first database only.
    const setup = fs.readFileSync(new URL('setup.sql', import.meta.url), 'utf8')
    const ROLES = 'create role anon nologin; create role authenticated nologin; create role service_role nologin;'
    if (!setup.includes(ROLES)) { console.error('setup.sql shape changed: role line not found'); process.exit(2) }
    await admin.query(i === 1 ? setup : setup.replace(ROLES, ''))
    await admin.query(body)
    await admin.query(`insert into auth.users values ('${ME}','me@x.test');
      insert into public.scenarios(id,user_id,title,graph) values ('${GUEST}',null,'Guest decision','{"nodes":[{"id":"g"}],"edges":[]}')`)
    const clients = await Promise.all(Array.from({ length: N }, async () => { const c = conn(); await c.connect(); return c }))
    const answers = await Promise.all(clients.map(async (c) => {
      await c.query('begin'); await c.query('set local role service_role')
      const r = await c.query(`select public.copy_guest_scenario('${GUEST}','${ME}') as r`)
      await c.query('commit'); return r.rows[0].r
    }))
    const rows = Number((await admin.query(`select count(*) as n from public.scenarios where source_scenario_id='${GUEST}' and user_id='${ME}'`)).rows[0].n)
    results[name] = { ids: new Set(answers.map(a => a.scenario_id)).size, created: answers.filter(a => a.created).length, rows }
    console.log(name.padEnd(13), JSON.stringify(results[name]))
    await Promise.all(clients.map(c => c.end())); await admin.end()
  }
} finally {
  await server.stop(); fs.rmSync(dir, { recursive: true, force: true })
}
const shipped = results['AS SHIPPED'], control = results['LOCK REMOVED']
const pass = shipped && control && shipped.ids === 1 && shipped.created === 1 && shipped.rows === 1 && control.rows > 1
console.log(pass ? `PASS: ${N} concurrent sessions → one copy; without the lock → ${control.rows} copies` : 'FAIL')
process.exit(pass ? 0 : 1)
