/* Sonor Site — SITE VISIT REPORT PDF (app-local, v0.2.0, 2026-11-10 — minimal footer + rear contact page (§43/§49), cover shows the STAGE
 *   (Site shows the build, §65 — client details stay in Survey / PM), RFIs with no text never print 'null'; v0.1.0 2026-11-07)
 * Cover (house cover art, Service Contracts format) + Site visit pages: checks by stage · the notes recorded on this visit
 * (since `since`, else every open note) · open snags + RFIs. Every figure comes from the live SonorSite model — nothing re-counted.
 * Shared chrome: sonor-pdf-luxury.js on pdf-lib (neutral working-document theme, no cream).
 * API: await SitePdf.report({ project, site, engineer?, stage?, since? }) → Uint8Array
 */
window.SitePdf = (function () {
  'use strict';
  function selfDir() { try { var s = document.currentScript; if (s && s.src) return s.src.replace(/[^/]*$/, ''); } catch (e) { } return '../data/'; }
  var BASE = selfDir(), DOC_LABEL = 'SITE VISIT';
  function L() { var lx = window.SonorPdfLuxury; if (!lx || !window.PDFLib) throw new Error('pdf-lib / SonorPdfLuxury not loaded'); return lx; }
  var GLYPH = { '↔': '<->', '→': '->', '←': '<-', '✓': 'yes', '✔': 'yes', '✕': 'no', '✗': 'no', '☐': '[ ]', '☑': '[x]', '²': '2', '³': '3' };
  function pd(str) { return String(str == null ? '' : str).replace(/[↔→←✓✔✕✗☐☑]/g, function (c) { return GLYPH[c] || '?'; }).replace(/[^\x00-\xFF€‘’“”–—…•™]/g, '?'); }
  function fit(font, str, size, w) { str = pd(str); if (font.widthOfTextAtSize(str, size) <= w) return str; while (str.length > 1 && font.widthOfTextAtSize(str + '…', size) > w) str = str.slice(0, -1); return str + '…'; }
  function fmtDate(iso) { try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }); } catch (e) { return ''; } }
  var NOOP = {}; ['text', 'tracked', 'right', 'rect', 'rectB', 'hline', 'vline', 'logo', 'image', 'dot', 'path'].forEach(function (k) { NOOP[k] = function () { }; });

  async function report(m) {
    var lx = L(), PL = window.PDFLib, A4 = lx.A4, M = lx.M, C = lx.COL, W = A4.w - M * 2;
    if (lx.theme) lx.theme('neutral');
    var doc = await PL.PDFDocument.create(); doc.setTitle('Site visit — ' + (m.project.name || '')); doc.setAuthor('Sonor Smart Homes');
    var F = await lx.makeFonts(doc, BASE), cedia = null, fade = null;
    try { cedia = await lx.loadImage(doc, BASE + 'cedia-member-stacked.png'); } catch (e) { }
    try { var fp = lx.fadePngDataUrl(); if (fp) fade = await doc.embedPng(fp); } catch (e) { }
    var state = { dry: true, n: 0, total: 0 }, FOOT = A4.h - 70;
    function newPage(label) { state.n++; if (state.dry) return NOOP; var pg = doc.addPage([A4.w, A4.h]), P = lx.mk(pg, doc); lx.pageHead(P, F, label, state.n, state.total, DOC_LABEL, { brand: 'large' }); return P; }
    // v0.2.0 — §43 / §49 footer: '<project> · Page N' only; the contact block is the rear page, once
    if (lx.footerMode) lx.footerMode('minimal', pd(m.project.ref || m.project.name || 'Sonor'));
    function foot(P) { if (!state.dry) lx.pageFoot(P, F, lx.footerMode ? { pageNo: state.n } : { email: 'projects@sonor.co.uk' }); }
    var stageLabel = m.stage ? (((m.site && m.site.stages) || []).find(function (x) { return x.key === m.stage; }) || {}).label || m.stage : 'All stages';
    async function build() {
      state.n = 1;
      if (!state.dry) {
        var hero = null; try { hero = await lx.loadCoverArt(doc, BASE + 'site-cover.jpg'); } catch (e) { }
        var cp = doc.addPage([A4.w, A4.h]), CP = lx.mk(cp, doc);
        lx.cover(CP, F, { hero: hero, fadeImg: fade, layout: hero ? 'art' : undefined, eyebrow: 'SITE VISIT', title: pd(m.project.name || 'Site visit'), subtitle: pd([m.project.address, m.project.ref].filter(Boolean).join(' · ')),
          info: [['STAGE', pd(stageLabel)], ['DATE', fmtDate(new Date().toISOString())], ['ENGINEER', pd(m.engineer || 'Sonor')]], cediaImg: cedia, brandLarge: true, brandColour: hero ? lx.COL.CREAM : lx.COL.GOLD, topShade: 0.6, airy: true });
      }
      await sitePages(m.site);
      // ── rear page (v0.2.0, §43 / §49) — the full contact block, once; counted so every head shows the true total ──
      if (lx.rearPage) {
        state.n++;
        if (!state.dry) {
          var co = ((window.__SONOR_BRAND__ || window.SonorBrand || {}).company) || {};
          lx.rearPage(lx.mk(doc.addPage([A4.w, A4.h]), doc), F, { email_new: co.email || 'projects@sonor.co.uk', email_service: co.emailSupport || 'service@sonor.co.uk', phone: co.phone, web: String(co.url || 'sonor.co.uk').replace(/^https?:\/\//, ''), cediaImg: cedia });
        }
      }
    }
    // ── SITE VISIT pages (moved from Survey v0.13.0's report, B-804): checks per stage · this visit's site notes · open snags + RFIs — every figure is the
    // live SonorSite model (Tasks checks, site_notes, plan_notes), nothing re-counted here ──
    async function sitePages(site) {
      var SINCE = m.since || null, KL = {}; ((window.SonorSite && window.SonorSite.KINDS) || []).forEach(function (k) { KL[k[0]] = k[1]; });
      var who = function (v) { try { return (window.SonorWho && window.SonorWho.label(v)) || String(v || '').split('@')[0]; } catch (e) { return String(v || '').split('@')[0]; } };
      var P = newPage('SITE VISIT'), y = state.dry ? 156 : lx.sectionHead(P, F, 'Site visit', pd(m.project.name || 'Project'), 'Progress and notes recorded on site, read live from Tasks, Takeoffs and the site notes.');
      function need(h, label) { if (y + h > FOOT) { foot(P); P = newPage('SITE VISIT'); y = 96; if (label) { P.tracked(label + ' (CONT.)', M, y, 8.5, F.r, C.GOLD, 2.6); y += 18; } } }
      // checks by stage
      P.tracked('CHECKS BY STAGE', M, y, 8.5, F.r, C.GOLD, 2.6); y += 18;
      (site.stages || []).forEach(function (st) {
        var t = 0, d = 0; (site.devices || []).forEach(function (dv) { (dv.checks || []).forEach(function (c) { if (c.stage === st.key) { t++; if (c.done) d++; } }); });
        if (!t) return; need(18);
        P.text(pd(st.label), M, y, 9.8, F.r, C.INK); P.right(d + ' / ' + t + '  (' + Math.round(d * 100 / t) + ' %)', A4.w - M, y, 9.5, F.b, d === t ? C.GOLD : C.INK);
        var bx = M + 170, bw = W - 170 - 110; P.rect(bx, y + 3, bw, 5, C.LINE); P.rect(bx, y + 3, bw * d / t, 5, C.GOLD);
        P.hline(M, A4.w - M, y + 14, C.LINE, 0.4, 0.7); y += 18;
      });
      y += 10;
      // notes from this visit (or every open note when the report is not a site visit)
      var notes = (site.notes || []).filter(function (n) { return SINCE ? String(n.created_at || '') >= SINCE : n.status === 'open'; });
      need(40); P.tracked(SINCE ? 'SITE NOTES — THIS VISIT' : 'OPEN SITE NOTES', M, y, 8.5, F.r, C.GOLD, 2.6); y += 18;
      if (!notes.length) { P.text('None.', M, y, 9.5, F.r, C.MUT); y += 16; }
      notes.forEach(function (n) {
        var head = (KL[n.kind] || n.kind) + (n.change_type ? ' · ' + n.change_type : '') + (n.status !== 'open' ? ' · ' + n.status + (n.linked && n.linked.rfi_id ? ' ' + n.linked.rfi_id : '') : '');
        var lines = lx.wrap(pd(n.text || ''), F.r, 9.8, W - 20).slice(0, 4), meta = pd([n.floor_code, n.room, n.device_label].filter(Boolean).join(' · ') + ' · ' + who(n.created_by) + ' · ' + String(n.created_at || '').slice(0, 10));
        var h = 13 + lines.length * 12 + 12; need(h + 6, SINCE ? 'SITE NOTES — THIS VISIT' : 'OPEN SITE NOTES');
        P.text(fit(F.b, head.toUpperCase(), 8, W), M, y, 8, F.b, C.INK2); y += 13;
        lines.forEach(function (ln) { P.text(ln, M, y, 9.8, F.r, C.INK); y += 12; });
        P.text(fit(F.r, meta, 8, W), M, y, 8, F.r, C.MUT); y += 12; P.hline(M, A4.w - M, y, C.LINE, 0.4, 0.7); y += 8;
      });
      y += 6;
      var sn = (site.snags || []).filter(function (x) { return !/done|cancelled/.test(x.status || ''); }), rf = (site.rfis || []).filter(function (x) { return !/closed|answered/.test(x.status || ''); });
      need(40); P.tracked('OPEN SNAGS (' + sn.length + ') · OPEN RFIs (' + rf.length + ')', M, y, 8.5, F.r, C.GOLD, 2.6); y += 18;
      sn.concat(rf.map(function (r) { return { title: (r.rfi_id ? r.rfi_id + ' · ' : '') + (r.text || '') + (r.to ? ' (to ' + r.to + ')' : ''), status: 'RFI' }; })).forEach(function (x) {
        var lines = lx.wrap(pd(x.title || ''), F.r, 9.5, W - 80).slice(0, 2); need(lines.length * 12 + 8, 'OPEN SNAGS · RFIs');
        lines.forEach(function (ln, i) { P.text(ln, M, y + i * 12, 9.5, F.r, C.INK); }); P.right(pd(x.status || ''), A4.w - M, y, 8.5, F.b, C.MUT);
        y += lines.length * 12 + 4; P.hline(M, A4.w - M, y, C.LINE, 0.4, 0.7); y += 6;
      });
      foot(P);
    }
    await build(); state.total = state.n; state.dry = false; await build();
    return doc.save();
  }
  return { report: report, VERSION: '0.2.0' };
})();
