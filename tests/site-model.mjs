// node "APP - Survey/tests/site-model.mjs" — SonorSite read model against a stub client (real row shapes from the demo project, 2026-11-07)
import { createRequire } from 'module'; const require = createRequire(import.meta.url);
const S = require('../../sonor-site.js'); let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const T = {
  takeoffs_floors: [{ id: 'u-gf', floor_id: 'fgf', code: 'GF', name: 'Ground Floor', seq: 0 }, { id: 'u-1f', floor_id: 'f1f', code: '1F', name: 'First Floor', seq: 1 }],
  takeoffs_floor_plans: [{ id: 'plan-gf', floor_id: 'fgf', revision_label: 'Rev B' }],
  tasks_general: [
    { id: 't1', external_source: 'punch', labels: ['punch'], metadata: { punch: { stage: 'first_fix' }, punch_list: [
      { dev: 'KP-GF', key: 'k1', item: 'ff.box', done: true, at: 'x', by: 'mark', loc: { uid: 'uid-kp' } },
      { dev: 'GONE-1', key: 'k2', item: 'ff.box', done: true },
      { dev: 'KP-GF', key: 'k3', item: 'ff.old', gone: true } ] } },
    { id: 't2', external_source: 'punch', labels: ['punch'], metadata: { punch: { stage: 'commissioning' }, punch_list: [{ dev: 'KP-GF', key: 'k4', item: 'co.id', done: false }, { dev: 'TV-1F', key: 'k5', done: false }] } },
    { id: 's1', external_source: 'site', labels: ['snag', 'site'], status: 'todo', title: 'Snag · x', plan_pin: { floor_code: 'GF' }, metadata: { site_note: { id: 'n1' } } } ],
  site_notes: [{ id: 'n1', device_uid: 'uid-kp', kind: 'snag', status: 'promoted' }, { id: 'n2', device_key: 'TV-1F', kind: 'change', status: 'open' }],
  tasks_punch_stages: [{ key: 'first_fix', label: '1st fix' }, { key: 'commissioning', label: 'Test & commission' }],
  projects: { plan_notes: { sections: { general: [{ id: 'a', is_rfi: true, rfi_id: 'RFI-001', text: 'q' }, { id: 'b', text: 'not rfi' }] } } },
  v_site_project: { notes_open: 1 }
};
const devs = [{ dev_key: 'TV-1F', name: 'TV', loc: { floor_id: 'u-1f' }, room_code: 'LOUNGE', service_nn: 3 }, { dev_key: 'KP-GF', name: 'Keypad', floor_code: 'GF', loc: { floor_id: 'u-gf' }, room_code: 'PLAY', service_nn: 4 }];
function q(table, single) { const b = { select() { return b; }, eq() { return b; }, is() { return b; }, or() { return b; }, order() { return b; },
  maybeSingle() { return Promise.resolve({ data: T[table] }); }, then(r, j) { return Promise.resolve({ data: T[table] }).then(r, j); } }; return b; }
const supa = { from: q, rpc: (n) => Promise.resolve({ data: n === 'punch_project_devices' ? devs : null }) };
const m = await S.load(supa, 'p1');
ok(m.floors.map(f => f.code).join() === 'GF,1F', 'floors in GF→1F order');
ok(m.floors[0].plan && m.floors[0].plan.revision_label === 'Rev B' && m.floors[1].plan === null, 'active plan revision per floor');
const kp = m.devices.find(d => d.key === 'KP-GF'), tv = m.devices.find(d => d.key === 'TV-1F');
ok(kp.uid === 'uid-kp' && kp.total === 2 && kp.done === 1, 'device checks merged across tasks, gone lines dropped, uid from the line');
ok(tv.floor === '1F', 'floor code resolved from takeoffs_floors uuid');
ok(S.stageProgress(kp, 'commissioning').total === 1 && S.stageProgress(kp, 'first_fix').done === 1, 'stage progress');
ok(m.devices.some(d => d.key === 'GONE-1' && d.source === 'punch-only'), 'ticked checks of a removed device still shown');
ok(kp.notes.length === 1 && tv.notes.length === 1, 'notes attach by uid, else by device key');
ok(m.snags.length === 1 && m.snags[0].note_id === 'n1', 'snags from Tasks, linked back to the note');
ok(m.rfis.length === 1 && m.rfis[0].rfi_id === 'RFI-001', 'RFIs read from plan_notes');
const g = S.byFloor(m); ok(g[0].floor.code === 'GF' && g[g.length - 1].floor.code === '—', 'byFloor: GF first, devices with no floor last');
const cache = { v: null, get: async () => cache.v, set: async (k, v) => { cache.v = JSON.parse(JSON.stringify(v)); } };
await S.load(supa, 'p1', { cache }); const bad = { from: () => { throw new Error('offline'); }, rpc: () => Promise.reject(new Error('offline')) };
const off = await S.load(bad, 'p1', { cache }); ok(off.stale === true && off.devices.length === m.devices.length, 'offline: last good model, flagged stale');
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
