import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { env } from '@/config/env';

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

    let customerEmail: string | null = (order as { billing_email?: string | null }).billing_email ?? null;
    const userId = (order as { user_id?: string | null }).user_id;
    if (userId && !customerEmail) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      customerEmail = authUser?.user?.email ?? null;
    }
    const customerName = ((order as { billing_name?: string | null }).billing_name || 'Customer').trim() || 'Customer';
    const orderNumber = (order as { order_number: string }).order_number;

    let emailSent = false;
    const secret = env.app.orderStatusEmailSecret;
    const storeUrl = (env.app.mainSiteUrl || '').replace(/\/$/, '');

    if (customerEmail && secret && storeUrl) {
      try {
        const res = await fetch(`${storeUrl}/api/internal/order-status-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-order-status-secret': secret,
          },
          body: JSON.stringify({
            orderId,
            orderNumber,
            newStatus: status,
            customerEmail,
            customerName,
          }),
        });
        emailSent = res.ok;
        if (!res.ok) {
          const text = await res.text();
          console.error('Order status email request failed:', res.status, text);
        }
      } catch (err) {
        console.error('Order status email request error:', err);
      }
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
