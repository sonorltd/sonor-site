/* Sonor Site — SITE VISIT REPORT PDF (app-local)
 * v0.2.0 (2026-11-10) — Bryn: "we dont have enough examples of tasks and snags in this demo project to give a meaningful looking pdf export
 *   for site reports". Visit report v2: an AT-A-GLANCE page (five figures on light cards, who was on site, checks by stage with this visit's
 *   share drawn in), WORK DONE THIS VISIT (ticks by stage → floor → room, in GF / 1F… and service order), SITE NOTES THIS VISIT grouped by
 *   kind (changes from plan with their review, questions, snags, notes), OPEN SNAGS (Tasks + Portal, priority first) and OPEN RFIs, and
 *   STILL TO DO per stage. Every figure comes from the live SonorSite model — nothing re-counted against another table.
 * v0.1.0 (2026-11-07) — cover + checks by stage · this visit's notes · open snags + RFIs.
 * Shared chrome: sonor-pdf-luxury.js on pdf-lib (neutral working-document theme).
 * API: await SitePdf.report({ project, site, engineer?, stage?, since? }) → Uint8Array   (since = start of the visit, ISO)
 */
window.SitePdf = (function () {
  'use strict';
  function selfDir() { try { var s = document.currentScript; if (s && s.src) return s.src.replace(/[^/]*$/, ''); } catch (e) { } return '../data/'; }
  var BASE = selfDir(), DOC_LABEL = 'SITE VISIT', VERSION = '0.2.0';
  function L() { var lx = window.SonorPdfLuxury; if (!lx || !window.PDFLib) throw new Error('pdf-lib / SonorPdfLuxury not loaded'); return lx; }
  var GLYPH = { '↔': '<->', '→': '->', '←': '<-', '✓': 'yes', '✔': 'yes', '✕': 'no', '✗': 'no', '☐': '[ ]', '☑': '[x]', '²': '2', '³': '3', '×': 'x' };
  function pd(str) { return String(str == null ? '' : str).replace(/[↔→←✓✔✕✗☐☑×]/g, function (c) { return GLYPH[c] || '?'; }).replace(/[^\x00-\xFF€‘’“”–—…•™]/g, '?'); }
  function fit(font, str, size, w) { str = pd(str); if (font.widthOfTextAtSize(str, size) <= w) return str; while (str.length > 1 && font.widthOfTextAtSize(str + '…', size) > w) str = str.slice(0, -1); return str + '…'; }
  function fmtDate(iso) { try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }
  function fmtTime(iso) { try { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function hex(h) { h = String(h || '').replace('#', ''); return /^[0-9a-f]{6}$/i.test(h) ? [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] : [150, 150, 150]; }
  function svc(nn) { var G = window.SonorServiceGroups; if (G && G.service) return G.service(nn); var B = window.__SONOR_BRAND__ || {}; return (B.services || []).find(function (x) { return Number(x.nn) === Number(nn); }) || null; }
  function svcRank(nn) { var G = window.SonorServiceGroups; return G ? G.rank(nn) : (Number(nn) || 99); }
  var FLOORS = ['GF', '1F', '2F', '3F', '4F', 'BA', 'EXT'];
  function floorRank(c) { var i = FLOORS.indexOf(String(c || '').toUpperCase()); return i < 0 ? 50 : i; }
  var NOOP = {}; ['text', 'tracked', 'right', 'rect', 'rectB', 'rrect', 'hline', 'vline', 'logo', 'image', 'dot', 'path'].forEach(function (k) { NOOP[k] = function () { }; });
  var PRI = { p1: 'Urgent', p2: 'High', p3: 'Normal', p4: 'Low' }, UNPLACED = 'Not in a room', STATUS = { todo: 'To do', in_progress: 'In progress', raised: 'Raised', assigned: 'Assigned', blocked: 'Blocked', open: 'Open' };
  var CHG = {}; var KL = {};

  async function report(m) {
    var lx = L(), PL = window.PDFLib, A4 = lx.A4, M = lx.M, C = lx.COL, W = A4.w - M * 2;
    if (lx.theme) lx.theme('neutral');
    ((window.SonorSite && window.SonorSite.KINDS) || []).forEach(function (k) { KL[k[0]] = k[1]; });
    ((window.SonorSite && window.SonorSite.CHANGES) || []).forEach(function (k) { CHG[k[0]] = k[1]; });
    var who = function (v) { try { return (window.SonorWho && window.SonorWho.label(v)) || nameOf(v); } catch (e) { return nameOf(v); } };
    function nameOf(v) { var s = String(v || '').split('@')[0]; return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
    var site = m.site || {}, SINCE = m.since || null, GREEN = [74, 140, 92], RED = [196, 72, 72], AMBER = [196, 140, 48];
    var doc = await PL.PDFDocument.create(); doc.setTitle('Site visit — ' + (m.project.name || '')); doc.setAuthor('Sonor Smart Homes');
    var F = await lx.makeFonts(doc, BASE), cedia = null, fade = null;
    try { cedia = await lx.loadImage(doc, BASE + 'cedia-member-stacked.png'); } catch (e) { }
    try { var fp = lx.fadePngDataUrl(); if (fp) fade = await doc.embedPng(fp); } catch (e) { }
    var state = { dry: true, n: 0, total: 0 }, FOOT = A4.h - 70;

    // ── the model, read once ──
    var devs = site.devices || [], notes = site.notes || [], inVisit = function (iso) { return SINCE ? String(iso || '') >= SINCE : false; };
    var ticks = []; devs.forEach(function (d) { (d.checks || []).forEach(function (c) { if (c.done && inVisit(c.at)) ticks.push({ d: d, c: c }); }); });
    var visitNotes = notes.filter(function (n) { return SINCE ? inVisit(n.created_at) : n.status === 'open'; });
    var openSnags = (site.snags || []).filter(function (x) { return x.open != null ? x.open : !/^(done|cancelled|closed|resolved|verified)$/i.test(x.status || ''); })
      .sort(function (a, b) { return String(a.priority || 'p9').localeCompare(String(b.priority || 'p9')) || floorRank(a.floor) - floorRank(b.floor); });
    var openRfis = (site.rfis || []).filter(function (x) { return x.open != null ? x.open : !/^(closed|answered|resolved|done)$/i.test(x.status || ''); });
    var changesOpen = notes.filter(function (n) { return n.kind === 'change' && (n.status === 'open' || n.status === 'accepted'); });
    var people = {}; ticks.forEach(function (t) { var k = t.c.by || '—'; (people[k] = people[k] || { ticks: 0, notes: 0 }).ticks++; });
    visitNotes.forEach(function (n) { var k = n.created_by || '—'; (people[k] = people[k] || { ticks: 0, notes: 0 }).notes++; });
    var firstAt = null, lastAt = null; ticks.map(function (t) { return t.c.at; }).concat(visitNotes.map(function (n) { return n.created_at; })).forEach(function (a) { if (!a) return; if (!firstAt || a < firstAt) firstAt = a; if (!lastAt || a > lastAt) lastAt = a; });

    function newPage(label) { state.n++; if (state.dry) return NOOP; var pg = doc.addPage([A4.w, A4.h]), P = lx.mk(pg, doc); lx.pageHead(P, F, label, state.n, state.total, DOC_LABEL, { brand: 'large' }); return P; }
    function foot(P) { if (!state.dry) lx.pageFoot(P, F, { email: 'projects@sonor.co.uk' }); }
    var P, y;
    function start(label, eyebrow, title, note) { P = newPage(label); y = state.dry ? 156 : lx.sectionHead(P, F, eyebrow, title, note); }
    function need(h, cont) { if (y + h > FOOT) { foot(P); P = newPage(cont.page); y = 96; if (cont.label) { P.tracked(cont.label + ' (CONT.)', M, y, 8.5, F.r, C.GOLD, 2.6); y += 20; } } }
    function head(label, cont, right) { need(46, cont); y += 6; P.tracked(label, M, y, 8.5, F.r, C.GOLD, 2.6); if (right) P.right(pd(right), A4.w - M, y, 8.5, F.r, C.MUT); y += 18; }
    function rule() { P.hline(M, A4.w - M, y, C.LINE, 0.4, 0.8); }

    async function build() {
      state.n = 1;
      if (!state.dry) {
        var hero = null; try { hero = await lx.loadCoverArt(doc, BASE + 'site-cover.jpg'); } catch (e) { }
        var cp = doc.addPage([A4.w, A4.h]), CP = lx.mk(cp, doc);
        lx.cover(CP, F, { hero: hero, fadeImg: fade, layout: hero ? 'art' : undefined, eyebrow: 'SITE VISIT', title: pd(m.project.name || 'Site visit'), subtitle: pd([m.project.address, m.project.ref].filter(Boolean).join(' · ')),
          info: [['CLIENT', pd(m.project.client_name || '—')], ['DATE', fmtDate(SINCE || new Date().toISOString())], ['ON SITE', pd(Object.keys(people).filter(function (k) { return k !== '—'; }).map(who).join(', ') || m.engineer || 'Sonor')]],
          cediaImg: cedia, brandLarge: true, brandColour: hero ? lx.COL.CREAM : lx.COL.GOLD, topShade: 0.6, airy: true });
      }
      glance(); done(); notesPages(); openItems(); todo();
    }

    // ── 1 · AT A GLANCE ──
    function glance() {
      var CONT = { page: 'AT A GLANCE' };
      start('AT A GLANCE', 'Site visit · ' + fmtDate(SINCE || new Date().toISOString()), 'At a glance',
        (firstAt ? 'On site ' + fmtTime(firstAt) + '–' + fmtTime(lastAt) + '. ' : '') + 'Read live from Tasks (checks and snags), Takeoffs (devices, plan and RFIs), the Portal and the site notes.');
      var cards = [[ticks.length, 'checks ticked', GREEN], [visitNotes.length, 'site notes', C.INK], [changesOpen.length, 'changes from plan', AMBER], [openSnags.length, 'open snags', RED], [openRfis.length, 'open RFIs', C.INK2]];
      var gap = 8, cw = (W - gap * 4) / 5, ch = 62;
      cards.forEach(function (k, i) {
        var x = M + i * (cw + gap);
        P.rect(x, y, cw, ch, [255, 255, 255]); P.rrect(x, y, cw, ch, 5, C.LINE, 0.8);
        P.rect(x, y + 10, 2.4, ch - 20, k[2]);
        P.text(String(k[0]), x + 12, y + 12, 22, F.b, C.INK);
        P.text(pd(k[1]), x + 12, y + 42, 8.5, F.r, C.MUT);
      });
      y += ch + 22;
      // who was on site
      var keys = Object.keys(people).sort(function (a, b) { return (people[b].ticks + people[b].notes) - (people[a].ticks + people[a].notes); });
      head('ON SITE', CONT);
      if (!keys.length) { P.text('No checks or notes recorded in this visit.', M, y, 9.5, F.r, C.MUT); y += 18; }
      keys.forEach(function (k) { need(18, CONT); P.text(pd(k === '—' ? 'Not recorded' : who(k)), M, y, 10, F.b, C.INK); P.right(people[k].ticks + ' checks · ' + people[k].notes + ' notes', A4.w - M, y, 9.5, F.r, C.INK2); y += 14; rule(); y += 6; });
      y += 8;
      // checks by stage — the whole job, with this visit's share drawn in
      head('CHECKS BY STAGE', CONT, 'dark = this visit');
      var bx = M + 150, bw = W - 150 - 120;
      (site.stages || []).forEach(function (st) {
        var t = 0, d = 0, v = 0; devs.forEach(function (dv) { (dv.checks || []).forEach(function (c) { if (c.stage !== st.key) return; t++; if (c.done) { d++; if (inVisit(c.at)) v++; } }); });
        if (!t) return; need(20, CONT);
        P.text(pd(st.label), M, y, 9.8, F.r, C.INK);
        P.rect(bx, y + 3, bw, 6, C.LINE); P.rect(bx, y + 3, bw * (d - v) / t, 6, [168, 196, 172]); if (v) P.rect(bx + bw * (d - v) / t, y + 3, bw * v / t, 6, GREEN);
        P.right(d + ' / ' + t + '  ' + Math.round(d * 100 / t) + ' %' + (v ? '  (+' + v + ')' : ''), A4.w - M, y, 9, d === t ? F.b : F.r, d === t ? GREEN : C.INK);
        y += 14; rule(); y += 6;
      });
      foot(P);
    }

    // ── 2 · WORK DONE THIS VISIT — stage → floor → room ──
    function done() {
      if (!ticks.length) return;
      var CONT = { page: 'WORK DONE', label: 'WORK DONE THIS VISIT' };
      start('WORK DONE', 'This visit', 'Work done', ticks.length + ' checks ticked, by stage and room. Each line lists the devices and how many of their checks were done.');
      (site.stages || []).forEach(function (st) {
        var list = ticks.filter(function (t) { return t.c.stage === st.key; }); if (!list.length) return;
        head(pd(st.label.toUpperCase()), CONT, list.length + ' checks');
        var rooms = {}; list.forEach(function (t) { var k = (t.d.floor || '—') + '|' + (t.d.room_name || UNPLACED); (rooms[k] = rooms[k] || { floor: t.d.room_name ? t.d.floor : null, room: t.d.room_name || UNPLACED, devs: {} }); var dk = t.d.key; (rooms[k].devs[dk] = rooms[k].devs[dk] || { d: t.d, n: 0 }).n++; });
        Object.keys(rooms).map(function (k) { return rooms[k]; }).sort(function (a, b) { return ((a.room === UNPLACED) - (b.room === UNPLACED)) || floorRank(a.floor) - floorRank(b.floor) || String(a.room).localeCompare(String(b.room)); }).forEach(function (r) {
          var items = Object.keys(r.devs).map(function (k) { return r.devs[k]; }).sort(function (a, b) { return svcRank(a.d.nn) - svcRank(b.d.nn) || String(a.d.name).localeCompare(String(b.d.name)); });
          var byName = {}; items.forEach(function (it) { var k = it.d.name; (byName[k] = byName[k] || { name: k, nn: it.d.nn, units: 0, checks: 0 }); byName[k].units++; byName[k].checks += it.n; });
          var txt = Object.keys(byName).map(function (k) { var b = byName[k]; return (b.units > 1 ? b.units + ' x ' : '') + b.name; }).join(', ');
          var lines = lx.wrap(pd(txt), F.r, 9, W - 210).slice(0, 3), total = items.reduce(function (a, it) { return a + it.n; }, 0), h = Math.max(14, lines.length * 11.5) + 6;
          need(h + 4, CONT);
          var nns = []; items.forEach(function (it) { if (nns.indexOf(String(it.d.nn)) < 0) nns.push(String(it.d.nn)); });
          nns.slice(0, 5).forEach(function (nn, i) { var s = svc(nn); P.dot(M + 3 + i * 7, y + 5, 2.6, hex(s && s.hex)); });
          P.text(fit(F.b, (r.floor ? r.floor + ' · ' : '') + r.room, 9.5, 120), M + 42, y, 9.5, F.b, C.INK);
          lines.forEach(function (ln, i) { P.text(ln, M + 168, y + i * 11.5, 9, F.r, C.INK2); });
          P.right(String(total), A4.w - M, y, 9.5, F.b, GREEN);
          y += h; rule(); y += 5;
        });
        y += 6;
      });
      foot(P);
    }

    // ── 3 · SITE NOTES THIS VISIT — by kind ──
    function notesPages() {
      if (!visitNotes.length) return;
      var CONT = { page: 'SITE NOTES', label: 'SITE NOTES' };
      start('SITE NOTES', SINCE ? 'This visit' : 'Open', 'Site notes', 'Changes from the plan go to Takeoffs for review and are drawn on the as-built; questions become RFIs; snags go to Tasks.');
      var ST = { open: 'Open', accepted: 'Accepted — to draw', applied: 'Drawn on the as-built', promoted: 'Sent on', dismissed: 'Dismissed', resolved: 'Resolved' };
      [['change', 'CHANGES FROM PLAN'], ['question', 'QUESTIONS'], ['snag', 'SNAGS FOUND'], ['note', 'NOTES'], ['photo', 'PHOTOS']].forEach(function (g) {
        var list = visitNotes.filter(function (n) { return n.kind === g[0]; }).sort(function (a, b) { return floorRank(a.floor_code) - floorRank(b.floor_code) || String(a.created_at).localeCompare(String(b.created_at)); });
        if (!list.length) return;
        head(g[1], CONT, list.length + '');
        list.forEach(function (n) {
          var where = [n.floor_code, n.room, n.device_label].filter(Boolean).join(' · ') || 'General';
          var st = (n.status === 'promoted' && n.linked && n.linked.rfi_id) ? n.linked.rfi_id + ' raised' : (n.status === 'promoted' ? 'Snag in Tasks' : (ST[n.status] || n.status));
          var lines = lx.wrap(pd(n.text || ''), F.r, 9.6, W - 130).slice(0, 4), rv = n.review && n.review.note ? lx.wrap(pd('-> ' + n.review.note + (n.review.by ? ' (' + who(n.review.by) + ')' : '')), F.r, 8.5, W - 130).slice(0, 2) : [];
          var h = 13 + lines.length * 12 + rv.length * 11 + 13; need(h + 6, CONT);
          var s = svc(n.service_nn); if (s) P.dot(M + 3, y + 5, 2.6, hex(s.hex));
          P.text(fit(F.b, where + (n.change_type ? '  ·  ' + (CHG[n.change_type] || n.change_type) : ''), 9, W - 140), M + 12, y, 9, F.b, C.INK);
          var stc = /Open/.test(st) ? AMBER : /Dismiss/.test(st) ? C.MUT : GREEN;
          P.right(pd(st), A4.w - M, y, 8.5, F.b, stc); y += 13;
          lines.forEach(function (ln) { P.text(ln, M + 12, y, 9.6, F.r, C.INK); y += 12; });
          rv.forEach(function (ln) { P.text(ln, M + 12, y, 8.5, F.r, C.INK2); y += 11; });
          P.text(pd(who(n.created_by) + ' · ' + fmtTime(n.created_at) + (n.x != null || n.to_x != null ? ' · pinned on the plan' : '')), M + 12, y, 8, F.r, C.MUT); y += 12;
          rule(); y += 7;
        });
        y += 4;
      });
      foot(P);
    }

    // ── 4 · OPEN SNAGS + RFIs ──
    function openItems() {
      var CONT = { page: 'OPEN ITEMS', label: 'OPEN SNAGS' };
      start('OPEN ITEMS', 'Still open', 'Snags and RFIs', openSnags.length + ' open snag' + (openSnags.length === 1 ? '' : 's') + ' (Tasks and the client Portal) and ' + openRfis.length + ' open RFI' + (openRfis.length === 1 ? '' : 's') + ' (Takeoffs Plan Notes).');
      head('OPEN SNAGS', CONT, openSnags.length + '');
      if (!openSnags.length) { P.text('None open.', M, y, 9.5, F.r, C.MUT); y += 18; }
      var cx = [M, M + 52, A4.w - M - 190, A4.w - M - 110];
      if (openSnags.length) { P.text('PRIORITY', cx[0], y, 7.5, F.b, C.LABEL); P.text('SNAG', cx[1], y, 7.5, F.b, C.LABEL); P.text('WHO', cx[2], y, 7.5, F.b, C.LABEL); P.right('STATUS', A4.w - M, y, 7.5, F.b, C.LABEL); y += 12; rule(); y += 6; }
      openSnags.forEach(function (x) {
        var lines = lx.wrap(pd(x.title || ''), F.r, 9.5, cx[2] - cx[1] - 12).slice(0, 2), h = lines.length * 12 + 12; need(h + 6, CONT);
        var pc = x.priority === 'p1' ? RED : x.priority === 'p2' ? AMBER : C.MUT;
        P.text(pd(PRI[x.priority] || x.priority || '—'), cx[0], y, 8.5, F.b, pc);
        var s = svc(x.service_nn); if (s) P.dot(cx[1] - 7, y + 5, 2.6, hex(s.hex));
        lines.forEach(function (ln, i) { P.text(ln, cx[1], y + i * 12, 9.5, F.r, C.INK); });
        P.text(pd([x.floor, x.source === 'portal' ? 'Portal' : 'Tasks'].filter(Boolean).join(' · ')), cx[1], y + lines.length * 12, 8, F.r, C.MUT);
        P.text(fit(F.r, x.assignee ? who(x.assignee) : 'Unassigned', 9, cx[3] - cx[2] - 6), cx[2], y, 9, F.r, C.INK2);
        P.right(pd(STATUS[x.status] || String(x.status || '').replace(/_/g, ' ')), A4.w - M, y, 8.5, F.r, C.INK2);
        y += h; rule(); y += 6;
      });
      y += 8; CONT.label = 'OPEN RFIs';
      head('OPEN RFIs', CONT, openRfis.length + '');
      if (!openRfis.length) { P.text('None open.', M, y, 9.5, F.r, C.MUT); y += 18; }
      openRfis.forEach(function (r) {
        var lines = lx.wrap(pd(r.text || ''), F.r, 9.5, W - 150).slice(0, 3), h = lines.length * 12 + 12; need(h + 6, CONT);
        P.text(pd(r.rfi_id || 'RFI'), M, y, 9, F.b, C.INK);
        lines.forEach(function (ln, i) { P.text(ln, M + 52, y + i * 12, 9.5, F.r, C.INK); });
        P.text(pd([r.floor, r.to ? 'to ' + r.to : null, r.created_at ? fmtDate(r.created_at) : null].filter(Boolean).join(' · ')), M + 52, y + lines.length * 12, 8, F.r, C.MUT);
        P.right(pd(STATUS[r.status] || r.status || 'Open'), A4.w - M, y, 8.5, F.r, AMBER);
        y += h; rule(); y += 6;
      });
      foot(P);
    }

    // ── 5 · STILL TO DO — per stage, the rooms with the most left ──
    function todo() {
      var CONT = { page: 'STILL TO DO', label: 'STILL TO DO' }, any = false;
      start('STILL TO DO', 'Next visit', 'Still to do', 'Checks not yet ticked, by stage, with the rooms that have the most left.');
      (site.stages || []).forEach(function (st) {
        var left = []; devs.forEach(function (d) { (d.checks || []).forEach(function (c) { if (c.stage === st.key && !c.done) left.push(d); }); });
        if (!left.length) return; any = true;
        var rooms = {}; left.forEach(function (d) { var k = d.room_name ? (d.floor ? d.floor + ' · ' : '') + d.room_name : UNPLACED; rooms[k] = (rooms[k] || 0) + 1; });
        var top = Object.keys(rooms).sort(function (a, b) { return ((a === UNPLACED) - (b === UNPLACED)) || rooms[b] - rooms[a]; }), txt = top.slice(0, 6).map(function (k) { return k + ' (' + rooms[k] + ')'; }).join(', ') + (top.length > 6 ? ' and ' + (top.length - 6) + ' more rooms' : '');
        var lines = lx.wrap(pd(txt), F.r, 9, W - 200).slice(0, 3); need(lines.length * 11.5 + 14, CONT);
        P.text(pd(st.label), M, y, 9.8, F.b, C.INK); P.right(left.length + ' left', A4.w - M, y, 9, F.b, C.INK2);
        lines.forEach(function (ln, i) { P.text(ln, M + 130, y + i * 11.5, 9, F.r, C.INK2); });
        y += Math.max(14, lines.length * 11.5) + 4; rule(); y += 6;
      });
      if (!any) P.text('Every check on this project is ticked.', M, y, 10, F.r, GREEN);
      foot(P);
    }

    await build(); state.total = state.n; state.dry = false; await build();
    return doc.save();
  }
  return { report: report, VERSION: VERSION };
})();
