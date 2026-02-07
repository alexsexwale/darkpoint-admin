import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { cjDropshipping } from '@/lib/cjdropshipping';

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
      .select('id, tracking_number, cj_orders(cj_tracking_number)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const cjOrders = (order as { cj_orders?: Array<{ cj_tracking_number: string | null }> }).cj_orders;
    const cjTracking = cjOrders?.[0]?.cj_tracking_number;
    const orderTracking = (order as { tracking_number?: string | null }).tracking_number;
    const trackNumber = (cjTracking || orderTracking || '').trim();

    if (!trackNumber) {
      return NextResponse.json(
        { success: false, error: 'No tracking number available for this order' },
        { status: 400 }
      );
    }

    const result = await cjDropshipping.getTrackInfo(trackNumber);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to fetch tracking from CJ' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      trackNumber,
    });
  } catch (err) {
    console.error('CJ tracking API error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
