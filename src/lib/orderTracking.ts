import { createServerClient } from '@/lib/supabase';
import { cjDropshipping } from '@/lib/cjdropshipping';
import type { OrderStatus } from '@/types';

const CJ_TRACKING_BASE_URL = 'https://www.cjpacket.com/?trackingNumber=';

export type OrderTrackingStage =
  | 'processing'
  | 'dispatched'
  | 'en_route'
  | 'arrived_courier_facility'
  | 'out_for_delivery'
  | 'available_for_pickup'
  | 'unsuccessful_delivery'
  | 'delivered';

/** Map tracking_stage to orders.status (forward-only semantics; caller checks isForwardStatusTransition). */
export function mapTrackingStageToOrderStatus(
  stage: OrderTrackingStage | null | undefined
): 'processing' | 'shipped' | 'delivered' | null {
  if (!stage) return null;
  if (stage === 'delivered') return 'delivered';
  if (
    stage === 'dispatched' ||
    stage === 'en_route' ||
    stage === 'arrived_courier_facility' ||
    stage === 'out_for_delivery' ||
    stage === 'available_for_pickup' ||
    stage === 'unsuccessful_delivery'
  ) {
    return 'shipped';
  }
  if (stage === 'processing') return 'processing';
  return null;
}

/** Allow only forward transitions from tracking; never overwrite cancelled/refunded. */
export function isForwardStatusTransition(
  current: OrderStatus,
  next: OrderStatus
): boolean {
  if (current === next) return false;
  const terminal: OrderStatus[] = ['cancelled', 'refunded'];
  if (terminal.includes(current)) return false;
  const order: Record<string, number> = { pending: 0, processing: 1, shipped: 2, delivered: 3 };
  const c = order[current];
  const n = order[next];
  if (c === undefined || n === undefined) return false;
  return n > c;
}

function mapCjStatusToStage(cjStatus: string | null | undefined): OrderTrackingStage | null {
  if (!cjStatus || typeof cjStatus !== 'string') return null;
  const s = cjStatus.toLowerCase().trim();
  if (s.includes('delivered') || s === 'delivered') return 'delivered';
  if (s.includes('unsuccessful') || s.includes('failed') || s.includes('failure')) return 'unsuccessful_delivery';
  if (s.includes('pickup') || s.includes('pick up') || s.includes('available')) return 'available_for_pickup';
  if (s.includes('out for delivery')) return 'out_for_delivery';
  if (s.includes('arrived') || s.includes('courier') || s.includes('facility')) return 'arrived_courier_facility';
  if (s.includes('en route') || s.includes('in transit') || s.includes('transit')) return 'en_route';
  if (s.includes('dispatched') || s.includes('shipped')) return 'dispatched';
  if (s.includes('processing') || s.includes('created') || s.includes('pending')) return 'processing';
  return null;
}

export interface RefreshOrderTrackingResult {
  success: boolean;
  error?: string;
  data?: Array<{
    trackingNumber: string;
    logisticName: string;
    trackingFrom: string;
    trackingTo: string;
    deliveryDay: string;
    deliveryTime: string;
    trackingStatus: string;
    lastMileCarrier: string;
    lastTrackNumber: string;
  }>;
  trackNumber?: string;
  trackingUrl?: string;
  saved?: boolean;
  /** Set when tracking was upserted; cron uses this to sync orders.status. */
  trackingStage?: OrderTrackingStage | null;
}

/**
 * Refresh CJ tracking for an order and upsert into order_tracking.
 * Used by GET /api/orders/[id]/cj-tracking and by the cleanup cron.
 */
export async function refreshOrderTracking(orderId: string): Promise<RefreshOrderTrackingResult> {
  try {
    const supabase = createServerClient();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, tracking_number, tracking_url, cj_orders(id, cj_order_id, cj_tracking_number)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return { success: false, error: 'Order not found' };
    }

    const cjOrders = (order as {
      cj_orders?: Array<{ id: string; cj_order_id: string | null; cj_tracking_number: string | null }>;
    }).cj_orders;
    const cjOrder = cjOrders?.[0];
    const cjTracking = cjOrder?.cj_tracking_number;
    const orderTracking = (order as { tracking_number?: string | null }).tracking_number;
    const orderTrackingUrl = (order as { tracking_url?: string | null }).tracking_url;
    let trackNumber = (cjTracking || orderTracking || '').trim();
    let trackingUrl = (orderTrackingUrl || '').trim();
    let saved = false;

    if (!trackNumber && cjOrder?.cj_order_id) {
      const detailResult = await cjDropshipping.getOrderDetail(cjOrder.cj_order_id);
      if (detailResult.success && detailResult.data) {
        const tn = (detailResult.data.trackNumber || '').trim();
        const tu = (detailResult.data.trackingUrl || '').trim();
        if (tn) {
          trackNumber = tn;
          trackingUrl = tu || `${CJ_TRACKING_BASE_URL}${encodeURIComponent(tn)}`;
          const { error: updateOrderError } = await supabase
            .from('orders')
            .update({
              tracking_number: trackNumber,
              tracking_url: trackingUrl || null,
            })
            .eq('id', orderId);
          if (!updateOrderError && cjOrder.id) {
            await supabase
              .from('cj_orders')
              .update({ cj_tracking_number: trackNumber })
              .eq('id', cjOrder.id);
          }
          saved = true;
        }
      }
    } else if (trackNumber && !trackingUrl) {
      trackingUrl = `${CJ_TRACKING_BASE_URL}${encodeURIComponent(trackNumber)}`;
    }

    if (!trackNumber) {
      return {
        success: false,
        error:
          'No tracking number yet. CJ has not assigned a tracking number for this order. Try again later once the order is shipped.',
      };
    }

    const result = await cjDropshipping.getTrackInfo(trackNumber);

    if (!result.success) {
      return { success: false, error: result.error || 'Failed to fetch tracking from CJ' };
    }

    const first = result.data?.[0];
    if (first && orderId) {
      const trackingStage = mapCjStatusToStage(first.trackingStatus);
      const row = {
        order_id: orderId,
        tracking_number: first.trackingNumber || trackNumber,
        logistic_name: first.logisticName || null,
        tracking_from: first.trackingFrom || null,
        tracking_to: first.trackingTo || null,
        delivery_day: first.deliveryDay || null,
        delivery_time: first.deliveryTime || null,
        tracking_status: first.trackingStatus || null,
        tracking_stage: trackingStage,
        last_mile_carrier: first.lastMileCarrier || null,
        last_track_number: first.lastTrackNumber || null,
      };
      await supabase.from('order_tracking').upsert(row, {
        onConflict: 'order_id',
        ignoreDuplicates: false,
      });
    }

    const trackingStage = first ? mapCjStatusToStage(first.trackingStatus) : null;
    return {
      success: true,
      data: result.data,
      trackNumber,
      trackingUrl: trackingUrl || undefined,
      saved,
      trackingStage,
    };
  } catch (err) {
    console.error('refreshOrderTracking error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Internal error',
    };
  }
}
