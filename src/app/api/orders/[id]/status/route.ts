import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { sendOrderStatusEmail } from '@/lib/orderStatusEmail';

const ALLOWED_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] as const;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await context.params;
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Order ID required' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const status = typeof body.status === 'string' ? body.status.toLowerCase().trim() : '';
    if (!status || !ALLOWED_STATUSES.includes(status as typeof ALLOWED_STATUSES[number])) {
      return NextResponse.json(
        { success: false, error: 'Valid status required: ' + ALLOWED_STATUSES.join(', ') },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, status, shipped_at, delivered_at, user_id, billing_email, billing_name, order_number')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const currentStatus = (order as { status: string }).status;
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === 'shipped' && !(order as { shipped_at?: string | null }).shipped_at) {
      updates.shipped_at = new Date().toISOString();
    }
    if (status === 'delivered' && !(order as { delivered_at?: string | null }).delivered_at) {
      updates.delivered_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId);

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    let emailSent = false;
    if (currentStatus !== status) {
      emailSent = await sendOrderStatusEmail(orderId, status);
    }

    return NextResponse.json({
      success: true,
      emailSent,
    });
  } catch (err) {
    console.error('Order status update error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
