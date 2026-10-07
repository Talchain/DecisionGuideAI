// Dry run of copy_guest_scenario v2 (S-G slice 2: the copy carries brief, name and conversation) on PGlite.
// Never touches Supabase. Usage: node run-v2.mjs <v1 migration.sql> <v2 migration.sql>
// Every row binds to exact identities (ids, turn_ids, SQLSTATE + message, row tuples). Exits 1 if any row fails, or
// if no migration was applied. v1's own rows stay in run.mjs (setup.sql); these run on setup-v2.sql (full turns table).
import { PGlite } from '@electric-sql/pglite'
import fs from 'fs'

const migrations = process.argv.slice(2)
if (migrations.length === 0) { console.error('no migration given'); process.exit(2) }
const db = new PGlite()
await db.exec(fs.readFileSync(new URL('setup-v2.sql', import.meta.url), 'utf8'))
for (const m of migrations) await db.exec(fs.readFileSync(m, 'utf8'))

const U = n => `00000000-0000-0000-0000-0000000000${n}`
const ME = U('0a'), OTHER = U('0b'), GHOST = U('0c'), FAILUSER = U('0d')
const GUEST = U('a1'), OWNED = U('a2'), EMPTY = U('a3'), ABSENT = U('a4'), HUGE = U('a5'), EDGE = U('a6'), GUEST2 = U('a7'), MV = U('c1'), MUT = U('c2')
const T1 = U('d1'), T2 = U('d2'), T3 = U('d3'), T4 = U('d4')
// GUEST: a graph, the brief, the name (framing), the CAS hash, a Run, and FOUR turn rows:
//   g-1  the drafting turn (agent_turn hash, both messages, coaching + guidance signals);
//   g-2  a Run turn that left a held action, next-step offers keyed to the guest Run, and model-version markers;
//   g-2:claim  a claim marker (never copied);
//   g-3  a user-only turn.
// The Run's facts hang off g-2.
await db.exec(`
insert into auth.users values ('${ME}','me@x.test'),('${OTHER}','other@x.test'),('${FAILUSER}','fail@x.test');
insert into public.model_versions values ('${MV}');
insert into public.scenarios(id,user_id,title,scenario_schema_version,stage,graph,framing,brief_text,graph_identity_hash,analysis_status,analysis,brief,events,event_seq,latest_analysis_summary,rolling_summary,current_model_version_id,last_turn_nonce,analysis_provenance,analysis_error,analysis_invalidated_at,is_pinned)
values ('${GUEST}',null,'Hire a second engineer?',3,'evaluate',
  '{"nodes":[{"id":"goal","kind":"goal","label":"Ship faster"}],"edges":[]}',
  '{"goal":"Ship faster","title":"Second engineer"}','Should we hire a second engineer this quarter? Budget £200,000.','h-guest-1',
  'ready','{"run":"r1"}','{"headline":"Hire"}','[{"event_id":"e1","event_type":"graph_saved"}]',1,
  '{"p":0.6}','{"summary":"..."}','${MV}',3,'{"seed":42}','{"e":"x"}',now(),true),
 ('${OWNED}','${OTHER}','Theirs',1,'frame','{"nodes":[],"edges":[]}',null,null,null,'none',null,null,'[]',0,null,null,null,0,null,null,null,false),
 ('${EMPTY}',null,'No model yet',1,'frame',null,null,null,null,'none',null,null,'[]',0,null,null,null,0,null,null,null,false),
 ('${HUGE}',null,'Too big',1,'frame',jsonb_build_object('nodes', jsonb_build_array(jsonb_build_object('id','n','label',repeat('x',1048577))),'edges','[]'::jsonb),null,null,null,'none',null,null,'[]',0,null,null,null,0,null,null,null,false),
 ('${EDGE}',null,'Just under the cap',1,'frame',jsonb_build_object('nodes', jsonb_build_array(jsonb_build_object('id','n','label',repeat('x',1048576 - 50))),'edges','[]'::jsonb),null,null,null,'none',null,null,'[]',0,null,null,null,0,null,null,null,false);
insert into public.v5_conversation_turns(id,scenario_id,user_id,turn_id,turn_class,handler_id,request_hash,response_emitted,llm_calls_used,duration_ms,created_at,pending_actions,coaching_state,user_message,assistant_message,model_version_mutation_id,model_version_created,agent_guidance,suggested_actions,suggested_actions_run_key) values
 ('${T1}','${GUEST}',null,'g-1','direct_answer',null,'agent_turn:aaa',true,5,4200,'2026-09-28T13:06:20Z','[]','{"stage":"frame"}','Should I hire a second engineer?','I have drafted a model with two options.',null,null,'{"cooldown":["0123456789ab"]}',null,null),
 ('${T2}','${GUEST}',null,'g-2','handler','run_analysis','agent_turn:bbb',true,0,6100,'2026-09-28T13:07:30Z',
   '[{"id":"gmh_1","scenario_id":"${GUEST}","kind":"held_proposal","expires_at_turn_count":1}]','{"stage":"evaluate"}','Run it','‘Hire’: about 51% chance of meeting your goal, in this model.',
   '${MUT}',false,null,'[{"id":"explain","label":"Explain this result","message":"Explain this result"}]','runkey-guest'),
 ('${T3}','${GUEST}',null,'g-2:claim','direct_answer',null,'claim:bbb',true,0,0,'2026-09-28T13:07:31Z','[]',null,null,null,null,null,null,null,null),
 ('${T4}','${GUEST}',null,'g-3','direct_answer',null,'agent_turn:ccc',false,0,0,'2026-09-28T13:08:00Z','[]',null,'And if we wait?',null,null,null,null,null,null);
insert into public.v5_handler_facts(scenario_id,user_id,v5_conversation_turn_id) values ('${GUEST}',null,'${T2}');
-- C20's fault injector: an insert of a turn owned by FAILUSER fails, as a mid-copy failure would.
create function public.fail_for_failuser() returns trigger language plpgsql as $$ begin
  if new.user_id = '${FAILUSER}' then raise exception 'injected turn insert failure' using errcode = 'XX999'; end if; return new; end $$;
create trigger fail_for_failuser before insert on public.v5_conversation_turns for each row execute function public.fail_for_failuser();
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
const canon = v => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))
const q = async sql => (await db.query(sql)).rows
const copy = (src, user) => as('service_role', null, `select public.copy_guest_scenario('${src}','${user}') as r`)
const rowText = async id => (await q(`select row_to_json(s)::text as t from public.scenarios s where id = '${id}'`))[0]?.t ?? null
const count = async where => Number((await q(`select count(*)::int as n from public.scenarios where ${where}`))[0].n)
const turnCount = async where => Number((await q(`select count(*)::int as n from public.v5_conversation_turns where ${where}`))[0].n)
const turnsText = async sid => (await q(`select row_to_json(t)::text as t from public.v5_conversation_turns t where scenario_id = '${sid}' order by turn_id`)).map(r => r.t)

// THE COLUMN MANIFEST. Every turn column is in exactly one class; a column added to the table and not classified here
// turns C22 red, so a new column cannot silently fall through to its default.
const KEPT = ['turn_id', 'turn_class', 'handler_id', 'request_hash', 'response_emitted', 'llm_calls_used', 'duration_ms', 'created_at', 'user_message', 'assistant_message', 'coaching_state', 'agent_guidance']
const REKEYED = ['id', 'scenario_id', 'user_id']
const RESET = { pending_actions: [], suggested_actions: null, suggested_actions_run_key: null, model_version_mutation_id: null, model_version_created: null }

const results = []
const row = (id, name, pass, detail) => { results.push({ id, name, pass: !!pass }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name}${pass ? '' : ' :: ' + JSON.stringify(detail)}`) }
const total0 = await count('true')
const turns0 = await turnCount('true')
const guestBefore = await rowText(GUEST)
const guestTurnsBefore = await turnsText(GUEST)

