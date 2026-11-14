import {chromium} from '/Users/paulslee/olumi-work/worktrees/dgai-build/node_modules/.pnpm/playwright@1.57.0/node_modules/playwright/index.mjs'
import {mkdirSync,writeFileSync} from 'node:fs'
const origin='http://127.0.0.1:4132',out='/Users/paulslee/olumi-work/ui-evidence/look/night-new/04-explanation',results=[]
mkdirSync(out,{recursive:true});const b=await chromium.launch()
for(const tag of ['approved','pending']){
 await fetch(`${origin}/night/select/${tag}`);const sid=tag==='approved'?'s_e399f8a9d922':'s_a30668165d74'
 const auth=await(await fetch(`${origin}/api/admin/people/1/reissue`,{method:'POST',headers:{'x-olumi-admin':'night-new-isolated-evidence-admin','content-type':'application/json'},body:'{}'})).json()
 for(const [w,h,dpr,label] of [[2000,1200,1,'2000'],[1128,707,1,'1128'],[1504,902,1.33,'133']]){
  const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr});await ctx.addCookies([{name:'olumi',value:auth.link.slice(3),url:origin,httpOnly:true,sameSite:'Lax'}]);const p=await ctx.newPage(),refused=[],errors=[]
  p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(u.origin!==origin)return r.abort();if(u.pathname.startsWith('/api/')&&q.method()!=='GET'){refused.push(u.pathname);return r.abort()}return r.continue()})
  await p.goto(`${origin}/#/scenario/00000000-0000-4000-8000-${sid.slice(2)}`);await p.waitForSelector('[data-testid="view-canvas"]');await p.waitForTimeout(3000)
  const view=await p.evaluate(async s=>(await fetch(`/api/scenarios/${s}/view?schema=3&all=1`)).json(),sid);writeFileSync(`${out}/${tag}-view.json`,JSON.stringify(view))
  const card=view.model.cards.find(c=>c.family==='option'&&c.id.includes(tag==='approved'?'grant':'widen'))??view.model.cards.find(c=>c.family==='option')
  await p.locator(`.react-flow__node[data-id="${card.id}"] [role="group"]`).first().click({position:{x:30,y:12}});await p.waitForTimeout(500)
  await p.screenshot({path:`${out}/${tag}-${label}-selected.png`})
  const notes=p.locator('[data-testid="selected-explain"] [data-testid="worked-notes"] > summary').first()
  let method=null,operands=0,authors=[],returned=false
  if(await notes.count()){
   await notes.click();await notes.scrollIntoViewIfNeeded();await p.waitForTimeout(300)
   method=await p.locator('[data-testid="selected-explain"] [data-testid="worked-method"]').first().textContent();operands=await p.locator('[data-testid="selected-explain"] [data-operand]').count();authors=await p.locator('[data-testid="selected-explain"] [data-testid="worked-author"]').allTextContents()
   const last=p.locator('[data-testid="selected-explain"] [data-operand]').last();await last.scrollIntoViewIfNeeded();await p.screenshot({path:`${out}/${tag}-${label}-calculation.png`})
  }
  const back=p.locator('[data-testid="selected-back"]');await back.scrollIntoViewIfNeeded();await back.click();returned=await p.locator('[data-testid="view-chat"]').isVisible()
  results.push({tag,label,card:card.id,method,operands,authors,returned,errors,refused,passed:!!method&&operands>0&&returned&&errors.length===0&&refused.length===0});await ctx.close()
 }
}
await b.close();writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(results)
