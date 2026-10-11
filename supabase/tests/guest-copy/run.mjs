// Dry run of copy_guest_scenario on PGlite (in-process Postgres). Never touches
// Supabase. Usage: node run.mjs <migration.sql>
// Every row binds to exact identities (ids, SQLSTATE + message, row tuples).
// Exits 1 if any row fails, or if no migration was applied.
import { PGlite } from '@electric-sql/pglite'
import fs from 'fs'

const migrations = process.argv.slice(2)
if (migrations.length === 0) { console.error('no migration given'); process.exit(2) }
const baseline = fs.readFileSync(new URL('../../migrations/20261001222932_copy_guest_scenario_20261001.sql', import.meta.url), 'utf8')
const forward = migrations.map(m => fs.readFileSync(m, 'utf8')).join('\n')
if (!forward.includes('p_checked_source_graph')) throw new Error('expected checked migration')
async function runVariant(name, applied, checked) {
console.log(`\nVARIANT ${name}`)
const db = new PGlite()
await db.exec(fs.readFileSync(new URL('setup.sql', import.meta.url), 'utf8'))
await db.exec(baseline)
if (applied) await db.exec(applied)

const U = n => `00000000-0000-0000-0000-0000000000${n}`
const ME = U('0a'), OTHER = U('0b'), GHOST = U('0c')            // GHOST: not an auth user
const GUEST = U('a1'), OWNED = U('a2'), EMPTY = U('a3'), ABSENT = U('a4'), HUGE = U('a5'), EDGE = U('a6'), GUEST2 = U('a7'), MV = U('c1')
// GUEST is shaped like what the guest turn path leaves: a graph, the brief, the
// CAS hash, a Run (analysis columns, CEE's analysis brief, events, a model
// version), schema version 3, and turn + fact rows. Only graph + title may travel.
await db.exec(`
insert into auth.users values ('${ME}','me@x.test'),('${OTHER}','other@x.test');
insert into public.model_versions values ('${MV}');
insert into public.scenarios(id,user_id,title,scenario_schema_version,stage,graph,framing,brief_text,graph_identity_hash,analysis_status,analysis,brief,events,event_seq,latest_analysis_summary,rolling_summary,current_model_version_id,last_turn_nonce,analysis_provenance,analysis_error,analysis_invalidated_at,is_pinned)
values ('${GUEST}',null,'Hire a second engineer?',3,'evaluate',
  '{"nodes":[{"id":"goal","kind":"goal","label":"Ship faster"}],"edges":[]}',
  '{"goal":"Ship faster"}','Should we hire a second engineer this quarter?','h-guest-1',
  'ready','{"run":"r1"}','{"headline":"Hire"}','[{"event_id":"e1","event_type":"graph_saved"}]',1,
  '{"p":0.6}','{"summary":"..."}','${MV}',3,'{"seed":42}','{"e":"x"}',now(),true),
 ('${OWNED}','${OTHER}','Theirs',1,'frame','{"nodes":[],"edges":[]}',null,null,null,'none',null,null,'[]',0,null,null,null,0,null,null,null,false),
 ('${EMPTY}',null,'No model yet',1,'frame',null,null,null,null,'none',null,null,'[]',0,null,null,null,0,null,null,null,false),
 ('${HUGE}',null,'Too big',1,'frame',jsonb_build_object('nodes', jsonb_build_array(jsonb_build_object('id','n','label',repeat('x',1048577))),'edges','[]'::jsonb),null,null,null,'none',null,null,'[]',0,null,null,null,0,null,null,null,false),
 ('${EDGE}',null,'Just under the cap',1,'frame',jsonb_build_object('nodes', jsonb_build_array(jsonb_build_object('id','n','label',repeat('x',1048576 - 50))),'edges','[]'::jsonb),null,null,null,'none',null,null,'[]',0,null,null,null,0,null,null,null,false);
insert into public.v5_conversation_turns(id,scenario_id,user_id) values ('${U('d1')}','${GUEST}',null);
insert into public.v5_handler_facts(scenario_id,user_id,v5_conversation_turn_id) values ('${GUEST}',null,'${U('d1')}');
`)

async function as(role, uid, sql) {
  const claims = JSON.stringify(uid ? { sub: uid, role } : { role })
  try {
    await db.exec(`set role ${role}`)
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims])
    const r = await db.query(sql)
    return { ok: true, rows: r.rows }
  } catch (e) {
    return { ok: false, code: e.code, err: e.message }
  } finally {
    await db.exec('reset role')
  }
}
// Key-order-free comparison: jsonb stores object keys sorted, so compare canonical forms.
const canon = v => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))
const q = async sql => (await db.query(sql)).rows
const copy = (src, user) => as('service_role', null, `select public.copy_guest_scenario('${src}','${user}') as r`)
const rowText = async id => (await q(`select row_to_json(s)::text as t from public.scenarios s where id = '${id}'`))[0]?.t ?? null
const count = async where => Number((await q(`select count(*)::int as n from public.scenarios where ${where}`))[0].n)

