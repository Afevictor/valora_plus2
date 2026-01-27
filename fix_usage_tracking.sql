-- Table to track usage of Analytics/AI features
create table if not exists public.analysis_usage_log (
  id uuid default gen_random_uuid() primary key,
  workshop_id uuid references auth.users(id) on delete cascade not null,
  report_type text default 'profitability', -- e.g. 'profitability', 'damage_assessment'
  created_at timestamptz default now()
);

alter table public.analysis_usage_log enable row level security;

-- Policies
create policy "Users can view their own usage logs"
  on public.analysis_usage_log for select
  using (auth.uid() = workshop_id);

create policy "Users can insert their own usage logs"
  on public.analysis_usage_log for insert
  with check (auth.uid() = workshop_id);

-- Optional: Index for faster counting
create index if not exists idx_analysis_usage_workshop_date 
  on public.analysis_usage_log (workshop_id, created_at);
