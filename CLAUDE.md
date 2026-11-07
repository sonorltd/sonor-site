# Site — Claude Code Context (v0.1.0)

> **Current version: v0.1.0** — 2026-11-07 BORN (Bryn: "survey and site are diff apps, survey is for that, site is for engineers, they are very similar but different levels of info"). The engineers' on-site app, split out of Survey's short-lived Site panel (Survey v0.12–0.13). Devices by floor → service (collapsible, SonorServiceGroups) with their punch checks per stage (tick → `punch_tick`), device detail for engineers (model, kind, links to every app via SonorDeviceLinks), site notes (note / change from plan / photo / question / snag) on a device, floor, room or a 📍 point on the floor's live Takeoffs plan, open snags + RFIs, Site visit report PDF. Offline-first (own SonorOutbox queue).
> **Spine version: 1.3** (declared at registration — kit-served, graphite, SonorHeader + SonorApp.init; NOT shell-mounted yet → reconcile with `workspace-apps.tsv spine_target` at the first audit; per GEL invariant 3 the declaration drops to 1.2.6 if the shell isn't adopted)
> Inherits: `../CLAUDE.md` (master rules) · Brand source: `../Branding - CORE/brand-core.xml` · **Contract: `../SITE-ARCHITECTURE.md` — read first.**

## Survey vs Site (the split)
| | Survey (`sonor-survey`) | Site (`sonor-site`) |
|---|---|---|
| Who | Bryn / sales at client meetings + pre-design surveys | engineers during the install |
| Level of info | what the client wants, what's there: Pencil notes, plan markups, survey marks, photos, checklists, client questions | what's being built: the design's devices, checks per stage, changes from plan, snags, RFIs, model / links per device |
| Owns | `survey_sessions`, `survey_pages` | `site_notes` |
| Shares | `sonor-outbox.js` (queue), `sonor-plan-image.js` (Takeoffs plan), `site-photos` bucket | same |

## Architecture (MODULAR-FIRST)
`dashboard/sonor-site.html` is a thin shell. App-local modules (edit HERE):
| Module | Owns |
|---|---|
| `data/site-config.js` | static refs (outbox name, buckets, photo size) |
| `data/site-app.js` | the UI: project → stage chips → Devices / Site notes / Snags & RFIs tabs; note sheet; 📍 plan picker; outbox ops `site.note` / `site.tick` / `site.resolve` / `photo.upload`; visit report button |
| `data/site-pdf.js` | Site visit report on `sonor-pdf-luxury.js` (house cover art `site-cover.jpg` = the Tasks cover via covers.json; checks by stage · notes since the last 24 h · open snags + RFIs) |
| `dashboard/sw.js` + `manifest.webmanifest` | installable PWA, shell + CDN libs pre-cached; `CACHE_VERSION` = bump site 2 |
Root masters consumed (synced copies — never edit here): `sonor-site.js` (SonorSite — read model + RPC calls + card), `sonor-outbox.js`, `sonor-plan-image.js`, `sonor-device-links.js`, `sonor-service-groups.js`, `sonor-project-bar.js` / `-list.js`, `sonor-header.js`, `sonor-app.js`, `sonor-brand.js`, `sonor-db.js`, `sonor-pdf-luxury.js` / `-theme.js`, kit mirror.

## Data (SUPABASE-FIRST)
- **Owns:** `site_notes` (see SITE-ARCHITECTURE.md for columns, statuses and RPCs). Photos → `site-photos/{project}/site/{note}.jpg`.
- **Reads (never copies):** `punch_project_devices(project)`, `tasks_general` punch rows + snags, `takeoffs_floors` / `takeoffs_floor_plans` (+ bucket `takeoffs-plans`), `projects.metadata.plan_notes` RFIs, `tasks_punch_stages`, `v_site_project`.
- **Writes into other apps only through RPCs:** `punch_tick` (Tasks check) · `site_note_resolve` ('snag' → Tasks task, 'rfi' → plan_notes RFI) · `site_note_upsert`. Who = the signed-in login, stamped server side (`sonor_who()`).
- Migrations: `../APP - Survey/supabase/migrations/2026-11-07_site_mode.sql` + `2026-11-07b_site_mode_v2.sql` (written while Site was a Survey panel; the tables are Site's).

## Upstream / downstream
- Upstream: Takeoffs + Engineering design (devices, plans), Tasks (`punch_generate` checks), Takeoffs Plan Notes (RFIs).
- Downstream: Takeoffs ▸ Layers ▸ Site notes (review: accept → applied on the as-built), Tasks (snags, ticks), PM Brief Site card (`SonorSite.renderCard`), equipment register (install dates follow ticked install checks).

## Brand
- **Active theme: graphite** (GRAPHITE-FIRST). Plan paper is white (document-preview law).
## Brand Overrides
None.

## Drawing model
**Drawing model: direct-object (ADAPTER_INVARIANTS)** — the 📍 picker draws the plan image fitted exactly as Takeoffs (1400×900 world frame, top-left) and stores the tap in world units; render scale only at draw time. No drawing state persisted beyond `x,y,to_x,to_y`.

## Feature timeline
- v0.1.0 (2026-11-07) — born from Survey's Site panel; full-page engineers' app; visit report; shared outbox / plan masters extracted.

## Rules (app-specific)
1. Site never moves a Takeoffs placement — changes go to Takeoffs review (accept → drawn → applied).
2. Every write is an outbox op first (works with no signal); never call Supabase writes directly from UI code.
3. No people typed by hand — names come from the login / SonorWho.
4. Client-facing info (budget, client wants, contact details) stays in Survey / PM — Site shows the build.
