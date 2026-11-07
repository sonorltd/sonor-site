/* Sonor Site — APP (app-local, v0.3.0 — tap a device on the embedded plan → its checks + notes in a sheet; v0.2.0 — TODAY strip from the engineers' calendar (B-807) · PLAN tab = the Takeoffs site view embedded, device 📐 → centred on it (B-806); v0.1.0, 2026-11-07)
 * Bryn: "survey and site are diff apps, survey is for that, site is for engineers, they are very similar but different levels of info".
 * The engineers' app: the project's devices with their checks per stage, site notes (note / change from plan / photo / question /
 * snag) on a device, floor, room or a 📍 point on the live Takeoffs plan, and the project's open snags + RFIs.
 *
 * UI ONLY. Data: the root seam SonorSite (sonor-site.js) reads every owner live (Takeoffs devices + plan revision, Tasks checks +
 * snags, plan_notes RFIs, site_notes). Writes queue in this app's own SonorOutbox (sonor-outbox.js) and land through the single-
 * writer RPCs punch_tick · site_note_upsert · site_note_resolve (who = the signed-in login, server side). Plans: SonorPlanImage.
 * Moved here from Survey v0.13.0's Site panel (survey-site.js) — SITE-ARCHITECTURE.md is the contract.
 */
(function () {
  'use strict';
  var CFG = window.__SITE_CONFIG__ || {}, $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.from((r || document).querySelectorAll(s)); };
  var supa = null, OB = null, PID = null, M = null, stage = null, tab = 'devices', open = {}, loading = false, dirty = false, q = '', today = [], planSrc = null;
  try { stage = localStorage.getItem('sonor_site_stage') || null; } catch (e) { }

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function me() { var u = window.__SONOR_USER__; return (u && u.email) || null; }
  function who(v) { try { return (window.SonorWho && window.SonorWho.label(v)) || String(v || '').split('@')[0]; } catch (e) { return String(v || '').split('@')[0]; } }
  function fmtDate(iso) { try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }); } catch (e) { return ''; } }
  function toast(msg) { if (window.SonorShell && window.SonorShell.toast) return window.SonorShell.toast(msg); var t = $('#stToast'); t.textContent = msg; t.hidden = false; clearTimeout(t._t); t._t = setTimeout(function () { t.hidden = true; }, 2600); }
  function openModal(title, body) { $('#stModalTitle').textContent = title; var b = $('#stModalBody'); b.innerHTML = ''; b.appendChild(body); $('#stModal').hidden = false; }
  function closeModal() { $('#stModal').hidden = true; }
  function svc(nn) { var B = window.__SONOR_BRAND__ || window.SonorBrand || {}; return (B.services || []).find(function (x) { return Number(x.nn) === Number(nn); }) || null; }
  function dot(nn) { var s = svc(nn); return '<span class="st-dot" style="background:' + ((s && s.hex) || 'var(--text-muted)') + '"></span>'; }
  function prog(done, total) { var pc = total ? Math.round(done * 100 / total) : 0, tone = !total ? 'dim' : pc === 100 ? 'ok' : pc ? 'part' : 'none'; return '<span class="st-prog" data-tone="' + tone + '">' + done + '/' + total + '</span>'; }

  // ---------- boot ----------
  function boot() {
    supa = new window.SonorDB().client;
    OB = window.SonorOutbox.create({ name: CFG.outbox || 'sonor-site', label: 'Site', apply: apply });
    OB.setClient(supa); OB.onStatus(renderSync);
    OB.onStatus(function (st) { if (dirty && st.online && !st.flushing && !st.pending) { dirty = false; load(); } });   // queue drained → re-read every owner
    var qp = new URLSearchParams(location.search).get('pid');
    if (qp && /^[0-9a-f-]{36}$/i.test(qp)) { try { localStorage.setItem('sonor_active_project_id::site', qp); } catch (e) { } }
    window.SonorProjectBar.init({ supa: supa, appKey: 'site', host: $('#projectBarHost') });
    document.addEventListener('sonor:project-changed', function (e) { setProject(e.detail && e.detail.currentId); });
    var cur = null; try { cur = localStorage.getItem('sonor_active_project_id::site'); } catch (e) { }
    if (cur) setTimeout(function () { if (!PID) setProject(cur); }, 800);
    $('#stModalClose').onclick = closeModal;
    $('#stSync').onclick = function () { OB.flushNow(); };
    try { navigator.serviceWorker && navigator.serviceWorker.register('./sw.js'); } catch (e) { }
    loadToday();
    render();
  }
  // v0.2.0 TODAY (B-807) — the engineers' Google Calendar is the SSOT for site scheduling (Bryn 2026-10-17): today's entries for the
  // signed-in engineer (tasks_gcal_events, synced by Tasks), each a one-tap switch to its project; with no project picked yet and
  // exactly one job today, that job opens on its own.
  async function loadToday() {
    var em = me(); if (!em || !supa) return;
    var d0 = new Date(); d0.setHours(0, 0, 0, 0); var d1 = new Date(d0.getTime() + 864e5);
    try {
      var r = await supa.from('tasks_gcal_events').select('id,summary,location,starts_at,ends_at,all_day,project_id,event_status').eq('engineer_email', em.toLowerCase()).gte('starts_at', d0.toISOString()).lt('starts_at', d1.toISOString()).neq('event_status', 'cancelled').order('starts_at');
      today = (r.data || []); if (!r.error) { try { await OB.cacheSet('today:' + em, today); } catch (e) { } }
    } catch (e) { try { today = (await OB.cacheGet('today:' + em)) || []; } catch (e2) { today = []; } }
    var jobs = today.filter(function (t) { return t.project_id; });
    if (!PID && jobs.length && jobs.every(function (t) { return t.project_id === jobs[0].project_id; })) pickProject(jobs[0].project_id);
    render();
  }
  function pickProject(pid) { try { if (window.SonorProjectBar && window.SonorProjectBar.setActive) { window.SonorProjectBar.setActive(pid); return; } } catch (e) { } setProject(pid); }
  // v0.3.0 — a device tapped on the embedded plan (Takeoffs site view 1.4.0 posts 'sonor:site-device') opens that device's checks + notes
  // in a sheet over the plan — tick and note without leaving it. Same-origin messages only.
  window.addEventListener('message', function (e) {
    var d = e.data; if (!d || d.type !== 'sonor:site-device' || !M) return;
    if (e.origin !== location.origin && !(location.protocol === 'file:' && e.origin === 'null')) return;
    var dev = M.devices.find(function (x) { return (d.uid && x.uid === d.uid) || (d.device && x.key === d.device); });
    if (!dev) { toast((d.device || 'That device') + ' has no checks in this project yet'); return; }
    deviceSheet(dev);
  });
  function deviceSheet(dev) {
    var body = document.createElement('div'); body.className = 'st-sheet'; open[dev.key] = true;
    function paint() {
      body.innerHTML = deviceRow(dev);
      $$('[data-chk]', body).forEach(function (b) { b.onclick = function () { var c = dev.checks.find(function (x) { return x.task_id === b.dataset.task && x.key === b.dataset.chk; }); if (c) { tick(dev, c); paint(); } }; });
      $$('[data-devnote]', body).forEach(function (b) { b.onclick = function () { closeModal(); noteSheet({ device: dev }); }; });
      $$('[data-dev-link="site"]', body).forEach(function (a) { a.onclick = function (ev) { ev.preventDefault(); closeModal(); }; });   // already on the plan
    }
    paint(); openModal(dev.name + (dev.room_name ? ' · ' + dev.room_name : ''), body);
  }
  function setProject(pid) { if (!pid || pid === PID) return; PID = pid; M = null; open = {}; load(); }

  // ---------- data ----------
  async function load() {
    if (!PID || loading) return; loading = true; render();
    try { M = await window.SonorSite.load(supa, PID, { cache: { get: OB.cacheGet, set: OB.cacheSet }, timeoutMs: 9000 }); await overlayQueued(); }
    catch (e) { M = null; toast('Could not load the project — ' + e.message); }
    loading = false; render();
  }
  async function overlayQueued() {   // this device's unsent ticks / notes, shown until they land
    var ops = await OB.all(); if (!M) return;
    ops.forEach(function (o) {
      if (o.pid !== PID) return;
      if (o.op === 'site.tick') M.devices.forEach(function (d) { d.checks.forEach(function (c) { if (c.task_id === o.task && c.key === o.key) { c.done = o.done; c.queued = true; } }); recount(d); });
      if (o.op === 'site.note') { var n = Object.assign({ status: 'open', queued: true }, o.row), i = M.notes.findIndex(function (x) { return x.id === n.id; }); if (i >= 0) M.notes[i] = Object.assign(M.notes[i], n); else { M.notes.unshift(n); attach(n); } }
    });
  }
  function recount(d) { d.total = d.checks.length; d.done = d.checks.filter(function (c) { return c.done; }).length; }
  function attach(n) { var d = M.devices.find(function (x) { return (n.device_uid && x.uid === n.device_uid) || (!n.device_uid && n.device_key && x.key === n.device_key); }); if (d && d.notes.indexOf(n) < 0) d.notes.unshift(n); }

  // ---------- writes: outbox first, the shared seam's RPCs on flush ----------
  async function apply(o) {
    var S = window.SonorSite, isNet = OB.isNet;
    try {
      if (o.op === 'site.note') await S.saveNote(supa, o.row);
      else if (o.op === 'site.tick') await S.tick(supa, o.task, o.key, o.done, o.by);
      else if (o.op === 'site.resolve') await S.resolve(supa, o.id, o.action, o.by, null, o.extra);
      else if (o.op === 'photo.upload') { var blob = await OB.blobGet('photo:' + o.id); if (!blob) return true; var r = await supa.storage.from(CFG.buckets.photos).upload(o.path, blob, { contentType: 'image/jpeg', upsert: true }); if (r.error) return isNet(r.error) ? 'retry' : true; }
      return true;
    } catch (e) { if (isNet(e)) return 'retry'; console.warn('[Site] dropped', o.op, e.message); return true; }
  }
  async function tick(d, c) {
    c.done = !c.done; c.queued = true; recount(d); render();
    dirty = true; await OB.add({ op: 'site.tick', pid: PID, task: c.task_id, key: c.key, done: c.done, by: me() }); OB.flush();
  }
  async function saveNote(row, file) {
    row.id = row.id || window.SonorSite.uuid(); row.project_id = PID; row.created_by = row.created_by || me();
    if (file) {
      var ph = await window.SonorPlanImage.preparePhoto(file, CFG.photoMax, CFG.photoQuality);
      row.photo_path = PID + '/site/' + row.id + '.jpg';
      await OB.blobSet('photo:site:' + row.id, ph.blob);
      await OB.add({ op: 'photo.upload', pid: PID, id: 'site:' + row.id, path: row.photo_path });
    }
    dirty = true; await OB.add({ op: 'site.note', pid: PID, row: row });
    var n = Object.assign({ status: 'open', queued: true, created_at: new Date().toISOString() }, row), i = M.notes.findIndex(function (x) { return x.id === n.id; });
    if (i >= 0) M.notes[i] = Object.assign(M.notes[i], n); else { M.notes.unshift(n); attach(n); }
    OB.flush(); render();
  }
  async function resolve(n, action) {
    var label = { snag: 'Sent to Tasks as a snag', rfi: 'Raised as an RFI', resolve: 'Resolved', dismiss: 'Dismissed', reopen: 'Reopened' }[action];
    dirty = true; await OB.add({ op: 'site.resolve', pid: PID, id: n.id, action: action, by: me() });
    n.status = { snag: 'promoted', rfi: 'promoted', resolve: 'resolved', dismiss: 'dismissed', reopen: 'open' }[action]; n.queued = true;
    OB.flush(); toast(label); render();
  }

  // ---------- render ----------
  function render() {
    var host = $('#stApp'); if (!host) return;
    // the Plan tab holds a live iframe — never rebuild it for a tick / note (that would reload the plan); just refresh the counts
    var fr = $('#stPlan'); if (tab === 'plan' && M && fr && fr.getAttribute('src') === (planSrc || planUrl())) { var sub = $('.st-sub', host); if (sub) sub.textContent = liveLine(); return; }
    var todayHtml = today.length ? '<div class="st-today"><span class="st-today-h">Today</span>' + today.map(function (t) {
      var tm = t.all_day ? 'All day' : new Date(t.starts_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      return '<button class="st-job' + (t.project_id && t.project_id === PID ? ' on' : '') + '"' + (t.project_id ? ' data-job="' + esc(t.project_id) + '"' : ' disabled title="Not linked to a project in the calendar"') + '><b>' + esc(tm) + '</b> ' + esc(t.summary || 'Job') + '</button>';
    }).join('') + '</div>' : '';
    if (!PID) { host.innerHTML = todayHtml + '<p class="st-empty">Pick a project in the bar above' + (today.length ? ' or one of today’s jobs' : '') + '.</p>'; wire(host); return; }
    if (!M) { host.innerHTML = '<p class="st-empty">' + (loading ? 'Loading the live project…' : 'Could not load this project.') + '</p>'; return; }
    var openNotes = M.notes.filter(function (n) { return n.status === 'open'; }).length, openSnags = M.snags.filter(function (s) { return !/done|cancelled/.test(s.status || ''); }).length, openRfis = M.rfis.filter(function (r) { return !/closed|answered/.test(r.status || ''); }).length;
    host.innerHTML = todayHtml + '<div class="st-bar"><span class="st-sub">' + esc(liveLine()) + '</span>' + (M.stale ? '<span class="st-stale" title="' + esc(M.error || '') + '">Offline copy · ' + esc(fmtDate(M.at)) + '</span>' : '')
      + '<span class="st-grow"></span><button class="btn btn-sm" data-act="reload" title="Reload from every app">⟳</button><button class="btn btn-sm" data-act="report">📄 Visit report</button><button class="btn btn-sm btn-primary" data-act="note">＋ Site note</button></div>'
      + '<div class="st-bar st-stages"><button class="btn btn-sm' + (!stage ? ' active' : '') + '" data-stage="">All stages</button>' + (M.stages || []).map(function (s) { return '<button class="btn btn-sm' + (stage === s.key ? ' active' : '') + '" data-stage="' + esc(s.key) + '">' + esc(s.label) + '</button>'; }).join('') + '</div>'
      + '<div class="tab-bar st-tabs">' + [['devices', 'Devices'], ['plan', 'Plan'], ['notes', 'Site notes' + (openNotes ? ' · ' + openNotes : '')], ['snags', 'Snags & RFIs' + ((openSnags + openRfis) ? ' · ' + (openSnags + openRfis) : '')]].map(function (t) { return '<button class="tab' + (tab === t[0] ? ' active' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('')
      + (tab === 'devices' ? '<span class="nav-actions"><input id="stFind" type="search" placeholder="Find a device or room" value="' + esc(q) + '"></span>' : '') + '</div>'
      + '<div class="st-body" id="stBody"></div>';
    var body = $('#stBody');
    if (tab === 'devices') renderDevices(body); else if (tab === 'plan') renderPlan(body); else if (tab === 'notes') renderNotes(body); else renderSnags(body);
    wire(host);
  }
  function liveLine() {
    var tot = 0, dn = 0; M.devices.forEach(function (d) { var p = window.SonorSite.stageProgress(d, stage); tot += p.total; dn += p.done; });
    return M.devices.length + ' devices · ' + dn + '/' + tot + ' checks' + (M.floors.length ? ' · ' + M.floors.map(function (f) { return f.code + (f.plan ? ' ' + (f.plan.revision_label || 'plan') : ''); }).join(' · ') : '');
  }
  function match(d) { if (!q) return true; var s = (d.name + ' ' + d.key + ' ' + (d.room_name || '') + ' ' + (d.model || '')).toLowerCase(); return q.toLowerCase().split(/\s+/).every(function (w) { return s.indexOf(w) >= 0; }); }
  function renderDevices(body) {
    var groups = window.SonorSite.byFloor(M); if (!groups.length) { body.innerHTML = '<p class="st-empty">No devices in this project’s design yet — they appear as soon as Takeoffs or Engineering has them.</p>'; return; }
    groups.forEach(function (gr) {
      var list = gr.devices.filter(function (d) { return match(d) && (!stage || d.checks.some(function (c) { return c.stage === stage; }) || d.notes.length); }); if (!list.length) return;
      var fp = list.reduce(function (a, d) { var p = window.SonorSite.stageProgress(d, stage); a.d += p.done; a.t += p.total; return a; }, { d: 0, t: 0 });
      var sec = document.createElement('section'); sec.className = 'st-floor';
      sec.innerHTML = '<h4>' + esc(gr.floor.name || gr.floor.code) + (gr.floor.plan ? ' <span class="st-rev">plan ' + esc(gr.floor.plan.revision_label || '') + '</span>' : '') + ' ' + prog(fp.d, fp.t)
        + (gr.floor.id ? ' <a class="st-link" data-floorplan="' + esc(gr.floor.id) + '" href="' + esc(planUrl({ floor: gr.floor.id })) + '">Plan</a>' : '') + '</h4><div class="st-groups"></div>';
      body.appendChild(sec);
      var host = $('.st-groups', sec);
      window.SonorServiceGroups.render(host, list, { key: 'site-app-' + gr.floor.code, getNn: function (d) { return d.nn; }, row: deviceRow, tier: 'client', toolbar: false,
        count: function (g) { return g.items.length + ' device' + (g.items.length === 1 ? '' : 's'); },
        aside: function (g) { var a = g.items.reduce(function (x, d) { var p = window.SonorSite.stageProgress(d, stage); x.d += p.done; x.t += p.total; return x; }, { d: 0, t: 0 }); return prog(a.d, a.t); } });
    });
    $$('[data-dev]', body).forEach(function (r) { r.onclick = function (e) { if (e.target.closest('[data-chk],[data-devnote],a')) return; open[r.dataset.dev] = !open[r.dataset.dev]; render(); }; });
    $$('[data-chk]', body).forEach(function (b) { b.onclick = function () { var d = M.devices.find(function (x) { return x.key === b.dataset.dk; }), c = d && d.checks.find(function (x) { return x.task_id === b.dataset.task && x.key === b.dataset.chk; }); if (c) tick(d, c); }; });
    $$('[data-devnote]', body).forEach(function (b) { b.onclick = function () { noteSheet({ device: M.devices.find(function (x) { return x.key === b.dataset.devnote; }) }); }; });
    $$('[data-floorplan]', body).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); planSrc = a.getAttribute('href'); tab = 'plan'; render(); }; });
    $$('[data-dev-link="site"]', body).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); planSrc = a.getAttribute('href'); tab = 'plan'; render(); }; });
  }
  function deviceRow(d) {
    var p = window.SonorSite.stageProgress(d, stage), isOpen = !!open[d.key], checks = d.checks.filter(function (c) { return !stage || c.stage === stage; }), nOpen = d.notes.filter(function (n) { return n.status === 'open'; }).length;
    var h = '<div class="st-dev' + (isOpen ? ' open' : '') + '" data-dev="' + esc(d.key) + '">' + dot(d.nn) + '<span class="st-dev-n">' + esc(d.name) + '<span class="st-dev-k">' + esc(d.key) + '</span></span><span class="st-dev-r">' + esc(d.room_name || '') + '</span>'
      + (nOpen ? '<span class="st-badge">' + nOpen + ' note' + (nOpen > 1 ? 's' : '') + '</span>' : '') + (d.source === 'punch-only' ? '<span class="st-badge st-warn">removed from design</span>' : '') + prog(p.done, p.total) + '</div>';
    if (!isOpen) return h;
    var links = (window.SonorDeviceLinks && d.loc) ? window.SonorDeviceLinks.html(window.SonorDeviceLinks.forDevice({ project: PID, loc: d.loc, device: d.key, uid: d.uid }), { compact: true }) : '';
    h += '<div class="st-checks">' + ((d.model || d.block_code || links) ? '<div class="st-tech">' + (d.model ? '<span>Model <b>' + esc(d.model) + '</b></span>' : '') + (d.kind ? '<span>' + esc(d.kind) + '</span>' : '') + links + '</div>' : '')
      + (checks.length ? checks.map(function (c) {
        var st = (M.stages.find(function (s) { return s.key === c.stage; }) || {}).short || c.stage || '';
        return '<button class="st-chk' + (c.done ? ' done' : '') + '" data-chk="' + esc(c.key) + '" data-task="' + esc(c.task_id) + '" data-dk="' + esc(d.key) + '"><span class="st-box">' + (c.done ? '✓' : '') + '</span><span class="st-chk-t">' + esc(String(c.text || c.item || '').replace(/^.*? — /, '')) + '</span><span class="st-chk-m">' + esc(st) + (c.done && c.by ? ' · ' + esc(who(c.by)) : '') + (c.queued ? ' · waiting to upload' : '') + '</span></button>';
      }).join('') : '<p class="muted">No checks for this stage.</p>')
      + (d.notes.length ? '<div class="st-dev-notes">' + d.notes.map(noteLine).join('') + '</div>' : '')
      + '<button class="btn btn-sm" data-devnote="' + esc(d.key) + '">＋ Note on this device</button></div>';
    return h;
  }
  var KIND = {}; (window.SonorSite ? window.SonorSite.KINDS : []).forEach(function (k) { KIND[k[0]] = k[1]; });
  var CH = {}; (window.SonorSite ? window.SonorSite.CHANGES : []).forEach(function (c) { CH[c[0]] = c[1]; });
  function noteLine(n) {
    var st = n.status === 'open' ? '' : ' · ' + ({ promoted: (n.linked && n.linked.rfi_id) ? n.linked.rfi_id : 'in Tasks', accepted: 'accepted — to draw in Takeoffs', applied: 'drawn on the as-built', dismissed: 'dismissed', resolved: 'resolved' }[n.status] || n.status);
    return '<div class="st-note" data-status="' + esc(n.status) + '"><span class="st-kind" data-k="' + esc(n.kind) + '">' + esc(KIND[n.kind] || n.kind) + (n.change_type ? ' · ' + esc(CH[n.change_type] || n.change_type) : '') + '</span> ' + esc(n.text || '') + '<span class="st-chk-m">' + esc(st) + (n.queued ? ' · waiting to upload' : '') + '</span></div>';
  }
  function photoUrl(path) { try { return supa.storage.from(CFG.buckets.photos).getPublicUrl(path).data.publicUrl; } catch (e) { return ''; } }
  // v0.2.0 PLAN (B-806) — the Takeoffs read-only SITE VIEW (sonor-takeoffs-site.js, with the site-notes layer from v1.3.0) embedded:
  // one plan viewer for every app, never a copy. A device's 📐 link opens it centred on that device.
  function planUrl(o) {
    o = o || {}; var L = window.SonorDeviceLinks, u = L && (o.uid || o.device || o.floor) ? L.build('takeoffsSite', 'device', { project: PID, floor: o.floor, uid: o.uid, device: o.device }) : null;
    if (u) return u; var B = window.__SONOR_BRAND__ || {}, base = (B.appUrls && B.appUrls.hosted && B.appUrls.hosted.takeoffsSite) || 'https://apps.sonor.co.uk/sonor-takeoffs/site.html';
    return base + '?view=site&pid=' + encodeURIComponent(PID);
  }
  function renderPlan(body) {
    var src = planSrc || planUrl();
    body.innerHTML = '<div class="st-plan"><iframe id="stPlan" title="Site plan (Takeoffs site view)" src="' + esc(src) + '" allow="fullscreen"></iframe></div><p class="st-chk-m">Read-only plan from Takeoffs · site notes show as numbered pins · needs signal · <a class="st-link" href="' + esc(src) + '" target="_blank" rel="noopener">Open full screen ↗</a></p>';
  }
  function renderNotes(body) {
    var notes = M.notes; if (!notes.length) { body.innerHTML = '<p class="st-empty">No site notes yet. Use ＋ Site note, or open a device and add one to it.</p>'; return; }
    body.innerHTML = notes.map(function (n) {
      var where = [n.floor_code, n.room, n.device_label].filter(Boolean).join(' · ') + (n.x != null || n.to_x != null ? ' · 📍' : '');
      var acts = n.status === 'open' ? (n.kind === 'question' ? '<button class="btn btn-sm" data-res="rfi">Raise RFI</button>' : '') + (n.kind !== 'change' ? '<button class="btn btn-sm" data-res="snag">Snag → Tasks</button>' : '<span class="st-chk-m">reviewed in Takeoffs</span>') + '<button class="btn btn-sm" data-res="resolve">Resolved</button><button class="btn btn-sm" data-res="dismiss">Dismiss</button>'
        : (n.status === 'accepted' || n.status === 'applied') ? '' : '<button class="btn btn-sm" data-res="reopen">Reopen</button>';
      return '<div class="st-ncard" data-id="' + esc(n.id) + '">' + (n.photo_path ? '<img class="st-ph" loading="lazy" src="' + esc(photoUrl(n.photo_path)) + '" alt="">' : '') + '<div class="st-nmain">' + noteLine(n)
        + '<div class="st-chk-m">' + esc(where) + ' · ' + esc(who(n.created_by)) + ' · ' + esc(fmtDate(n.created_at)) + '</div><div class="st-acts">' + acts + '</div></div></div>';
    }).join('');
    $$('[data-res]', body).forEach(function (b) { b.onclick = function () { var id = b.closest('[data-id]').dataset.id, n = M.notes.find(function (x) { return x.id === id; }); if (n) resolve(n, b.dataset.res); }; });
  }
  function renderSnags(body) {
    var s = M.snags.map(function (x) { return '<div class="st-note"><span class="st-kind" data-k="snag">Snag</span> ' + esc(x.title) + '<span class="st-chk-m"> · ' + esc(x.status) + (x.floor ? ' · ' + esc(x.floor) : '') + '</span></div>'; }).join('');
    var r = M.rfis.map(function (x) { return '<div class="st-note"><span class="st-kind" data-k="question">' + esc(x.rfi_id || 'RFI') + '</span> ' + esc(x.text) + '<span class="st-chk-m"> · ' + esc(x.status) + (x.to ? ' · to ' + esc(x.to) : '') + '</span></div>'; }).join('');
    body.innerHTML = '<h4>Snags (Tasks)</h4>' + (s || '<p class="muted">None open.</p>') + '<h4>RFIs (Plan Notes)</h4>' + (r || '<p class="muted">None.</p>');
  }
  function wire(host) {
    $$('[data-act]', host).forEach(function (b) { b.onclick = function () { var a = b.dataset.act; if (a === 'reload') load(); else if (a === 'note') noteSheet({}); else if (a === 'report') report(); }; });
    $$('[data-stage]', host).forEach(function (b) { b.onclick = function () { stage = b.dataset.stage || null; try { localStorage.setItem('sonor_site_stage', stage || ''); } catch (e) { } render(); }; });
    $$('[data-tab]', host).forEach(function (b) { b.onclick = function () { if (b.dataset.tab === 'plan' && tab !== 'plan') planSrc = null; tab = b.dataset.tab; render(); }; });
    $$('[data-job]', host).forEach(function (b) { b.onclick = function () { pickProject(b.dataset.job); }; });
    var f = $('#stFind', host); if (f) { f.oninput = function () { q = this.value; var pos = this.selectionStart; render(); var g = $('#stFind'); if (g) { g.focus(); try { g.setSelectionRange(pos, pos); } catch (e) { } } }; }
  }
  function renderSync(st) {
    var el = $('#stSync'); if (!el) return; var n = st.pending, t = st.last ? new Date(st.last).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null;
    if (!st.online) { el.dataset.tone = 'warn'; el.textContent = n ? 'Saved to device · ' + n + ' waiting for signal' : 'Offline'; }
    else if (st.flushing) { el.dataset.tone = 'busy'; el.textContent = 'Uploading ' + n + '…'; }
    else if (n) { el.dataset.tone = 'info'; el.textContent = n + ' waiting to upload'; }
    else { el.dataset.tone = 'ok'; el.textContent = 'All backed up' + (t ? ' · ' + t : ''); }
  }

  // ---------- new note ----------
  function noteSheet(o) {
    if (!M) return; var d = o.device || null, body = document.createElement('div'); body.className = 'st-form';
    var floors = (M.floors || []).map(function (f) { return '<option value="' + esc(f.code) + '"' + (d && d.floor === f.code ? ' selected' : '') + '>' + esc(f.name || f.code) + '</option>'; }).join('');
    var devs = M.devices.slice().sort(function (a, b) { return String(a.floor).localeCompare(String(b.floor)) || String(a.room_name).localeCompare(String(b.room_name)) || String(a.name).localeCompare(String(b.name)); })
      .map(function (x) { return '<option value="' + esc(x.key) + '"' + (d && d.key === x.key ? ' selected' : '') + '>' + esc([x.floor, x.room_name, x.name].filter(Boolean).join(' · ')) + '</option>'; }).join('');
    body.innerHTML = '<label>Type <select id="stKind">' + window.SonorSite.KINDS.map(function (k) { return '<option value="' + k[0] + '">' + k[1] + '</option>'; }).join('') + '</select></label>'
      + '<label id="stChWrap" hidden>What changed <select id="stCh">' + window.SonorSite.CHANGES.map(function (k) { return '<option value="' + k[0] + '">' + k[1] + '</option>'; }).join('') + '</select></label>'
      + '<label>Device <select id="stDev"><option value="">— Not about one device</option>' + devs + '</select></label>'
      + '<label>Floor <select id="stFloor"><option value="">—</option>' + floors + '</select></label>'
      + '<label>Room <input id="stRoom" value="' + esc(d ? (d.room_name || '') : '') + '" placeholder="Room"></label>'
      + '<label>Note <textarea id="stText" rows="3" placeholder="What was found / done / changed"></textarea></label>'
      + '<label>On the plan <span class="st-pinrow"><button type="button" class="btn btn-sm" id="stPinBtn">📍 Pin on plan</button><span class="st-chk-m" id="stPinLbl">not pinned — the note sits on its device / room</span></span></label>'
      + '<label>Photo <input id="stPhoto" type="file" accept="image/*" capture="environment"></label>'
      + '<div class="st-actions"><button type="button" class="btn" id="stCancel">Cancel</button><button type="button" class="btn btn-primary" id="stSave">Save note</button></div>';
    openModal(d ? 'Site note · ' + d.name : 'Site note', body);
    var pin = null, moved = function () { return $('#stKind', body).value === 'change' && $('#stCh', body).value === 'moved'; };
    $('#stKind', body).onchange = function () { $('#stChWrap', body).hidden = this.value !== 'change'; };
    $('#stDev', body).onchange = function () { var v = this.value, x = M.devices.find(function (y) { return y.key === v; }); if (x) { if (x.floor) $('#stFloor', body).value = x.floor; $('#stRoom', body).value = x.room_name || ''; } };
    $('#stPinBtn', body).onclick = function () {
      var fc = $('#stFloor', body).value, f = M.floors.find(function (y) { return y.code === fc; }); if (!f) { toast('Pick the floor first'); return; }
      pickOnPlan(f, moved() ? 'Tap where it actually went' : 'Tap where this is', pin).then(function (pt) { if (!pt) return; pin = pt; $('#stPinLbl', body).textContent = 'pinned on ' + (f.plan ? 'plan ' + (f.plan.revision_label || '') : f.code) + (moved() ? ' (new position)' : ''); });
    };
    $('#stCancel', body).onclick = closeModal;
    $('#stSave', body).onclick = async function () {
      var dv = $('#stDev', body).value, x = M.devices.find(function (y) { return y.key === dv; }) || null, kind = $('#stKind', body).value, fc = $('#stFloor', body).value || null;
      var f = M.floors.find(function (y) { return y.code === fc; }) || null, text = $('#stText', body).value.trim(), file = $('#stPhoto', body).files[0] || null, mv = moved();
      if (!text && !file) { toast('Add a note or a photo'); return; }
      this.disabled = true;
      await saveNote({ kind: kind, change_type: kind === 'change' ? $('#stCh', body).value : null, text: text, floor_code: fc, floor_id: f ? f.floor_id : null,
        plan_id: f && f.plan ? f.plan.id : null, revision_label: f && f.plan ? f.plan.revision_label : null, room: $('#stRoom', body).value.trim() || null,
        device_uid: x ? x.uid : null, device_key: x ? x.key : null, device_label: x ? x.name : null, service_nn: x ? x.nn : null, stage: stage,
        x: pin && !mv ? pin.x : null, y: pin && !mv ? pin.y : null, to_x: pin && mv ? pin.x : null, to_y: pin && mv ? pin.y : null }, file);
      closeModal(); toast('Site note saved' + (navigator.onLine ? '' : ' to the device — uploads when there is signal'));
    };
  }
  // 📍 the floor's ACTIVE Takeoffs plan, fitted exactly as Takeoffs does → the tap is a Takeoffs world point
  function pickOnPlan(f, prompt, prev) {
    return new Promise(async function (done) {
      var SP = window.SonorPlanImage.SPACE, img = null, wrap = document.createElement('div'); wrap.className = 'st-pick';
      wrap.innerHTML = '<div class="st-pick-h"><b>' + esc(prompt) + '</b><span class="st-sub">' + esc(f.name || f.code) + (f.plan ? ' · plan ' + esc(f.plan.revision_label || '') : '') + '</span><span class="st-grow"></span><button class="btn btn-sm" data-p="cancel">Cancel</button><button class="btn btn-sm btn-primary" data-p="ok" disabled>Use this point</button></div><div class="st-pick-c"><canvas></canvas><p class="st-sub st-pick-msg">Loading the plan…</p></div>';
      document.body.appendChild(wrap);
      var c = $('canvas', wrap), host = $('.st-pick-c', wrap), pt = prev ? { x: prev.x, y: prev.y } : null, sc = 1;
      function draw() {
        sc = Math.min((host.clientWidth - 16) / SP.w, (host.clientHeight - 16) / SP.h); c.width = Math.round(SP.w * sc); c.height = Math.round(SP.h * sc);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        if (img) x.drawImage(img.image, 0, 0, img.fit.w * sc, img.fit.h * sc);
        if (pt) { x.beginPath(); x.arc(pt.x * sc, pt.y * sc, 10, 0, Math.PI * 2); x.fillStyle = 'rgba(224,160,48,.35)'; x.fill(); x.lineWidth = 3; x.strokeStyle = '#E0A030'; x.stroke(); }
        $('[data-p="ok"]', wrap).disabled = !pt;
      }
      function close(v) { wrap.remove(); done(v); }
      $('[data-p="cancel"]', wrap).onclick = function () { close(null); }; $('[data-p="ok"]', wrap).onclick = function () { close(pt); };
      c.addEventListener('pointerup', function (e) { var r = c.getBoundingClientRect(); pt = { x: Math.round((e.clientX - r.left) / sc * 10) / 10, y: Math.round((e.clientY - r.top) / sc * 10) / 10 }; draw(); });
      draw();
      try {
        var row = await window.SonorPlanImage.activePlan(supa, PID, f.floor_id);
        if (row) { img = await window.SonorPlanImage.loadImage(supa, row, { blobGet: OB.blobGet, blobSet: OB.blobSet }); $('.st-pick-msg', wrap).textContent = ''; }
        else $('.st-pick-msg', wrap).textContent = 'No plan uploaded for this floor in Takeoffs yet — the point still saves in the plan frame.';
      } catch (e) { $('.st-pick-msg', wrap).textContent = 'Plan not available offline yet — open it once with signal (the point still saves).'; }
      draw();
    });
  }

  // ---------- visit report ----------
  async function report() {
    if (!M) return; toast('Building the visit report…');
    try {
      var proj = (window.SonorProjectBar && window.SonorProjectBar.getProject && window.SonorProjectBar.getProject(PID)) || { id: PID, name: '' };
      var bytes = await window.SitePdf.report({ project: proj, site: M, engineer: who(me()) || null, stage: stage, since: new Date(Date.now() - 24 * 3600 * 1000).toISOString() });
      var name = ((proj.ref || proj.name || 'site') + ' — site visit ' + new Date().toISOString().slice(0, 10) + '.pdf').replace(/[\/\\:]/g, '-');
      var b = new Blob([bytes], { type: 'application/pdf' }), u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); URL.revokeObjectURL(u); }, 1500);
      toast('Report ready');
    } catch (e) { console.error(e); toast('Report failed: ' + e.message); }
  }

  window.SiteApp = { boot: boot, model: function () { return M; }, reload: load, today: function () { return today; }, deviceSheet: deviceSheet, VERSION: '0.3.0' };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
