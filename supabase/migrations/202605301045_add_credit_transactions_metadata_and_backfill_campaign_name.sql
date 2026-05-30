-- Permanent campaign-name snapshot for billing/audit history.
-- Ensures Finance → Campaign Usage can display the original campaign name
-- even after the campaign row is deleted.

alter table if exists public.credit_transactions
  add column if not exists campaign_name text;

alter table if exists public.credit_transactions
  add column if not exists metadata jsonb;

update public.credit_transactions
set metadata = '{}'::jsonb
where metadata is null;

-- Backfill from existing campaigns where possible.
-- If the campaign row is already deleted, the name cannot be recovered automatically.
update public.credit_transactions as ct
set campaign_name = c.campaign_name
from public.campaigns as c
where ct.campaign_id = c.id
  and (ct.campaign_name is null or ct.campaign_name = '')
  and c.campaign_name is not null
  and c.campaign_name <> '';

update public.credit_transactions as ct
set metadata = jsonb_set(ct.metadata, '{campaign_name}', to_jsonb(c.campaign_name), true)
from public.campaigns as c
where ct.campaign_id = c.id
  and (ct.metadata->>'campaign_name' is null or ct.metadata->>'campaign_name' = '')
  and c.campaign_name is not null
  and c.campaign_name <> '';

-- If campaign_name column is already populated, mirror it into metadata for consistency.
update public.credit_transactions
set metadata = jsonb_set(metadata, '{campaign_name}', to_jsonb(campaign_name), true)
where campaign_name is not null
  and campaign_name <> ''
  and (metadata->>'campaign_name' is null or metadata->>'campaign_name' = '');

create index if not exists credit_transactions_user_campaign_usage_idx
  on public.credit_transactions (user_id, campaign_id, created_at desc)
  where type = 'usage' and status = 'completed';

