import {chromium} from '/Users/paulslee/olumi-work/worktrees/dgai-build/node_modules/.pnpm/playwright@1.57.0/node_modules/playwright/index.mjs'
import {mkdirSync,writeFileSync} from 'node:fs'
const origin='http://127.0.0.1:4132',out='/Users/paulslee/olumi-work/ui-evidence/look/night-new/06-edit-final',sid='s_e399f8a9d922',results=[]
mkdirSync(out,{recursive:true});const b=await chromium.launch()
for(const [w,h,dpr,label] of [[2000,1200,1,'2000'],[1128,707,1,'1128'],[1504,902,1.33,'133']]){
 await fetch(`${origin}/night/select/edit-${label}`);const auth=await(await fetch(`${origin}/api/admin/people/1/reissue`,{method:'POST',headers:{'x-olumi-admin':'night-new-isolated-evidence-admin','content-type':'application/json'},body:'{}'})).json()
 const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr});await ctx.addCookies([{name:'olumi',value:auth.link.slice(3),url:origin,httpOnly:true,sameSite:'Lax'}]);const p=await ctx.newPage(),posts=[],refused=[]
 await p.route('**/*',async r=>{const q=r.request(),u=new URL(q.url());if(u.origin!==origin)return r.abort();if(u.pathname.startsWith('/api/')&&q.method()!=='GET'){if(/\/edit$/.test(u.pathname)&&posts.length===0){const res=await r.fetch();posts.push({path:u.pathname,status:res.status(),body:q.postData()});return r.fulfill({response:res})}refused.push(u.pathname);return r.abort()}return r.continue()})
 const read=()=>p.evaluate(async s=>(await fetch(`/api/scenarios/${s}/view?schema=3`)).json(),sid)
 await p.goto(`${origin}/#/scenario/00000000-0000-4000-8000-${sid.slice(2)}`);await p.waitForSelector('[data-testid="view-canvas"]');await p.waitForTimeout(3000)
 const before=await read(),option=before.model.cards.find(c=>c.family==='option'&&c.id.includes('grant')),grant='grant_or_bridging_loan_secured_added_seek_a_small_grant_or_short',measure=before.model.cards.find(c=>c.worked?.steps.some(s=>s.figure.options.some(f=>f.option===option.id&&f.id===grant))),id=measure.worked.steps.find(s=>s.figure.options.some(f=>f.option===option.id&&f.id===grant)).coefficient.id
 await p.locator(`.react-flow__node[data-id="${option.id}"] [role="group"]`).first().click({position:{x:30,y:12}})
 const notes=p.locator('.ok-selected [data-testid="worked-notes"] > summary').first();await notes.click()
 await p.locator(`.ok-selected [data-testid="view-step-edit-${id}"]`).click();await p.locator(`[data-testid="view-step-typed-${id}"]`).fill('-0.00003 to -0.00001')
 await p.screenshot({path:`${out}/edit-${label}-typed.png`});await p.locator(`[data-testid="view-step-set-${id}"]`).click();await p.waitForSelector('[data-testid="selected-model-change"]',{timeout:20000});await p.waitForTimeout(1000)
 const after=await read(),since=after.model.run.since,receipt=p.locator('[data-testid="selected-model-change"]');await receipt.scrollIntoViewIfNeeded();await p.screenshot({path:`${out}/edit-${label}-changed.png`})
 const words=await receipt.textContent(),changed=after.model.cards.find(c=>c.id===id);await p.locator('[data-testid="selected-back"]').click();await p.screenshot({path:`${out}/edit-${label}-review.png`})
 await p.reload();await p.waitForSelector('[data-testid="view-canvas"]');await p.waitForTimeout(2500);const reopen=await read();await p.screenshot({path:`${out}/edit-${label}-reopen.png`})
 const snap=v=>({version:v.version?.n,proposal:v.proposal?.id??null,cards:v.model.cards.map(c=>({id:c.id,figure:c.figure,author:c.author,headline:c.headline,change:c.change}))})
 const same=JSON.stringify(snap(after))===JSON.stringify(snap(reopen)),old=before.model.cards.find(c=>c.id===id)
 results.push({label,posts,refused,before:{figure:old.figure.text,author:old.author.text,chance:option.headline.text},after:{figure:changed.figure.text,author:changed.author.text,chance:after.model.cards.find(c=>c.id===option.id).headline.text},since,receipt:words,same,passed:posts[0]?.status>=200&&posts[0]?.status<300&&refused.length===0&&old.author.text!==changed.author.text&&since.lines.length>0&&since.lines.every(l=>words.includes(l.line))&&same})
 writeFileSync(`${out}/${label}-view.json`,JSON.stringify(after));await ctx.close()
}
await b.close();writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(results.map(({label,passed,before,after,same,posts})=>({label,passed,before,after,same,posts})))
