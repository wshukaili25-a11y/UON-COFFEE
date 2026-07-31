# UON Hub V31.1 Operations Suite

Implemented features 4–10:
- Bulk upload manifests and batch tracking schema
- Resource usefulness and star feedback
- Notification subscriptions and delivery tracking
- Unified search analytics foundation
- Operations analytics dashboard and export
- Role/permission model with optional college scope
- Audit log, soft-delete archive, backup-ready operational tables

## Deploy
1. Run `supabase/migrations/20260731173000_v311_operations_suite.sql`.
2. Deploy Supabase functions already included in the project.
3. Publish the site on Vercel.
4. Hard refresh / clear old PWA cache.
