-- =============================================================================
-- Run this SQL in your Supabase SQL Editor (or any PostgreSQL client) to create
-- the order_tracking table. CJ tracking data is saved here every time you click
-- "View CJ tracking" on an order details page.
-- =============================================================================

-- Table: one row per order, linked via order_id (FK to orders).
CREATE TABLE IF NOT EXISTS order_tracking (
  order_id UUID NOT NULL PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,
  logistic_name TEXT,
  tracking_from TEXT,
  tracking_to TEXT,
  delivery_day TEXT,
  delivery_time TEXT,
  tracking_status TEXT,
  last_mile_carrier TEXT,
  last_track_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_tracking_updated_at ON order_tracking(updated_at DESC);

CREATE OR REPLACE FUNCTION set_order_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_tracking_updated_at ON order_tracking;
CREATE TRIGGER order_tracking_updated_at
  BEFORE UPDATE ON order_tracking
  FOR EACH ROW
  EXECUTE PROCEDURE set_order_tracking_updated_at();

COMMENT ON TABLE order_tracking IS 'CJ Dropshipping tracking snapshot; saved/updated when admin clicks View CJ tracking.';

-- If you use Row Level Security (RLS) on public tables, add a policy so the app can read/write:
-- ALTER TABLE order_tracking ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Service role can manage order_tracking" ON order_tracking FOR ALL USING (true) WITH CHECK (true);
