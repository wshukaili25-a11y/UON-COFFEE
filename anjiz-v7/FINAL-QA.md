# ANJIZ — Final Requirements Matrix

| Requirement | Review implementation | Status |
|---|---|---|
| Admin view appointments | Calendar, day view, list, filters and details | ✅ |
| Admin books for students | Verified Student/Visitor booking workflow | ✅ |
| Attendance + categorization | Role/status/date/search dashboard | ✅ |
| Login/logout dates & days | Attendance timeline and records | ✅ |
| Late/absent to FI | Supervisor action + FI handoff/email preparation | ✅ Review workflow |
| Reports weekly/monthly/annual | Presets + Custom From/To | ✅ |
| Disability students | Star highlighting in reports | ✅ |
| Blocked students | Highlight + day/date/reason | ✅ |
| Courses report | Reports → Courses | ✅ |
| Levels report | Reports → Levels | ✅ |
| Survey | Config/publish workflow | ✅ |
| Rules & Regulations | Draft/version/publish workflow | ✅ |
| Timetable each cycle | XLSX/XLS/CSV import, validate, publish, archive | ✅ |
| Announcements | Audience, priority, notifications and email queue | ✅ |
| Email/Excel reports | Prepared email + Excel/CSV export | ✅ Review workflow |
| English automated registration | 2 instructors; first 5 to #1, rest to #2; manual override | ✅ |
| Math & DL | Single instructor per slot | ✅ |
| Conversation/Workshops/Reading/Edu-games | Single instructor per slot | ✅ |
| Peer tutorials | Availability + Admin assignment | ✅ |
| Instructor appointments | My Appointments | ✅ |
| Instructor computer request | Request + Admin approve/reject | ✅ |
| Referred students | Attendance/appointments + FI handoff | ✅ |
| Instructor attendance | Sign in/out + late/absent + supervisor follow-up | ✅ |
| Instructor reports | Period reports + export/email | ✅ |
| Instructor barcode | Personal QR/barcode and scanner | ✅ |
| Excel user verification | Admin System Setup upload/verify/export | ✅ |
| Student/Visitor booking | Booking workflow | ✅ |
| Attendance history | History + export/email | ✅ |
| Official stamped record | Review/export workflow | ✅; production signature by CIS |
| Student timetable/announcements | Profile access + notifications | ✅ |
| Scan ID/barcode login | iOS/Safari camera + image fallback | ✅ |
| Peer/Trainee appointments | My appointments + book for student | ✅ |
| Peer/Trainee attendance | Login/logout, late/absent | ✅ |
| Supervisor comments | Note/comment + prepared email | ✅ |
| Peer/Trainee reports | Period reports + export/email | ✅ |
| Peer/Trainee barcode | Personal QR/barcode | ✅ |
| Production SSO/database/FI/SMTP | CIS integration points | ⏳ CIS |

## Important distinction
Items marked **Review workflow** are fully demonstrable in the front end but do not claim a live University backend. Production email delivery, FI Advisory connectivity, secure identity signing and persistent server-side storage must be connected by CIS.
