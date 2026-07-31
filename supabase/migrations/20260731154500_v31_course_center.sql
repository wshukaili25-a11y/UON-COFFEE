-- UON Hub V31: normalized course center schema and public read policies
create table if not exists public.course_prerequisites (
  course_code text not null references public.courses(code) on update cascade on delete cascade,
  prerequisite_code text not null references public.courses(code) on update cascade on delete restrict,
  minimum_grade text,
  created_at timestamptz not null default now(),
  primary key (course_code, prerequisite_code),
  constraint course_prerequisite_not_self check (course_code <> prerequisite_code)
);

create table if not exists public.course_resources (
  id uuid primary key default gen_random_uuid(),
  course_code text not null references public.courses(code) on update cascade on delete cascade,
  title text not null,
  description text,
  resource_type text not null default 'link' check (resource_type in ('link','book','video','website','file','other')),
  url text not null,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.courses add column if not exists level integer;
alter table public.courses add column if not exists learning_outcomes text;
alter table public.courses add column if not exists updated_at timestamptz not null default now();
alter table public.summaries add column if not exists course_code text;
alter table public.whatsapp_groups add column if not exists course_code text;
alter table public.rating_submissions add column if not exists course_code text;

create index if not exists courses_active_code_idx on public.courses(active, code);
create index if not exists courses_college_department_idx on public.courses(college, department);
create index if not exists summaries_course_code_idx on public.summaries(course_code) where approved = true;
create index if not exists whatsapp_groups_course_code_idx on public.whatsapp_groups(course_code) where approved = true;
create index if not exists rating_submissions_course_code_idx on public.rating_submissions(course_code) where status = 'approved';
create index if not exists course_resources_course_sort_idx on public.course_resources(course_code, sort_order) where active = true;

alter table public.course_prerequisites enable row level security;
alter table public.course_resources enable row level security;
drop policy if exists "Public reads course prerequisites" on public.course_prerequisites;
create policy "Public reads course prerequisites" on public.course_prerequisites for select using (true);
drop policy if exists "Public reads active course resources" on public.course_resources;
create policy "Public reads active course resources" on public.course_resources for select using (active = true);

comment on table public.course_prerequisites is 'Prerequisite graph used by the V31 course center.';
comment on table public.course_resources is 'Curated public learning resources attached to a course.';
