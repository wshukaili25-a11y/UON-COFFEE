# UON Hub V64 — Google + Knowledge Source Hub

V64 makes UON AI source-aware. Public/curated knowledge can be refreshed from trusted sources while private student schedule/tasks/Focus data remains local unless a user explicitly chooses to share it.

## Architecture

1. `uon-ai-chat-v64` is the browser gateway.
2. Existing `uon-ai-chat` / `uon-ai-v3` remain the grounded University of Nizwa assistant core.
3. `uon-ai-google-v64` adds live Google Maps Places results only for location/nearby intents.
4. `uon-ai-source-sync-v64` refreshes trusted public/curated knowledge into `uon_ai_knowledge`.
5. `uon-ai-source-admin-v64` manages source registry, manual sync, and approval/rejection.
6. `admin-ai-sources.html` is the admin UI.

## Required Supabase secrets

Set these as server-side Edge Function secrets; never expose them in browser JavaScript:

- `GOOGLE_MAPS_API_KEY`
  - Enable **Places API (New)** in Google Cloud.
  - Billing must be enabled for the Google Maps Platform project.
  - Restrict the key to the required Maps API(s). Do not use a broad unrestricted key.
- `UON_AI_CONNECTOR_SECRET`
  - Strong random secret shared only by `uon-ai-chat-v64` and `uon-ai-google-v64`.
- `UON_AI_SYNC_SECRET`
  - Strong random secret for scheduled source-sync calls. Admin-password calls are also supported for manual sync.
- `GOOGLE_SERVICE_ACCOUNT_JSON`
  - Existing project secret used by the current Google Drive importer and V64 Drive knowledge sync.

Supabase-provided secrets such as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are used server-side only.

## Google Maps data policy in V64

Google Places results are fetched live when the student asks a location/nearby question. V64 does **not** persist Google place names, formatted addresses, opening state, or other Places content in the knowledge table.

`uon_ai_google_place_refs` stores only:

- durable `place_id`
- UON Hub's own query tags
- UON Hub's own relevance score/notes
- timestamps

The UI displays **Google Maps** attribution and links to Google Maps. Each result can also include a directions URL from University of Nizwa.

## Google Drive knowledge sources

Use `admin-ai-sources.html` and choose `google_drive`.

- `source_id` must be the Google Drive folder ID.
- Share that folder with the configured Google service-account email.
- V64 uses `drive.readonly` server-side.
- Google Docs are exported as plain text.
- Google Sheets are exported as CSV.
- Text/CSV files can be read directly.
- Unsupported binary formats are skipped by the knowledge sync; the existing Drive importer can still register their links/content workflows.
- Recommended trust level: 60–85 with auto-publish **off** so an admin reviews new knowledge first.

## Google Calendar sources

V64 currently supports **public Google Calendar ICS feeds** as knowledge sources (`google_calendar_public`). This is appropriate for a public/official calendar that is intentionally shared.

Do not place a student's private calendar feed into the public knowledge source registry.

Personal Google Calendar integration should be implemented later as user OAuth with minimum scopes and separate per-user storage; it must never feed the public knowledge base.

## University of Nizwa sources

The V64 migration seeds official University of Nizwa pages for:

- University home/current information
- Academic calendar
- Academic programs
- Rules
- Contact information
- Campus map

They use trust level 100 and are eligible for automatic publication. Sync still records provenance, fetched time, content hash and source state.

## Knowledge validation model

Each source-backed `uon_ai_knowledge` record includes:

- `source_provider`
- `source_external_id`
- `source_type`
- `source_url` / `source_title`
- `fetched_at`
- `source_updated_at`
- `content_hash`
- `confidence`
- `verification_status`
- `last_verified_at`
- `metadata`

Content hashes prevent duplicate updates. Lower-trust sources remain inactive/pending until an admin approves them.

## Source administration

Open `/admin-ai-sources.html` and authenticate using the normal UON Hub admin password.

Admin actions:

- list sources and health
- add University page / Google Drive / public Google Calendar sources
- set trust and refresh interval
- enable/disable sources
- Sync Now / sync all due sources
- review and approve/reject pending knowledge
- inspect recent sync runs and failures

## Scheduled refresh

Schedule `uon-ai-source-sync-v64` through Supabase Cron / an authenticated HTTP schedule. The scheduled request should send `x-sync-secret` using `UON_AI_SYNC_SECRET` and body similar to:

```json
{"action":"sync-due","limit":8}
```

Do not hard-code the sync secret in a public SQL migration or browser file.

A 30–60 minute scheduler is sufficient; each source also has its own `next_sync_at` / `refresh_minutes`, so sources that are not due are not fetched.

## Personal Google accounts — later phase

For a future signed-in UON Hub account layer:

- Google Calendar: request the minimum calendar scope required by the exact action; require explicit confirmation before creating/updating events.
- Google Drive: prefer narrow file-specific scopes such as `drive.file` when possible instead of full Drive access.
- Store per-user OAuth tokens encrypted/server-side and never merge private user content into `uon_ai_knowledge`.
- Add disconnect/revoke controls and show exactly what UON Hub can access.

## Release gate

V64 should remain on its development branch until:

1. static verifier passes,
2. migration is reviewed,
3. Edge Functions deploy successfully,
4. required secrets are configured,
5. Google Places live test succeeds,
6. source sync test inserts/updates one official source correctly,
7. admin approval flow is tested,
8. no private data appears in public knowledge/RLS reads.
