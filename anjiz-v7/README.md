# ANJIZ Review Frontend

This folder contains the University of Nizwa ANJIZ review frontend prepared for CIS handoff.

## Live entry point
- Production review: https://anjiz-system-preview.vercel.app
- Repository entry: `index.html`
- Runtime payload: `v16-full-loader.pack.b64` contains the complete V32 application.

## Build and active runtime
Run `node anjiz-v7/build-runtime.mjs` from the repository root with Node 24.
The build resolves the existing V8 presentation transform from local inputs,
then assembles all modules in dependency order. It validates each script and the
final HTML script boundaries before writing `index.html` and the gzip/Base64
payload used by the existing Vercel entry. No add-on fetch is required at startup.
QR camera libraries and spreadsheet-import libraries remain loaded on demand.

V32 fixes the duplicated `async` in the legacy QR patch, unsafe insertion of
JavaScript into another loader's string literal, and browser decoding of the
Student V18 pack's excess Base64 padding. It preserves the local data key,
existing accounts, features and presentation.

`runtime/appointments-core.js` and `runtime/reports-core.js` vendor the exact
previously pinned versions from commits `c901e410` and `6f208a72`. Keep them local
so older GitHub files are not fetched while a user is opening the workspace.

## Important files
- `CIS-HANDOFF.md` — production integration handoff.
- `FINAL-QA.md` — requirements coverage matrix.
- `base-loader-v8.gz.b64` — stable base application; keep unchanged unless intentionally rebuilding the base.
- `build-runtime.mjs` — reproducible build with syntax and HTML boundary checks.
- `appointments-v9.js/css` — legacy enhancement inputs; CSS is separated from its old embedded loader during the build.
- `reports-v12.js` — historical remote module loader, superseded by the build.
- `final-v27.js/css` — final CIS review controls.

## Review environment only
Browser-side state, demo authentication, demo email delivery and FI handoff are review workflows. CIS should replace them with University SSO, server-side RBAC/database, FI Advisory integration, approved email service and server-side QR/record verification.

## Legacy / rollback assets
Files such as `anjiz-v24-direct.html`, `p1.txt`–`p4.txt`, `RESTORE-IN-PROGRESS.txt`, `ROLLBACK-NOTE.txt`, `STABLE-LOADER.txt` and `app1.js` are retained only as historical/rollback material and are not the production review entry point.
