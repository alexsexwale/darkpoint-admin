import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { cjDropshipping } from '@/lib/cjdropshipping';

const CJ_TRACKING_BASE_URL = 'https://www.cjpacket.com/?trackingNumber=';

/** Canonical tracking stages matching the order tracking pipeline UI. */
export type OrderTrackingStage =
  | 'processing'
  | 'dispatched'
  | 'en_route'
  | 'arrived_courier_facility'
  | 'out_for_delivery'
  | 'available_for_pickup'
  | 'unsuccessful_delivery'
  | 'delivered';

/**
 * Map CJ trackingStatus (free text) to our canonical order_tracking_stage enum.
 * Keeps raw tracking_status in DB; tracking_stage is for pipeline display/counts.
 */
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context.params;
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Order ID required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, tracking_number, tracking_url, cj_orders(id, cj_order_id, cj_tracking_number)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
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

    // If no tracking stored, pull from CJ order details and save (only when admin hasn't entered it)
    if (!trackNumber && cjOrder?.cj_order_id) {
      const detailResult = await cjDropshipping.getOrderDetail(cjOrder.cj_order_id);
      if (detailResult.success && detailResult.data) {
        const tn = (detailResult.data.trackNumber || '').trim();
        const tu = (detailResult.data.trackingUrl || '').trim();
        if (tn) {
          trackNumber = tn;
          trackingUrl = tu || `${CJ_TRACKING_BASE_URL}${encodeURIComponent(tn)}`;
          // Save to DB
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
      return NextResponse.json(
        {
          success: false,
          error:
            'No tracking number yet. CJ has not assigned a tracking number for this order. Try again later once the order is shipped.',
        },
        { status: 200 }
      );
    }

    const result = await cjDropshipping.getTrackInfo(trackNumber);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to fetch tracking from CJ' },
        { status: 502 }
      );
    }

    // Save tracking snapshot to order_tracking (upsert by order_id)
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

    return NextResponse.json({
      success: true,
      data: result.data,
      trackNumber,
      trackingUrl: trackingUrl || undefined,
      saved,
    });
  } catch (err) {
    console.error('CJ tracking API error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
