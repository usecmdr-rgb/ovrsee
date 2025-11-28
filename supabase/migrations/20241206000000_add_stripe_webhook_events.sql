-- Track processed Stripe webhook events for idempotency
create table if not exists public.stripe_webhook_events (
  id text primary key,
  created_at timestamptz default now()
);











