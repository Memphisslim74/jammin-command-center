-- JAMMIN' Command Center
-- Bookkeeper Payroll Workspace
-- Run once in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.payroll_periods (
    id uuid primary key default gen_random_uuid(),
    label text not null,
    start_date date not null,
    end_date date not null,
    status text not null default 'active'
        check (status in ('active', 'finalized')),
    is_active boolean not null default true,
    created_by uuid references auth.users(id) on delete set null,
    finalized_by uuid references auth.users(id) on delete set null,
    finalized_at timestamptz,
    reopened_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint payroll_period_dates_valid check (end_date >= start_date),
    constraint payroll_period_is_fourteen_days check ((end_date - start_date) = 13)
);

create unique index if not exists payroll_periods_one_active_idx
    on public.payroll_periods ((is_active))
    where is_active = true;

create index if not exists payroll_periods_start_date_idx
    on public.payroll_periods (start_date desc);

create table if not exists public.payroll_period_entries (
    id uuid primary key default gen_random_uuid(),
    payroll_period_id uuid not null references public.payroll_periods(id) on delete cascade,
    source_type text not null
        check (source_type in ('commission', 'show', 'manager_hours', 'equipment_hours')),
    source_id text not null,
    entry_date date not null,
    assigned_at timestamptz not null default now(),
    unique (source_type, source_id)
);

create index if not exists payroll_period_entries_period_idx
    on public.payroll_period_entries (payroll_period_id);

alter table public.commissions
    add column if not exists denial_reason text,
    add column if not exists denied_at timestamptz,
    add column if not exists denied_by uuid references auth.users(id) on delete set null;

alter table public.shows
    add column if not exists denial_reason text,
    add column if not exists denied_at timestamptz,
    add column if not exists denied_by uuid references auth.users(id) on delete set null;

alter table public.manager_hours
    add column if not exists denial_reason text,
    add column if not exists denied_at timestamptz,
    add column if not exists denied_by uuid references auth.users(id) on delete set null;

alter table public.equipment_hours
    add column if not exists denial_reason text,
    add column if not exists denied_at timestamptz,
    add column if not exists denied_by uuid references auth.users(id) on delete set null;

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
          and role in ('admin', 'manager')
          and coalesce(status, 'active') = 'active'
    );
$$;

