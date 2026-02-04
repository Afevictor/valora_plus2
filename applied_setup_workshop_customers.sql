-- Table: workshop_customers
-- Purpose: Store end-customers for each workshop, distinct from the system 'clients' (which are App Users/Workshops).

create table if not exists public.workshop_customers (
  id uuid default gen_random_uuid() primary key,
  workshop_id uuid references auth.users(id) not null,
  full_name text not null,
  phone text,
  email text,
  tax_id text, -- DNI/NIF/CIF
  address text,
  city text,
  province text,
  postal_code text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes
create index if not exists idx_workshop_customers_workshop_id on public.workshop_customers(workshop_id);
create index if not exists idx_workshop_customers_name on public.workshop_customers(full_name);

-- RLS
alter table public.workshop_customers enable row level security;

-- Policy: Workshops can only see their own customers
create policy "Workshops can view own customers"
  on public.workshop_customers for select
  using (auth.uid() = workshop_id);

-- Policy: Workshops can insert their own customers
create policy "Workshops can insert own customers"
  on public.workshop_customers for insert
  with check (auth.uid() = workshop_id);

-- Policy: Workshops can update their own customers
create policy "Workshops can update own customers"
  on public.workshop_customers for update
  using (auth.uid() = workshop_id);

-- Policy: Workshops can delete their own customers
create policy "Workshops can delete own customers"
  on public.workshop_customers for delete
  using (auth.uid() = workshop_id);

-- Grant permissions
grant all on public.workshop_customers to authenticated;
grant all on public.workshop_customers to service_role;
