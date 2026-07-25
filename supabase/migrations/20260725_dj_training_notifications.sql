-- JAMMIN Command Center: DJ training completion notification log

begin;

create table if not exists public.training_completion_notifications (
  id uuid primary key default gen_random_uuid(),
  dj_user_id uuid not null references public.profiles(id) on delete cascade,
  sent_by_user_id uuid references public.profiles(id) on delete set null,
  sent_by_name text,
  sent_to text not null,
  manager_recipients text[] not null default '{}',
  completed_items jsonb not null default '[]'::jsonb,
  delivery_status text not null default 'sent'
    check (delivery_status in ('sent', 'failed')),
  resend_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists training_completion_notifications_dj_idx
  on public.training_completion_notifications (dj_user_id, created_at desc);

alter table public.training_completion_notifications enable row level security;

drop policy if exists "DJs can read their own training completion emails" on public.training_completion_notifications;
create policy "DJs can read their own training completion emails"
on public.training_completion_notifications
for select to authenticated
using (dj_user_id = auth.uid());

drop policy if exists "Admins and managers can read training completion emails" on public.training_completion_notifications;
create policy "Admins and managers can read training completion emails"
on public.training_completion_notifications
for select to authenticated
using (public.current_user_role() in ('admin', 'manager'));

grant select on public.training_completion_notifications to authenticated;
grant select, insert, update, delete on public.training_completion_notifications to service_role;

commit;
