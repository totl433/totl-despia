-- ============================================
-- Branded Leaderboards System
-- ============================================
-- Tables for influencer/brand leaderboards,
-- memberships, subscriptions, join codes,
-- payouts, revenue events, and metrics.

-- ============================================
-- 0. Add is_admin to users
-- ============================================
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- ============================================
-- 1. branded_leaderboards
-- ============================================
CREATE TABLE IF NOT EXISTS branded_leaderboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE NOT NULL,
  header_image_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'unlisted')),
  price_type TEXT NOT NULL DEFAULT 'free' CHECK (price_type IN ('free', 'paid')),
  season_price_cents INTEGER DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP',
  revenue_share_pct NUMERIC(5,2) DEFAULT 0,
  payout_owner_id UUID REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  season TEXT NOT NULL DEFAULT '2025-26',
  start_gw INTEGER,
  rc_offering_id TEXT,
  rc_entitlement_id TEXT,
  rc_product_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE branded_leaderboards
  ADD COLUMN IF NOT EXISTS header_image_url TEXT,
  ADD COLUMN IF NOT EXISTS revenue_share_pct NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS start_gw INTEGER,
  ADD COLUMN IF NOT EXISTS rc_offering_id TEXT,
  ADD COLUMN IF NOT EXISTS rc_entitlement_id TEXT,
  ADD COLUMN IF NOT EXISTS rc_product_id TEXT;

-- ============================================
-- 2. branded_leaderboard_hosts
-- ============================================
CREATE TABLE IF NOT EXISTS branded_leaderboard_hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES branded_leaderboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(leaderboard_id, user_id)
);

-- ============================================
-- 3. branded_leaderboard_memberships
-- ============================================
CREATE TABLE IF NOT EXISTS branded_leaderboard_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES branded_leaderboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  source TEXT DEFAULT 'join_code' CHECK (source IN ('join_code', 'deep_link', 'discovery', 'admin')),
  UNIQUE(leaderboard_id, user_id)
);

-- ============================================
-- 4. branded_leaderboard_subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS branded_leaderboard_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES branded_leaderboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rc_subscription_id TEXT,
  rc_product_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'billing_retry')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. branded_leaderboard_join_codes
-- ============================================
CREATE TABLE IF NOT EXISTS branded_leaderboard_join_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  leaderboard_id UUID NOT NULL REFERENCES branded_leaderboards(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. branded_leaderboard_broadcast_messages
-- ============================================
CREATE TABLE IF NOT EXISTS branded_leaderboard_broadcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES branded_leaderboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'host' CHECK (message_type IN ('host', 'system')),
  seed_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bl_broadcast_seed_unique
  ON branded_leaderboard_broadcast_messages(leaderboard_id, seed_key)
  WHERE seed_key IS NOT NULL;

-- ============================================
-- 7. branded_leaderboard_broadcast_reads
-- ============================================
CREATE TABLE IF NOT EXISTS branded_leaderboard_broadcast_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES branded_leaderboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(leaderboard_id, user_id)
);

-- ============================================
-- 8. branded_leaderboard_broadcast_reactions
-- ============================================
CREATE TABLE IF NOT EXISTS branded_leaderboard_broadcast_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES branded_leaderboards(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES branded_leaderboard_broadcast_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);

-- ============================================
-- 9. payouts
-- ============================================
CREATE TABLE IF NOT EXISTS branded_leaderboard_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES branded_leaderboards(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.users(id),
  period TEXT NOT NULL,
  gross_revenue_cents INTEGER NOT NULL DEFAULT 0,
  net_revenue_cents INTEGER NOT NULL DEFAULT 0,
  totl_share_cents INTEGER NOT NULL DEFAULT 0,
  influencer_share_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'held')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. revenue_events
-- ============================================
CREATE TABLE IF NOT EXISTS branded_leaderboard_revenue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES branded_leaderboards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('purchase', 'renewal', 'cancellation', 'refund')),
  rc_event_id TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. leaderboard_metrics
-- ============================================
CREATE TABLE IF NOT EXISTS branded_leaderboard_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id UUID NOT NULL REFERENCES branded_leaderboards(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,
  visits INTEGER NOT NULL DEFAULT 0,
  joins INTEGER NOT NULL DEFAULT 0,
  paid_conversions INTEGER NOT NULL DEFAULT 0,
  active_predictors INTEGER NOT NULL DEFAULT 0,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(leaderboard_id, period, period_start)
);

-- ============================================
-- Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_bl_slug ON branded_leaderboards(slug);
CREATE INDEX IF NOT EXISTS idx_bl_status ON branded_leaderboards(status);
CREATE INDEX IF NOT EXISTS idx_bl_visibility ON branded_leaderboards(visibility);
CREATE INDEX IF NOT EXISTS idx_bl_rc_product_id ON branded_leaderboards(rc_product_id);

