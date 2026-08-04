-- JAMMIN' Command Center
-- Allow authenticated users to retrieve payroll-period dates only.
-- This does not expose anyone else's submissions, rates, totals, or payroll records.
-- It adds no new tables and stores no additional data.

create or replace function public.get_visible_payroll_periods()
returns table (
    id uuid,
    label text,
    start_date date,
    end_date date,
    status text,
    is_active boolean
)
language sql
stable
security definer
set search_path = public
as $$
    select
        periods.id,
        periods.label,
        periods.start_date,
        periods.end_date,
        periods.status,
        periods.is_active
    from public.payroll_periods periods
    order by
        periods.is_active desc,
        periods.start_date desc
    limit 26;
$$;

grant execute
on function public.get_visible_payroll_periods()
to authenticated;

notify pgrst, 'reload schema';
