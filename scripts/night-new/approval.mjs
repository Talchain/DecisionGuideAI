import {chromium} from '/Users/paulslee/olumi-work/worktrees/dgai-build/node_modules/.pnpm/playwright@1.57.0/node_modules/playwright/index.mjs'
import {mkdirSync,writeFileSync} from 'node:fs'
const origin='http://127.0.0.1:4132',out='/Users/paulslee/olumi-work/ui-evidence/look/night-new/03-approval-final',sid='s_a30668165d74',results=[]
mkdirSync(out,{recursive:true});const b=await chromium.launch()
for(const action of ['approve','discard']) for(const [w,h,dpr,label] of [[2000,1200,1,'2000'],[1128,707,1,'1128'],[1504,902,1.33,'133']]) {
 await fetch(`${origin}/night/select/${action}-${label}`)
 const auth=await(await fetch(`${origin}/api/admin/people/1/reissue`,{method:'POST',headers:{'x-olumi-admin':'night-new-isolated-evidence-admin','content-type':'application/json'},body:'{}'})).json()
 const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:dpr});await ctx.addCookies([{name:'olumi',value:auth.link.slice(3),url:origin,httpOnly:true,sameSite:'Lax'}]);const p=await ctx.newPage(),posts=[],refused=[]
 await p.route('**/*',async r=>{const q=r.request(),u=new URL(q.url());if(u.origin!==origin)return r.abort();if(u.pathname.startsWith('/api/')&&q.method()!=='GET') {if(new RegExp(`/api/proposals/\\d+/${action}$`).test(u.pathname)&&posts.length===0){const res=await r.fetch();posts.push({path:u.pathname,status:res.status(),body:q.postData()});return r.fulfill({response:res})} refused.push(u.pathname);return r.abort()}return r.continue()})
 await p.goto(`${origin}/#/scenario/00000000-0000-4000-8000-${sid.slice(2)}`);await p.waitForSelector('[data-testid="board-provisional"]');await p.waitForTimeout(3000)
 const vis=sel=>p.locator(sel).evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.height>0})
 const buttonsVisible=await vis('[data-testid="view-approve"]')&&await vis('[data-testid="view-set-aside"]')
 await p.screenshot({path:`${out}/${action}-${label}-before.png`})
 await p.locator('[data-testid="view-proposal-change"]').click();const changeFocus=await p.locator('#view-chat-text').evaluate(n=>document.activeElement===n)
 await p.locator('#view-chat-text').fill('Please change this provisional model.');await p.screenshot({path:`${out}/${action}-${label}-change.png`});await p.locator('#view-chat-text').fill('')
 // A tick changes review selection only; the subsequent Approve still approves the whole proposal.
 const tick=p.locator('[data-testid="view-change-group-0"]');await tick.check();const selective=await p.locator('[data-testid="view-approve-ticked"]').isEnabled();await tick.uncheck()
 await p.locator(action==='approve'?'[data-testid="view-approve"]':'[data-testid="view-set-aside"]').click();await p.waitForTimeout(2500)
 const view=await p.evaluate(async s=>(await fetch(`/api/scenarios/${s}/view?schema=3`)).json(),sid)
 await p.screenshot({path:`${out}/${action}-${label}-after.png`});await p.reload();await p.waitForTimeout(3000)
 const reopen=await p.evaluate(async s=>(await fetch(`/api/scenarios/${s}/view?schema=3`)).json(),sid)
 await p.screenshot({path:`${out}/${action}-${label}-reopen.png`})
 results.push({action,label,buttonsVisible,changeFocus,selective,posts,refused,version:view.version,proposal:view.proposal?.id??null,cards:view.model?.cards.length??0,sameVersion:JSON.stringify(view.version)===JSON.stringify(reopen.version),passed:buttonsVisible&&changeFocus&&selective&&posts[0]?.status===200&&!view.proposal&&(action==='approve'?view.version?.n===1:view.version===null)&&refused.length===0})
 await ctx.close()
}
await b.close();writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(results.map(({action,label,passed,posts})=>({action,label,passed,posts})))
