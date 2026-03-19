-- Update collectes table to add frequency and alternating weeks support
-- Run this script in Supabase SQL editor.

alter table if exists public.collectes
add column if not exists frequence text default 'weekly' check (frequence in ('weekly', 'biweekly', 'monthly'));

alter table if exists public.collectes
add column if not exists semaines_alternees text check (semaines_alternees in ('A', 'B'));

-- Add comment for clarity
comment on column public.collectes.frequence is 'Collection frequency: weekly, biweekly (every 2 weeks), or monthly (every 4 weeks)';
comment on column public.collectes.semaines_alternees is 'For biweekly collections: A (odd weeks) or B (even weeks). Null for weekly/monthly.';

-- Update existing rows to have 'weekly' as default
update public.collectes set frequence = 'weekly' where frequence is null;
