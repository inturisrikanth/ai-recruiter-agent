-- Preserve campaign identity in immutable billing history.
-- This allows Finance lifetime metrics and Campaign Usage to remain stable
-- even if campaigns (and their call rows) are later deleted.

alter table if exists public.credit_transactions
  add column if not exists campaign_name text;

-- Optional but helpful for per-campaign usage lookups.
create index if not exists credit_transactions_user_campaign_usage_idx
  on public.credit_transactions (user_id, campaign_id, created_at desc)
  where type = 'usage' and status = 'completed';

