-- JAMMIN' Command Center
-- Restrict the full Staff Payroll workspace to administrators and explicitly
-- designated payroll users. Regular managers keep management/training access,
-- but do not receive access to the accounting workspace.

alter table public.profiles
    add column if not exists payroll_access boolean not null default false;

-- Designate Lindsay as the bookkeeper without changing her manager role.
update public.profiles
set payroll_access = true
where lower(email) = lower('lindsay@myjammindjs.com');

create or replace function public.payroll_user_can_manage()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and coalesce(status, 'active') = 'active'
          and (
              role = 'admin'
              or payroll_access = true
          )
    );
$$;

grant execute
on function public.payroll_user_can_manage()
to authenticated;

notify pgrst, 'reload schema';
