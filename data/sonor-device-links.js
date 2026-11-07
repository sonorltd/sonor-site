/**
 * sonor-device-links.js — ONE place that turns "a device on a project" into links to every app
 * that holds a view of it. Root master (2026-10-31), synced to data/ by sync-everything.sh.
 *
 * Owner 2026-10-31: "every app linked to the other and the whole project seamlessly linked across
 * all its aspects". A device is known everywhere by the same keys:
 *   project   projects.id
 *   loc       { uid (Takeoffs sonorSymbol.uid), floor_id, node (Engineering), rack, panel, circuit }
 *             — written by punch_generate() on punch tasks and by asset_register_sync() on client_assets
 *   device    the device ID label (e.g. TV-GF-LIV-1)
 *   uid       client_assets.source_uid (Takeoffs uid, else eng:<node> / panel:<id> / dev:<key>)
 * URL shapes live ONLY in sonor-brand.js deepLinks (takeoffsSite / engineering / tasks / netmap /
 * service-contracts). This file decides which links apply; it never hard-codes a URL.
 *
 *   SonorDeviceLinks.build(app, contract, params)         → url | null
 *   SonorDeviceLinks.forDevice(d, opts)                    → [{ key, label, icon, href, title }]
 *       d    = { project, loc, device, uid, networked }
 *       opts = { only: ['site','engineering','tasks','netmap','equipment'], except: [...] }
 *   SonorDeviceLinks.forAsset(row, opts)                   → same, from a v_asset_warranty row
 *   SonorDeviceLinks.html(links, { compact })              → small link chips
 */
(function (global) {
  'use strict';
  var VERSION = '1.0.0';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function brand() { return global.__SONOR_BRAND__ || null; }

  // The shared deep-link contract first; the same params on appUrls.hosted as the fallback.
  function build(app, contract, params) {
    var clean = {};
    Object.keys(params || {}).forEach(function (k) { var v = params[k]; if (v != null && v !== '') clean[k] = v; });
    var B = brand();
    if (B && typeof B.deepLink === 'function') {
      var url = B.deepLink(app, contract || 'device', clean);
      if (url) return url;
    }
    var base = B && B.appUrls && B.appUrls.hosted && B.appUrls.hosted[app];
    if (!base) return null;
    var qs = new URLSearchParams(clean).toString();
    return base + (qs ? (base.indexOf('?') >= 0 ? '&' : '?') + qs : '');
  }

  var ORDER = ['site', 'engineering', 'tasks', 'netmap', 'equipment'];

  function forDevice(d, opts) {
    d = d || {}; opts = opts || {};
    var pid = d.project, loc = (d.loc && typeof d.loc === 'object') ? d.loc : {}, dev = d.device || null;
    if (!pid) return [];
    var want = function (k) { return (!opts.only || opts.only.indexOf(k) >= 0) && !(opts.except && opts.except.indexOf(k) >= 0); };
    var name = dev || 'this device';
    var out = [];
    if (want('site') && (loc.uid || loc.floor_id)) {
      var h = build('takeoffsSite', 'device', { project: pid, floor: loc.floor_id, uid: loc.uid, device: dev });
      if (h) out.push({ key: 'site', label: 'Site plan', icon: '📐', href: h, title: 'Open ' + name + ' on the site plan (Takeoffs)' });
    }
    if (want('engineering') && (loc.node || loc.rack || loc.panel || loc.circuit)) {
      var e = build('engineering', 'device', { project: pid, node: loc.node, uid: loc.node ? loc.uid : null,
        rack: loc.node ? null : loc.rack, panel: loc.node ? null : loc.panel, circuit: loc.node ? null : loc.circuit, device: dev });
      if (e) out.push({ key: 'engineering', label: 'Engineering', icon: '🔌', href: e, title: 'Open ' + name + ' in Engineering' });
    }
    if (want('tasks') && (dev || d.uid || loc.uid)) {
      var t = build('tasks', 'device', { project: pid, view: 'list', device: dev, uid: d.uid || loc.uid });
      if (t) out.push({ key: 'tasks', label: 'Tasks', icon: '✅', href: t, title: 'Punch tasks for ' + name + ' (Tasks)' });
    }
    if (want('netmap') && d.networked) {
      var n = build('netmap', 'device', { pid: pid, uid: d.uid || loc.uid, device: dev });
      if (n) out.push({ key: 'netmap', label: 'Network', icon: '🌐', href: n, title: 'Address, serial and MAC for ' + name + ' (Network Map)' });
    }
    if (want('equipment')) {
      var q = build('service-contracts', 'equipment', { pid: pid, uid: d.uid });
      if (q) out.push({ key: 'equipment', label: 'Warranty', icon: '🛡', href: q, title: 'Warranty and service for ' + name + ' (Service Contracts)' });
    }
    return out.sort(function (a, b) { return ORDER.indexOf(a.key) - ORDER.indexOf(b.key); });
  }

  function forAsset(row, opts) {
    if (!row) return [];
    var loc = row.loc || (row.metadata && row.metadata.loc) || {};
    return forDevice({ project: row.project_id, loc: loc, device: row.device_id || (row.metadata && row.metadata.device_id) || null,
      uid: row.source_uid, networked: !!(row.mac || row.ip) }, opts);
  }

  function html(links, opts) {
    opts = opts || {};
    return (links || []).map(function (l) {
      return '<a class="dev-link" target="_blank" rel="noopener" href="' + esc(l.href) + '" title="' + esc(l.title) + '" data-dev-link="' + esc(l.key) + '">' +
        esc(l.icon) + (opts.compact ? '' : ' ' + esc(l.label)) + '</a>';
    }).join(opts.compact ? '' : ' ');
  }

  global.SonorDeviceLinks = { VERSION: VERSION, build: build, forDevice: forDevice, forAsset: forAsset, html: html };
})(typeof window !== 'undefined' ? window : this);
