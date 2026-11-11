-- Demo site visit for the Site app (Bryn 2026-11-10: "we dont have enough examples of tasks and snags in this demo project to give a
-- meaningful looking pdf export for site reports"). Project: Demo (de300000-0000-4000-8000-00000000d3a0).
-- Every row is flagged: site_notes.metadata.demo_seed = '2026-11-10' · punch lines ticked here carry demo_visit = '2026-11-10'.
-- Undo: delete from site_notes where metadata->>'demo_seed'='2026-11-10'; delete from tasks_general where external_source='site' and
--   external_id in (those ids); remove the RFI items with id 'site_<note id>' from projects.metadata.plan_notes; untick lines with demo_visit.
-- Snapshots taken first: take_snapshot('site_notes'|'tasks_general','pre-demo-site-seed').
with v(n, fid, fc, plan, room, uid, dkey, label, nn, stage, kind, ch, x, y, tx, ty, txt, by, at) as (values
 (1,'fmdemo0gf0001','GF','d7420663-47b8-4ab3-9ac4-cf295cf91e05'::uuid,'Kitchen','5ws7kfvd5518x4','CSM-GF-KIT-03','Ceiling speaker',2,'second_fix','change','moved',null::numeric,null::numeric,515::numeric,468::numeric,'Speaker moved 400 mm towards the island to clear the new pendant drop over the worktop.','mark@sonor.co.uk','2026-11-10 09:42+00'::timestamptz),
 (2,'fmdemo0gf0001','GF','d7420663-47b8-4ab3-9ac4-cf295cf91e05','Living Area','5r5hnyrp09fymo','FXWL-GF-LIV','Fixed TV mount',3,'second_fix','change','swapped',null,null,null,null,'Client has gone to an 85" set — tilt mount instead of fixed, back box raised 150 mm.','bryn@sonor.co.uk','2026-11-10 10:05+00'),
 (3,'fmdemo0gf0001','GF','d7420663-47b8-4ab3-9ac4-cf295cf91e05','Entrance Hall','sqvbcmsqafjizu','T4IW8-GF-HALL','C4 T4 in-wall 8"',7,'second_fix','change','moved',null,null,378,618,'Touchscreen moved to the right of the front door — the joiner''s coat cupboard now sits on the left.','mark@sonor.co.uk','2026-11-09 14:20+00'),
 (4,'fmdemo1f00001','1F','be81900b-b0b5-4904-857a-c374edb58127','Landing','vj5ll9rqi12uit','WAP-1F-LAND','Ceiling-mount access point',9,'second_fix','question',null,null,null,null,null,'Landing ceiling is a lath and plaster coffer — OK to surface-mount the AP, or move it into the airing cupboard?','mark@sonor.co.uk','2026-11-10 11:12+00'),
 (5,'fmdemo0gf0001','GF','d7420663-47b8-4ab3-9ac4-cf295cf91e05','Garage','3k2beyyfvhrkau','RA-GF-GAR','18U comms rack',10,'rack_build','note',null,null,null,null,null,'Rack in, levelled and bolted to the floor. Earth bond done by DT Electrical.','bryn@sonor.co.uk','2026-11-09 09:15+00'),
 (6,'fmdemo0gf0001','GF','d7420663-47b8-4ab3-9ac4-cf295cf91e05','Sitting Room (cinema)','c1rc76pscame42','SURBR-GF-SITT','Surround speaker, back right',1,'second_fix','snag',null,null,null,null,null,'Back-right surround back box sits 120 mm lower than the left — re-cut and plasterer to make good.','mark@sonor.co.uk','2026-11-10 12:30+00'),
 (7,'fmdemo0gf0001','GF','d7420663-47b8-4ab3-9ac4-cf295cf91e05','Porch','odja6b2nj16o8v','DB-GF-PRCH','Video doorbell',8,'second_fix','snag',null,null,null,null,null,'Doorbell back box is crooked by about 5° — re-fix before the render goes on.','bryn@sonor.co.uk','2026-11-10 13:05+00'),
 (8,'fmdemo1f00001','1F','be81900b-b0b5-4904-857a-c374edb58127','Bed 5 Ensuite','ab35fd097e210e','SH-1F-B5EN','Shaver socket',null,'second_fix','snag',null,null,null,null,null,'Shaver socket fitted on the wrong wall — electrician to swap it with the light switch position.','mark@sonor.co.uk','2026-11-10 13:40+00'),
 (9,'fmdemo0gf0001','GF','d7420663-47b8-4ab3-9ac4-cf295cf91e05','Dining Area','feb6gzzd7u01jx','DC-GF-DIN','Door contact',8,'second_fix','change','omitted',null,null,null,null,'Left out — the bifold has an integral contact; wired back to the alarm panel instead.','mark@sonor.co.uk','2026-11-10 10:48+00'),
 (10,'fmdemo0gf0001','GF','d7420663-47b8-4ab3-9ac4-cf295cf91e05','Kitchen',null,null,null,9,'second_fix','change','added',545,445,null,null,'Added a data point behind the fridge housing for the Sub-Zero Wi-Fi module.','bryn@sonor.co.uk','2026-11-10 10:20+00'),
 (11,'fmdemo0gf0001','GF','d7420663-47b8-4ab3-9ac4-cf295cf91e05','Lounge','eetak6oitxbgs1','TV4K-GF-LNG','TV point — 4K',3,'second_fix','change','route',null,null,null,null,'HDMI and Cat6 run through the void under the stairs, not the ceiling — joist notching not allowed there.','mark@sonor.co.uk','2026-11-10 11:55+00'),
 (12,'fmdemo1f00001','1F','be81900b-b0b5-4904-857a-c374edb58127','Master Bed','q3fpi0lh86cocy','DPT-1F-MBED','Data Point Twin',9,'second_fix','note',null,null,null,null,null,'Second fix done: plates fitted and labelled, both ports tested to the laundry switch.','bryn@sonor.co.uk','2026-11-09 15:30+00'),
 (13,'fmdemo1f00001','1F','be81900b-b0b5-4904-857a-c374edb58127','Office','n3vzteb28s0cn2','DPT-1F-OFF','Data Point Twin',9,'second_fix','question',null,null,null,null,null,'Client asked for a third data point by the window desk — needs pricing before we chase it in.','bryn@sonor.co.uk','2026-11-10 14:10+00'),
 (14,'fmdemo0gf0001','GF','d7420663-47b8-4ab3-9ac4-cf295cf91e05','Gym','to3ytsdj9wh374','TV4K-GF-GYM','TV point — 4K',3,'second_fix','snag',null,null,null,null,null,'TV point looks low for the rowing machine.','mark@sonor.co.uk','2026-11-09 11:00+00'),
 (15,'fmdemo1f00001','1F','be81900b-b0b5-4904-857a-c374edb58127','Bed 2','rbgojehugekly1','WAP-1F-BED2','Ceiling-mount access point',9,'commissioning','snag',null,null,null,null,null,'Access point not powering up — suspect PoE port 7 on the laundry switch.','bryn@sonor.co.uk','2026-11-10 14:45+00'),
 (16,'fmdemo0gf0001','GF','d7420663-47b8-4ab3-9ac4-cf295cf91e05',null,null,null,null,null,null,'note',null,480,805,null,null,'Skip at the side gate — keep the path clear for the rack delivery on Thursday.','bryn@sonor.co.uk','2026-11-10 08:50+00'),
 (17,'fmdemo1f00001','1F','be81900b-b0b5-4904-857a-c374edb58127','Master Bed','h05q7auyll43ll','CSM-1F-MBED-02','Ceiling speaker',2,'second_fix','photo',null,null,null,null,null,'Speaker cut-outs marked against the joist layout before the boarders close up.','mark@sonor.co.uk','2026-11-10 09:05+00'),
 (18,'fmdemo0gf0001','GF','d7420663-47b8-4ab3-9ac4-cf295cf91e05','Garage','7oklzz1b8se27c','MN-GF-GAR','Control processor',7,'commissioning','note',null,null,null,null,null,'Controller on the network at .10, Composer project loaded, OS updated.','bryn@sonor.co.uk','2026-11-10 15:20+00')
)
insert into site_notes (id, project_id, floor_id, floor_code, room, plan_id, revision_label, device_uid, device_key, device_label, service_nn, stage, kind, change_type, x, y, to_x, to_y, text, status, created_by, metadata, created_at, updated_at)
select ('de300000-0000-4000-8000-0000005e' || lpad(n::text, 4, '0'))::uuid, 'de300000-0000-4000-8000-00000000d3a0', fid, fc, room, plan, 'Client markup', uid, dkey, label, nn, stage, kind, ch, x, y, tx, ty, txt, 'open', by,
  jsonb_build_object('demo_seed', '2026-11-10'), at, at from v
on conflict (id) do nothing;

-- reviews through the single writer (who = p_by here, a server job)
select site_note_resolve('de300000-0000-4000-8000-0000005e0004', 'rfi', 'bryn@sonor.co.uk');
select site_note_resolve('de300000-0000-4000-8000-0000005e0006', 'snag', 'bryn@sonor.co.uk');
select site_note_resolve('de300000-0000-4000-8000-0000005e0007', 'snag', 'bryn@sonor.co.uk');
select site_note_resolve('de300000-0000-4000-8000-0000005e0015', 'snag', 'bryn@sonor.co.uk');
select site_note_resolve('de300000-0000-4000-8000-0000005e0002', 'accept', 'bryn@sonor.co.uk', 'Draw the tilt mount + raised box on the as-built');
select site_note_resolve('de300000-0000-4000-8000-0000005e0003', 'applied', 'bryn@sonor.co.uk', 'Moved on the Takeoffs as-built');
select site_note_resolve('de300000-0000-4000-8000-0000005e0005', 'resolve', 'bryn@sonor.co.uk');
select site_note_resolve('de300000-0000-4000-8000-0000005e0012', 'resolve', 'bryn@sonor.co.uk');
select site_note_resolve('de300000-0000-4000-8000-0000005e0014', 'dismiss', 'bryn@sonor.co.uk', 'Checked — 1,200 mm to centre, matches the drawing');

-- this visit's ticks: ~60 % of the open 2nd-fix lines, ~12 % of commissioning, today, by Mark / Bryn
update tasks_general t set metadata = jsonb_set(t.metadata, '{punch_list}', (
  select jsonb_agg(case when not coalesce((l->>'done')::boolean, false) and not coalesce((l->>'gone')::boolean, false)
      and (abs(hashtext(t.id::text || coalesce(l->>'key', ''))) % 100) < (case t.metadata->'punch'->>'stage' when 'second_fix' then 60 else 12 end)
    then l || jsonb_build_object('done', true, 'by', case when abs(hashtext(coalesce(l->>'key','') || 'w')) % 2 = 0 then 'mark@sonor.co.uk' else 'bryn@sonor.co.uk' end,
      'at', to_char(timestamptz '2026-11-10 09:00+00' + make_interval(mins => abs(hashtext(coalesce(l->>'key','') || 't')) % 380), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'demo_visit', '2026-11-10')
    else l end order by o)
  from jsonb_array_elements(t.metadata->'punch_list') with ordinality as e(l, o)))
where t.project_id = 'de300000-0000-4000-8000-00000000d3a0' and t.external_source = 'punch' and t.metadata->'punch'->>'stage' in ('second_fix', 'commissioning')
  and jsonb_typeof(t.metadata->'punch_list') = 'array' and jsonb_array_length(t.metadata->'punch_list') > 0;
