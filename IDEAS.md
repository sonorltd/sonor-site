# Site — IDEAS

## Data this app can provide
- `site_notes` (changes from plan, photos, questions, snags) per device uid / floor / plan revision — read by Takeoffs (review layer), PM Brief (card), Tasks (snags), the client portal later (photos of hidden work).
- Live check progress per stage via `v_site_project`.

## Data this app could consume
- Network addresses per device (SonorNetwork / `v_network_devices`) for commissioning checks.
- Engineers' calendar (today's visits) to pre-select the project.
- Cable IDs / schedules from Takeoffs for second fix.

## Integration notes
- Device positions on a plan view: reuse Takeoffs' read-only site view (`sonor-takeoffs-site.js`) as a shared module rather than drawing our own.

## Requests to other projects
- Board: show `SonorSite.renderCard` on the project card (B-804).
- Takeoffs: promote `sonor-takeoffs-site.js` to a root master so Site can embed the interactive plan.
