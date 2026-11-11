-- v_site_project.snags_open counts Tasks snags AND open Portal snags (not samples) — one figure for Site, the Board and the PM brief.
-- Applied 2026-11-10 (migration site_project_snags_include_portal).
create or replace view v_site_project as
 SELECT id AS project_id,
    ( SELECT count(*) FROM site_notes s WHERE s.project_id = p.id AND s.status = 'open') AS notes_open,
    ( SELECT count(*) FROM site_notes s WHERE s.project_id = p.id AND s.status = 'open' AND s.kind = 'change') AS changes_open,
    ( SELECT count(*) FROM site_notes s WHERE s.project_id = p.id AND s.status = 'accepted') AS changes_accepted,
    ( SELECT count(*) FROM tasks_general t WHERE t.project_id = p.id AND 'snag' = ANY (t.labels) AND t.status <> ALL (ARRAY['done','cancelled']))
    + ( SELECT count(*) FROM v_tasks_unified u WHERE u.project_id = p.id AND u.source_app = 'portal-snag'
          AND u.status <> ALL (ARRAY['closed','resolved','verified','cancelled','done']) AND coalesce(u.metadata->>'is_sample','false') <> 'true') AS snags_open,
    ( SELECT count(*) FROM tasks_general t, LATERAL jsonb_array_elements(COALESCE(t.metadata -> 'punch_list', '[]'::jsonb)) l(value)
          WHERE t.project_id = p.id AND t.external_source = 'punch' AND NOT COALESCE((l.value ->> 'gone')::boolean, false)) AS checks_total,
    ( SELECT count(*) FROM tasks_general t, LATERAL jsonb_array_elements(COALESCE(t.metadata -> 'punch_list', '[]'::jsonb)) l(value)
          WHERE t.project_id = p.id AND t.external_source = 'punch' AND NOT COALESCE((l.value ->> 'gone')::boolean, false) AND ((l.value ->> 'done')::boolean)) AS checks_done,
    ( SELECT max(s.created_at) FROM site_notes s WHERE s.project_id = p.id) AS last_note_at
   FROM projects p;
