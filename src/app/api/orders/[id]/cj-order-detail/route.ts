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
      .select('id, cj_orders(cj_order_id)')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const cjOrders = (order as { cj_orders?: Array<{ cj_order_id: string | null }> }).cj_orders;
    const cjOrderId = cjOrders?.[0]?.cj_order_id?.trim();

    if (!cjOrderId) {
      return NextResponse.json(
        { success: false, error: 'This order has not been placed with CJ Dropshipping' },
        { status: 400 }
      );
    }

    const result = await cjDropshipping.getOrderDetail(cjOrderId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to fetch order detail from CJ' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });
  } catch (err) {
    console.error('CJ order detail API error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
