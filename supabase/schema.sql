-- Jammin Command Center schema

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'user' check (role in ('admin', 'manager', 'user')),
  full_name text,
  phone text,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  dj_name text not null,
  amount numeric not null,
  event_name text not null,
  status text default 'Pending',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.shows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  dj_name text not null,
  venue_name text not null,
  start_time time,
  end_time time,
  show_pay_amount numeric,
  status text default 'Pending',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.manager_hours (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  manager_name text not null,
  hours numeric not null,
  event_name text not null,
  status text default 'Pending',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.equipment_hours (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  date date not null,
  submitted_by text not null,
  equipment_name text not null,
  hours numeric not null,
  event_name text not null,
  status text default 'Pending',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.equipment_checkouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  event_date date not null,
  event_name text not null,
  items_needed text[] default '{}',
  other_items text,
  status text default 'Pending',
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.equipment_repairs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  make text not null,
  model text not null,
  serial_number text not null,
  date_reported date default current_date,
  issue_description text not null,
  image_notes text,
  status text default 'Pending',
  created_at timestamptz default now()
);

create table if not exists public.notification_settings (
  form_type text primary key,
  recipients text[] not null default '{}',
  updated_by uuid references auth.users(id),
  updated_at timestamptz default now()
);

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

insert into public.notification_settings (form_type, recipients)
values
  ('Commission', array['steve@myjammindjs.com']),
  ('Show', array['steve@myjammindjs.com']),
  ('Manager Hours', array['steve@myjammindjs.com']),
  ('Equipment Hours', array['steve@myjammindjs.com']),
  ('Equipment Checkout', array['steve@myjammindjs.com']),
  ('Equipment Repair', array['steve@myjammindjs.com']),
  ('Default', array['steve@myjammindjs.com'])
on conflict (form_type)
do nothing;
