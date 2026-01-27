create table if not exists public.labor_logs (
    id uuid default gen_random_uuid() primary key,
    work_order_id uuid references public.work_orders(id) on delete cascade,
    client_id uuid,
    employee_id uuid,
    phase text,
    start_time timestamptz,
    end_time timestamptz,
    duration_minutes numeric,
    hourly_rate_snapshot numeric,
    calculated_labor_cost numeric,
    workshop_id uuid default auth.uid(),
    created_at timestamptz default now()
);

alter table public.labor_logs enable row level security;

create policy "Enable read access for all users"
on public.labor_logs for select
using (true);

create policy "Enable insert for authenticated users only"
on public.labor_logs for insert
with check (auth.role() = 'authenticated');
