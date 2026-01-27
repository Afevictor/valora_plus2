create table if not exists public.company_profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  company_name text,
  cif text,
  address text,
  city text,
  zip_code text,
  province text,
  email text,
  phone text,
  coste_hora numeric,
  pvp_mano_obra numeric,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS
alter table public.company_profiles enable row level security;

create policy "Users can view their own profile"
  on public.company_profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.company_profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.company_profiles for insert
  with check (auth.uid() = id);
