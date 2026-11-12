/**
 * The conversation on the slice (DL 12 Nov). A reply Olumi held back is drawn as its own state in core's own sentence (`broke`), never as a
 * reply: the turn is a real core View turn (capacity fixture) whose answer core replaced, carrying core's sentences as core's own tests pin
 * them (ac41 shared/turn-words.ts REPLY_WITHHELD; f549b9cc view/__tests__/coach-withheld.test.ts). And a question Olumi no longer asks
 * leaves the composer.
 */
import '@testing-library/jest-dom/vitest'
import {readFileSync} from 'node:fs'
import {describe,it,expect,afterEach} from 'vitest'
import {render,screen,cleanup,act} from '@testing-library/react'
import {Panel} from '../Panel'
import {useViewStore} from '../../olumiView/store'
import type {View} from '../../olumiView/client'
const real=JSON.parse(readFileSync('src/olumiView/fixtures/real/capacity.view3.json','utf8')) as View
const turn0=(real.chat as unknown as Record<string,unknown>[])[0]!
const AC41='Olumi\'s reply broke its own rules, so it is not shown.'
const F549={broke:'Olumi held back its reply: it used a figure it could not trace to your model, and Olumi shows only what it can stand behind. A question to take forward: What share of your jobs are e-bike jobs?',
 withheld:{kind:'untraced_figure',limit:'Olumi held back its reply: it used a figure it could not trace to your model, and Olumi shows only what it can stand behind.',next:'What share of your jobs are e-bike jobs?'}}
const held=(extra:Record<string,unknown>)=>({...real,proposal:null,turn:null,chat:[{...turn0,answer:null,...extra}]}) as unknown as View
const props={detail:null,editing:false,closeDetail:()=>{},flash:()=>{}}
afterEach(()=>{cleanup();useViewStore.setState({uuid:null,sid:null,view:null,status:'none',error:null})})
describe('Olumi held back its reply',()=>{
 it.each([['core ac41 (the bare sentence)',{broke:AC41},AC41],['a core with COACH-WITHHELD (limit and the question to take forward)',F549,F549.broke]])('%s: core\'s sentence, as its own state, once',(_n,extra,said)=>{
  const v=held(extra);useViewStore.setState({view:v,status:'ready',at:null})
  render(<Panel v={v} {...props}/>)
  const w=screen.getByTestId('next-withheld')
  expect(w).toHaveTextContent(said)
  expect(w.closest('section')!.querySelectorAll('.reply:not(.withheld)')).toHaveLength(0)
  expect(document.body.textContent!.split('A question to take forward').length-1).toBe(said.includes('A question to take forward')?1:0)
 })
})
describe('a question Olumi no longer asks',()=>{
 it('leaves the composer when a newer View drops it',()=>{
  // No real View fixture in the repo carries coaching questions: the questions are core's own (f549b9cc coach-withheld fixture, workshop case).
  const q=['What share of your jobs are e-bike jobs?','What would success look like here? The brief does not yet say what is being aimed for.']
  const v={...real,proposal:null,turn:null,model:{...real.model!,coaching_questions:q}} as View;useViewStore.setState({view:v,status:'ready',at:null})
  let answering:{at:number;text:string}|null={at:0,text:q[0]!}
  const set=(x:typeof answering)=>{answering=x}
  const r=render(<Panel v={v} {...props} answering={answering} setAnswering={set}/>)
  expect(screen.getByTestId('next-answering')).toHaveTextContent(q[0]!)
  const newer={...v,model:{...v.model!,coaching_questions:q.slice(1)}} as View
  act(()=>useViewStore.setState({view:newer}));r.rerender(<Panel v={newer} {...props} answering={answering} setAnswering={set}/>)
  expect(answering).toBeNull()
 })
})
