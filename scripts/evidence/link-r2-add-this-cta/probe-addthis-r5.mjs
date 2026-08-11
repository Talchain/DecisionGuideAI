// ROUND 5 — the same question, with a control that can actually discriminate.
//
// ⚠ ROUND 4 WAS VOID AND THE CONTROL IS WHY WE KNOW. Its positive control sent
// `Change Annual CRM Licence Cost to £64,000.` — a label HARDCODED from an
// earlier run's draft. This run's draft named the factor "Annual CRM Spend", so
// the control asked the engine to change a node that did not exist and the
// engine, correctly, asked which one was meant. The control was bound BY VALUE
// to a label the drafter happens to emit, not BY IDENTITY to a node in the graph
// under test — trap 19, in the harness rather than in a spec. Every arm in that
// round is unreadable as a result, which is the control doing its job.
//
// Round 5 derives BOTH the control's target and the add's target from THIS run's
// own committed graph, so neither can name something that is not there.
import fs from 'node:fs'; import { randomUUID } from 'node:crypto';
import { sendBufferedTurn, sendStreamedTurn, targets } from '/Users/paulslee/Documents/GitHub/scripts/golden-journey/lib/wire.mjs';
import { classifyOutcome } from './classifier.mjs';
const OUT='/private/tmp/link-r2-lane-8f3c2a/evidence/addthis-probe-r5'; fs.mkdirSync(OUT,{recursive:true});
const log=(...a)=>{const l=`[${new Date().toISOString()}] ${a.join(' ')}`;console.log(l);fs.appendFileSync(`${OUT}/probe.log`,l+'\n');};
const BRIEF=`Should we replace our current CRM with HubSpot next quarter, or keep what we have? We are a 34-person B2B sales team with annual revenue of £31m. Annual CRM cost is about £50,000 and switching would cost roughly £20,000 one-off. The goal is higher sales productivity without blowing the budget.`;

/** A cost-ish factor from THIS graph, by identity. Null => the arm is skipped, never guessed. */
const pickCostFactor=(g)=>(g.nodes||[]).find(n=>n.kind==='factor'&&/cost|spend|price|licen[cs]e|fee/i.test(n.label||''))||null;
/** A factor with an edge INTO the goal — i.e. one that provably already feeds it. */
function pickGoalFeeder(g){
  const goal=(g.nodes||[]).find(n=>n.kind==='goal'||n.kind==='outcome'); if(!goal) return null;
  const e=(g.edges||[]).find(x=>x.target===goal.id||x.to===goal.id);
  if(!e) return null;
  const srcId=e.source??e.from;
  const src=(g.nodes||[]).find(n=>n.id===srcId);
  return src&&goal?{feeder:src,goal}:null;
}

async function runArm(kind){
  const scenarioId=randomUUID();
  log(`${kind}: scenario=${scenarioId} drafting…`);
  const t1=await sendStreamedTurn({id:`${kind}_DRAFT`,scenarioId,message:BRIEF});
  if(!t1.graphReady){log(`${kind}: NO DRAFT — UNMEASURED`);return {arm:kind,unmeasured:'no_draft'};}
  const g=t1.graphReady, before=(g.nodes||[]).length;
  const rec={arm:kind,scenarioId,nodesBefore:before,labels:(g.nodes||[]).map(n=>n.label)};

  if(kind==='P_CONTROL_DERIVED'){
    const t=pickCostFactor(g);
    if(!t){log(`${kind}: no cost factor in THIS graph — UNMEASURED (not guessed)`);return {...rec,unmeasured:'no_cost_factor'};}
    rec.target=t.label; rec.message=`Change ${t.label} to £64,000.`;
  } else {
    const gf=pickGoalFeeder(g);
    if(!gf){log(`${kind}: no factor with an edge into the goal — UNMEASURED`);return {...rec,unmeasured:'no_goal_feeder'};}
    rec.target=gf.feeder.label; rec.goal=gf.goal.label;
    // The engine's OWN stated requirement, quoted back: "connect it to a factor
    // that already feeds your goal". `gf.feeder` provably does — it has an edge in.
    rec.message=`Add a new factor called "Annual revenue" with a value of £31m, and connect it so that it influences ${gf.feeder.label}, which already feeds the goal.`;
  }

  log(`${kind}: target="${rec.target}" msg=${JSON.stringify(rec.message)}`);
  const t2=await sendBufferedTurn({id:`${kind}_EDIT`,scenarioId,message:rec.message});
  const c=classifyOutcome(t2);
  rec.edit={kind:c.kind,verdict:c.verdict,codes:c.codes,markers:c.markers,
    nodesAfter:t2.body?.draft_graph?(t2.body.draft_graph.nodes||[]).length:null,
    text:String(t2.body?.assistant_text||t2.body?.message||'').slice(0,500)};
  log(`${kind}: -> ${c.kind} ${JSON.stringify(c.codes)}`);

  if(c.kind==='HELD'){
    log(`${kind}: HELD — sending a REAL confirmation turn ("Yes")…`);
    const t3=await sendBufferedTurn({id:`${kind}_CONFIRM`,scenarioId,message:'Yes'});
    const c3=classifyOutcome(t3); const g3=t3.body?.draft_graph||null;
    rec.confirm={kind:c3.kind,codes:c3.codes,nodesAfter:g3?(g3.nodes||[]).length:null,
      newLabels:g3?(g3.nodes||[]).map(n=>n.label).filter(l=>!rec.labels.includes(l)):null,
      text:String(t3.body?.assistant_text||t3.body?.message||'').slice(0,400)};
    log(`${kind}: CONFIRM -> ${c3.kind} nodes ${before}->${rec.confirm.nodesAfter} new=${JSON.stringify(rec.confirm.newLabels)}`);
    fs.writeFileSync(`${OUT}/${kind}-confirm.json`,JSON.stringify(t3.body,null,2));
  }
  fs.writeFileSync(`${OUT}/${kind}.json`,JSON.stringify({...rec,editFullBody:t2.body},null,2));
  return rec;
}
log(`target=${targets.ceeTurnBase}`);
const results=await Promise.all(['P_CONTROL_DERIVED','Q_ADD_TO_GOAL_FEEDER'].map(k=>runArm(k).catch(e=>({arm:k,error:String(e)}))));
fs.writeFileSync(`${OUT}/summary.json`,JSON.stringify({brief:BRIEF,results},null,2));
log('===== SUMMARY =====');
for(const r of results) log(`${String(r.arm).padEnd(22)} target="${r.target||'-'}" ${r.unmeasured?('UNMEASURED:'+r.unmeasured):(r.edit.kind+' '+JSON.stringify(r.edit.codes))} confirm=${r.confirm?r.confirm.kind+' nodes->'+r.confirm.nodesAfter:'(none)'}`);
const ctl=results.find(r=>r.arm==='P_CONTROL_DERIVED');
log(`POSITIVE CONTROL: ${ctl?.unmeasured?('UNMEASURED — '+ctl.unmeasured):ctl?.edit?.kind} ${ctl?.edit?.kind==='APPLIED_DIRECT'?'(arms readable)':'(ARMS NOT READABLE)'}`);
