-- Jammin Command Center RLS policies

alter table public.profiles enable row level security;
alter table public.commissions enable row level security;
alter table public.shows enable row level security;
alter table public.manager_hours enable row level security;
alter table public.equipment_hours enable row level security;
alter table public.equipment_checkouts enable row level security;
alter table public.equipment_repairs enable row level security;
alter table public.notification_settings enable row level security;

-- Profiles
create policy if not exists "Users can read own profile" on public.profiles
for select to authenticated using (id = auth.uid());

create policy if not exists "Admins and managers can read profiles" on public.profiles
for select to authenticated using (public.current_user_role() in ('admin', 'manager'));

create policy if not exists "Users can update own profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy if not exists "Admins can manage profiles" on public.profiles
for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');

-- Helper pattern for user-owned submission tables.
create policy if not exists "Users can read own commissions" on public.commissions
for select to authenticated using (user_id = auth.uid());
create policy if not exists "Users can insert own commissions" on public.commissions
for insert to authenticated with check (user_id = auth.uid());
create policy if not exists "Admins and managers can read all commissions" on public.commissions
for select to authenticated using (public.current_user_role() in ('admin', 'manager'));
create policy if not exists "Admins can update commissions" on public.commissions
for update to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy if not exists "Admins can delete commissions" on public.commissions
for delete to authenticated using (public.current_user_role() = 'admin');

create policy if not exists "Users can read own shows" on public.shows
for select to authenticated using (user_id = auth.uid());
create policy if not exists "Users can insert own shows" on public.shows
for insert to authenticated with check (user_id = auth.uid());
create policy if not exists "Admins and managers can read all shows" on public.shows
for select to authenticated using (public.current_user_role() in ('admin', 'manager'));
create policy if not exists "Admins can update shows" on public.shows
for update to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy if not exists "Admins can delete shows" on public.shows
for delete to authenticated using (public.current_user_role() = 'admin');

create policy if not exists "Users can read own manager hours" on public.manager_hours
for select to authenticated using (user_id = auth.uid());
create policy if not exists "Users can insert own manager hours" on public.manager_hours
for insert to authenticated with check (user_id = auth.uid());
create policy if not exists "Admins and managers can read all manager hours" on public.manager_hours
for select to authenticated using (public.current_user_role() in ('admin', 'manager'));
create policy if not exists "Admins can update manager hours" on public.manager_hours
for update to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy if not exists "Admins can delete manager hours" on public.manager_hours
for delete to authenticated using (public.current_user_role() = 'admin');

create policy if not exists "Users can read own equipment hours" on public.equipment_hours
for select to authenticated using (user_id = auth.uid());
create policy if not exists "Users can insert own equipment hours" on public.equipment_hours
for insert to authenticated with check (user_id = auth.uid());
create policy if not exists "Admins and managers can read all equipment hours" on public.equipment_hours
for select to authenticated using (public.current_user_role() in ('admin', 'manager'));
create policy if not exists "Admins can update equipment hours" on public.equipment_hours
for update to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy if not exists "Admins can delete equipment hours" on public.equipment_hours
for delete to authenticated using (public.current_user_role() = 'admin');

create policy if not exists "Users can read own equipment checkouts" on public.equipment_checkouts
for select to authenticated using (user_id = auth.uid());
create policy if not exists "Users can insert own equipment checkouts" on public.equipment_checkouts
for insert to authenticated with check (user_id = auth.uid());
create policy if not exists "Admins and managers can read all equipment checkouts" on public.equipment_checkouts
for select to authenticated using (public.current_user_role() in ('admin', 'manager'));
create policy if not exists "Admins can update equipment checkouts" on public.equipment_checkouts
for update to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy if not exists "Admins can delete equipment checkouts" on public.equipment_checkouts
for delete to authenticated using (public.current_user_role() = 'admin');

create policy if not exists "Users can read own equipment repairs" on public.equipment_repairs
for select to authenticated using (user_id = auth.uid());
create policy if not exists "Users can insert own equipment repairs" on public.equipment_repairs
for insert to authenticated with check (user_id = auth.uid());
create policy if not exists "Admins and managers can read all equipment repairs" on public.equipment_repairs
for select to authenticated using (public.current_user_role() in ('admin', 'manager'));
create policy if not exists "Admins can update equipment repairs" on public.equipment_repairs
for update to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
create policy if not exists "Admins can delete equipment repairs" on public.equipment_repairs
for delete to authenticated using (public.current_user_role() = 'admin');

create policy if not exists "Admins can manage notification settings" on public.notification_settings
for all to authenticated using (public.current_user_role() = 'admin') with check (public.current_user_role() = 'admin');
