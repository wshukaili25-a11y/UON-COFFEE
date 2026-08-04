# UON Hub Security

## Implemented controls

- Strict browser security headers through `vercel.json`.
- Content Security Policy restricting scripts, styles, connections, frames, and objects.
- HTTPS enforcement with HSTS.
- Protection against clickjacking, MIME sniffing, unsafe referrers, and unwanted browser permissions.
- Runtime link validation that blocks unsafe protocols and embedded credentials.
- Automatic `noopener noreferrer` protection for external links.
- Client-side upload validation for allowed type, size, safe filename, and SHA-256 fingerprinting.
- Local security event log for blocked links, forms, and files.
- Administrative pages excluded from offline page caching.
- User-saved offline pages stored separately so normal cache cleanup does not delete them.

## Upload policy

Allowed client-side file types:

- PDF
- DOCX
- PPTX
- JPEG
- PNG
- WebP

Maximum file size: 25 MB.

Client-side validation is only an early protection layer. Supabase Storage policies and server-side validation must remain authoritative before a file is accepted or published.

## Reporting a vulnerability

Do not publish sensitive vulnerability details in a public issue. Contact the project owner privately with the affected page, reproduction steps, expected behavior, actual behavior, and screenshots with secrets removed.

## Secrets

Never commit Supabase service-role keys, Telegram bot tokens, passwords, private API keys, or session cookies. Public Supabase anon/publishable keys must still be protected by correct Row Level Security policies.
