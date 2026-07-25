-- JAMMIN Command Center: DJ training foundation
-- Adds configurable training categories, per-DJ sign-off records, audit history,
-- and row-level permissions for administrators, managers, and DJs.

begin;

create table if not exists public.training_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_required boolean not null default true,
  admin_only_signoff boolean not null default false,
  allows_custom_label boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_categories_code_format
    check (code ~ '^[a-z0-9_]+$')
);

create table if not exists public.staff_training (
  id uuid primary key default gen_random_uuid(),
  dj_user_id uuid not null references public.profiles(id) on delete cascade,
  training_category_id uuid not null references public.training_categories(id) on delete restrict,
  status text not null default 'incomplete'
    check (status in ('incomplete', 'complete')),
  completion_date date,
  completed_at timestamptz,
  completed_by_user_id uuid references public.profiles(id) on delete set null,
  completed_by_name text,
  custom_label text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_training_completion_fields check (
    (status = 'incomplete')
    or (
      status = 'complete'
      and completion_date is not null
      and completed_at is not null
      and completed_by_name is not null
    )
  )
);

-- Standard categories allow one record per DJ. "Other Event Type" can have
-- multiple records as long as each custom label is different.
create unique index if not exists staff_training_unique_item
  on public.staff_training (
    dj_user_id,
    training_category_id,
    coalesce(lower(trim(custom_label)), '')
  );

create index if not exists staff_training_dj_user_idx
  on public.staff_training (dj_user_id);

create index if not exists staff_training_category_idx
  on public.staff_training (training_category_id);

create index if not exists staff_training_status_idx
  on public.staff_training (status);

