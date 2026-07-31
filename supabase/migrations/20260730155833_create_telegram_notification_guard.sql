create table if not exists public.telegram_web_notifications (
  source_table text not null,
  source_id text not null,
  sent_count integer not null default 0 check (sent_count >= 0),
  created_at timestamptz not null default now(),
  primary key (source_table, source_id),
  check (
    source_table in (
      'summaries',
      'whatsapp_groups',
      'rating_submissions',
      'confessions',
      'student_projects',
      'course_requests',
      'feature_suggestions',
      'broken_link_reports'
    )
  ),
  check (length(source_id) between 1 and 100)
);

alter table public.telegram_web_notifications enable row level security;
revoke all on table public.telegram_web_notifications from anon, authenticated;

create index if not exists telegram_web_notifications_created_at_idx
on public.telegram_web_notifications (created_at desc);

comment on table public.telegram_web_notifications is
'Idempotency claims for public web-submit Telegram notifications. Service role only.';
