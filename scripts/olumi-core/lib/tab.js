(function (win, person) {
  /*
   * THE PAGE'S SIDE of the one-origin server. Injected into DGAI's index.html before DGAI starts (server.mjs), so DGAI's own source
   * is untouched. It does three things, all about knowing WHO this tab is and WHICH scenario a UUID names:
   *
   *   1. Another person's saved state is not this person's. When this browser last held someone else's private link, DGAI's saved
   *      state (their scenario, thread, autosave) and every scenario pairing below are cleared. Storage that already names THIS
   *      person is theirs and is never cleared, whatever this tab was before (a reload of an old tab must not unpair their scenarios).
   *   2. Every call to the server's /bff/ routes says which person this tab was opened for (x-olumi-person). The server refuses a
   *      write when the browser's private link has since changed, so an open tab can never save as somebody else.
   *   3. DGAI mints a scenario's UUID before olumi-core knows the scenario. The pairing UUID -> core's scenario id is kept here, in
   *      the same storage as DGAI's own memory of that UUID (one key per scenario, so nothing is capped and two tabs cannot
   *      overwrite each other), sent for the one scenario a call names (x-olumi-scenario), and learned from the answer's
   *      x-olumi-alias. The server holds none of it.
   *
   *   4. A tab opened for Ada that is still running when another tab of this browser takes Bea's link must not leave Ada's work
   *      for Bea: it learns of the change from the shared storage (an event, on focus, and before EVERY write it makes), says so,
   *      and stops writing to it. (Its own unload would otherwise save Ada's model into the storage Bea's page then recovers as
   *      "Recovered unsaved changes".)
   *
   * Written as one plain function (no imports, no modern-only syntax) because the server inlines its source text into the page.
   */
  var PERSON_KEY = 'olumi-core-person'
  var SCENARIO_KEY = 'olumi-core-sc:'
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  var ALIAS = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})=(s_[0-9a-f]+)$/i

  var store = null
  try { store = win.localStorage } catch (e) { store = null }
  var read = function (k) { try { return store ? store.getItem(k) : null } catch (e) { return null } }
  var write = function (k, v) { try { if (store) store.setItem(k, v) } catch (e) { /* storage refused: the pairing is lost with it, as DGAI's own memory is */ } }

  // 1. whose saved state is this? The shared storage names the person it belongs to. When it names someone else (or no one), it is
  // not this person's, and nothing of it is taken into this page. The TAB's own session storage (it survives a reload) names who
  // THIS TAB was: a tab that was another person's clears only its own session storage. It never clears the shared storage on that
  // account: when the shared storage already names this person, it holds THEIR work (another tab of theirs wrote it), and wiping it
  // would unpair their scenarios. What the old tab might still write to the shared storage is stopped at the write (step 4), not here.
  var TAB_KEY = 'olumi-core-tab-person'
  try {
    var tabWas = null
    try { tabWas = win.sessionStorage.getItem(TAB_KEY) } catch (e) { /* none */ }
    if (read(PERSON_KEY) !== person.id) {
      if (store) store.clear()
      try { win.sessionStorage.clear() } catch (e) { /* none */ }
      write(PERSON_KEY, person.id)
    } else if (tabWas !== null && tabWas !== person.id) {
      try { win.sessionStorage.clear() } catch (e) { /* none */ }
    }
    try { win.sessionStorage.setItem(TAB_KEY, person.id) } catch (e) { /* none */ }
  } catch (e) { /* none */ }
  win.__OLUMI_CORE__ = { person: person }

  // 4. another tab of this browser has since taken someone else's private link: this tab says so and writes nothing more to the
  // shared storage (what it would save is the previous person's work).
  var stale = false
  var markStale = function () {
    if (stale) return
    stale = true
    var show = function () {
      var d = win.document.createElement('div')
      d.setAttribute('role', 'alert')
      d.setAttribute('data-testid', 'olumi-core-page-for-someone-else')
      d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#fff7ed;border-bottom:1px solid #fdba74;color:#7c2d12;font:15px/1.4 system-ui,sans-serif;padding:12px 16px;text-align:center'
      d.innerHTML = 'This page was opened with a different private link from the one this browser holds now. Nothing you do here will be saved. <a href="" onclick="location.reload();return false" style="color:inherit">Reload this page</a> to continue as the person whose private link is open now.'
      win.document.body.appendChild(d)
    }
    if (win.document.body) show()
    else win.document.addEventListener('DOMContentLoaded', show)
  }
  var checkPerson = function () {
    var now = read(PERSON_KEY)
    if (now !== null && now !== person.id) markStale()
  }
  try {
    var proto = win.Storage && win.Storage.prototype
    if (proto && store) {
      ;['setItem', 'removeItem', 'clear'].forEach(function (name) {
        var real = proto[name]
        // Every write first asks whose storage this is, so a tab that heard nothing (a background tab, a restored session) still
        // cannot put its person's work into the next person's.
        proto[name] = function () { if (this === store) { checkPerson(); if (stale) return undefined } return real.apply(this, arguments) }
      })
    }
    if (win.addEventListener) {
      win.addEventListener('storage', function (ev) { if (ev.key === null || ev.key === PERSON_KEY) checkPerson() })
      win.addEventListener('focus', checkPerson)
      win.addEventListener('pageshow', checkPerson)
    }
  } catch (e) { /* none */ }

  // A browser landing on the bare address opens the canvas.
  try {
    var h = win.location.hash
    if (!h || h === '#' || h === '#/') win.location.replace(win.location.pathname + win.location.search + '#/canvas')
  } catch (e) { /* none */ }

  // Which scenario UUID does this call name? A turn names it in its body, a saved-model read in its path.
  var scenarioOf = function (pathname, init) {
    var m = /^\/bff\/cee\/scenarios\/([^/]+)\/graph$/.exec(pathname)
    if (m && UUID.test(m[1])) return m[1]
    try {
      if (init && typeof init.body === 'string') {
        var id = JSON.parse(init.body).scenario_id
        if (typeof id === 'string' && UUID.test(id)) return id
      }
    } catch (e) { /* not JSON */ }
    return null
  }

  // 5. The model this page last read, per scenario (the `x-olumi-revision` the server put on its last saved-model read or turn). A figure
  // edit says it, so the server can refuse an edit made from a page that is behind the saved model, instead of overwriting a newer figure.
  var seen = {}

  // 2 and 3. say who this tab is and which scenario a UUID is, on every call to the server's /bff/ and /api/ routes; learn new pairings.
  var realFetch = win.fetch
  if (typeof realFetch === 'function') {
    win.fetch = function (input, init) {
      var next = input
      var nextInit = init
      var named = null
      try {
        var raw = typeof input === 'string' ? input : (input && input.url) || String(input)
        var url = new win.URL(raw, win.location.href)
        if (url.origin === win.location.origin && (url.pathname.indexOf('/bff/') === 0 || url.pathname.indexOf('/api/') === 0)) {
          var headers = new win.Headers((init && init.headers) || (typeof input !== 'string' && input && input.headers) || undefined)
          headers.set('x-olumi-person', person.id)
          var uuid = scenarioOf(url.pathname, init)
          named = uuid
          var sid = uuid ? read(SCENARIO_KEY + uuid) : null
          if (uuid && sid) headers.set('x-olumi-scenario', uuid + '=' + sid)
          if (uuid && seen[uuid]) headers.set('x-olumi-revision', seen[uuid])
          var copy = {}
          for (var k in init) copy[k] = init[k]
          copy.headers = headers
          if (typeof input === 'string') nextInit = copy
          else { next = new win.Request(input, copy); nextInit = undefined }
        }
      } catch (e) { next = input; nextInit = init }
      return realFetch.call(win, next, nextInit).then(function (res) {
        try {
          var said = res.headers.get('x-olumi-alias')
          var pair = said ? ALIAS.exec(said) : null
          if (pair) write(SCENARIO_KEY + pair[1], pair[2])
          var rev = res.headers.get('x-olumi-revision')
          if (named && rev) seen[named] = rev
        } catch (e) { /* none */ }
        return res
      })
    }
  }

  // An address that names a scenario this person cannot open (someone else's, or none) would show a blank canvas and say nothing:
  // this says so, with the way out.
  try {
    var named = /^#\/scenario\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(win.location.hash)
    if (named && typeof win.fetch === 'function') {
      win.fetch('/bff/cee/scenarios/' + named[1] + '/graph', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then(function (r) {
        if (r.status !== 404 && r.status !== 401) return
        var show = function () {
          var d = win.document.createElement('div')
          d.setAttribute('role', 'alert')
          d.setAttribute('data-testid', 'olumi-core-scenario-unavailable')
          d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#fff7ed;border-bottom:1px solid #fdba74;color:#7c2d12;font:15px/1.4 system-ui,sans-serif;padding:12px 16px;text-align:center'
          d.innerHTML = 'That scenario is not available to you: it may belong to someone else. Open it from your own private link, or <a href="#/canvas" style="color:inherit">start a new one</a>.'
          win.document.body.appendChild(d)
        }
        if (win.document.body) show()
        else win.document.addEventListener('DOMContentLoaded', show)
      }).catch(function () { /* none */ })
    }
  } catch (e) { /* none */ }
})
