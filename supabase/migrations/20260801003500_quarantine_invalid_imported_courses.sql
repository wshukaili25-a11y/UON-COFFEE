create table if not exists public.course_import_quarantine (
  source_course_id uuid primary key,
  course_code text,
  reason text not null,
  snapshot jsonb not null,
  quarantined_at timestamptz not null default now()
);

alter table public.course_import_quarantine enable row level security;

insert into public.course_import_quarantine(source_course_id,course_code,reason,snapshot)
select c.id,c.code,
       case
         when c.code !~ '^[A-Z]{2,5}[0-9]{3}[A-Z]?$' then 'invalid_course_code'
         else 'corrupted_import_text'
       end,
       to_jsonb(c)
from public.courses c
where c.code !~ '^[A-Z]{2,5}[0-9]{3}[A-Z]?$'
   or coalesce(c.name_ar,'') ~ '[[:cntrl:]]'
on conflict (source_course_id) do update
set course_code=excluded.course_code,
    reason=excluded.reason,
    snapshot=excluded.snapshot;

update public.courses
set active=false,
    status='inactive',
    updated_at=now()
where code !~ '^[A-Z]{2,5}[0-9]{3}[A-Z]?$'
   or coalesce(name_ar,'') ~ '[[:cntrl:]]';