const results = []
const row = (id, name, pass, detail) => { results.push({ id, name, pass: !!pass }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name}${pass ? '' : ' :: ' + JSON.stringify(detail)}`) }
const total0 = await count('true')
const guestBefore = await rowText(GUEST)

// C1 the owner copy: a NEW row owned by the caller, carrying exactly the model and the user's words.
const c1 = await copy(GUEST, ME)
const id1 = c1.ok ? c1.rows[0].r.scenario_id : null
// EVERY column except id/created_at/updated_at, so a column added to the copy by mistake turns this row red.
const cols = (await q(`select column_name from information_schema.columns where table_schema='public' and table_name='scenarios' and column_name not in ('id','created_at','updated_at') order by ordinal_position`)).map(r => r.column_name)
const got = id1 ? (await q(`select ${cols.join(',')} from public.scenarios where id = '${id1}'`))[0] : null
// DL condition 1: graph + title, the owner, the provenance link; every other column at its never-run default.
const want = {
  revision: 0, user_id: ME, title: 'Hire a second engineer?', scenario_schema_version: 1, stage: 'frame',
  graph: { nodes: [{ id: 'goal', kind: 'goal', label: 'Ship faster' }], edges: [] }, framing: null,
  analysis_status: 'none', analysis: null, analysis_error: null, analysis_provenance: null, events: [], event_seq: 0, brief: null,
  last_turn_nonce: 0, is_pinned: false, is_archived: false, source_scenario_id: GUEST, latest_analysis_summary: null, brief_text: null,
  current_model_version_id: null, rolling_summary: null, graph_identity_hash: null, analysis_invalidated_at: null,
}
row('C1', 'owner copy = a new row owned by the caller; graph + title only, every other column never-run', c1.ok && c1.rows[0].r.created === true && id1 !== GUEST
  && cols.length === Object.keys(want).length && canon(got) === canon(want), { c1, got, cols })
row('C1b', 'the copy has no turns and no facts', id1 && Number((await q(`select (select count(*) from public.v5_conversation_turns where scenario_id='${id1}') + (select count(*) from public.v5_handler_facts where scenario_id='${id1}') as n`))[0].n) === 0, {})

// C2 the guest original is byte-unchanged (whole row, every column), and its turns/facts are untouched.
row('C2', 'guest original byte-unchanged', (await rowText(GUEST)) === guestBefore, { before: guestBefore, after: await rowText(GUEST) })
row('C2b', 'guest turns and facts still unowned', Number((await q(`select count(*) as n from public.v5_conversation_turns where scenario_id='${GUEST}' and user_id is null`))[0].n) === 1
  && Number((await q(`select count(*) as n from public.v5_handler_facts where scenario_id='${GUEST}' and user_id is null`))[0].n) === 1, {})

// C3 a second call returns the SAME copy, and makes no second row.
const c3 = await copy(GUEST, ME)
row('C3', 'second call → same copy id, created=false, one row', c3.ok && c3.rows[0].r.scenario_id === id1 && c3.rows[0].r.created === false
  && (await count(`source_scenario_id='${GUEST}' and user_id='${ME}'`)) === 1, c3)

// C4 an OWNED source is refused, and nothing is written.
const n4 = await count('true')
const c4 = await copy(OWNED, ME)
row('C4', 'owned source refused (CG409), nothing written', !c4.ok && c4.code === 'CG409' && c4.err === 'copy_guest_scenario: source is not a guest scenario' && (await count('true')) === n4, c4)

// C5 anon and authenticated cannot call it at all (only service_role).
const c5a = await as('anon', null, `select public.copy_guest_scenario('${GUEST}','${ME}')`)
const c5b = await as('authenticated', ME, `select public.copy_guest_scenario('${GUEST}','${ME}')`)
row('C5', 'anon refused', !c5a.ok && c5a.err === 'permission denied for function copy_guest_scenario', c5a)
row('C5b', 'authenticated refused (the owner comes from CEE\'s verified JWT only)', !c5b.ok && c5b.err === 'permission denied for function copy_guest_scenario', c5b)

// C6–C8 the typed refusals.
const c6 = await copy(GUEST, GHOST)
row('C6', 'an id that is not an auth user is refused (22023)', !c6.ok && c6.code === '22023' && c6.err === 'copy_guest_scenario: p_user_id is not a known auth user', c6)
const c7 = await copy(ABSENT, ME)
row('C7', 'absent source → CG404', !c7.ok && c7.code === 'CG404' && c7.err === 'copy_guest_scenario: source not found', c7)
const c8 = await copy(EMPTY, ME)
row('C8', 'a guest source with no model → CG422', !c8.ok && c8.code === 'CG422' && c8.err === 'copy_guest_scenario: source has no model to copy', c8)

// C13 the size cap: one byte over 1 MiB is refused and nothing is written; just under it copies (the boundary pair).
const n13 = await count('true')
const c13 = await copy(HUGE, ME)
row('C13', 'a source graph over 1 MiB is refused (CG413), nothing written', !c13.ok && c13.code === 'CG413' && c13.err === 'copy_guest_scenario: source model is too large to copy' && (await count('true')) === n13, c13)
const c13b = await copy(EDGE, ME)
row('C13b', 'CONTROL: a source just under the cap copies', c13b.ok && c13b.rows[0].r.created === true, c13b)

// C9 another user copying the same guest gets THEIR OWN copy; mine is untouched.
const mine = await rowText(id1)
const c9 = await copy(GUEST, OTHER)
const id9 = c9.ok ? c9.rows[0].r.scenario_id : null
row('C9', 'a second user gets a separate copy; the first copy is unchanged', c9.ok && c9.rows[0].r.created === true && id9 !== id1 && id9 !== GUEST
  && (await q(`select user_id from public.scenarios where id='${id9}'`))[0]?.user_id === OTHER && (await rowText(id1)) === mine, c9)

// C10 hardening: SECURITY DEFINER, search_path='', EXECUTE for service_role only.
const meta = (await q(`select p.prosecdef, p.proconfig, coalesce((select array_agg(distinct a.grantee::regrole::text order by a.grantee::regrole::text) from aclexplode(p.proacl) a where a.privilege_type='EXECUTE'), '{}') as exec
  from pg_proc p where p.oid = 'public.copy_guest_scenario(${checked ? 'uuid,uuid,jsonb,bigint' : 'uuid,uuid'})'::regprocedure`))[0]
row('C10', 'SECURITY DEFINER, search_path=\'\', EXECUTE = {postgres, service_role}', meta.prosecdef === true && JSON.stringify(meta.proconfig) === JSON.stringify(['search_path=""'])
  && JSON.stringify(meta.exec) === JSON.stringify(['postgres', 'service_role']), meta)

// C11 a caller's TEMP table named `scenarios` cannot shadow the real one.
await db.exec(`set role service_role; create temp table scenarios(id uuid, user_id uuid, source_scenario_id uuid, created_at timestamptz, graph jsonb); insert into scenarios values ('${GUEST}', '${OTHER}', null, now(), null); reset role`)
const c11 = await copy(GUEST, OTHER)
// C11b the FRESH path under the same shadow (CODEX overflow on #2431): the TEMP table claims GUEST2 is OWNED with no
// graph, so a function that read it would refuse (CG409/CG422). It must read public.scenarios and copy GUEST2's model.
await db.exec(`insert into public.scenarios(id,user_id,title,graph) values ('${GUEST2}',null,'Second guest','{"nodes":[{"id":"g2"}],"edges":[]}');
  set role service_role; insert into scenarios values ('${GUEST2}', '${OTHER}', null, now(), null); reset role`)
const c11b = await copy(GUEST2, OTHER)
const id11b = c11b.ok ? c11b.rows[0].r.scenario_id : null
const fresh = id11b ? (await q(`select user_id, title, graph, source_scenario_id from public.scenarios where id = '${id11b}'`))[0] : null
await db.exec('set role service_role; drop table pg_temp.scenarios; reset role')
row('C11b', 'a TEMP `scenarios` does not shadow the FRESH path: the copy is made from public.scenarios', c11b.ok && c11b.rows[0].r.created === true
  && canon(fresh) === canon({ user_id: OTHER, title: 'Second guest', graph: { nodes: [{ id: 'g2' }], edges: [] }, source_scenario_id: GUEST2 }), { c11b, fresh })
row('C11', 'a TEMP `scenarios` does not shadow public.scenarios (replay of C9 returns the same copy)', c11.ok && c11.rows[0].r.scenario_id === id9 && c11.rows[0].r.created === false, c11)

row('C12', 'exactly the expected rows were written (3 copies + C11b\'s source + its copy)', (await count('true')) === total0 + 5, { total0, now: await count('true') })

if (checked) {
  const checkedCopy = (src, user, graph, revision) => as('service_role', null,
    `select public.copy_guest_scenario('${src}','${user}', '${JSON.stringify(graph).replaceAll("'", "''")}'::jsonb, ${revision}) as r`)
  const source = async (id, revision = 7) => {
    const graph = { nodes: [{ id: 'goal', kind: 'goal', label: 'Exact checked words' }], edges: [] }
    await db.query(`insert into public.scenarios(id,user_id,title,graph,revision) values ($1,null,'Checked',$2,$3)`, [id, graph, revision])
    return graph
  }
  const S = U('b1'), M = U('b2'), R = U('b3'), O = U('b4')
  const graph = await source(S)
  const c14 = await checkedCopy(S, ME, graph, 7)
  const checkedId = c14.rows?.[0]?.r.scenario_id
  const copiedGraph = checkedId ? (await q(`select graph from public.scenarios where id='${checkedId}'`))[0].graph : null
  row('C14', 'checked==copied success (created:true), exact jsonb bytes', c14.ok && c14.rows[0].r.created && canon(copiedGraph) === canon(graph), c14)
  const movedGraph = await source(M)
  await db.query(`update public.scenarios set graph=$1 where id=$2`, [{ ...movedGraph, words: 'moved' }, M])
  const before15 = await rowText(M), n15 = await count('true')
  const c15 = await checkedCopy(M, ME, movedGraph, 7)
  row('C15', 'MOVED_SOURCE CG412; zero rows written; whole source unchanged', !c15.ok && c15.code === 'CG412' && c15.err === 'copy_guest_scenario: checked source changed' && await count('true') === n15 && await rowText(M) === before15, c15)
  const c15c = await checkedCopy(M, ME, JSON.parse(before15).graph, 7)
  row('C15control', 'CONTROL latest checked graph succeeds', c15c.ok && c15c.rows[0].r.created === true, c15c)
  const revGraph = await source(R)
  await db.query(`update public.scenarios set revision=8 where id=$1`, [R])
  const before16 = await rowText(R), n16 = await count('true')
  const c16 = await checkedCopy(R, ME, revGraph, 7)
  row('C16', 'revision moved CG412; zero rows; source unchanged', !c16.ok && c16.code === 'CG412' && await count('true') === n16 && await rowText(R) === before16, c16)
  const c16c = await checkedCopy(R, ME, revGraph, 8)
  row('C16control', 'CONTROL latest revision succeeds', c16c.ok && c16c.rows[0].r.created === true, c16c)
  await db.query(`update public.scenarios set graph=$1,revision=8,user_id=$2 where id=$3`, [{ changed: true }, OTHER, S])
  const originalCopy = await rowText(checkedId), n17 = await count('true')
  const c17 = await checkedCopy(S, ME, graph, 7)
  row('C17', 'REPLAY_AFTER_MOVE returns original copy created:false before binding, zero new rows', c17.ok && c17.rows[0].r.scenario_id === checkedId && c17.rows[0].r.created === false && await count('true') === n17 && await rowText(checkedId) === originalCopy, c17)
  const ownerGraph = await source(O)
  await db.query(`update public.scenarios set user_id=$1 where id=$2`, [OTHER, O])
  const n18 = await count('true'), ownedBefore = await rowText(O)
  const c18 = await checkedCopy(O, ME, ownerGraph, 7)
  row('C18', 'guest status moved CG412; no writes, source unchanged', !c18.ok && c18.code === 'CG412' && await count('true') === n18 && await rowText(O) === ownedBefore, c18)
  await db.query(`update public.scenarios set user_id=null where id=$1`, [O])
  const c18c = await checkedCopy(O, ME, ownerGraph, 7)
  row('C18control', 'CONTROL guest status restored succeeds', c18c.ok && c18c.rows[0].r.created === true, c18c)
  const otherCopy = await checkedCopy(O, OTHER, ownerGraph, 7)
  row('C19', 'second checked user independent, first copy unchanged', otherCopy.ok && otherCopy.rows[0].r.created === true && otherCopy.rows[0].r.scenario_id !== c18c.rows[0].r.scenario_id && (await q(`select user_id from public.scenarios where id='${otherCopy.rows[0].r.scenario_id}'`))[0].user_id === OTHER, otherCopy)
  const P = U('b5'), pg = await source(P), n20 = await count('true')
  const partial = await as('service_role', null, `select public.copy_guest_scenario('${P}','${ME}','${JSON.stringify(pg)}'::jsonb,NULL)`)
  row('C20', 'partial checked binding refused, never unchecked', !partial.ok && partial.code === 'CG412' && await count('true') === n20, partial)
  const functions = await q(`select pg_catalog.pg_get_function_arguments(p.oid) as args from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='copy_guest_scenario'`)
  row('C21', 'exactly one signature with optional trailing defaults; legacy two-arg resolution preserved', functions.length === 1 && functions[0].args === 'p_source_scenario_id uuid, p_user_id uuid, p_checked_source_graph jsonb DEFAULT NULL::jsonb, p_checked_source_revision bigint DEFAULT NULL::bigint', functions)
  // Real SQL statement rollback: fail during destination insert, then retry.
  await db.exec(`create function public.fail_copy_insert() returns trigger language plpgsql as $$ begin if NEW.source_scenario_id is not null then raise exception 'injected insert failure' using errcode='XX000'; end if; return NEW; end $$;
    create trigger fail_copy before insert on public.scenarios for each row execute function public.fail_copy_insert();`)
  const fail = await checkedCopy(P, ME, pg, 7)
  row('C22', 'failed SQL insert persists no half-state', !fail.ok && fail.code === 'XX000' && await count('true') === n20, fail)
  await db.exec('drop trigger fail_copy on public.scenarios')
  const retry = await checkedCopy(P, ME, pg, 7)
  row('C22control', 'CONTROL retry after rollback succeeds and reloads exact graph', retry.ok && retry.rows[0].r.created === true && canon((await q(`select graph from public.scenarios where id='${retry.rows[0].r.scenario_id}'`))[0].graph) === canon(pg), retry)
}
await db.close()
const failed = results.filter(r => !r.pass)
console.log(`${name}: ${results.length - failed.length}/${results.length} rows pass`)
return { results, failed }
}
const before = await runVariant('BASELINE', '', false)
const after = await runVariant('CHECKED', forward, true)
const check = /  -- CHECKED_SOURCE_BINDING[\s\S]*?  -- END_CHECKED_SOURCE_BINDING\n/
if (!check.test(forward)) throw new Error('binding mutant injection point missing')
const block = forward.match(check)[0]
const mutants = [
  ['EQUALITY_REMOVED', forward.replace('       OR v_graph IS DISTINCT FROM p_checked_source_graph\n', ''), ['C15']],
  ['REVOKE_REMOVED', forward.replace(/^REVOKE ALL[^\n]*\n/m, ''), ['C5', 'C5b', 'C10']],
  ['CHECK_BEFORE_REPLAY', forward.replace(check, '').replace('  SELECT s.id INTO v_existing', `  SELECT s.user_id, s.graph, s.revision INTO v_owner, v_graph, v_revision FROM public.scenarios s WHERE s.id=p_source_scenario_id FOR SHARE;\n${block}  SELECT s.id INTO v_existing`), ['C17']],
]
let controlsGreen = true
for (const [name, mutant, expected] of mutants) {
  const run = await runVariant(name, mutant, true)
  const red = expected.every(id => run.failed.some(r => r.id === id))
  console.log(`${red ? 'PASS' : 'FAIL'} MUTANT ${name}: named rows RED = ${expected.join(',')}`)
  controlsGreen &&= red
}
console.log(`SUMMARY old=${before.results.length} checked=${after.results.length} mutants=${mutants.length}`)
if (before.failed.length || after.failed.length || !controlsGreen) process.exit(1)
