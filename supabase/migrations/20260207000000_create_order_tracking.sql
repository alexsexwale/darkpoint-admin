-- CJ tracking info snapshot per order (saved each time "View CJ tracking" is used).
-- Links to orders; one row per order, updated on each fetch from CJ.
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

-- Index for listing by updated_at (optional)
CREATE INDEX IF NOT EXISTS idx_order_tracking_updated_at ON order_tracking(updated_at DESC);

-- Trigger to refresh updated_at on change
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
