# ANJIZ Management System — CIS Final Review Handoff

**Review build:** V29 resilient bootstrap + V27 final controls  
**Review URL:** https://anjiz-system-preview.vercel.app

## Scope
This build implements the front-end workflows requested in **ANJIZ New System.docx** for Admin, Instructor, Student/Visitor and Peer-Tutor/Trainee profiles. It is a functional CIS review environment. Production authentication, persistent storage and University integrations remain CIS responsibilities.

## Completed functional modules

### Admin
- Appointments calendar/day/list, search and status filters, attendance actions and export.
- Book for verified Student/Visitor with conflict checks and automatic/manual assignment.
- Attendance & Categorization: login/logout, present/late/absent, supervisor actions and FI handoff.
- Reports: Weekly, Monthly, Annual and Custom From/To; Users, Attendance, Courses, Levels and Special Cases.
- Disability star highlighting and blocked-student day/date/reason reporting.
- Survey, Rules & Regulations, Timetable and Announcements/Notifications.
- Timetable cycle upload (XLSX/XLS/CSV), validation, publish, archive and notifications.
- Automated Instructor Registration for all ANJIZ programs and Peer Tutorials.
- **System Setup & CIS Handoff:** Excel/CSV user verification, user directory/export, computer approval queue, audit/email outbox, backup and integration status.

### Instructor
- My Appointments.
- Computer requests for supervisor approval.
- Referred Students attendance/appointments and FI Advisory handoff.
- Personal attendance, login/logout, late/absent workflow and personal QR/barcode.
- Reports with period selection, email preparation and Excel export.
- Timetable, announcements and notifications.

### Student / Visitor
- Book services/programs and view appointments.
- Attendance history, export and email-history workflow.
- Official stamped-record review/export workflow.
- Timetable, announcements and notifications.
- QR/ID login workflow and personal ANJIZ QR.

### Peer-Tutor / Trainee
- My appointments and book-for-student.
- Availability and Admin assignments.
- Login/logout attendance, late/absent, supervisor notes and prepared email notification.
- Reports, timetable, announcements and personal QR/barcode.

## Automated registration rules
- **English:** maximum 2 instructors per slot; students 1–5 → Instructor 1; remaining students → Instructor 2; level/manual override supported.
- **Math & DL:** 1 instructor per slot.
- **Conversation / Workshops / Reading Club / Edu-games:** 1 instructor per slot.
- **Peer Tutorials:** assignment from peer availability plus Admin selection/override.

## Review-only services that are functional
- QR generation, QR verification links, camera scanner and image-file fallback.
- Fast Attendance scanner for Admin review.
- Demo Email Gateway with queued/sent history.
- FI handoff preparation and supervisor actions.
- Browser-side data persistence for review.
- Excel/CSV import/export.

## CIS production connections required
1. University SSO / identity provider and secure role provisioning.
2. Server-side database, RBAC and transactional persistence.
3. FI Advisory API/SSO/data contract.
4. University SMTP/Microsoft 365 approved sender service.
5. Server-side QR/identity signing and verification endpoint.
6. Official digital signature/verification for stamped records.
7. Approved Survey URL/content and Rules & Regulations text.
8. Approved production Excel templates/column contracts if fixed formats are required.
9. Security controls: secrets management, audit retention, backups, monitoring, privacy and data-retention policy.

## Runtime stability
- Production V29 bootstrap loads the stable ANJIZ base plus current runtime modules from the ANJIZ branch with GitHub/jsDelivr fallback.
- QR is installed before login interaction.
- V27 module loader is resilient: one optional module failing does not stop the rest of the system.
- No University production passwords, API secrets or SMTP credentials are stored in the browser.

## Demo review accounts
The public login UI does not display demo credentials. For CIS testing only:
- Admin: admin@anjiz.demo
- Instructor: instructor@anjiz.demo
- Student: student@anjiz.demo
- Visitor: visitor@anjiz.demo
- Peer-Tutor: peer@anjiz.demo
- Trainee: trainee@anjiz.demo
- Demo password: anjiz

## Recommended CIS review sequence
1. Admin → Dashboard / Appointments / Booking.
2. Attendance → late/absent supervisor workflow.
3. Reports → Custom From/To + Courses + Levels + Special Cases.
4. Others → Timetable / Announcements / Survey / Rules.
5. Automated Registration → English allocation and Peer availability.
6. System Setup → Excel Verification + Computer Approvals + CIS Integrations + Final Health.
7. Instructor → Computers / Referred Students / Attendance / Reports.
8. Student/Visitor → Booking / History / Official Record / QR.
9. Peer/Trainee → Availability / Booking / Attendance / Supervisor Notes.
