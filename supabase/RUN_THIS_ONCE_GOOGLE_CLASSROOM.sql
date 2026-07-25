-- JAMMIN Command Center: Google Classroom integration
-- Stores one teacher-authorized Classroom connection, imported course content,
-- student/profile matches, and cached submission progress.

begin;

create table if not exists public.google_classroom_connections (
  id text primary key default 'primary' check (id = 'primary'),
  authorized_email text not null,
  authorized_name text,
  connected_by_user_id uuid references public.profiles(id) on delete set null,
  token_ciphertext text not null,
  token_expires_at timestamptz,
  granted_scopes text[] not null default '{}',
  course_id text,
  course_name text,
  course_section text,
  course_link text,
  status text not null default 'connected'
    check (status in ('connected', 'syncing', 'error', 'disconnected')),
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.google_classroom_students (
  id uuid primary key default gen_random_uuid(),
  connection_id text not null default 'primary'
    references public.google_classroom_connections(id) on delete cascade,
  course_id text not null,
  google_user_id text not null,
  email text,
  full_name text,
  photo_url text,
  profile_id uuid references public.profiles(id) on delete set null,
  match_method text check (match_method in ('email', 'manual')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, course_id, google_user_id)
);

create unique index if not exists google_classroom_students_profile_unique
  on public.google_classroom_students (connection_id, course_id, profile_id)
  where profile_id is not null;

create index if not exists google_classroom_students_profile_idx
  on public.google_classroom_students (profile_id);

create index if not exists google_classroom_students_email_idx
  on public.google_classroom_students (lower(email));

create table if not exists public.google_classroom_topics (
  id uuid primary key default gen_random_uuid(),
  connection_id text not null default 'primary'
    references public.google_classroom_connections(id) on delete cascade,
  course_id text not null,
  google_topic_id text not null,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, course_id, google_topic_id)
);

create table if not exists public.google_classroom_items (
  id uuid primary key default gen_random_uuid(),
  connection_id text not null default 'primary'
    references public.google_classroom_connections(id) on delete cascade,
  course_id text not null,
  item_type text not null check (item_type in ('coursework', 'material')),
  google_item_id text not null,
  google_topic_id text,
  title text not null,
  description text,
  state text,
  work_type text,
  alternate_link text,
  due_date date,
  due_time text,
  max_points numeric,
  materials jsonb not null default '[]'::jsonb,
  creation_time timestamptz,
  update_time timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, course_id, item_type, google_item_id)
);

create index if not exists google_classroom_items_course_idx
  on public.google_classroom_items (connection_id, course_id, item_type, active);

create table if not exists public.google_classroom_submissions (
  id uuid primary key default gen_random_uuid(),
  connection_id text not null default 'primary'
    references public.google_classroom_connections(id) on delete cascade,
  course_id text not null,
  classroom_item_id uuid not null
    references public.google_classroom_items(id) on delete cascade,
  classroom_student_id uuid not null
    references public.google_classroom_students(id) on delete cascade,
  google_submission_id text not null,
  state text,
  late boolean not null default false,
  assigned_grade numeric,
  draft_grade numeric,
  alternate_link text,
  creation_time timestamptz,
  update_time timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, course_id, google_submission_id)
);

create index if not exists google_classroom_submissions_student_idx
  on public.google_classroom_submissions (classroom_student_id, update_time desc);

create or replace function public.set_google_classroom_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists google_classroom_connections_updated_at on public.google_classroom_connections;
create trigger google_classroom_connections_updated_at
before update on public.google_classroom_connections
for each row execute function public.set_google_classroom_updated_at();

drop trigger if exists google_classroom_students_updated_at on public.google_classroom_students;
create trigger google_classroom_students_updated_at
before update on public.google_classroom_students
for each row execute function public.set_google_classroom_updated_at();

drop trigger if exists google_classroom_topics_updated_at on public.google_classroom_topics;
create trigger google_classroom_topics_updated_at
before update on public.google_classroom_topics
for each row execute function public.set_google_classroom_updated_at();

drop trigger if exists google_classroom_items_updated_at on public.google_classroom_items;
create trigger google_classroom_items_updated_at
before update on public.google_classroom_items
for each row execute function public.set_google_classroom_updated_at();

drop trigger if exists google_classroom_submissions_updated_at on public.google_classroom_submissions;
create trigger google_classroom_submissions_updated_at
before update on public.google_classroom_submissions
for each row execute function public.set_google_classroom_updated_at();

alter table public.google_classroom_connections enable row level security;
alter table public.google_classroom_students enable row level security;
alter table public.google_classroom_topics enable row level security;
alter table public.google_classroom_items enable row level security;
alter table public.google_classroom_submissions enable row level security;

-- No authenticated policy is intentionally created for the connection table.
-- It contains encrypted tokens and is accessed only through service-role Edge Functions.

drop policy if exists "Admins and managers can read Classroom students" on public.google_classroom_students;
create policy "Admins and managers can read Classroom students"
on public.google_classroom_students
for select to authenticated
using (public.current_user_role() in ('admin', 'manager'));

drop policy if exists "DJs can read their Classroom match" on public.google_classroom_students;
create policy "DJs can read their Classroom match"
on public.google_classroom_students
for select to authenticated
using (profile_id = auth.uid());

drop policy if exists "Authenticated users can read Classroom topics" on public.google_classroom_topics;
create policy "Authenticated users can read Classroom topics"
on public.google_classroom_topics
for select to authenticated
using (true);

drop policy if exists "Authenticated users can read active Classroom items" on public.google_classroom_items;
create policy "Authenticated users can read active Classroom items"
on public.google_classroom_items
for select to authenticated
using (active = true);

drop policy if exists "Admins and managers can read Classroom submissions" on public.google_classroom_submissions;
create policy "Admins and managers can read Classroom submissions"
on public.google_classroom_submissions
for select to authenticated
using (public.current_user_role() in ('admin', 'manager'));

drop policy if exists "DJs can read their Classroom submissions" on public.google_classroom_submissions;
create policy "DJs can read their Classroom submissions"
on public.google_classroom_submissions
for select to authenticated
using (
  exists (
    select 1
    from public.google_classroom_students student
    where student.id = classroom_student_id
      and student.profile_id = auth.uid()
  )
);

commit;