// C1 the owner copy: graph, title, framing and brief travel; every other scenarios column takes its never-run default.
const c1 = await copy(GUEST, ME)
const id1 = c1.ok ? c1.rows[0].r.scenario_id : null
const cols = (await q(`select column_name from information_schema.columns where table_schema='public' and table_name='scenarios' and column_name not in ('id','created_at','updated_at') order by ordinal_position`)).map(r => r.column_name)
const got = id1 ? (await q(`select ${cols.join(',')} from public.scenarios where id = '${id1}'`))[0] : null
const want = {
  user_id: ME, title: 'Hire a second engineer?', scenario_schema_version: 1, stage: 'frame',
  graph: { nodes: [{ id: 'goal', kind: 'goal', label: 'Ship faster' }], edges: [] }, framing: { goal: 'Ship faster', title: 'Second engineer' },
  analysis_status: 'none', analysis: null, analysis_error: null, analysis_provenance: null, events: [], event_seq: 0, brief: null,
  last_turn_nonce: 0, is_pinned: false, is_archived: false, source_scenario_id: GUEST, latest_analysis_summary: null,
  brief_text: 'Should we hire a second engineer this quarter? Budget £200,000.',
  current_model_version_id: null, rolling_summary: null, graph_identity_hash: null, analysis_invalidated_at: null,
}
row('C1', 'v2 copy: graph + title + framing + brief_text, owned by the caller; every other column never-run', c1.ok && c1.rows[0].r.created === true && id1 !== GUEST
  && cols.length === Object.keys(want).length && canon(got) === canon(want), { c1, got })

