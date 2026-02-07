-- Tracking stages matching the order tracking pipeline (Processing → Delivered).
-- Use this enum so the database can match the tracking UI stages.
CREATE TYPE order_tracking_stage AS ENUM (
  'processing',
  'dispatched',
  'en_route',
  'arrived_courier_facility',
  'out_for_delivery',
  'available_for_pickup',
  'unsuccessful_delivery',
  'delivered'
);

-- Add column to order_tracking (nullable so existing rows and unknown CJ statuses are valid).
ALTER TABLE order_tracking
  ADD COLUMN IF NOT EXISTS tracking_stage order_tracking_stage;

COMMENT ON COLUMN order_tracking.tracking_stage IS 'Canonical stage in the delivery pipeline; mapped from CJ trackingStatus when saving.';
