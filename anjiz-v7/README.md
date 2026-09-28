# ANJIZ Review Frontend

This folder contains the University of Nizwa ANJIZ review frontend prepared for CIS handoff.

## Live entry point
- Production review: https://anjiz-system-preview.vercel.app
- Repository entry: `index.html`
- Runtime bootstrap: `v16-full-loader.pack.b64` currently contains the V29 resilient bootstrap.

## Active runtime chain
1. V29 bootstrap loads `base-loader-v8.gz.b64`.
2. It injects current `appointments-v9.js` and `appointments-v9.css`.
3. Appointment bootstrap loads Booking V10, Attendance V11 and `reports-v12.js`.
4. `reports-v12.js` is the resilient V27 loader for Reports, Timetable V13, Communications V14, Registration V15, Instructor/Peer V16-V17, Student/Visitor V18, Demo services V19, QR V20 and Final V27 controls.
5. `final-v27.js/css` provides System Setup, Excel user verification, computer approvals, integration status, audit/outbox, backup and final health.

## Important files
- `CIS-HANDOFF.md` — production integration handoff.
- `FINAL-QA.md` — requirements coverage matrix.
- `base-loader-v8.gz.b64` — stable base application; keep unchanged unless intentionally rebuilding the base.
- `appointments-v9.js/css` — appointments + early iOS/Safari QR scanner bootstrap.
- `reports-v12.js` — resilient module loader.
- `final-v27.js/css` — final CIS review controls.

## Review environment only
Browser-side state, demo authentication, demo email delivery and FI handoff are review workflows. CIS should replace them with University SSO, server-side RBAC/database, FI Advisory integration, approved email service and server-side QR/record verification.

## Legacy / rollback assets
Files such as `anjiz-v24-direct.html`, `p1.txt`–`p4.txt`, `RESTORE-IN-PROGRESS.txt`, `ROLLBACK-NOTE.txt`, `STABLE-LOADER.txt` and `app1.js` are retained only as historical/rollback material and are not the production review entry point.