create table if not exists public.training_history (
  id uuid primary key default gen_random_uuid(),
  training_record_id uuid references public.staff_training(id) on delete set null,
  dj_user_id uuid not null references public.profiles(id) on delete cascade,
  training_category_id uuid references public.training_categories(id) on delete set null,
  training_category_name text not null,
  custom_label text,
  action text not null
    check (action in ('created', 'completed', 'reopened', 'updated')),
  previous_status text,
  new_status text not null,
  previous_completion_date date,
  new_completion_date date,
  performed_by_user_id uuid references public.profiles(id) on delete set null,
  performed_by_name text,
  notes text,
  record_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists training_history_dj_user_idx
  on public.training_history (dj_user_id, created_at desc);

create index if not exists training_history_record_idx
  on public.training_history (training_record_id, created_at desc);

create or replace function public.set_training_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.validate_staff_training_signoff()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  actor_name text;
  category_name text;
  category_admin_only boolean;
  category_allows_custom_label boolean;
begin
  select role, coalesce(nullif(trim(full_name), ''), email, 'Unknown user')
    into actor_role, actor_name
  from public.profiles
  where id = actor_id;

  select name, admin_only_signoff, allows_custom_label
    into category_name, category_admin_only, category_allows_custom_label
  from public.training_categories
  where id = new.training_category_id
    and active = true;

  if category_name is null then
    raise exception 'The selected training category is missing or inactive.';
  end if;

  -- Authenticated browser users must be administrators or managers.
  -- Service-role operations have no auth.uid() and remain available for imports.
  if actor_id is not null then
    if actor_role not in ('admin', 'manager') then
      raise exception 'Only administrators and managers can update DJ training.';
    end if;

    if actor_role = 'manager' and new.dj_user_id = actor_id then
      raise exception 'Managers cannot approve their own training.';
    end if;

    if actor_role = 'manager' and category_admin_only then
      raise exception 'This training item requires administrator sign-off.';
    end if;
  end if;

  if category_allows_custom_label then
    new.custom_label := nullif(trim(new.custom_label), '');
    if new.custom_label is null then
      raise exception 'A label is required for Other Event Type training.';
    end if;
  else
    new.custom_label := null;
  end if;

  if new.status = 'complete' then
    if tg_op = 'INSERT' or old.status is distinct from 'complete' then
      new.completion_date := coalesce(new.completion_date, current_date);
      new.completed_at := coalesce(new.completed_at, now());

      if actor_id is not null then
        new.completed_by_user_id := actor_id;
        new.completed_by_name := actor_name;
      else
        if new.completed_by_name is null then
          select coalesce(nullif(trim(full_name), ''), email, 'System')
            into new.completed_by_name
          from public.profiles
          where id = new.completed_by_user_id;
        end if;
        new.completed_by_name := coalesce(new.completed_by_name, 'System');
      end if;
    else
      new.completion_date := coalesce(new.completion_date, old.completion_date, current_date);
      new.completed_at := coalesce(new.completed_at, old.completed_at, now());

      -- Managers may update notes or the completion date, but they cannot
      -- rewrite who originally signed off on an already-completed item.
      if actor_role = 'manager' then
        new.completed_by_user_id := old.completed_by_user_id;
        new.completed_by_name := old.completed_by_name;
      else
        new.completed_by_user_id := coalesce(new.completed_by_user_id, old.completed_by_user_id);
        new.completed_by_name := coalesce(new.completed_by_name, old.completed_by_name, actor_name, 'System');
      end if;
    end if;
  else
    new.completion_date := null;
    new.completed_at := null;
    new.completed_by_user_id := null;
    new.completed_by_name := null;
  end if;

  return new;
end;
$$;

create or replace function public.log_staff_training_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  history_action text;
  actor_id uuid := auth.uid();
  actor_name text;
  category_name text;
begin
  select name into category_name
  from public.training_categories
  where id = new.training_category_id;

  select coalesce(nullif(trim(full_name), ''), email, 'System')
    into actor_name
  from public.profiles
  where id = actor_id;

  if tg_op = 'INSERT' then
    history_action := case when new.status = 'complete' then 'completed' else 'created' end;
  elsif old.status is distinct from new.status and new.status = 'complete' then
    history_action := 'completed';
  elsif old.status is distinct from new.status and new.status = 'incomplete' then
    history_action := 'reopened';
  else
    history_action := 'updated';
  end if;

  insert into public.training_history (
    training_record_id,
    dj_user_id,
    training_category_id,
    training_category_name,
    custom_label,
    action,
    previous_status,
    new_status,
    previous_completion_date,
    new_completion_date,
    performed_by_user_id,
    performed_by_name,
    notes,
    record_snapshot
  ) values (
    new.id,
    new.dj_user_id,
    new.training_category_id,
    coalesce(category_name, 'Unknown category'),
    new.custom_label,
    history_action,
    case when tg_op = 'UPDATE' then old.status else null end,
    new.status,
    case when tg_op = 'UPDATE' then old.completion_date else null end,
    new.completion_date,
    coalesce(actor_id, new.completed_by_user_id),
    coalesce(actor_name, new.completed_by_name, 'System'),
    new.notes,
    to_jsonb(new)
  );

  return new;
end;
$$;

drop trigger if exists training_categories_set_updated_at on public.training_categories;
create trigger training_categories_set_updated_at
before update on public.training_categories
for each row execute function public.set_training_updated_at();

drop trigger if exists staff_training_validate_signoff on public.staff_training;
create trigger staff_training_validate_signoff
before insert or update on public.staff_training
for each row execute function public.validate_staff_training_signoff();

drop trigger if exists staff_training_set_updated_at on public.staff_training;
create trigger staff_training_set_updated_at
before update on public.staff_training
for each row execute function public.set_training_updated_at();

drop trigger if exists staff_training_write_history on public.staff_training;
create trigger staff_training_write_history
after insert or update on public.staff_training
for each row execute function public.log_staff_training_history();

insert into public.training_categories (
  code,
  name,
  description,
  is_required,
  admin_only_signoff,
  allows_custom_label,
  sort_order
) values
  ('trivia_nights', 'Trivia Nights', 'Training for hosting JAMMIN trivia events.', true, false, false, 10),
  ('feud', 'Feud', 'Training for hosting Feud-style events.', true, false, false, 20),
  ('music_bingo', 'Music Bingo', 'Training for hosting Music Bingo events.', true, false, false, 30),
  ('weddings', 'Weddings', 'Wedding DJ training and workflow sign-off.', true, false, false, 40),
  ('karaoke', 'Karaoke', 'Karaoke hosting and equipment training.', true, false, false, 50),
  ('mitzvahs', 'Mitzvahs', 'Mitzvah event training and workflow sign-off.', true, false, false, 60),
  ('corporate_events', 'Corporate Events', 'Corporate event training and workflow sign-off.', true, false, false, 70),
  ('school_dances', 'School Dances', 'School dance training and workflow sign-off.', true, false, false, 80),
  ('google_classroom', 'Google Classroom', 'Completion of the assigned Google Classroom material.', true, true, false, 90),
  ('other_event_type', 'Other Event Type', 'Optional training for an additional named event type.', false, false, true, 100)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  admin_only_signoff = excluded.admin_only_signoff,
  allows_custom_label = excluded.allows_custom_label,
  sort_order = excluded.sort_order,
  updated_at = now();

alter table public.training_categories enable row level security;
alter table public.staff_training enable row level security;
alter table public.training_history enable row level security;

drop policy if exists "Authenticated users can read active training categories" on public.training_categories;
create policy "Authenticated users can read active training categories"
on public.training_categories
for select to authenticated
using (active = true or public.current_user_role() in ('admin', 'manager'));

drop policy if exists "Admins can manage training categories" on public.training_categories;
create policy "Admins can manage training categories"
on public.training_categories
for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "DJs can read their own training" on public.staff_training;
create policy "DJs can read their own training"
on public.staff_training
for select to authenticated
using (dj_user_id = auth.uid());

drop policy if exists "Admins and managers can read all DJ training" on public.staff_training;
create policy "Admins and managers can read all DJ training"
on public.staff_training
for select to authenticated
using (public.current_user_role() in ('admin', 'manager'));

drop policy if exists "Admins can manage all DJ training" on public.staff_training;
create policy "Admins can manage all DJ training"
on public.staff_training
for all to authenticated
using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

drop policy if exists "Managers can create training sign-offs" on public.staff_training;
create policy "Managers can create training sign-offs"
on public.staff_training
for insert to authenticated
with check (
  public.current_user_role() = 'manager'
  and dj_user_id <> auth.uid()
  and exists (
    select 1
    from public.training_categories category
    where category.id = training_category_id
      and category.active = true
      and category.admin_only_signoff = false
  )
);

drop policy if exists "Managers can update training sign-offs" on public.staff_training;
create policy "Managers can update training sign-offs"
on public.staff_training
for update to authenticated
using (
  public.current_user_role() = 'manager'
  and dj_user_id <> auth.uid()
  and exists (
    select 1
    from public.training_categories category
    where category.id = training_category_id
      and category.active = true
      and category.admin_only_signoff = false
  )
)
with check (
  public.current_user_role() = 'manager'
  and dj_user_id <> auth.uid()
  and exists (
    select 1
    from public.training_categories category
    where category.id = training_category_id
      and category.active = true
      and category.admin_only_signoff = false
  )
);

drop policy if exists "DJs can read their own training history" on public.training_history;
create policy "DJs can read their own training history"
on public.training_history
for select to authenticated
using (dj_user_id = auth.uid());

drop policy if exists "Admins and managers can read all training history" on public.training_history;
create policy "Admins and managers can read all training history"
on public.training_history
for select to authenticated
using (public.current_user_role() in ('admin', 'manager'));

grant select on public.training_categories to authenticated;
grant insert, update, delete on public.training_categories to authenticated;
grant select, insert, update, delete on public.staff_training to authenticated;
grant select on public.training_history to authenticated;

grant select, insert, update, delete on public.training_categories to service_role;
grant select, insert, update, delete on public.staff_training to service_role;
grant select, insert, update, delete on public.training_history to service_role;

commit;
