-- 1. Employees Table
create table if not exists public.employees (
  id uuid primary key,
  workshop_id uuid references auth.users(id) on delete cascade not null,
  full_name text not null,
  role text,
  department text,
  email text,
  mobile text,
  annual_salary numeric default 0,
  es_productivo boolean default false,
  porcentaje_productivo numeric default 0,
  active boolean default true,
  skills text[],
  raw_data jsonb,
  created_at timestamptz default now()
);

alter table public.employees enable row level security;

create policy "Users can manage their own employees"
  on public.employees for all
  using (auth.uid() = workshop_id)
  with check (auth.uid() = workshop_id);


-- 2. Hour Cost Storage (Cost Calculator)
create table if not exists public.hour_rate_storage (
  id uuid default gen_random_uuid() primary key,
  workshop_id uuid references auth.users(id) on delete cascade not null,
  periodo text not null,
  
  -- Flexible JSON storage for the calculator state
  payload_input jsonb,
  resultado_calculo jsonb,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  constraint unique_period_workshop unique (workshop_id, periodo)
);

alter table public.hour_rate_storage enable row level security;

create policy "Users can manage their own hour cost calcs"
  on public.hour_rate_storage for all
  using (auth.uid() = workshop_id)
  with check (auth.uid() = workshop_id);
