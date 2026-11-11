/*!
 * sonor-wifi-card.js — ROOT MASTER (v1.0.0, 2026-11-11) · SonorWifiCard
 * ---------------------------------------------------------------------------------------------------------------------
 * ONE Wi-Fi handover card for every Sonor surface (Bryn 2026-11-11: "very quick handover sheet for wifi passwords for
 * customers based on net map" · "a very slick version when they need the passwords immediately" · "give full pdf plus
 * pngs for every ssid" · "tie this in with network map and other associated apps so quick export is possible from
 * relevant places"). First job: The Old Rectory.
 *
 * Network Map owns the networks (network_configs.config.ssids + sonorSsid). This module only DRAWS + SHARES them:
 *   • one phone image per network (1080 wide — sent on WhatsApp as a PHOTO)
 *   • the combined client image (every client network, never Sonor Tech)
 *   • A4 sheet as PNG + PDF (PDF only when pdf-lib is on the page)
 *   • the WhatsApp message with each password in a ``` block (long-press → copy → paste in Wi-Fi settings —
 *     a QR code in a chat photo can't be tapped on the same phone, so the copyable text is the fast path)
 * Sonor Tech (sonorSsid) is internal: it is drawn only when the caller ticks "Include Sonor Tech" and never on the
 * combined client image or in the client portal.
 *
 *   SonorWifiCard.fromNetworkConfig(cfg)        → networks[]  ({ role, title, slug, ssid, password, guest, internal, hidden })
 *   SonorWifiCard.fromPortal(list)              → networks[]  (client portal sonor_client_portal().wifi rows)
 *   SonorWifiCard.load(supa, projectId)         → Promise<{ site, networks }>  (network_configs + projects.name)
 *   SonorWifiCard.renderPhone(card, nets, opt)  → Promise<Blob PNG>
 *   SonorWifiCard.renderA4(card, nets)          → Promise<Blob PNG>
 *   SonorWifiCard.a4Pdf(card, nets)             → Promise<Blob PDF | null>
 *   SonorWifiCard.whatsappText(card, nets)      → string
 *   SonorWifiCard.files(card, { internal })     → Promise<[{ name, blob, label }]>
 *   SonorWifiCard.open(card, opts)              → the shared export panel (previews · Share · Copy message · Download)
 *   SonorWifiCard.button(host, opts)            → adds the "Wi-Fi card" button; click loads the active project + opens
 * card = { site: 'The Old Rectory', networks: [...], tip?: 'footer tip', client?: true (portal: no internal toggle) }
 *
 * Needs: qrcode-generator (global `qrcode`) — loaded on demand from cdnjs when missing. Fonts + gold wordmark are read
 * from this file's own folder (data/fonts/gilroy-*.otf, data/sonor-wordmark-gold.png), synced by sync-everything.sh.
 * Offline reference renderer (same layout): APP - Network Map/tools/wifi-card.py.
 * Synced to app data/ by sync-everything.sh — edit HERE only.
 */