// C14 the conversation, re-keyed: one copied row per guest turn (claim marker excluded), matched by turn_id.
const src = Object.fromEntries((await q(`select * from public.v5_conversation_turns where scenario_id='${GUEST}'`)).map(r => [r.turn_id, r]))
const dst = id1 ? (await q(`select * from public.v5_conversation_turns where scenario_id='${id1}' order by created_at, turn_id`)) : []
const keptOk = dst.length === 3 && dst.every(t => KEPT.every(c => canon(t[c]) === canon(src[t.turn_id]?.[c])))
const rekeyOk = dst.every(t => t.scenario_id === id1 && t.user_id === ME && t.id !== src[t.turn_id]?.id)
row('C14', 'the guest turns are copied, re-keyed to the copy (new id, copy scenario, caller as user); every kept column byte-equal',
  c1.ok && keptOk && rekeyOk && canon(dst.map(t => t.turn_id)) === canon(['g-1', 'g-2', 'g-3']), { dst: dst.map(t => [t.turn_id, t.user_id]) })

// C15 what names the guest or its Run is reset — even though g-2 carries all of it in the source.
const g2 = dst.find(t => t.turn_id === 'g-2')
row('C15', 'pending_actions → [], next-step offers + run key → NULL, model-version markers → NULL (the source g-2 has all five set)',
  g2 && Object.entries(RESET).every(([c, v]) => canon(g2[c]) === canon(v))
  && canon(src['g-2'].pending_actions) !== '[]' && src['g-2'].suggested_actions_run_key === 'runkey-guest' && src['g-2'].model_version_created === false, { g2 })

// C16 the claim marker is not copied.
row('C16', 'the g-2:claim marker is not copied (the other 3 are)', id1 && (await turnCount(`scenario_id='${id1}'`)) === 3 && (await turnCount(`scenario_id='${id1}' and turn_id like '%:claim'`)) === 0 && (await turnCount(`scenario_id='${GUEST}' and turn_id = 'g-2:claim'`)) === 1, {})

// C17 the Run does not travel: no facts on the copy.
row('C17', 'CONTROL (as v1): no handler facts on the copy (the Run stays with the guest)', id1 && Number((await q(`select count(*) as n from public.v5_handler_facts where scenario_id='${id1}'`))[0].n) === 0, {})

// C19 the UI's marker: every copied turn precedes the copy's own created_at.
const copyCreated = id1 ? (await q(`select created_at from public.scenarios where id='${id1}'`))[0].created_at : null
row('C19', 'every copied turn is earlier than the copy\'s created_at (how the UI tells "from before you signed in")',
  copyCreated && dst.length === 3 && dst.every(t => new Date(t.created_at) < new Date(copyCreated)), { copyCreated, dst: dst.map(t => t.created_at) })

