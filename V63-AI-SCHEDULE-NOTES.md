# UON Hub V63 — UON AI + Smart Schedule

## UON AI
- Local student context card for today's classes, next class, nearest task, and Focus minutes.
- Local quick actions that do not send schedule/tasks to the server automatically.
- Local commands: today's classes, next class, nearest task, study recommendation, daily plan, and Focus summary.
- `وش أذاكر الحين؟` recommends the nearest-task course first, otherwise the least-studied scheduled course from the last 7 days.
- Deep-link prompts from schedule/course tools are handled once, avoiding duplicate submissions.
- `أضف مهمة ... لمادة ...` prepares a task locally and opens Tasks for user review; nothing is saved until the student confirms.

## Smart Schedule
- Switchable Sunday–Thursday day view with per-day class counts.
- Current/upcoming/completed status for the real current day.
- Focus, course-center, and UON AI actions from each class.
- Existing conflict/free-window analysis retained and expanded with current/next class pulse and Focus study-plan suggestions.
- Focus accepts course/minutes query parameters so schedule actions open a prepared study session.

## Privacy
- Schedule, tasks, and Focus history stay in localStorage.
- Local assistant actions read those values in-browser only.
- No local student context is automatically added to the UON AI network request.
- Task creation requires explicit review and confirmation on `tasks.html`.

## Release gate
- Development branch only: `feature/ai-schedule-v63`.
- Do not merge to production until GitHub verification passes and Vercel build-rate-limit is cleared.