(function (global) {
  'use strict';
  var VERSION = '1.0.0';
  var BASE = (function () {
    try { var s = document.currentScript && document.currentScript.src; if (s) return s.replace(/[^/]*$/, ''); } catch (e) { /* */ }
    return 'data/';
  })();
  var QR_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
  var C = { page: '#FAF9F7', ink: '#1E1C1A', muted: '#7D766E', gold: '#AD9978', line: '#E2DED8', white: '#FFFFFF' };
  var FONT = 'SonorWifiGilroy', FALLBACK = ', "DM Sans", "Helvetica Neue", Arial, sans-serif';
  var DEFAULT_TIP = 'Scan with your camera, or copy the password from our message';

  function brand() { var b = global.__SONOR_BRAND__ || {}; return b.company || {}; }
  function phone() { var c = brand(); return c.phoneSupport || c.phone || '07933 684 000'; }
  function email() { var c = brand(); return c.emailSupport || 'service@sonor.co.uk'; }
  function slugify(s) { return String(s || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'network'; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ── data ────────────────────────────────────────────────────────────────────────────────────────────────────────
  function isGuest(s) { return !!(s && (s.guest || /guest/i.test(String(s.id || '')) || /guest/i.test(String(s.label || s.name || '')))); }
  function shape(list) {
    var main = 0, other = 0;
    return list.map(function (n) {
      if (n.internal) return Object.assign(n, { role: 'Sonor Tech', title: 'Sonor Tech Wi-Fi', slug: 'sonor-tech' });
      if (n.guest) return Object.assign(n, { role: 'Guest', title: 'Guest Wi-Fi', slug: other++ ? 'guest-' + other : 'guest' });
      main++;
      return Object.assign(n, main === 1 ? { role: 'Main', title: 'Your Wi-Fi', slug: 'main' } : { role: 'Network ' + main, title: n.ssid, slug: slugify(n.ssid) });
    });
  }
  function fromNetworkConfig(cfg) {
    cfg = cfg || {};
    var list = (cfg.ssids || []).filter(function (s) { return s && s.label && !/^(MAIN|GUEST)$/.test(s.label) || (s && s.label && s.password); })
      .map(function (s) { return { ssid: String(s.label), password: String(s.password || ''), guest: isGuest(s), internal: false, hidden: !!s.hidden }; });
    list.sort(function (a, b) { return (a.guest ? 1 : 0) - (b.guest ? 1 : 0); });
    var st = cfg.sonorSsid;
    if (st && st.label && st.password) list.push({ ssid: String(st.label), password: String(st.password), guest: false, internal: true, hidden: !!st.hidden });
    return shape(list);
  }
  function fromPortal(list) {
    return shape((list || []).filter(function (w) { return w && w.name; }).map(function (w) {
      return { ssid: String(w.name), password: String(w.password || ''), guest: !!w.guest, internal: false, hidden: !!w.hidden };
    }).sort(function (a, b) { return (a.guest ? 1 : 0) - (b.guest ? 1 : 0); }));
  }
  function load(supa, pid) {
    if (!supa || !pid) return Promise.reject(new Error('Pick a project first'));
    return Promise.all([
      supa.from('network_configs').select('config').eq('project_id', pid).maybeSingle(),
      supa.from('projects').select('name').eq('id', pid).maybeSingle()
    ]).then(function (r) {
      if (r[0].error) throw r[0].error;
      var cfg = (r[0].data && r[0].data.config) || null;
      var site = (r[1].data && r[1].data.name) || (cfg && cfg.name) || '';
      return { site: site, networks: cfg ? fromNetworkConfig(cfg) : [], projectId: pid };
    });
  }

  // ── QR ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  var qrReady = null;
  function needQr() {
    if (typeof global.qrcode === 'function') return Promise.resolve();
    if (qrReady) return qrReady;
    qrReady = new Promise(function (ok, no) {
      var s = document.createElement('script'); s.src = QR_CDN; s.onload = function () { ok(); }; s.onerror = function () { qrReady = null; no(new Error('QR library did not load')); };
      document.head.appendChild(s);
    });
    return qrReady;
  }
  function payload(n) {
    var e = function (v) { return String(v || '').replace(/([\\;,:"])/g, '\\$1'); };
    return 'WIFI:T:' + (n.password ? 'WPA' : 'nopass') + ';S:' + e(n.ssid) + ';' + (n.password ? 'P:' + e(n.password) + ';' : '') + (n.hidden ? 'H:true;' : '') + ';';
  }
  function matrix(text) {
    var q = global.qrcode(0, 'M');
    try { if (global.qrcode.stringToBytesFuncs && global.qrcode.stringToBytesFuncs['UTF-8']) global.qrcode.stringToBytes = global.qrcode.stringToBytesFuncs['UTF-8']; } catch (e) { /* */ }
    q.addData(text, 'Byte'); q.make();
    var n = q.getModuleCount(), rows = [];
    for (var r = 0; r < n; r++) { var row = []; for (var c = 0; c < n; c++) row.push(q.isDark(r, c)); rows.push(row); }
    return rows;
  }

  // ── assets ──────────────────────────────────────────────────────────────────────────────────────────────────────
  var assetsReady = null;
  function needAssets() {
    if (assetsReady) return assetsReady;
    var fonts = [['gilroy-regular.otf', '400'], ['gilroy-extrabold.otf', '800']].map(function (f) {
      try {
        var ff = new FontFace(FONT, 'url(' + BASE + 'fonts/' + f[0] + ')', { weight: f[1] });
        return ff.load().then(function (x) { document.fonts.add(x); }).catch(function () { /* DM Sans fallback */ });
      } catch (e) { return Promise.resolve(); }
    });
    var logo = new Promise(function (ok) {
      var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = BASE + 'sonor-wordmark-gold.png';
    });
    assetsReady = Promise.all([Promise.all(fonts), logo, needQr()]).then(function (r) { return { logo: r[1] }; });
    return assetsReady;
  }

  // ── drawing ─────────────────────────────────────────────────────────────────────────────────────────────────────
  function f(w, px) { return (w >= 700 ? '800 ' : '400 ') + px + 'px "' + FONT + '"' + FALLBACK; }
  function fit(ctx, text, w, px, maxw) { ctx.font = f(w, px); while (px > 20 && ctx.measureText(text).width > maxw) { px -= 2; ctx.font = f(w, px); } return ctx.font; }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function text(ctx, s, x, y, font, colour, align) { ctx.font = font; ctx.fillStyle = colour; ctx.textAlign = align || 'left'; ctx.textBaseline = 'top'; ctx.fillText(s, x, y); }
  function drawQr(ctx, m, x, y, size) {
    var n = m.length, px = Math.max(1, Math.floor(size / n)), off = Math.floor((size - px * n) / 2);   // whole-pixel modules scan reliably
    ctx.fillStyle = C.white; ctx.fillRect(x, y, size, size); ctx.fillStyle = C.ink;
    x = Math.round(x) + off; y = Math.round(y) + off;
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (m[r][c]) ctx.fillRect(x + c * px, y + r * px, px, px);
  }
  function drawCard(ctx, x, y, w, h, n, qr) {
    rr(ctx, x, y, w, h, 28); ctx.fillStyle = C.white; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
    rr(ctx, x, y + 40, 8, h - 80, 4); ctx.fillStyle = C.gold; ctx.fill();
    var pad = 56, tx = x + pad, qx = x + w - pad - qr, tw = qx - tx - 40;
    text(ctx, n.role.toUpperCase(), tx, y + 52, f(800, 30), C.gold);
    text(ctx, 'Network', tx, y + 112, f(400, 28), C.muted);
    text(ctx, n.ssid, tx, y + 148, fit(ctx, n.ssid, 800, 58, tw), C.ink);
    text(ctx, 'Password', tx, y + 240, f(400, 28), C.muted);
    text(ctx, n.password || 'No password', tx, y + 276, fit(ctx, n.password || 'No password', 800, 58, tw), n.password ? C.ink : C.muted);
    var qy = y + (h - qr) / 2 - 18;
    drawQr(ctx, matrix(payload(n)), qx, qy, qr);
    text(ctx, 'Scan to join', qx + qr / 2, qy + qr + 14, f(400, 24), C.muted, 'center');
  }
  function drawLogo(ctx, logo, cx, y, w) {
    if (logo) { var h = logo.height * w / logo.width; ctx.drawImage(logo, cx - w / 2, y, w, h); }
    else text(ctx, 'SONOR', cx, y, f(800, Math.round(w / 4)), C.gold, 'center');
  }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; var x = c.getContext('2d'); x.fillStyle = C.page; x.fillRect(0, 0, w, h); return [c, x]; }
  function blob(c) { return new Promise(function (ok) { c.toBlob(function (b) { ok(b); }, 'image/png'); }); }

  function renderPhone(card, nets, opt) {
    opt = opt || {};
    return needAssets().then(function (a) {
      var W = 1080, M = 64, ch = 420, gap = 36, top = 470, H = top + nets.length * (ch + gap) + 300;
      var k = canvas(W, H), cv = k[0], ctx = k[1];
      drawLogo(ctx, a.logo, W / 2, 110, 300);
      text(ctx, opt.title || 'Your Wi-Fi', W / 2, 255, fit(ctx, opt.title || 'Your Wi-Fi', 800, 84, W - 2 * M), C.ink, 'center');
      if (card.site) text(ctx, card.site, W / 2, 362, fit(ctx, card.site, 400, 38, W - 2 * M), C.muted, 'center');
      var y = top;
      nets.forEach(function (n) { drawCard(ctx, M, y, W - 2 * M, ch, n, 300); y += ch + gap; });
      y += 30;
      ctx.fillStyle = C.gold; ctx.fillRect(W / 2 - 60, y - 1.5, 120, 3);
      text(ctx, card.tip || DEFAULT_TIP, W / 2, y + 40, fit(ctx, card.tip || DEFAULT_TIP, 400, 30, W - 2 * M), C.muted, 'center');
      text(ctx, 'Need a hand?  ' + phone(), W / 2, y + 110, f(800, 36), C.ink, 'center');
      text(ctx, email(), W / 2, y + 162, f(400, 30), C.muted, 'center');
      return blob(cv);
    });
  }
  function drawA4(card, nets, a) {
    var W = 2480, H = 3508, M = 200, k = canvas(W, H), cv = k[0], ctx = k[1];
    drawLogo(ctx, a.logo, W / 2, 260, 560);
    text(ctx, 'Your Wi-Fi', W / 2, 520, f(800, 170), C.ink, 'center');
    if (card.site) text(ctx, card.site, W / 2, 730, fit(ctx, card.site, 400, 70, W - 2 * M), C.muted, 'center');
    var top = 960, fy = H - 330, gap = 70, avail = fy - 80 - top;
    var ch = Math.min(640, (avail - gap * Math.max(0, nets.length - 1)) / Math.max(1, nets.length)), s = ch / 400, y = top;
    nets.forEach(function (n) {
      ctx.save(); ctx.translate(M, y); ctx.scale(s, s); drawCard(ctx, 0, 0, (W - 2 * M) / s, 400, n, 300); ctx.restore();
      y += ch + gap;
    });
    ctx.fillStyle = C.gold; ctx.fillRect(W / 2 - 110, fy - 2.5, 220, 5);
    text(ctx, 'Need a hand?  ' + phone() + '  ·  ' + email(), W / 2, fy + 70, f(800, 58), C.ink, 'center');
    text(ctx, 'Keep this sheet somewhere private. Share the guest network with visitors.', W / 2, fy + 160, f(400, 46), C.muted, 'center');
    return cv;
  }
  function renderA4(card, nets) { return needAssets().then(function (a) { return blob(drawA4(card, nets, a)); }); }
  var PDF_CDN = 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js', pdfReady = null;
  function needPdf() {   // same pdf-lib build the apps load; lazy so the client portal / Network Map don't carry it up front
    if (global.PDFLib) return Promise.resolve(true);
    if (pdfReady) return pdfReady;
    pdfReady = new Promise(function (ok) { var s = document.createElement('script'); s.src = PDF_CDN; s.onload = function () { ok(!!global.PDFLib); }; s.onerror = function () { pdfReady = null; ok(false); }; document.head.appendChild(s); });
    return pdfReady;
  }
  function a4Pdf(card, nets) {
    return needPdf().then(function (ok) { return ok ? pdfOf(card, nets) : null; });
  }
  function pdfOf(card, nets) {
    return renderA4(card, nets).then(function (png) { return png.arrayBuffer(); }).then(function (buf) {
      return global.PDFLib.PDFDocument.create().then(function (doc) {
        return doc.embedPng(buf).then(function (img) {
          var p = doc.addPage([595.28, 841.89]); p.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
          doc.setTitle('Wi-Fi — ' + (card.site || '')); doc.setAuthor('Sonor'); doc.setCreator('SonorWifiCard ' + VERSION);
          return doc.save();
        });
      });
    }).then(function (bytes) { return new Blob([bytes], { type: 'application/pdf' }); });
  }

  function whatsappText(card, nets) {
    nets = nets.filter(function (n) { return !n.internal; });
    var out = ['Hi, here are your Wi-Fi details' + (card.site ? ' for ' + card.site : '') + ':', ''];
    nets.forEach(function (n) {
      out.push('*' + n.ssid + '*' + (n.guest ? ' (for visitors)' : ''));
      out.push(n.password ? '```' + n.password + '```' : 'No password');
      out.push('');
    });
    out.push('Open Wi-Fi settings, pick the network, then long-press and paste the password. Any problems, call us on ' + phone() + '.');
    return out.join('\n');
  }

  function files(card, opt) {
    opt = opt || {};
    var all = card.networks || [], client = all.filter(function (n) { return !n.internal; });
    var per = all.filter(function (n) { return !n.internal || opt.internal; });
    var sheet = opt.internal ? per : client;
    var base = slugify(card.site || 'wifi') + '-wifi';
    var jobs = [];
    if (client.length) jobs.push(renderPhone(card, client).then(function (b) { return { name: base + '.png', blob: b, label: client.length > 1 ? 'All networks' : client[0].ssid, primary: true }; }));
    if (per.length > 1 || (per.length === 1 && per[0].internal)) per.forEach(function (n) {
      jobs.push(renderPhone(card, [n], { title: n.title }).then(function (b) { return { name: base + '-' + n.slug + '.png', blob: b, label: n.ssid }; }));
    });
    if (sheet.length) {
      jobs.push(renderA4(card, sheet).then(function (b) { return { name: base + '-a4.png', blob: b, label: 'A4 sheet (image)' }; }));
      jobs.push(a4Pdf(card, sheet).then(function (b) { return b ? { name: base + '.pdf', blob: b, label: 'A4 sheet (PDF)' } : null; }));
    }
    return Promise.all(jobs).then(function (r) { return r.filter(Boolean); });
  }

  // ── panel ───────────────────────────────────────────────────────────────────────────────────────────────────────
  var CSS = '.swc-back{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;font:14px/1.4 "DM Sans",system-ui,sans-serif}' +
    '.swc{background:#1C1C1E;color:#F2F2F3;border:1px solid #3A3A3C;border-radius:14px;width:min(860px,100%);max-height:92vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.5)}' +
    '.swc-h{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid #3A3A3C}.swc-h b{font-size:15px}.swc-h small{color:#9A9AA0}.swc-x{margin-left:auto;background:none;border:0;color:#9A9AA0;font-size:20px;cursor:pointer}' +
    '.swc-b{padding:16px 18px;overflow:auto}.swc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}' +
    '.swc-f{background:#2C2C2E;border:1px solid #3A3A3C;border-radius:10px;padding:8px;display:flex;flex-direction:column;gap:6px}.swc-f img{width:100%;height:190px;object-fit:contain;background:#FAF9F7;border-radius:6px}' +
    '.swc-f span{font-size:12px;color:#C7C7CC;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.swc-f.pri{border-color:#AD9978}' +
    '.swc-row{display:flex;gap:8px;flex-wrap:wrap}.swc button.b{font:inherit;font-size:13px;padding:7px 12px;border-radius:8px;border:1px solid #48484A;background:#2C2C2E;color:#F2F2F3;cursor:pointer}' +
    '.swc button.b:hover{border-color:#AD9978}.swc button.g{background:#AD9978;border-color:#AD9978;color:#1C1C1E;font-weight:600}.swc button.s{padding:4px 8px;font-size:12px}' +
    '.swc-ft{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 18px;border-top:1px solid #3A3A3C}.swc-ft label{display:flex;align-items:center;gap:6px;color:#C7C7CC;font-size:13px;margin-right:auto}' +
    '.swc-msg{margin-top:12px;background:#2C2C2E;border:1px solid #3A3A3C;border-radius:10px;padding:10px 12px;white-space:pre-wrap;font:12px/1.5 "DM Mono",ui-monospace,monospace;color:#C7C7CC}' +
    '.swc-note{color:#9A9AA0;font-size:12px;margin:10px 0 0}.swc-empty{color:#C7C7CC;padding:24px 4px}';
  function css() { if (document.getElementById('swc-css')) return; var s = document.createElement('style'); s.id = 'swc-css'; s.textContent = CSS; document.head.appendChild(s); }
  function download(file) {
    var u = URL.createObjectURL(file.blob), a = document.createElement('a'); a.href = u; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }
  function share(list, msg) {
    var fl = list.map(function (x) { return new File([x.blob], x.name, { type: x.blob.type }); });
    if (navigator.canShare && navigator.canShare({ files: fl })) return navigator.share({ files: fl, text: msg }).then(function () { return true; }, function () { return true; });
    return Promise.resolve(false);
  }

  function open(card, opts) {
    opts = opts || {};
    css();
    var hasInternal = (card.networks || []).some(function (n) { return n.internal; });
    var st = { internal: false, list: [], urls: [] };
    var back = document.createElement('div'); back.className = 'swc-back';
    back.innerHTML = '<div class="swc" role="dialog" aria-label="Wi-Fi card"><div class="swc-h"><b>Wi-Fi card</b><small>' + esc(card.site || '') + '</small>' +
      '<button class="swc-x" aria-label="Close">×</button></div><div class="swc-b"><div class="swc-grid" id="swcGrid"><div class="swc-empty">Drawing the cards…</div></div>' +
      '<div class="swc-msg" id="swcMsg"></div><p class="swc-note">On WhatsApp send the image as a photo, then this message — they long-press the password, copy it and paste it into Wi-Fi settings. The QR codes are for scanning from another phone or the printed sheet.</p></div>' +
      '<div class="swc-ft">' + (hasInternal && !card.client ? '<label><input type="checkbox" id="swcInt"> Include Sonor Tech network</label>' : '<span style="margin-right:auto"></span>') +
      '<button class="b" id="swcCopy">Copy WhatsApp message</button><button class="b" id="swcAll">Download all</button><button class="b g" id="swcShare">Share…</button></div></div>';
    document.body.appendChild(back);
    var $ = function (id) { return back.querySelector('#' + id); };
    function close() { st.urls.forEach(function (u) { URL.revokeObjectURL(u); }); back.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', key);
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    back.querySelector('.swc-x').onclick = close;
    var msg = whatsappText(card, card.networks || []);
    $('swcMsg').textContent = msg;
    function flash(btn, t) { var o = btn.textContent; btn.textContent = t; setTimeout(function () { btn.textContent = o; }, 1600); }
    $('swcCopy').onclick = function () {
      var b = this;
      (navigator.clipboard ? navigator.clipboard.writeText(msg) : Promise.reject()).then(function () { flash(b, 'Copied ✓'); }, function () {
        var r = document.createRange(); r.selectNodeContents($('swcMsg')); var s = getSelection(); s.removeAllRanges(); s.addRange(r); flash(b, 'Selected — press Copy');
      });
    };
    $('swcAll').onclick = function () { st.list.forEach(function (x, i) { setTimeout(function () { download(x); }, i * 350); }); };
    $('swcShare').onclick = function () {
      var b = this, pick = st.list.filter(function (x) { return x.primary; });
      share(pick.length ? pick : st.list.slice(0, 1), msg).then(function (ok) { if (!ok) { (pick[0] ? download(pick[0]) : null); flash(b, 'Saved — share from Photos'); } });
    };
    if ($('swcInt')) $('swcInt').onchange = function () { st.internal = this.checked; build(); };
    function build() {
      if (!(card.networks || []).length) { $('swcGrid').innerHTML = '<div class="swc-empty">No Wi-Fi networks on this project yet — add them in Network Map ▸ Setup ▸ Wi-Fi SSIDs.</div>'; return; }
      $('swcGrid').innerHTML = '<div class="swc-empty">Drawing the cards…</div>';
      files(card, { internal: st.internal }).then(function (list) {
        st.urls.forEach(function (u) { URL.revokeObjectURL(u); }); st.urls = []; st.list = list;
        $('swcGrid').innerHTML = list.map(function (x, i) {
          var u = URL.createObjectURL(x.blob); st.urls.push(u);
          var prev = /pdf$/.test(x.name) ? '<img alt="" src="' + (st.urls[st.urls.length - 2] || '') + '">' : '<img alt="" src="' + u + '">';
          return '<div class="swc-f' + (x.primary ? ' pri' : '') + '">' + prev + '<span title="' + esc(x.name) + '">' + esc(x.label) + '</span>' +
            '<button class="b s" data-i="' + i + '">' + (/pdf$/.test(x.name) ? 'Download PDF' : 'Download') + '</button></div>';
        }).join('');
        Array.prototype.forEach.call($('swcGrid').querySelectorAll('button[data-i]'), function (bt) { bt.onclick = function () { download(st.list[+bt.getAttribute('data-i')]); }; });
      }).catch(function (e) { $('swcGrid').innerHTML = '<div class="swc-empty">Could not draw the cards: ' + esc(e.message || e) + '</div>'; });
    }
    build();
    return { close: close };
  }

  function activePid() {
    try { if (global.SonorProjectBar && global.SonorProjectBar.getActiveId) { var a = global.SonorProjectBar.getActiveId(); if (a) return a; } } catch (e) { /* */ }
    try { if (global.SonorProjectBus && global.SonorProjectBus.get) { var b = global.SonorProjectBus.get(); if (b) return b; } } catch (e) { /* */ }
    try { return localStorage.getItem('sonor_active_project_id'); } catch (e) { return null; }
  }
  function button(host, opts) {
    opts = opts || {};
    if (typeof host === 'string') host = document.querySelector(host);
    if (!host) return null;
    var b = document.createElement('button');
    b.type = 'button'; b.className = opts.className || 'btn btn-sm'; b.textContent = opts.label || 'Wi-Fi card';
    b.title = 'Wi-Fi handover card — images for WhatsApp, A4 sheet and the copy-ready message (from Network Map)';
    b.onclick = function () {
      var supa = typeof opts.supa === 'function' ? opts.supa() : opts.supa;
      if (!supa && global.SonorDB) { try { supa = new global.SonorDB().client; } catch (e) { /* */ } }
      var pid = (opts.getProjectId && opts.getProjectId()) || activePid();
      var t = b.textContent; b.textContent = 'Wi-Fi…'; b.disabled = true;
      load(supa, pid).then(function (d) { b.textContent = t; b.disabled = false; open(d, opts); })
        .catch(function (e) { b.textContent = t; b.disabled = false; alert('Wi-Fi card: ' + (e.message || e)); });
    };
    if (opts.prepend) host.insertBefore(b, host.firstChild); else host.appendChild(b);
    return b;
  }

  global.SonorWifiCard = { VERSION: VERSION, fromNetworkConfig: fromNetworkConfig, fromPortal: fromPortal, load: load, payload: payload,
    renderPhone: renderPhone, renderA4: renderA4, a4Pdf: a4Pdf, whatsappText: whatsappText, files: files, open: open, button: button };
})(typeof window !== 'undefined' ? window : this);
