-- Explicit Data API grants. Do not grant anon for this app.

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.commissions to authenticated;
grant select, insert, update, delete on public.shows to authenticated;
grant select, insert, update, delete on public.manager_hours to authenticated;
grant select, insert, update, delete on public.equipment_hours to authenticated;
grant select, insert, update, delete on public.equipment_checkouts to authenticated;
grant select, insert, update, delete on public.equipment_repairs to authenticated;
grant select, insert, update, delete on public.notification_settings to authenticated;

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.commissions to service_role;
grant select, insert, update, delete on public.shows to service_role;
grant select, insert, update, delete on public.manager_hours to service_role;
grant select, insert, update, delete on public.equipment_hours to service_role;
grant select, insert, update, delete on public.equipment_checkouts to service_role;
grant select, insert, update, delete on public.equipment_repairs to service_role;
grant select, insert, update, delete on public.notification_settings to service_role;
