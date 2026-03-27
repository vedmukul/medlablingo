-- MedLabLingo: Supabase Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- analyses table: stores each uploaded document's results
create table if not exists analyses (
  id uuid default gen_random_uuid() primary key,
  device_id text not null,
  document_type text not null,
  reading_level text not null,
  extraction_preview text,
  result jsonb,
  request_id text,
  created_at timestamptz default now()
);

-- Index for fast device-based lookups
create index if not exists idx_analyses_device on analyses(device_id, created_at desc);

-- Enable RLS
alter table analyses enable row level security;

-- Policy: anyone can insert (anonymous devices)
create policy "Allow anonymous inserts"
  on analyses for insert
  with check (true);

-- Policy: devices can read their own rows
create policy "Devices read own analyses"
  on analyses for select
  using (device_id = coalesce(current_setting('request.headers', true)::json->>'x-device-id', ''));