// C2 the guest original is byte-unchanged: the scenario row and EVERY turn row.
row('C2', 'guest scenario row byte-unchanged', (await rowText(GUEST)) === guestBefore, {})
row('C2b', 'guest turn rows byte-unchanged and still unowned; its facts still unowned', canon(await turnsText(GUEST)) === canon(guestTurnsBefore)
  && (await turnCount(`scenario_id='${GUEST}' and user_id is null`)) === 4
  && Number((await q(`select count(*) as n from public.v5_handler_facts where scenario_id='${GUEST}' and user_id is null`))[0].n) === 1, {})

// C3 / C18 a replay returns the SAME copy and copies nothing again.
const c3 = await copy(GUEST, ME)
row('C3', 'second call → same copy id, created=false, one row', c3.ok && c3.rows[0].r.scenario_id === id1 && c3.rows[0].r.created === false
  && (await count(`source_scenario_id='${GUEST}' and user_id='${ME}'`)) === 1, c3)
row('C18', 'the replay copies no turn twice', id1 && (await turnCount(`scenario_id='${id1}'`)) === 3, {})

// C20 ONE transaction: a failure while copying the turns leaves no copy row behind (and no turn).
const n20 = await count('true')
const c20 = await copy(GUEST, FAILUSER)
row('C20', 'a failed turn insert rolls the whole copy back (no orphan scenario without its conversation)', !c20.ok && c20.code === 'XX999'
  && (await count('true')) === n20 && (await count(`user_id='${FAILUSER}'`)) === 0 && (await turnCount(`user_id='${FAILUSER}'`)) === 0, c20)

// C4 an OWNED source is refused, and nothing is written (scenarios or turns).
const n4 = await count('true'), t4 = await turnCount('true')
const c4 = await copy(OWNED, ME)
row('C4', 'owned source refused (CG409), nothing written', !c4.ok && c4.code === 'CG409' && c4.err === 'copy_guest_scenario: source is not a guest scenario'
  && (await count('true')) === n4 && (await turnCount('true')) === t4, c4)

// C5 anon and authenticated cannot call it at all.
const c5a = await as('anon', null, `select public.copy_guest_scenario('${GUEST}','${ME}')`)
const c5b = await as('authenticated', ME, `select public.copy_guest_scenario('${GUEST}','${ME}')`)
row('C5', 'anon refused', !c5a.ok && c5a.err === 'permission denied for function copy_guest_scenario', c5a)
row('C5b', 'authenticated refused (the owner comes from CEE\'s verified JWT only)', !c5b.ok && c5b.err === 'permission denied for function copy_guest_scenario', c5b)

// C6–C8 typed refusals.
const c6 = await copy(GUEST, GHOST)
row('C6', 'an id that is not an auth user is refused (22023)', !c6.ok && c6.code === '22023' && c6.err === 'copy_guest_scenario: p_user_id is not a known auth user', c6)
const c7 = await copy(ABSENT, ME)
row('C7', 'absent source → CG404', !c7.ok && c7.code === 'CG404' && c7.err === 'copy_guest_scenario: source not found', c7)
const c8 = await copy(EMPTY, ME)
row('C8', 'a guest source with no model → CG422', !c8.ok && c8.code === 'CG422' && c8.err === 'copy_guest_scenario: source has no model to copy', c8)

// C13 the size cap (boundary pair).
const n13 = await count('true')
const c13 = await copy(HUGE, ME)
row('C13', 'a source graph over 1 MiB is refused (CG413), nothing written', !c13.ok && c13.code === 'CG413' && (await count('true')) === n13, c13)
const c13b = await copy(EDGE, ME)
row('C13b', 'CONTROL: a source just under the cap copies (no turns to carry)', c13b.ok && c13b.rows[0].r.created === true
  && (await turnCount(`scenario_id='${c13b.ok ? c13b.rows[0].r.scenario_id : ME}'`)) === 0, c13b)

// C9 / C21 a second user gets their own copy with their own turn rows; mine are unchanged.
const mine = await rowText(id1), mineTurns = await turnsText(id1)
const c9 = await copy(GUEST, OTHER)
const id9 = c9.ok ? c9.rows[0].r.scenario_id : null
row('C9', 'a second user gets a separate copy; the first copy is unchanged', c9.ok && c9.rows[0].r.created === true && id9 !== id1 && id9 !== GUEST
  && (await q(`select user_id from public.scenarios where id='${id9}'`))[0]?.user_id === OTHER && (await rowText(id1)) === mine, c9)