create or replace function public.sync_payroll_period_entries(p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_period public.payroll_periods%rowtype;
    v_assigned_count integer := 0;
begin
    if not public.payroll_user_can_manage() then
        raise exception 'You do not have permission to manage payroll.';
    end if;

    select *
      into v_period
      from public.payroll_periods
     where id = p_period_id;

    if not found then
        raise exception 'Payroll period not found.';
    end if;

    if v_period.status = 'finalized' then
        return jsonb_build_object(
            'period_id', v_period.id,
            'assigned_count', (
                select count(*)
                from public.payroll_period_entries
                where payroll_period_id = v_period.id
            ),
            'status', v_period.status
        );
    end if;

    delete from public.payroll_period_entries
     where payroll_period_id = v_period.id;

    insert into public.payroll_period_entries (
        payroll_period_id,
        source_type,
        source_id,
        entry_date
    )
    select v_period.id, source_type, source_id, entry_date
    from (
        select 'commission'::text as source_type, id::text as source_id, date as entry_date
          from public.commissions
         where date between v_period.start_date and v_period.end_date

        union all

        select 'show'::text, id::text, date
          from public.shows
         where date between v_period.start_date and v_period.end_date

        union all

        select 'manager_hours'::text, id::text, date
          from public.manager_hours
         where date between v_period.start_date and v_period.end_date

        union all

        select 'equipment_hours'::text, id::text, date
          from public.equipment_hours
         where date between v_period.start_date and v_period.end_date
    ) entries_for_period
    where not exists (
        select 1
        from public.payroll_period_entries existing
        join public.payroll_periods existing_period
          on existing_period.id = existing.payroll_period_id
        where existing.source_type = entries_for_period.source_type
          and existing.source_id = entries_for_period.source_id
          and existing_period.status = 'finalized'
    )
    on conflict (source_type, source_id) do update
        set payroll_period_id = excluded.payroll_period_id,
            entry_date = excluded.entry_date,
            assigned_at = now();

    get diagnostics v_assigned_count = row_count;

    return jsonb_build_object(
        'period_id', v_period.id,
        'assigned_count', v_assigned_count,
        'status', v_period.status
    );
end;
$$;

create or replace function public.set_active_payroll_period(
    p_start_date date,
    p_end_date date,
    p_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_period_id uuid;
    v_result jsonb;
begin
    if not public.payroll_user_can_manage() then
        raise exception 'You do not have permission to manage payroll.';
    end if;

    if p_start_date is null or p_end_date is null then
        raise exception 'Payroll start and end dates are required.';
    end if;

    if (p_end_date - p_start_date) <> 13 then
        raise exception 'Payroll periods must cover exactly 14 calendar days.';
    end if;

    if exists (
        select 1
        from public.payroll_periods
        where status = 'finalized'
          and daterange(start_date, end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
    ) then
        raise exception 'These dates overlap a finalized payroll period.';
    end if;

    select id
      into v_period_id
      from public.payroll_periods
     where is_active = true
       and status = 'active'
     order by created_at desc
     limit 1
     for update;

    update public.payroll_periods
       set is_active = false,
           updated_at = now()
     where is_active = true
       and id is distinct from v_period_id;

    if v_period_id is null then
        insert into public.payroll_periods (
            label,
            start_date,
            end_date,
            status,
            is_active,
            created_by
        )
        values (
            coalesce(nullif(trim(p_label), ''), to_char(p_start_date, 'Mon DD, YYYY') || ' - ' || to_char(p_end_date, 'Mon DD, YYYY')),
            p_start_date,
            p_end_date,
            'active',
            true,
            auth.uid()
        )
        returning id into v_period_id;
    else
        update public.payroll_periods
           set label = coalesce(nullif(trim(p_label), ''), to_char(p_start_date, 'Mon DD, YYYY') || ' - ' || to_char(p_end_date, 'Mon DD, YYYY')),
               start_date = p_start_date,
               end_date = p_end_date,
               status = 'active',
               is_active = true,
               updated_at = now()
         where id = v_period_id;
    end if;

    delete from public.payroll_period_entries entries
    using public.payroll_periods periods
    where entries.payroll_period_id = periods.id
      and periods.status <> 'finalized'
      and periods.id <> v_period_id;

    v_result := public.sync_payroll_period_entries(v_period_id);

    return v_result || jsonb_build_object(
        'start_date', p_start_date,
        'end_date', p_end_date,
        'label', coalesce(nullif(trim(p_label), ''), to_char(p_start_date, 'Mon DD, YYYY') || ' - ' || to_char(p_end_date, 'Mon DD, YYYY'))
    );
end;
$$;

create or replace function public.finalize_payroll_period(p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_period public.payroll_periods%rowtype;
begin
    if not public.payroll_user_can_manage() then
        raise exception 'You do not have permission to manage payroll.';
    end if;

    perform public.sync_payroll_period_entries(p_period_id);

    update public.payroll_periods
       set status = 'finalized',
           is_active = false,
           finalized_at = now(),
           finalized_by = auth.uid(),
           updated_at = now()
     where id = p_period_id
       and status <> 'finalized'
    returning * into v_period;

    if not found then
        select * into v_period
          from public.payroll_periods
         where id = p_period_id;
    end if;

    if not found then
        raise exception 'Payroll period not found.';
    end if;

    return jsonb_build_object(
        'period_id', v_period.id,
        'status', v_period.status,
        'finalized_at', v_period.finalized_at
    );
end;
$$;

create or replace function public.reopen_payroll_period(p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_role text;
    v_period public.payroll_periods%rowtype;
begin
    select role
      into v_role
      from public.profiles
     where id = auth.uid()
       and coalesce(status, 'active') = 'active';

    if v_role <> 'admin' then
        raise exception 'Only an administrator can reopen finalized payroll.';
    end if;

    update public.payroll_periods
       set is_active = false,
           updated_at = now()
     where is_active = true;

    update public.payroll_periods
       set status = 'active',
           is_active = true,
           finalized_at = null,
           finalized_by = null,
           reopened_at = now(),
           updated_at = now()
     where id = p_period_id
    returning * into v_period;

    if not found then
        raise exception 'Payroll period not found.';
    end if;

    perform public.sync_payroll_period_entries(p_period_id);

    return jsonb_build_object(
        'period_id', v_period.id,
        'status', 'active',
        'is_active', true
    );
end;
$$;

alter table public.payroll_periods enable row level security;
alter table public.payroll_period_entries enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'payroll_periods'
          and policyname = 'Managers can view payroll periods'
    ) then
        create policy "Managers can view payroll periods"
            on public.payroll_periods
            for select
            to authenticated
            using (public.payroll_user_can_manage());
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'payroll_period_entries'
          and policyname = 'Managers can view payroll period entries'
    ) then
        create policy "Managers can view payroll period entries"
            on public.payroll_period_entries
            for select
            to authenticated
            using (public.payroll_user_can_manage());
    end if;
end
$$;

grant select on public.payroll_periods to authenticated;
grant select on public.payroll_period_entries to authenticated;
grant execute on function public.payroll_user_can_manage() to authenticated;
grant execute on function public.set_active_payroll_period(date, date, text) to authenticated;
grant execute on function public.sync_payroll_period_entries(uuid) to authenticated;
grant execute on function public.finalize_payroll_period(uuid) to authenticated;
grant execute on function public.reopen_payroll_period(uuid) to authenticated;

notify pgrst, 'reload schema';
