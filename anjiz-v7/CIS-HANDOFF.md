# ANJIZ Management System — CIS Review Handoff

Review build: Front-end functional prototype / CIS implementation handoff.

## Purpose
This build reflects the workflow and role requirements supplied in **ANJIZ New System.docx**. It is intentionally front-end focused. Persistent production data, university authentication, institutional email delivery, FI Advisory connectivity and official identity verification are integration responsibilities for CIS.

## Implemented workflow coverage

### Admin
- Appointments calendar, day view, filters, details, attendance actions and Excel export.
- Booking appointments for students/visitors with service, date, slot, assignment and validation.
- Attendance dashboard covering instructors, peer-tutors, trainees and visitors; login/logout, late/absent follow-up and categorization.
- Reports: weekly, monthly, annual and custom From/To; users, attendance, courses, levels and special cases.
- Students with disabilities are identified with a star; blocked students include date/day/reason.
- Timetable cycle management: upload XLSX/XLS/CSV, validation, publish, archive, notifications and exports.
- Announcements and notification center with audience/priority controls and prepared email queue.
- Survey and Rules & Regulations configuration/publishing areas.
- Automated instructor registration rules for English, Math & DL, Conversation, Workshops, Reading Club, Edu-games and Peer Tutorials.
- Excel/CSV user verification workflow.

### Instructor
- My Appointments.
- ANJIZ computer booking requests for supervisor approval.
- Referred Students attendance/appointments with FI Advisory integration handoff.
- Sign-in/sign-out attendance, late/absent workflow and personal barcode.
- My Reports with period filtering, email preparation and Excel export.
- Timetable, announcements and notifications.

### Student / Visitor
- Book ANJIZ services and programs.
- My Appointments and attendance history.
- Email attendance-history preparation and Excel export.
- Stamped official-record preview/export workflow; final institutional digital signature/verification to be supplied by CIS.
- Timetable, announcements, notifications and personal ANJIZ barcode/secure identity handoff.

### Peer-Tutor / Trainee
- My appointments and book-for-student workflow.
- Availability management and admin assignments.
- Attendance with login/logout, late/absent status and personal barcode.
- Supervisor notes/comments and prepared email notification workflow.
- Reports, timetable, announcements and notifications.

## Automated registration rules represented
- **FI Remedial Support (English):** maximum two instructors on the same slot; first five students allocated to Instructor 1, subsequent students to Instructor 2; level/manual assignment supported.
- **FI Remedial Support (Math & DL):** one instructor per slot.
- **Conversation / Workshops / Reading Club / Edu-games:** one instructor per slot.
- **Peer Tutorials:** peer-tutor selection based on availability, with admin assignment/override support.

## CIS integration points — production implementation required
1. University SSO / secure authentication and role provisioning.
2. Production database and audit retention; the review build uses browser-side prototype state.
3. FI Advisory API/SSO/data contract for referrals and attendance handoff.
4. Institutional SMTP/email service and approved sender identities.
5. Official ANJIZ Survey URL/form and approved Rules & Regulations content.
6. Official timetable/user Excel templates and column contract if CIS requires fixed schemas.
7. Barcode/QR identity security, signing and verification rules.
8. Official stamped record digital signature / verification endpoint.
9. Data protection, authorization, retention, backup, monitoring and production logging policies.

## Review note
Actions labeled **Prepare Email**, **Email Report**, **FI handoff**, **queue** or similar represent the UI/business workflow and are not claims of a live institutional backend connection. CIS should replace these handoff points with approved university services.

## Review URL
https://anjiz-system-preview.vercel.app