row('C21', 'their copy has its own 3 turn rows, owned by them; my copy\'s turn rows are byte-unchanged', id9
  && (await turnCount(`scenario_id='${id9}' and user_id='${OTHER}'`)) === 3 && canon(await turnsText(id1)) === canon(mineTurns), {})

// C10 hardening unchanged.
const meta = (await q(`select p.prosecdef, p.proconfig, coalesce((select array_agg(distinct a.grantee::regrole::text order by a.grantee::regrole::text) from aclexplode(p.proacl) a where a.privilege_type='EXECUTE'), '{}') as exec
  from pg_proc p where p.oid = 'public.copy_guest_scenario(uuid,uuid)'::regprocedure`))[0]
row('C10', 'SECURITY DEFINER, search_path=\'\', EXECUTE = {postgres, service_role}', meta.prosecdef === true && JSON.stringify(meta.proconfig) === JSON.stringify(['search_path=""'])
  && JSON.stringify(meta.exec) === JSON.stringify(['postgres', 'service_role']), meta)

// C11b a caller's TEMP tables named `scenarios` AND `v5_conversation_turns` cannot shadow the real ones.
await db.exec(`insert into public.scenarios(id,user_id,title,graph) values ('${GUEST2}',null,'Second guest','{"nodes":[{"id":"g2"}],"edges":[]}');
  insert into public.v5_conversation_turns(scenario_id,turn_id,turn_class,request_hash,user_message) values ('${GUEST2}','h-1','direct_answer','agent_turn:h1','Real turn');
  set role service_role;
  create temp table scenarios(id uuid, user_id uuid, source_scenario_id uuid, created_at timestamptz, graph jsonb, title text, framing jsonb, brief_text text);
  insert into scenarios values ('${GUEST2}', '${OTHER}', null, now(), null, 'Shadow', null, null);
  create temp table v5_conversation_turns(scenario_id uuid, turn_id text, user_message text);
  insert into v5_conversation_turns values ('${GUEST2}', 'shadow-1', 'Shadow turn');
  reset role`)
const c11b = await copy(GUEST2, OTHER)
const id11b = c11b.ok ? c11b.rows[0].r.scenario_id : null
const fresh = id11b ? (await q(`select user_id, title, graph, source_scenario_id from public.scenarios where id = '${id11b}'`))[0] : null
const freshTurns = id11b ? (await q(`select turn_id, user_message from public.v5_conversation_turns where scenario_id = '${id11b}'`)) : []
await db.exec('set role service_role; drop table pg_temp.scenarios; drop table pg_temp.v5_conversation_turns; reset role')
row('C11b', 'TEMP shadows are ignored: the copy and its turns come from public.*', c11b.ok && c11b.rows[0].r.created === true
  && canon(fresh) === canon({ user_id: OTHER, title: 'Second guest', graph: { nodes: [{ id: 'g2' }], edges: [] }, source_scenario_id: GUEST2 })
  && canon(freshTurns) === canon([{ turn_id: 'h-1', user_message: 'Real turn' }]), { c11b, fresh, freshTurns })

// C22 the column manifest is complete: every turn column is kept, re-keyed or reset — none falls to a default unseen.
const turnCols = (await q(`select column_name from information_schema.columns where table_schema='public' and table_name='v5_conversation_turns' order by ordinal_position`)).map(r => r.column_name)
const classified = [...KEPT, ...REKEYED, ...Object.keys(RESET)]
row('C22', 'every v5_conversation_turns column is classified (kept / re-keyed / reset): 20 of 20', turnCols.length === 20
  && turnCols.every(c => classified.includes(c)) && classified.length === turnCols.length, { unclassified: turnCols.filter(c => !classified.includes(c)) })

row('C12', 'exactly the expected rows were written: 4 copies + C11b\'s source and copy; 3+3+1 copied turns + C11b\'s source turn',
  (await count('true')) === total0 + 5 && (await turnCount('true')) === turns0 + 3 + 3 + 1 + 1, { s: await count('true'), t: await turnCount('true'), total0, turns0 })

const failed = results.filter(r => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} rows pass`)
if (results.length === 0 || failed > 0) process.exit(1)