CREATE INDEX IF NOT EXISTS idx_bl_hosts_leaderboard ON branded_leaderboard_hosts(leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_bl_hosts_user ON branded_leaderboard_hosts(user_id);

CREATE INDEX IF NOT EXISTS idx_bl_memberships_leaderboard ON branded_leaderboard_memberships(leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_bl_memberships_user ON branded_leaderboard_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_bl_memberships_active ON branded_leaderboard_memberships(user_id) WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_bl_subscriptions_leaderboard ON branded_leaderboard_subscriptions(leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_bl_subscriptions_user ON branded_leaderboard_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_bl_subscriptions_active ON branded_leaderboard_subscriptions(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_bl_subscriptions_rc ON branded_leaderboard_subscriptions(rc_subscription_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bl_subscriptions_rc_unique
  ON branded_leaderboard_subscriptions(rc_subscription_id)
  WHERE rc_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bl_join_codes_code ON branded_leaderboard_join_codes(code);
CREATE INDEX IF NOT EXISTS idx_bl_join_codes_leaderboard ON branded_leaderboard_join_codes(leaderboard_id);

CREATE INDEX IF NOT EXISTS idx_bl_broadcast_messages_leaderboard_created
  ON branded_leaderboard_broadcast_messages(leaderboard_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bl_broadcast_messages_user
  ON branded_leaderboard_broadcast_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_bl_broadcast_reads_user_leaderboard
  ON branded_leaderboard_broadcast_reads(user_id, leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_bl_broadcast_reactions_leaderboard_message
  ON branded_leaderboard_broadcast_reactions(leaderboard_id, message_id);
CREATE INDEX IF NOT EXISTS idx_bl_broadcast_reactions_user
  ON branded_leaderboard_broadcast_reactions(user_id);

CREATE INDEX IF NOT EXISTS idx_bl_payouts_leaderboard ON branded_leaderboard_payouts(leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_bl_revenue_events_leaderboard ON branded_leaderboard_revenue_events(leaderboard_id);
CREATE INDEX IF NOT EXISTS idx_bl_metrics_leaderboard ON branded_leaderboard_metrics(leaderboard_id, period, period_start);

-- ============================================
-- Enable RLS
-- ============================================
ALTER TABLE branded_leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE branded_leaderboard_hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE branded_leaderboard_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE branded_leaderboard_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE branded_leaderboard_join_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE branded_leaderboard_broadcast_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE branded_leaderboard_broadcast_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE branded_leaderboard_broadcast_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE branded_leaderboard_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE branded_leaderboard_revenue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE branded_leaderboard_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies
-- ============================================

-- branded_leaderboards: anyone authenticated can read active/public, admins can write
CREATE POLICY "Anyone can read active branded leaderboards" ON branded_leaderboards
  FOR SELECT USING (
    status = 'active' AND visibility IN ('public', 'unlisted')
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can insert branded leaderboards" ON branded_leaderboards
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can update branded leaderboards" ON branded_leaderboards
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can delete branded leaderboards" ON branded_leaderboards
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- branded_leaderboard_hosts: anyone can read, admins can write
CREATE POLICY "Anyone can read hosts" ON branded_leaderboard_hosts
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage hosts" ON branded_leaderboard_hosts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- branded_leaderboard_memberships: users can read their own and leaderboard members, users can insert/update their own
CREATE POLICY "Users can read memberships" ON branded_leaderboard_memberships
  FOR SELECT USING (true);

CREATE POLICY "Users can join leaderboards" ON branded_leaderboard_memberships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own membership" ON branded_leaderboard_memberships
  FOR UPDATE USING (auth.uid() = user_id);

-- branded_leaderboard_subscriptions: users can read own, system/admin writes
CREATE POLICY "Users can read own subscriptions" ON branded_leaderboard_subscriptions
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can manage subscriptions" ON branded_leaderboard_subscriptions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- branded_leaderboard_join_codes: admins manage, users can read active codes
CREATE POLICY "Users can read active join codes" ON branded_leaderboard_join_codes
  FOR SELECT USING (active = TRUE);

CREATE POLICY "Admins can manage join codes" ON branded_leaderboard_join_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- branded_leaderboard_broadcast_messages: members/hosts/admin can read, only hosts/admin can insert
CREATE POLICY "Members can read branded broadcast messages" ON branded_leaderboard_broadcast_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM branded_leaderboard_memberships m
      WHERE m.leaderboard_id = branded_leaderboard_broadcast_messages.leaderboard_id
        AND m.user_id = auth.uid()
        AND m.left_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM branded_leaderboard_hosts h
      WHERE h.leaderboard_id = branded_leaderboard_broadcast_messages.leaderboard_id
        AND h.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Hosts can insert branded broadcast messages" ON branded_leaderboard_broadcast_messages
  FOR INSERT WITH CHECK (
    (
      auth.uid() = user_id
      AND message_type = 'host'
      AND EXISTS (
        SELECT 1
        FROM branded_leaderboard_hosts h
        WHERE h.leaderboard_id = branded_leaderboard_broadcast_messages.leaderboard_id
          AND h.user_id = auth.uid()
      )
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- branded_leaderboard_broadcast_reads: members/hosts/admin can read, users manage their own read state
CREATE POLICY "Users can read branded broadcast reads" ON branded_leaderboard_broadcast_reads
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Users can insert branded broadcast reads" ON branded_leaderboard_broadcast_reads
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1
        FROM branded_leaderboard_memberships m
        WHERE m.leaderboard_id = branded_leaderboard_broadcast_reads.leaderboard_id
          AND m.user_id = auth.uid()
          AND m.left_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM branded_leaderboard_hosts h
        WHERE h.leaderboard_id = branded_leaderboard_broadcast_reads.leaderboard_id
          AND h.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update branded broadcast reads" ON branded_leaderboard_broadcast_reads
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- branded_leaderboard_broadcast_reactions: viewers can read, users manage their own reactions
CREATE POLICY "Users can read branded broadcast reactions" ON branded_leaderboard_broadcast_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM branded_leaderboard_memberships m
      WHERE m.leaderboard_id = branded_leaderboard_broadcast_reactions.leaderboard_id
        AND m.user_id = auth.uid()
        AND m.left_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM branded_leaderboard_hosts h
      WHERE h.leaderboard_id = branded_leaderboard_broadcast_reactions.leaderboard_id
        AND h.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Users can insert own branded broadcast reactions" ON branded_leaderboard_broadcast_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM branded_leaderboard_broadcast_messages m
      WHERE m.id = branded_leaderboard_broadcast_reactions.message_id
        AND m.leaderboard_id = branded_leaderboard_broadcast_reactions.leaderboard_id
    )
    AND (
      EXISTS (
        SELECT 1
        FROM branded_leaderboard_memberships m
        WHERE m.leaderboard_id = branded_leaderboard_broadcast_reactions.leaderboard_id
          AND m.user_id = auth.uid()
          AND m.left_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM branded_leaderboard_hosts h
        WHERE h.leaderboard_id = branded_leaderboard_broadcast_reactions.leaderboard_id
          AND h.user_id = auth.uid()
      )
      OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
    )
  );

CREATE POLICY "Users can delete own branded broadcast reactions" ON branded_leaderboard_broadcast_reactions
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- branded_leaderboard_payouts: admin only
CREATE POLICY "Admins can manage payouts" ON branded_leaderboard_payouts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- branded_leaderboard_revenue_events: admin only
CREATE POLICY "Admins can manage revenue events" ON branded_leaderboard_revenue_events
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- branded_leaderboard_metrics: admin only
CREATE POLICY "Admins can manage metrics" ON branded_leaderboard_metrics
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ============================================
-- Storage bucket for header images
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('branded-leaderboard-headers', 'branded-leaderboard-headers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read leaderboard headers" ON storage.objects
  FOR SELECT USING (bucket_id = 'branded-leaderboard-headers');

CREATE POLICY "Admins can upload leaderboard headers" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'branded-leaderboard-headers'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can update leaderboard headers" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'branded-leaderboard-headers'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Admins can delete leaderboard headers" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'branded-leaderboard-headers'
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE branded_leaderboards IS 'Influencer/brand leaderboards with pricing and RevenueCat integration';
COMMENT ON TABLE branded_leaderboard_hosts IS 'Host accounts attached to branded leaderboards';
COMMENT ON TABLE branded_leaderboard_memberships IS 'User memberships in branded leaderboards';
COMMENT ON TABLE branded_leaderboard_subscriptions IS 'Paid subscription records synced with RevenueCat';
COMMENT ON TABLE branded_leaderboard_join_codes IS 'Join codes for branded leaderboard access';
COMMENT ON TABLE branded_leaderboard_broadcast_messages IS 'Host-authored and system broadcast messages for branded leaderboards';
COMMENT ON TABLE branded_leaderboard_broadcast_reads IS 'Per-user read cursor for branded leaderboard broadcast messages';
COMMENT ON TABLE branded_leaderboard_broadcast_reactions IS 'Per-user emoji reactions for branded leaderboard broadcast messages';
COMMENT ON TABLE branded_leaderboard_payouts IS 'Payout records for influencer revenue share';
COMMENT ON TABLE branded_leaderboard_revenue_events IS 'Individual revenue events from RevenueCat webhooks';
COMMENT ON TABLE branded_leaderboard_metrics IS 'Aggregated performance metrics per leaderboard';
