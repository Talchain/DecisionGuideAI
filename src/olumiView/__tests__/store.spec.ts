/**
 * The page's View: one read per scenario, opened state sent with every read, an answer a newer read overtook dropped (Codex 00044),
 * and a failed read keeping the last good View with what was opened put back.
 */
import { afterEach, beforeEach, expect, it } from 'vitest'
import { setTeamFetch } from '../../olumiCore/team/api'
import { currentModel, useViewStore } from '../store'

const SID = 's_0123456789ab', UUID = '00000000-0000-4000-8000-0123456789ab'
const view = (title: string) => ({ schema: 'olumi.view/2', id: SID, title, commit: 't', signature: title, you: 'Paul', members: [], version: null, model: null, proposal: null,
  collab: { alone: true, heading: '', open: false, shared: [], mine: [], placeholder: '', can_reveal: false, waiting: null, commitments: [], owners: [] }, evidence: [], chat: [] })
const answered = (title: string) => new Response(JSON.stringify(view(title)), { status: 200 })

beforeEach(() => useViewStore.setState({ uuid: null, sid: null, view: null, opened: { open: new Map(), all: false }, status: 'none', error: null }))
afterEach(() => setTeamFetch(null))

it('reads the View of the scenario the page shows, by its core id', async () => {
  const urls: string[] = []
  setTeamFetch((async (url: string) => { urls.push(url); return answered('first') }) as unknown as typeof fetch)
  await useViewStore.getState().use(UUID)
  expect(urls).toEqual([`/api/scenarios/${SID}/view`])
  expect(useViewStore.getState().view?.title).toBe('first')
})

it('an older read that answers last is dropped: expand, then collapse, answered out of order, stays collapsed', async () => {
  setTeamFetch((async () => answered('first')) as unknown as typeof fetch)
  await useViewStore.getState().use(UUID)
  const answers: { url: string; answer: () => void }[] = []
  setTeamFetch(((url: string) => new Promise<Response>((done) => answers.push({ url, answer: () => done(answered(url.includes('open=') ? 'expanded' : 'collapsed')) }))) as unknown as typeof fetch)
  const expand = useViewStore.getState().setOpened({ open: new Map([['profit', ['cups']]]), all: false })
  const collapse = useViewStore.getState().setOpened({ open: new Map(), all: false })
  answers[1]!.answer(); await collapse
  answers[0]!.answer(); await expand
  expect(useViewStore.getState().view?.title).toBe('collapsed')
  expect(useViewStore.getState().opened.open.size).toBe(0)
})

it('a read that fails keeps the last good View, says why, and puts back what was opened', async () => {
  setTeamFetch((async () => answered('first')) as unknown as typeof fetch)
  await useViewStore.getState().use(UUID)
  setTeamFetch((async () => new Response(JSON.stringify({ error: 'the server is busy' }), { status: 503 })) as unknown as typeof fetch)
  expect(await useViewStore.getState().setOpened({ open: new Map([['profit', ['cups']]]), all: false })).toBe(false)
  expect(useViewStore.getState()).toMatchObject({ status: 'ready', error: 'the server is busy' })
  expect(useViewStore.getState().view?.title).toBe('first')
  expect(useViewStore.getState().opened.open.size).toBe(0)
})

it('after the canvas model changes, no chance is current until the new View lands (review 00051 P1)', async () => {
  const withModel = (title: string) => new Response(JSON.stringify({ ...view(title), model: { cards: [] } }), { status: 200 })
  setTeamFetch((async () => withModel('before')) as unknown as typeof fetch)
  await useViewStore.getState().use(UUID)
  expect(currentModel(useViewStore.getState())).not.toBeNull()
  let answer!: (r: Response) => void
  setTeamFetch((() => new Promise<Response>((done) => { answer = done })) as unknown as typeof fetch)
  const read = useViewStore.getState().modelChanged()
  expect(currentModel(useViewStore.getState())).toBeNull()
  answer(withModel('after')); await read
  expect(useViewStore.getState().view?.title).toBe('after')
  expect(currentModel(useViewStore.getState())).not.toBeNull()
})

it('a read after a model change that fails shows no chance as current', async () => {
  setTeamFetch((async () => new Response(JSON.stringify({ ...view('before'), model: { cards: [] } }), { status: 200 })) as unknown as typeof fetch)
  await useViewStore.getState().use(UUID)
  setTeamFetch((async () => new Response(JSON.stringify({ error: 'the server is busy' }), { status: 503 })) as unknown as typeof fetch)
  expect(await useViewStore.getState().modelChanged()).toBe(false)
  expect(currentModel(useViewStore.getState())).toBeNull()
})
