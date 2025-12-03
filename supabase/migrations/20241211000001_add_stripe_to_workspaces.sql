-- Add Stripe billing fields to workspaces table
-- This migration adds Stripe customer and subscription IDs to workspaces for team billing

ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Index for Stripe customer lookup
CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_customer_id ON workspaces(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_stripe_subscription_id ON workspaces(stripe_subscription_id);

-- Add comment
COMMENT ON COLUMN workspaces.stripe_customer_id IS 'Stripe customer ID for workspace billing';
COMMENT ON COLUMN workspaces.stripe_subscription_id IS 'Stripe subscription ID for workspace team seats';



